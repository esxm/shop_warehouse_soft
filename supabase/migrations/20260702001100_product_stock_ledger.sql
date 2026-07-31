begin;

create type public.stock_movement_type as enum (
  'opening',
  'supplier_receipt',
  'transfer',
  'sale',
  'return',
  'damage',
  'adjustment'
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  product_id uuid not null,
  movement_type public.stock_movement_type not null,
  source_location_id uuid,
  destination_location_id uuid,
  quantity bigint not null,
  unit_cost_ron numeric(18, 2),
  business_day_id uuid,
  reference_type text not null,
  reference_id uuid not null,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default statement_timestamp(),
  reversal_of_id uuid references public.stock_movements (id),
  idempotency_key uuid not null,
  request_fingerprint text not null,
  negative_stock_override boolean not null default false,
  override_reason text,
  constraint stock_movements_business_id_id_key
    unique (business_id, id),
  constraint stock_movements_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint stock_movements_source_location_business_fkey
    foreign key (business_id, source_location_id)
    references public.inventory_locations (business_id, id),
  constraint stock_movements_destination_location_business_fkey
    foreign key (business_id, destination_location_id)
    references public.inventory_locations (business_id, id),
  constraint stock_movements_business_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint stock_movements_quantity_positive check (quantity > 0),
  constraint stock_movements_unit_cost_nonnegative
    check (unit_cost_ron is null or unit_cost_ron >= 0),
  constraint stock_movements_locations_differ
    check (
      source_location_id is null
      or destination_location_id is null
      or source_location_id <> destination_location_id
    ),
  constraint stock_movements_reference_type_valid
    check (char_length(btrim(reference_type)) between 1 and 80),
  constraint stock_movements_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  constraint stock_movements_fingerprint_valid
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint stock_movements_reversal_valid
    check (reversal_of_id is null or reversal_of_id <> id),
  constraint stock_movements_override_valid
    check (
      (
        not negative_stock_override
        and override_reason is null
      )
      or (
        negative_stock_override
        and override_reason is not null
        and char_length(btrim(override_reason)) between 10 and 500
      )
    ),
  constraint stock_movements_original_shape_valid
    check (
      reversal_of_id is not null
      or (
        movement_type in ('opening', 'supplier_receipt', 'return')
        and source_location_id is null
        and destination_location_id is not null
      )
      or (
        movement_type in ('sale', 'damage')
        and source_location_id is not null
        and destination_location_id is null
      )
      or (
        movement_type = 'transfer'
        and source_location_id is not null
        and destination_location_id is not null
      )
      or (
        movement_type = 'adjustment'
        and (
          (source_location_id is null and destination_location_id is not null)
          or
          (source_location_id is not null and destination_location_id is null)
        )
      )
    )
);

create unique index stock_movements_business_idempotency_key
  on public.stock_movements (business_id, idempotency_key);
create unique index stock_movements_one_reversal_key
  on public.stock_movements (reversal_of_id)
  where reversal_of_id is not null;
create index stock_movements_product_created_idx
  on public.stock_movements (business_id, product_id, created_at desc);
create index stock_movements_source_location_idx
  on public.stock_movements (business_id, source_location_id, product_id)
  where source_location_id is not null;
create index stock_movements_destination_location_idx
  on public.stock_movements (
    business_id,
    destination_location_id,
    product_id
  )
  where destination_location_id is not null;
create index stock_movements_reference_idx
  on public.stock_movements (business_id, reference_type, reference_id);

alter table public.stock_movements enable row level security;

create policy stock_movements_select_member
on public.stock_movements
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.stock_movements from anon, authenticated;
grant select on table public.stock_movements to authenticated, service_role;
grant all on table public.stock_movements to service_role;

create function private.prevent_stock_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Product stock movements are immutable; create a reversal'
    using errcode = '55000';
end;
$$;

create trigger stock_movements_immutable
before update or delete on public.stock_movements
for each row
execute function private.prevent_stock_movement_mutation();

create function private.get_product_stock_balance(
  target_business_id uuid,
  target_product_id uuid,
  target_location_id uuid
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    sum(
      case
        when movement.destination_location_id = target_location_id
          then movement.quantity
        when movement.source_location_id = target_location_id
          then -movement.quantity
        else 0
      end
    ),
    0
  )::bigint
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.product_id = target_product_id
    and movement.reversal_of_id is null
    and (
      movement.source_location_id = target_location_id
      or movement.destination_location_id = target_location_id
    )
    and not exists (
      select 1
      from public.stock_movements as reversal
      where reversal.reversal_of_id = movement.id
    );
