begin;

alter table public.inventory_value_movements
  add column notes text,
  add column entry_origin text,
  add column idempotency_key uuid,
  add column request_fingerprint text,
  add constraint inventory_value_movements_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  add constraint inventory_value_movements_origin_valid
    check (
      entry_origin is null
      or entry_origin in ('operational', 'admin_historical')
    );

create unique index inventory_value_movements_business_idempotency_key
  on public.inventory_value_movements (business_id, idempotency_key)
  where idempotency_key is not null;
create unique index inventory_value_movements_transfer_source_key
  on public.inventory_value_movements (
    business_id,
    source_entity_id,
    movement_type
  )
  where source_entity_type = 'inventory_transfer';

create function private.guard_inventory_value_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_balance numeric;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'Inventory value movements are immutable'
      using errcode = '55000';
  end if;

  if new.source_location_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.business_id::text || ':' || new.source_location_id::text,
      9160
    )
  );

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

revoke all on function private.guard_inventory_value_movement()
  from public;

create trigger inventory_value_movements_guard
before insert or update or delete on public.inventory_value_movements
for each row
execute function private.guard_inventory_value_movement();

create function public.create_inventory_value_transfer(
  target_business_id uuid,
  target_business_day_id uuid,
  target_source_location_id uuid,
  target_destination_location_id uuid,
  target_amount_ron text,
  target_notes text,
  target_idempotency_key uuid,
  target_audit_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  caller_is_admin boolean;
  normalized_notes text := nullif(btrim(target_notes), '');
  normalized_reason text := nullif(btrim(target_audit_reason), '');
  parsed_amount numeric;
  selected_day_date date;
  selected_day_status public.business_day_status;
  source_location_type public.inventory_location_type;
  destination_location_type public.inventory_location_type;
  new_entry_origin text;
  request_fingerprint text;
  existing_transfer_id uuid;
  existing_fingerprint text;
  new_transfer_id uuid := gen_random_uuid();
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);
  parsed_amount := private.parse_positive_ron_amount(
    target_amount_ron,
    'Transfer amount'
  );

  if target_source_location_id = target_destination_location_id then
    raise exception 'Transfer locations must differ'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 500
  then
    raise exception 'Transfer notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null then
    raise exception 'Transfer request identifier is required'
      using errcode = '22023';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Audit reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'business_day_id', target_business_day_id,
      'source_location_id', target_source_location_id,
      'destination_location_id', target_destination_location_id,
      'amount_ron', parsed_amount,
      'notes', normalized_notes,
      'audit_reason', normalized_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9161
    )
  );

  select movement.id, movement.request_fingerprint
  into existing_transfer_id, existing_fingerprint
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and movement.idempotency_key = target_idempotency_key
    and movement.movement_type = 'inventory_transfer'
    and movement.source_entity_type = 'inventory_transfer';

  if existing_transfer_id is not null then
    if existing_fingerprint is distinct from request_fingerprint then
      raise exception 'Transfer request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_transfer_id;
  end if;

  select day.business_date, day.status
  into selected_day_date, selected_day_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for share;

  if selected_day_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if not caller_is_admin and selected_day_status <> 'open' then
    raise exception 'Employee requires the current open business day'
      using errcode = '55000';
  end if;

  if selected_day_status = 'closed' then
    if not caller_is_admin then
      raise exception 'Administrator access is required for historical transfers'
        using errcode = '42501';
    end if;

    if normalized_reason is null then
      raise exception 'Historical transfers require an audit reason'
        using errcode = '22023';
    end if;

    new_entry_origin := 'admin_historical';
  else
    new_entry_origin := 'operational';
  end if;

  select location.type
  into source_location_type
  from public.inventory_locations as location
  where location.id = target_source_location_id
    and location.business_id = target_business_id
    and location.is_active
  for share;

  if source_location_type is null then
    raise exception 'Source inventory location does not exist'
      using errcode = '22023';
  end if;

  select location.type
  into destination_location_type
  from public.inventory_locations as location
  where location.id = target_destination_location_id
    and location.business_id = target_business_id
    and location.is_active
  for share;

  if destination_location_type is null then
    raise exception 'Destination inventory location does not exist'
      using errcode = '22023';
  end if;

  if source_location_type <> 'warehouse'
    or destination_location_type <> 'shop'
  then
    raise exception 'Phase 1 supports warehouse-to-shop transfers only'
      using errcode = '22023';
  end if;

  insert into public.inventory_value_movements (
    id,
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    source_location_id,
    destination_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    notes,
    entry_origin,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    new_transfer_id,
    target_business_id,
    target_business_day_id,
    selected_day_date,
    'inventory_transfer',
    target_source_location_id,
    target_destination_location_id,
    parsed_amount,
    'inventory_transfer',
    new_transfer_id,
    normalized_notes,
    new_entry_origin,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  );

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
    'inventory_transfer.created',
    'inventory_transfer',
    new_transfer_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'movement_date', selected_day_date,
      'source_location_id', target_source_location_id,
      'destination_location_id', target_destination_location_id,
      'amount_ron', parsed_amount,
      'notes', normalized_notes,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  return new_transfer_id;
