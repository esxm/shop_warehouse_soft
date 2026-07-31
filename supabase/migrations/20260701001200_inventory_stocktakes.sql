begin;

create table public.inventory_stocktakes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  stocktake_date date not null,
  warehouse_actual_value_ron numeric(18, 2) not null,
  shop_actual_value_ron numeric(18, 2) not null,
  warehouse_expected_value_ron numeric(18, 2) not null,
  shop_expected_value_ron numeric(18, 2) not null,
  warehouse_difference_ron numeric(18, 2) not null,
  shop_difference_ron numeric(18, 2) not null,
  reason text not null,
  notes text,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint inventory_stocktakes_business_id_id_key
    unique (business_id, id),
  constraint inventory_stocktakes_idempotency_key
    unique (business_id, idempotency_key),
  constraint inventory_stocktakes_actual_nonnegative
    check (
      warehouse_actual_value_ron >= 0
      and shop_actual_value_ron >= 0
    ),
  constraint inventory_stocktakes_expected_nonnegative
    check (
      warehouse_expected_value_ron >= 0
      and shop_expected_value_ron >= 0
    ),
  constraint inventory_stocktakes_differences_consistent
    check (
      warehouse_difference_ron =
        warehouse_actual_value_ron - warehouse_expected_value_ron
      and shop_difference_ron =
        shop_actual_value_ron - shop_expected_value_ron
    ),
  constraint inventory_stocktakes_reason_valid
    check (char_length(btrim(reason)) between 10 and 500),
  constraint inventory_stocktakes_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  constraint inventory_stocktakes_reversal_consistent
    check (
      (
        reversed_at is null
        and reversed_by is null
        and reversal_reason is null
      )
      or (
        reversed_at is not null
        and reversed_by is not null
        and reversal_reason is not null
        and char_length(btrim(reversal_reason)) between 10 and 500
      )
    )
);

create index inventory_stocktakes_business_date_idx
  on public.inventory_stocktakes (
    business_id,
    stocktake_date desc,
    created_at desc
  );
create unique index inventory_value_movements_stocktake_location_key
  on public.inventory_value_movements (
    business_id,
    source_entity_id,
    (
      coalesce(source_location_id, destination_location_id)
    )
  )
  where source_entity_type = 'inventory_stocktake'
    and movement_type = 'inventory_stocktake_adjustment';

alter table public.inventory_stocktakes enable row level security;

create policy inventory_stocktakes_select_member
on public.inventory_stocktakes
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.inventory_stocktakes from anon, authenticated;
grant select on table public.inventory_stocktakes to authenticated;
grant all on table public.inventory_stocktakes to service_role;

create or replace function private.guard_inventory_value_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  location_to_lock uuid;
  source_balance numeric;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'Inventory value movements are immutable'
      using errcode = '55000';
  end if;

  for location_to_lock in
    select distinct location_id
    from pg_catalog.unnest(
      array[new.source_location_id, new.destination_location_id]
    ) as locked(location_id)
    where location_id is not null
    order by location_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        new.business_id::text || ':' || location_to_lock::text,
        9160
      )
    );
  end loop;

  if new.source_location_id is null then
    return new;
  end if;

  select coalesce(
    sum(
      case
        when movement.destination_location_id = new.source_location_id
          then movement.amount_ron
        when movement.source_location_id = new.source_location_id
          then -movement.amount_ron
        else 0
      end
    ),
    0
  )
  into source_balance
  from public.inventory_value_movements as movement
  where movement.business_id = new.business_id
    and (
      movement.destination_location_id = new.source_location_id
      or movement.source_location_id = new.source_location_id
    );

  if new.amount_ron > source_balance then
    raise exception 'Inventory movement exceeds source inventory value'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create function private.prevent_inventory_stocktake_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Inventory stocktakes are immutable; use a reversal'
      using errcode = '55000';
  end if;

  if old.reversed_at is not null then
    raise exception 'Reversed inventory stocktakes are immutable'
      using errcode = '55000';
  end if;

  if (
    to_jsonb(new)
      - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) <> (
    to_jsonb(old)
      - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) then
    raise exception 'Inventory stocktakes are immutable; use a reversal'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_inventory_stocktake_mutation()
  from public;