$$;

create function private.parse_stock_quantity(
  target_value text
)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_value text := pg_catalog.btrim(target_value);
  parsed_value numeric;
begin
  if normalized_value is null
    or normalized_value !~ '^[1-9][0-9]{0,17}$'
  then
    raise exception 'Quantity must be a positive whole number'
      using errcode = '22023';
  end if;

  parsed_value := normalized_value::numeric;

  if parsed_value > 999999999999999999 then
    raise exception 'Quantity is too large'
      using errcode = '22003';
  end if;

  return parsed_value::bigint;
end;
$$;

create function private.parse_optional_stock_unit_cost(
  target_value text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_value text := nullif(
    pg_catalog.replace(pg_catalog.btrim(target_value), ',', '.'),
    ''
  );
  parsed_value numeric;
begin
  if normalized_value is null then
    return null;
  end if;

  if normalized_value !~ '^(0|[1-9][0-9]{0,15})([.][0-9]{1,2})?$' then
    raise exception 'Unit cost must be non-negative with at most two decimals'
      using errcode = '22023';
  end if;

  parsed_value := normalized_value::numeric;

  if parsed_value > 9999999999999999.99 then
    raise exception 'Unit cost is too large'
      using errcode = '22003';
  end if;

  return round(parsed_value, 2);
end;
$$;

revoke all on function private.prevent_stock_movement_mutation()
  from public;
revoke all on function private.get_product_stock_balance(uuid, uuid, uuid)
  from public;
revoke all on function private.parse_stock_quantity(text)
  from public;
revoke all on function private.parse_optional_stock_unit_cost(text)
  from public;

create function public.create_stock_movement(
  target_business_id uuid,
  target_product_id uuid,
  target_movement_type text,
  target_quantity text,
  target_reference_type text,
  target_reference_id uuid,
  target_idempotency_key uuid,
  target_source_location_id uuid default null,
  target_destination_location_id uuid default null,
  target_unit_cost_ron text default null,
  target_business_day_id uuid default null,
  target_notes text default null,
  target_allow_negative boolean default false,
  target_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  caller_is_admin boolean;
  normalized_type text := pg_catalog.lower(
    pg_catalog.btrim(target_movement_type)
  );
  parsed_type public.stock_movement_type;
  parsed_quantity bigint;
  parsed_unit_cost numeric;
  normalized_reference_type text := pg_catalog.btrim(
    target_reference_type
  );
  normalized_notes text := nullif(pg_catalog.btrim(target_notes), '');
  normalized_reason text := nullif(
    pg_catalog.btrim(target_override_reason),
    ''
  );
  selected_day_status public.business_day_status;
  product_is_active boolean;
  source_is_active boolean;
  destination_is_active boolean;
  source_balance bigint;
  projected_source_balance bigint;
  request_fingerprint text;
  existing_movement_id uuid;
  existing_fingerprint text;
  new_movement_id uuid := gen_random_uuid();
  used_negative_override boolean := false;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);

  begin
    parsed_type := normalized_type::public.stock_movement_type;
  exception
    when invalid_text_representation then
      raise exception 'Unsupported stock movement type'
        using errcode = '22023';
  end;

  parsed_quantity := private.parse_stock_quantity(target_quantity);
  parsed_unit_cost := private.parse_optional_stock_unit_cost(
    target_unit_cost_ron
  );

  if target_idempotency_key is null then
    raise exception 'Stock movement request identifier is required'
      using errcode = '22023';
  end if;

  if target_reference_id is null then
    raise exception 'Stock movement reference identifier is required'
      using errcode = '22023';
  end if;

  if normalized_reference_type is null
    or char_length(normalized_reference_type) not between 1 and 80
  then
    raise exception 'Reference type must contain 1 to 80 characters'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 500
  then
    raise exception 'Stock movement notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Override reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  if target_allow_negative and not caller_is_admin then
    raise exception 'Administrator access is required to override stock'
      using errcode = '42501';
  end if;

  if target_allow_negative and normalized_reason is null then
    raise exception 'Negative-stock override requires a reason'
      using errcode = '22023';
  end if;

  if parsed_type in ('opening', 'supplier_receipt', 'return') then
    if target_source_location_id is not null
      or target_destination_location_id is null
    then
      raise exception 'Inbound movement requires only a destination location'
        using errcode = '22023';
    end if;
  elsif parsed_type in ('sale', 'damage') then
    if target_source_location_id is null
      or target_destination_location_id is not null
    then
      raise exception 'Outbound movement requires only a source location'
        using errcode = '22023';
    end if;
  elsif parsed_type = 'transfer' then
    if target_source_location_id is null
      or target_destination_location_id is null
      or target_source_location_id = target_destination_location_id
    then
      raise exception 'Transfer requires two different locations'
        using errcode = '22023';
    end if;
  elsif parsed_type = 'adjustment' then
    if (
      target_source_location_id is null
      and target_destination_location_id is null
    ) or (
      target_source_location_id is not null
      and target_destination_location_id is not null
    ) then
      raise exception 'Adjustment requires exactly one location direction'
        using errcode = '22023';
    end if;
  end if;

  if parsed_type = 'opening' and not caller_is_admin then
    raise exception 'Administrator access is required for opening stock'
      using errcode = '42501';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'product_id', target_product_id,
      'movement_type', parsed_type,
      'source_location_id', target_source_location_id,
      'destination_location_id', target_destination_location_id,
      'quantity', parsed_quantity,
      'unit_cost_ron', parsed_unit_cost,
      'business_day_id', target_business_day_id,
      'reference_type', normalized_reference_type,
      'reference_id', target_reference_id,
      'notes', normalized_notes,
      'allow_negative', target_allow_negative,
      'override_reason', normalized_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9320
    )
  );

  select movement.id, movement.request_fingerprint
  into existing_movement_id, existing_fingerprint
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.idempotency_key = target_idempotency_key;

  if existing_movement_id is not null then
    if existing_fingerprint is distinct from request_fingerprint then
      raise exception 'Stock movement request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_movement_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_product_id::text,
      9321
    )
  );

  select product.is_active
  into product_is_active
  from public.products as product
  where product.business_id = target_business_id
    and product.id = target_product_id
  for share;

  if product_is_active is null then
    raise exception 'Product does not exist'
      using errcode = '22023';
  end if;

  if not product_is_active then
    raise exception 'Product is inactive'
      using errcode = '55000';
  end if;

  if target_source_location_id is not null then
    select location.is_active
    into source_is_active
    from public.inventory_locations as location
    where location.business_id = target_business_id
      and location.id = target_source_location_id
    for share;

    if source_is_active is null then
      raise exception 'Source inventory location does not exist'
        using errcode = '22023';
    end if;

    if not source_is_active then
      raise exception 'Source inventory location is inactive'
        using errcode = '55000';
    end if;
  end if;

  if target_destination_location_id is not null then
    select location.is_active
    into destination_is_active
    from public.inventory_locations as location
    where location.business_id = target_business_id
      and location.id = target_destination_location_id
    for share;

    if destination_is_active is null then
      raise exception 'Destination inventory location does not exist'
        using errcode = '22023';
    end if;

    if not destination_is_active then
      raise exception 'Destination inventory location is inactive'
        using errcode = '55000';
    end if;
  end if;

  if target_business_day_id is not null then
    select day.status
    into selected_day_status
    from public.business_days as day
    where day.business_id = target_business_id
      and day.id = target_business_day_id
    for share;

    if selected_day_status is null then
      raise exception 'Business day does not exist'
        using errcode = '22023';
    end if;

    if selected_day_status <> 'open' then
      if not caller_is_admin then
        raise exception 'Employee requires the current open business day'
          using errcode = '55000';
      end if;

      if normalized_reason is null then
        raise exception 'Historical stock movement requires an audit reason'
          using errcode = '22023';
      end if;
    end if;
  elsif not caller_is_admin then
    raise exception 'Employee stock movement requires an open business day'
      using errcode = '55000';
  end if;

  if target_source_location_id is not null then
    source_balance := private.get_product_stock_balance(
      target_business_id,
      target_product_id,
      target_source_location_id
    );
    projected_source_balance := source_balance - parsed_quantity;

    if projected_source_balance < 0 then
      if not target_allow_negative then
        raise exception 'Stock movement would make product quantity negative'
          using errcode = '22023';
      end if;

      used_negative_override := true;
    end if;
  end if;

  insert into public.stock_movements (
    id,
    business_id,
    product_id,
    movement_type,
    source_location_id,
    destination_location_id,
    quantity,
    unit_cost_ron,
    business_day_id,
    reference_type,
    reference_id,
    notes,
    created_by,
    idempotency_key,
    request_fingerprint,
    negative_stock_override,
    override_reason
  )
  values (
    new_movement_id,
    target_business_id,
    target_product_id,
    parsed_type,
    target_source_location_id,
    target_destination_location_id,
    parsed_quantity,
    parsed_unit_cost,
    target_business_day_id,
    normalized_reference_type,
    target_reference_id,
    normalized_notes,
    current_user_id,
    target_idempotency_key,
    request_fingerprint,
    used_negative_override,
    case when used_negative_override then normalized_reason end
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
    case
      when used_negative_override
        then 'stock_movement.negative_override_created'
      else 'stock_movement.created'
    end,
    'stock_movement',
    new_movement_id,
    pg_catalog.jsonb_build_object(
      'product_id', target_product_id,
      'movement_type', parsed_type,
      'source_location_id', target_source_location_id,
      'destination_location_id', target_destination_location_id,
      'quantity', parsed_quantity,
      'unit_cost_ron', parsed_unit_cost,
      'business_day_id', target_business_day_id,
      'reference_type', normalized_reference_type,
      'reference_id', target_reference_id,
      'source_balance_before', source_balance,
      'source_balance_after', projected_source_balance,
      'negative_stock_override', used_negative_override
    ),
    case
      when used_negative_override or selected_day_status = 'closed'
        then normalized_reason
    end
  );

  return new_movement_id;