end;
$$;

create function public.reverse_inventory_value_transfer(
  target_business_id uuid,
  target_transfer_id uuid,
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
  transfer_to_reverse public.inventory_value_movements%rowtype;
  new_reversal_id uuid;
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

  select movement.*
  into transfer_to_reverse
  from public.inventory_value_movements as movement
  where movement.id = target_transfer_id
    and movement.business_id = target_business_id
    and movement.movement_type = 'inventory_transfer'
    and movement.source_entity_type = 'inventory_transfer'
  for update;

  if not found then
    raise exception 'Inventory transfer does not exist'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = target_transfer_id
  ) then
    raise exception 'Inventory transfer is already reversed'
      using errcode = '55000';
  end if;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    source_location_id,
    destination_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    notes,
    entry_origin,
    created_by,
    reversal_of_id
  )
  values (
    target_business_id,
    transfer_to_reverse.business_day_id,
    transfer_to_reverse.movement_date,
    'inventory_transfer_reversal',
    transfer_to_reverse.destination_location_id,
    transfer_to_reverse.source_location_id,
    transfer_to_reverse.amount_ron,
    'inventory_transfer',
    target_transfer_id,
    'Transfer reversal',
    transfer_to_reverse.entry_origin,
    current_user_id,
    target_transfer_id
  )
  returning id into new_reversal_id;

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
    'inventory_transfer.reversed',
    'inventory_transfer',
    target_transfer_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'amount_ron', transfer_to_reverse.amount_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversal_movement_id', new_reversal_id
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.create_inventory_value_transfer(
  uuid, uuid, uuid, uuid, text, text, uuid, text
) from public;
revoke all on function public.reverse_inventory_value_transfer(
  uuid, uuid, text
) from public;
grant execute on function public.create_inventory_value_transfer(
  uuid, uuid, uuid, uuid, text, text, uuid, text
) to authenticated, service_role;
grant execute on function public.reverse_inventory_value_transfer(
  uuid, uuid, text
) to authenticated, service_role;

create or replace view public.inventory_value_movement_summaries
with (security_invoker = true)
as
select
  movement.id as movement_id,
  movement.business_id,
  movement.business_day_id,
  movement.movement_date,
  movement.movement_type,
  movement.source_location_id,
  movement.destination_location_id,
  movement.amount_ron::text as amount_ron,
  movement.source_entity_type,
  movement.source_entity_id,
  movement.created_by,
  movement.created_at,
  movement.reversal_of_id,
  movement.notes,
  movement.entry_origin,
  movement.idempotency_key
from public.inventory_value_movements as movement;

create view public.inventory_transfer_summaries
with (security_invoker = true)
as
select
  transfer.id as transfer_id,
  transfer.business_id,
  transfer.business_day_id,
  transfer.movement_date as transfer_date,
  transfer.source_location_id,
  source_location.name as source_location_name,
  transfer.destination_location_id,
  destination_location.name as destination_location_name,
  transfer.amount_ron::text as amount_ron,
  transfer.notes,
  transfer.entry_origin,
  transfer.created_by,
  transfer.created_at,
  reversal.id as reversal_movement_id,
  case
    when reversal.id is null then 'active'
    else 'reversed'
  end as status
from public.inventory_value_movements as transfer
inner join public.inventory_locations as source_location
  on source_location.id = transfer.source_location_id
  and source_location.business_id = transfer.business_id
inner join public.inventory_locations as destination_location
  on destination_location.id = transfer.destination_location_id
  and destination_location.business_id = transfer.business_id
left join public.inventory_value_movements as reversal
  on reversal.reversal_of_id = transfer.id
where transfer.movement_type = 'inventory_transfer'
  and transfer.source_entity_type = 'inventory_transfer';

revoke all on table public.inventory_transfer_summaries
  from anon, authenticated;
grant select on table public.inventory_transfer_summaries
  to authenticated, service_role;

comment on function public.create_inventory_value_transfer(
  uuid, uuid, uuid, uuid, text, text, uuid, text
) is
  'Atomically moves inventory value from warehouse to shop without changing the business total.';
comment on function public.reverse_inventory_value_transfer(
  uuid, uuid, text
) is
  'Creates a linked shop-to-warehouse movement that reverses an inventory transfer.';

commit;