create trigger inventory_stocktakes_prevent_mutation
before update or delete on public.inventory_stocktakes
for each row
execute function private.prevent_inventory_stocktake_mutation();

create function public.create_inventory_stocktake(
  target_business_id uuid,
  target_stocktake_date date,
  target_warehouse_actual_value_ron text,
  target_shop_actual_value_ron text,
  target_reason text,
  target_notes text,
  target_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  parsed_warehouse_actual numeric;
  parsed_shop_actual numeric;
  normalized_reason text := nullif(btrim(target_reason), '');
  normalized_notes text := nullif(btrim(target_notes), '');
  warehouse_location_id uuid;
  shop_location_id uuid;
  location_to_lock uuid;
  warehouse_expected numeric;
  shop_expected numeric;
  warehouse_difference numeric;
  shop_difference numeric;
  request_fingerprint text;
  existing_stocktake_id uuid;
  existing_fingerprint text;
  new_stocktake_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if target_stocktake_date is null then
    raise exception 'Stocktake date is required'
      using errcode = '22023';
  end if;

  parsed_warehouse_actual := private.parse_nonnegative_ron_amount(
    target_warehouse_actual_value_ron,
    'Warehouse actual value'
  );
  parsed_shop_actual := private.parse_nonnegative_ron_amount(
    target_shop_actual_value_ron,
    'Shop actual value'
  );

  if normalized_reason is null
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Stocktake reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 500
  then
    raise exception 'Stocktake notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null then
    raise exception 'Stocktake request identifier is required'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'stocktake_date', target_stocktake_date,
      'warehouse_actual_value_ron', parsed_warehouse_actual,
      'shop_actual_value_ron', parsed_shop_actual,
      'reason', normalized_reason,
      'notes', normalized_notes
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9170
    )
  );

  select stocktake.id, stocktake.request_fingerprint
  into existing_stocktake_id, existing_fingerprint
  from public.inventory_stocktakes as stocktake
  where stocktake.business_id = target_business_id
    and stocktake.idempotency_key = target_idempotency_key;

  if existing_stocktake_id is not null then
    if existing_fingerprint is distinct from request_fingerprint then
      raise exception 'Stocktake request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_stocktake_id;
  end if;

  select location.id
  into warehouse_location_id
  from public.inventory_locations as location
  where location.business_id = target_business_id
    and location.type = 'warehouse'
    and location.is_active;

  select location.id
  into shop_location_id
  from public.inventory_locations as location
  where location.business_id = target_business_id
    and location.type = 'shop'
    and location.is_active;

  if warehouse_location_id is null or shop_location_id is null then
    raise exception 'Active warehouse and shop locations are required'
      using errcode = '55000';
  end if;

  for location_to_lock in
    select location_id
    from pg_catalog.unnest(
      array[warehouse_location_id, shop_location_id]
    ) as locked(location_id)
    order by location_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        target_business_id::text || ':' || location_to_lock::text,
        9160
      )
    );
  end loop;

  select coalesce(
    sum(
      case
        when movement.destination_location_id = warehouse_location_id
          then movement.amount_ron
        when movement.source_location_id = warehouse_location_id
          then -movement.amount_ron
        else 0
      end
    ),
    0
  )
  into warehouse_expected
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and (
      movement.destination_location_id = warehouse_location_id
      or movement.source_location_id = warehouse_location_id
    );

  select coalesce(
    sum(
      case
        when movement.destination_location_id = shop_location_id
          then movement.amount_ron
        when movement.source_location_id = shop_location_id
          then -movement.amount_ron
        else 0
      end
    ),
    0
  )
  into shop_expected
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and (
      movement.destination_location_id = shop_location_id
      or movement.source_location_id = shop_location_id
    );

  warehouse_difference := parsed_warehouse_actual - warehouse_expected;
  shop_difference := parsed_shop_actual - shop_expected;

  insert into public.inventory_stocktakes (
    business_id,
    stocktake_date,
    warehouse_actual_value_ron,
    shop_actual_value_ron,
    warehouse_expected_value_ron,
    shop_expected_value_ron,
    warehouse_difference_ron,
    shop_difference_ron,
    reason,
    notes,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    target_business_id,
    target_stocktake_date,
    parsed_warehouse_actual,
    parsed_shop_actual,
    warehouse_expected,
    shop_expected,
    warehouse_difference,
    shop_difference,
    normalized_reason,
    normalized_notes,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  )
  returning id into new_stocktake_id;

  if warehouse_difference > 0 then
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      destination_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      notes,
      created_by
    )
    values (
      target_business_id,
      target_stocktake_date,
      'inventory_stocktake_adjustment',
      warehouse_location_id,
      warehouse_difference,
      'inventory_stocktake',
      new_stocktake_id,
      'Inventory stocktake adjustment',
      current_user_id
    );
  elsif warehouse_difference < 0 then
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      source_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      notes,
      created_by
    )
    values (
      target_business_id,
      target_stocktake_date,
      'inventory_stocktake_adjustment',
      warehouse_location_id,
      abs(warehouse_difference),
      'inventory_stocktake',
      new_stocktake_id,
      'Inventory stocktake adjustment',
      current_user_id
    );
  end if;

  if shop_difference > 0 then
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      destination_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      notes,
      created_by
    )
    values (
      target_business_id,
      target_stocktake_date,
      'inventory_stocktake_adjustment',
      shop_location_id,
      shop_difference,
      'inventory_stocktake',
      new_stocktake_id,
      'Inventory stocktake adjustment',
      current_user_id
    );
  elsif shop_difference < 0 then
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      source_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      notes,
      created_by
    )
    values (
      target_business_id,
      target_stocktake_date,
      'inventory_stocktake_adjustment',
      shop_location_id,
      abs(shop_difference),
      'inventory_stocktake',
      new_stocktake_id,
      'Inventory stocktake adjustment',
      current_user_id
    );
  end if;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data,
    reason
  )
  values (
    target_business_id,
    current_user_id,
    'inventory_stocktake.created',
    'inventory_stocktake',
    new_stocktake_id,
    pg_catalog.jsonb_build_object(
      'stocktake_date', target_stocktake_date,
      'warehouse_expected_value_ron', warehouse_expected,
      'warehouse_actual_value_ron', parsed_warehouse_actual,
      'warehouse_difference_ron', warehouse_difference,
      'shop_expected_value_ron', shop_expected,
      'shop_actual_value_ron', parsed_shop_actual,
      'shop_difference_ron', shop_difference,
      'notes', normalized_notes
    ),
    normalized_reason
  );

  return new_stocktake_id;