end;
$$;

create function public.reverse_stock_movement(
  target_business_id uuid,
  target_movement_id uuid,
  target_reason text,
  target_idempotency_key uuid,
  target_allow_negative boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(target_reason), '');
  original public.stock_movements%rowtype;
  destination_balance bigint;
  projected_destination_balance bigint;
  request_fingerprint text;
  existing_reversal_id uuid;
  existing_fingerprint text;
  new_reversal_id uuid := gen_random_uuid();
  used_negative_override boolean := false;
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

  if target_idempotency_key is null then
    raise exception 'Reversal request identifier is required'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'movement_id', target_movement_id,
      'reason', normalized_reason,
      'allow_negative', target_allow_negative
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9320
    )
  );

  select movement.id, movement.request_fingerprint
  into existing_reversal_id, existing_fingerprint
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.idempotency_key = target_idempotency_key;

  if existing_reversal_id is not null then
    if existing_fingerprint is distinct from request_fingerprint then
      raise exception 'Reversal request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_reversal_id;
  end if;

  select movement.*
  into original
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.id = target_movement_id
    and movement.reversal_of_id is null
  for update;

  if not found then
    raise exception 'Stock movement does not exist or is a reversal'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || original.product_id::text,
      9321
    )
  );

  if exists (
    select 1
    from public.stock_movements as reversal
    where reversal.reversal_of_id = original.id
  ) then
    raise exception 'Stock movement is already reversed'
      using errcode = '55000';
  end if;

  if original.destination_location_id is not null then
    destination_balance := private.get_product_stock_balance(
      target_business_id,
      original.product_id,
      original.destination_location_id
    );
    projected_destination_balance :=
      destination_balance - original.quantity;

    if projected_destination_balance < 0 then
      if not target_allow_negative then
        raise exception 'Reversal would make product quantity negative'
          using errcode = '22023';
      end if;

      used_negative_override := true;
    end if;
  end if;

  insert into public.stock_movements (
    id,
    business_id,
    product_id,
    movement_type,
    source_location_id,
    destination_location_id,
    quantity,
    unit_cost_ron,
    business_day_id,
    reference_type,
    reference_id,
    notes,
    created_by,
    reversal_of_id,
    idempotency_key,
    request_fingerprint,
    negative_stock_override,
    override_reason
  )
  values (
    new_reversal_id,
    target_business_id,
    original.product_id,
    original.movement_type,
    original.source_location_id,
    original.destination_location_id,
    original.quantity,
    original.unit_cost_ron,
    original.business_day_id,
    'stock_movement_reversal',
    original.id,
    'Stock movement reversal',
    current_user_id,
    original.id,
    target_idempotency_key,
    request_fingerprint,
    used_negative_override,
    case when used_negative_override then normalized_reason end
  );

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
    case
      when used_negative_override
        then 'stock_movement.negative_override_reversed'
      else 'stock_movement.reversed'
    end,
    'stock_movement',
    original.id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'product_id', original.product_id,
      'quantity', original.quantity
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversal_movement_id', new_reversal_id,
      'destination_balance_before', destination_balance,
      'destination_balance_after', projected_destination_balance,
      'negative_stock_override', used_negative_override
    ),
    normalized_reason
  );

  return new_reversal_id;