end;
$$;

create function public.reverse_inventory_stocktake(
  target_business_id uuid,
  target_stocktake_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := nullif(btrim(target_reason), '');
  reversal_time timestamptz := pg_catalog.now();
  stocktake_to_reverse public.inventory_stocktakes%rowtype;
  adjustment public.inventory_value_movements%rowtype;
  location_to_lock uuid;
  reversal_count integer := 0;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if normalized_reason is null
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Reversal reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  select stocktake.*
  into stocktake_to_reverse
  from public.inventory_stocktakes as stocktake
  where stocktake.id = target_stocktake_id
    and stocktake.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Inventory stocktake does not exist'
      using errcode = '22023';
  end if;

  if stocktake_to_reverse.reversed_at is not null then
    raise exception 'Inventory stocktake is already reversed'
      using errcode = '55000';
  end if;

  for location_to_lock in
    select distinct coalesce(
      movement.source_location_id,
      movement.destination_location_id
    )
    from public.inventory_value_movements as movement
    where movement.business_id = target_business_id
      and movement.source_entity_type = 'inventory_stocktake'
      and movement.source_entity_id = target_stocktake_id
      and movement.movement_type = 'inventory_stocktake_adjustment'
    order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        target_business_id::text || ':' || location_to_lock::text,
        9160
      )
    );
  end loop;

  for adjustment in
    select movement.*
    from public.inventory_value_movements as movement
    where movement.business_id = target_business_id
      and movement.source_entity_type = 'inventory_stocktake'
      and movement.source_entity_id = target_stocktake_id
      and movement.movement_type = 'inventory_stocktake_adjustment'
    order by movement.id
    for update
  loop
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      source_location_id,
      destination_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      notes,
      created_by,
      reversal_of_id
    )
    values (
      target_business_id,
      stocktake_to_reverse.stocktake_date,
      'inventory_stocktake_reversal',
      adjustment.destination_location_id,
      adjustment.source_location_id,
      adjustment.amount_ron,
      'inventory_stocktake',
      target_stocktake_id,
      'Inventory stocktake reversal',
      current_user_id,
      adjustment.id
    );

    reversal_count := reversal_count + 1;
  end loop;

  update public.inventory_stocktakes
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_stocktake_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Inventory stocktake reversal lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_data,
    new_data,
    reason
  )
  values (
    target_business_id,
    current_user_id,
    'inventory_stocktake.reversed',
    'inventory_stocktake',
    target_stocktake_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'warehouse_difference_ron',
        stocktake_to_reverse.warehouse_difference_ron,
      'shop_difference_ron', stocktake_to_reverse.shop_difference_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time,
      'reversal_movement_count', reversal_count
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.create_inventory_stocktake(
  uuid, date, text, text, text, text, uuid
) from public;
revoke all on function public.reverse_inventory_stocktake(
  uuid, uuid, text
) from public;
grant execute on function public.create_inventory_stocktake(
  uuid, date, text, text, text, text, uuid
) to authenticated, service_role;
grant execute on function public.reverse_inventory_stocktake(
  uuid, uuid, text
) to authenticated, service_role;

create view public.inventory_stocktake_summaries
with (security_invoker = true)
as
select
  stocktake.id as stocktake_id,
  stocktake.business_id,
  stocktake.stocktake_date,
  stocktake.warehouse_expected_value_ron::text
    as warehouse_expected_value_ron,
  stocktake.warehouse_actual_value_ron::text
    as warehouse_actual_value_ron,
  stocktake.warehouse_difference_ron::text
    as warehouse_difference_ron,
  stocktake.shop_expected_value_ron::text
    as shop_expected_value_ron,
  stocktake.shop_actual_value_ron::text
    as shop_actual_value_ron,
  stocktake.shop_difference_ron::text
    as shop_difference_ron,
  stocktake.reason,
  stocktake.notes,
  stocktake.created_by,
  stocktake.created_at,
  stocktake.reversed_at,
  stocktake.reversed_by,
  stocktake.reversal_reason,
  case
    when stocktake.reversed_at is null then 'active'
    else 'reversed'
  end as status
from public.inventory_stocktakes as stocktake;

revoke all on table public.inventory_stocktake_summaries
  from anon, authenticated;
grant select on table public.inventory_stocktake_summaries
  to authenticated, service_role;

comment on table public.inventory_stocktakes is
  'Immutable inventory expected-versus-actual snapshots with linked ledger adjustments.';
comment on function public.create_inventory_stocktake(
  uuid, date, text, text, text, text, uuid
) is
  'Atomically snapshots expected inventory values and adjusts each location to the submitted actual value.';
comment on function public.reverse_inventory_stocktake(uuid, uuid, text)
  is 'Reverses an inventory stocktake through linked compensating movements.';

commit;