end;
$$;

revoke all on function public.create_stock_movement(
  uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text, uuid, text,
  boolean, text
) from public;
revoke all on function public.reverse_stock_movement(
  uuid, uuid, text, uuid, boolean
) from public;
grant execute on function public.create_stock_movement(
  uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text, uuid, text,
  boolean, text
) to authenticated, service_role;
grant execute on function public.reverse_stock_movement(
  uuid, uuid, text, uuid, boolean
) to authenticated, service_role;

create view public.product_stock_by_location
with (security_invoker = true)
as
select
  product.business_id,
  product.id as product_id,
  product.internal_code,
  product.name as product_name,
  product.category_id,
  category.name as category_name,
  product.is_active as product_is_active,
  location.id as location_id,
  location.name as location_name,
  location.type as location_type,
  coalesce(
    sum(
      case
        when movement.destination_location_id = location.id
          then movement.quantity
        when movement.source_location_id = location.id
          then -movement.quantity
        else 0
      end
    ) filter (
      where movement.id is not null
        and movement.reversal_of_id is null
        and not exists (
          select 1
          from public.stock_movements as reversal
          where reversal.reversal_of_id = movement.id
        )
    ),
    0
  )::text as quantity
from public.products as product
inner join public.product_categories as category
  on category.business_id = product.business_id
  and category.id = product.category_id
inner join public.inventory_locations as location
  on location.business_id = product.business_id
left join public.stock_movements as movement
  on movement.business_id = product.business_id
  and movement.product_id = product.id
  and (
    movement.source_location_id = location.id
    or movement.destination_location_id = location.id
  )
group by
  product.business_id,
  product.id,
  product.internal_code,
  product.name,
  product.category_id,
  category.name,
  product.is_active,
  location.id,
  location.name,
  location.type;

create view public.stock_movement_summaries
with (security_invoker = true)
as
select
  movement.id as movement_id,
  movement.business_id,
  movement.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  movement.movement_type,
  movement.source_location_id,
  source_location.name as source_location_name,
  movement.destination_location_id,
  destination_location.name as destination_location_name,
  movement.quantity::text as quantity,
  movement.unit_cost_ron::text as unit_cost_ron,
  movement.business_day_id,
  day.business_date,
  movement.reference_type,
  movement.reference_id,
  movement.notes,
  movement.created_by,
  profile.full_name as created_by_name,
  movement.created_at,
  movement.reversal_of_id,
  reversal.id as reversal_movement_id,
  movement.negative_stock_override,
  movement.override_reason,
  case
    when movement.reversal_of_id is not null then 'reversal'
    when reversal.id is not null then 'reversed'
    else 'active'
  end as status
from public.stock_movements as movement
inner join public.products as product
  on product.business_id = movement.business_id
  and product.id = movement.product_id
left join public.inventory_locations as source_location
  on source_location.business_id = movement.business_id
  and source_location.id = movement.source_location_id
left join public.inventory_locations as destination_location
  on destination_location.business_id = movement.business_id
  and destination_location.id = movement.destination_location_id
left join public.business_days as day
  on day.business_id = movement.business_id
  and day.id = movement.business_day_id
left join public.profiles as profile
  on profile.id = movement.created_by
left join public.stock_movements as reversal
  on reversal.reversal_of_id = movement.id;

revoke all on table public.product_stock_by_location
  from anon, authenticated;
revoke all on table public.stock_movement_summaries
  from anon, authenticated;
grant select on table public.product_stock_by_location
  to authenticated, service_role;
grant select on table public.stock_movement_summaries
  to authenticated, service_role;

create function private.prevent_product_deactivation_with_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active
    and not new.is_active
    and exists (
      select 1
      from public.inventory_locations as location
      where location.business_id = new.business_id
        and private.get_product_stock_balance(
          new.business_id,
          new.id,
          location.id
        ) <> 0
    )
  then
    raise exception 'Product with stock cannot be deactivated'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger products_require_zero_stock_to_deactivate
before update of is_active on public.products
for each row
execute function private.prevent_product_deactivation_with_stock();

revoke all on function private.prevent_product_deactivation_with_stock()
  from public;

comment on table public.stock_movements is
  'Immutable per-product quantity ledger. Balances are always derived from active original movements.';
comment on view public.product_stock_by_location is
  'Current derived quantity for every product and active inventory location.';
comment on function public.create_stock_movement(
  uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text, uuid, text,
  boolean, text
) is
  'Creates one serialized, idempotent stock movement and prevents unauthorized negative quantities.';
comment on function public.reverse_stock_movement(
  uuid, uuid, text, uuid, boolean
) is
  'Creates an immutable linked reversal after checking the resulting destination quantity.';

commit;
