begin;

alter table public.inventory_value_movements
  add constraint inventory_value_movements_business_id_id_key
  unique (business_id, id);

create table public.inventory_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  inventory_transfer_id uuid not null,
  product_id uuid not null,
  line_number integer not null,
  quantity bigint not null,
  unit_cost_ron numeric(18, 8) not null,
  line_total_ron numeric(18, 2) not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint inventory_transfer_lines_transfer_business_fkey
    foreign key (business_id, inventory_transfer_id)
    references public.inventory_value_movements (business_id, id),
  constraint inventory_transfer_lines_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint inventory_transfer_lines_transfer_line_key
    unique (inventory_transfer_id, line_number),
  constraint inventory_transfer_lines_transfer_product_key
    unique (inventory_transfer_id, product_id),
  constraint inventory_transfer_lines_number_positive
    check (line_number > 0),
  constraint inventory_transfer_lines_quantity_positive
    check (quantity > 0),
  constraint inventory_transfer_lines_unit_cost_positive
    check (unit_cost_ron > 0),
  constraint inventory_transfer_lines_total_consistent
    check (
      line_total_ron = round(quantity * unit_cost_ron, 2)
      and line_total_ron > 0
    )
);

create index inventory_transfer_lines_business_product_idx
  on public.inventory_transfer_lines (
    business_id,
    product_id,
    created_at desc
  );
create unique index stock_movements_inventory_transfer_product_key
  on public.stock_movements (business_id, reference_id, product_id)
  where movement_type = 'transfer'
    and reference_type = 'inventory_transfer'
    and reversal_of_id is null;

alter table public.inventory_transfer_lines enable row level security;

create policy inventory_transfer_lines_select_member
on public.inventory_transfer_lines
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.inventory_transfer_lines
  from anon, authenticated;
grant select on table public.inventory_transfer_lines
  to authenticated, service_role;
grant all on table public.inventory_transfer_lines to service_role;

create function private.prevent_inventory_transfer_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Inventory transfer lines are immutable'
    using errcode = '55000';
end;
$$;

create trigger inventory_transfer_lines_immutable
before update or delete on public.inventory_transfer_lines
for each row
execute function private.prevent_inventory_transfer_line_mutation();

create function private.validate_inventory_transfer_line_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_transfer record;
  transfer_to_check public.inventory_value_movements%rowtype;
  line_count bigint;
  transfer_total numeric;
begin
  for target_transfer in
    select distinct
      line.business_id,
      line.inventory_transfer_id
    from new_inventory_transfer_lines as line
  loop
    select movement.*
    into transfer_to_check
    from public.inventory_value_movements as movement
    where movement.business_id = target_transfer.business_id
      and movement.id = target_transfer.inventory_transfer_id
    for share;

    if not found
      or transfer_to_check.movement_type <> 'inventory_transfer'
      or transfer_to_check.source_entity_type <> 'inventory_transfer'
      or transfer_to_check.reversal_of_id is not null
    then
      raise exception 'Product lines require an original inventory transfer'
        using errcode = '23514';
    end if;

    select count(*), sum(line.line_total_ron)
    into line_count, transfer_total
    from public.inventory_transfer_lines as line
    where line.business_id = target_transfer.business_id
      and line.inventory_transfer_id =
        target_transfer.inventory_transfer_id;

    if line_count = 0
      or transfer_total <> transfer_to_check.amount_ron
    then
      raise exception 'Inventory transfer line totals do not reconcile'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end;
$$;

create trigger inventory_transfer_lines_validate_totals
after insert on public.inventory_transfer_lines
referencing new table as new_inventory_transfer_lines
for each statement
execute function private.validate_inventory_transfer_line_totals();

revoke all on function private.prevent_inventory_transfer_line_mutation()
  from public;
revoke all on function private.validate_inventory_transfer_line_totals()
  from public;

create function private.get_product_stock_cost_balance(
  target_business_id uuid,
  target_product_id uuid,
  target_location_id uuid
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    sum(
      case
        when movement.destination_location_id = target_location_id
          then movement.quantity * movement.unit_cost_ron
        when movement.source_location_id = target_location_id
          then -movement.quantity * movement.unit_cost_ron
        else 0
      end
    ),
    0
  )
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.product_id = target_product_id
    and movement.reversal_of_id is null
    and movement.unit_cost_ron is not null
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

create function private.has_uncosted_product_stock_activity(
  target_business_id uuid,
  target_product_id uuid,
  target_location_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.stock_movements as movement
    where movement.business_id = target_business_id
      and movement.product_id = target_product_id
      and movement.reversal_of_id is null
      and movement.unit_cost_ron is null
      and (
        movement.source_location_id = target_location_id
        or movement.destination_location_id = target_location_id
      )
      and not exists (
        select 1
        from public.stock_movements as reversal
        where reversal.reversal_of_id = movement.id
      )
  );
$$;

revoke all on function private.get_product_stock_cost_balance(
  uuid, uuid, uuid
) from public;
revoke all on function private.has_uncosted_product_stock_activity(
  uuid, uuid, uuid
) from public;

create function public.create_inventory_product_transfer(
  target_business_id uuid,
  target_business_day_id uuid,
  target_source_location_id uuid,
  target_destination_location_id uuid,
  target_idempotency_key uuid,
  target_lines jsonb,
  target_notes text default null,
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
  normalized_notes text := nullif(pg_catalog.btrim(target_notes), '');
  normalized_reason text := nullif(
    pg_catalog.btrim(target_audit_reason),
    ''
  );
  selected_day_date date;
  selected_day_status public.business_day_status;
  source_location_active boolean;
  source_location_type public.inventory_location_type;
  destination_location_active boolean;
  destination_location_type public.inventory_location_type;
  new_entry_origin text;
  requested_lines jsonb := '[]'::jsonb;
  costed_lines jsonb := '[]'::jsonb;
  line_record record;
  product_to_lock record;
  parsed_product_id uuid;
  parsed_product_active boolean;
  parsed_quantity bigint;
  seen_product_ids uuid[] := array[]::uuid[];
  source_quantity bigint;
  source_cost_balance numeric;
  preserved_unit_cost numeric;
  parsed_line_total numeric;
  transfer_total numeric := 0;
  line_count integer;
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

  if target_idempotency_key is null then
    raise exception 'Transfer request identifier is required'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 500
  then
    raise exception 'Transfer notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Audit reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  if target_lines is null
    or pg_catalog.jsonb_typeof(target_lines) <> 'array'
    or pg_catalog.jsonb_array_length(target_lines) not between 1 and 100
  then
    raise exception 'Transfer requires 1 to 100 product lines'
      using errcode = '22023';
  end if;

  for line_record in
    select line.value, line.ordinality
    from pg_catalog.jsonb_array_elements(target_lines)
      with ordinality as line(value, ordinality)
  loop
    if pg_catalog.jsonb_typeof(line_record.value) <> 'object'
      or (
        line_record.value - array['product_id', 'quantity']
      ) <> '{}'::jsonb
    then
      raise exception 'Transfer line % has unsupported fields',
        line_record.ordinality
        using errcode = '22023';
    end if;

    begin
      parsed_product_id := nullif(
        line_record.value ->> 'product_id',
        ''
      )::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Transfer line % product is invalid',
          line_record.ordinality
          using errcode = '22023';
    end;

    if parsed_product_id is null then
      raise exception 'Transfer line % product is required',
        line_record.ordinality
        using errcode = '22023';
    end if;

    if parsed_product_id = any(seen_product_ids) then
      raise exception 'Each product may appear only once per transfer'
        using errcode = '22023';
    end if;

    select product.is_active
    into parsed_product_active
    from public.products as product
    where product.business_id = target_business_id
      and product.id = parsed_product_id
    for share;

    if parsed_product_active is null then
      raise exception 'Transfer line % product does not exist',
        line_record.ordinality
        using errcode = '22023';
    end if;

    if not parsed_product_active then
      raise exception 'Inactive products cannot be transferred'
        using errcode = '55000';
    end if;

    parsed_quantity := private.parse_stock_quantity(
      line_record.value ->> 'quantity'
    );

    requested_lines := requested_lines
      || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'line_number', line_record.ordinality,
          'product_id', parsed_product_id,
          'quantity', parsed_quantity
        )
      );
    seen_product_ids := pg_catalog.array_append(
      seen_product_ids,
      parsed_product_id
    );
  end loop;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'business_day_id', target_business_day_id,
      'source_location_id', target_source_location_id,
      'destination_location_id', target_destination_location_id,
      'lines', requested_lines,
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
    and movement.idempotency_key = target_idempotency_key;

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

  select location.is_active, location.type
  into source_location_active, source_location_type
  from public.inventory_locations as location
  where location.id = target_source_location_id
    and location.business_id = target_business_id
  for share;

  if source_location_type is null then
    raise exception 'Source inventory location does not exist'
      using errcode = '22023';
  end if;

  select location.is_active, location.type
  into destination_location_active, destination_location_type
  from public.inventory_locations as location
  where location.id = target_destination_location_id
    and location.business_id = target_business_id
  for share;

  if destination_location_type is null then
    raise exception 'Destination inventory location does not exist'
      using errcode = '22023';
  end if;

  if not source_location_active
    or not destination_location_active
  then
    raise exception 'Transfer locations must be active'
      using errcode = '55000';
  end if;

  if source_location_type <> 'warehouse'
    or destination_location_type <> 'shop'
  then
    raise exception 'Product transfers must move warehouse stock to shop'
      using errcode = '22023';
  end if;

  for product_to_lock in
    select
      line.product_id,
      line.line_number,
      line.quantity
    from pg_catalog.jsonb_to_recordset(requested_lines) as line(
      line_number integer,
      product_id uuid,
      quantity bigint
    )
    order by line.product_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        target_business_id::text
          || ':'
          || product_to_lock.product_id::text,
        9321
      )
    );

    source_quantity := private.get_product_stock_balance(
      target_business_id,
      product_to_lock.product_id,
      target_source_location_id
    );

    if source_quantity < product_to_lock.quantity then
      raise exception 'Insufficient warehouse quantity for transfer line %',
        product_to_lock.line_number
        using errcode = '22023';
    end if;

    if private.has_uncosted_product_stock_activity(
      target_business_id,
      product_to_lock.product_id,
      target_source_location_id
    ) then
      raise exception 'Warehouse cost is unavailable for transfer line %',
        product_to_lock.line_number
        using errcode = '55000';
    end if;

    source_cost_balance := private.get_product_stock_cost_balance(
      target_business_id,
      product_to_lock.product_id,
      target_source_location_id
    );

    if source_quantity <= 0 or source_cost_balance <= 0 then
      raise exception 'Warehouse cost is unavailable for transfer line %',
        product_to_lock.line_number
        using errcode = '55000';
    end if;

    preserved_unit_cost := round(
      source_cost_balance / source_quantity,
      8
    );
    parsed_line_total := round(
      product_to_lock.quantity * preserved_unit_cost,
      2
    );

    if parsed_line_total <= 0 then
      raise exception 'Transfer line % historical cost is too small',
        product_to_lock.line_number
        using errcode = '22003';
    end if;

    transfer_total := transfer_total + parsed_line_total;

    if transfer_total > 9999999999999999.99 then
      raise exception 'Inventory transfer total is too large'
        using errcode = '22003';
    end if;

    costed_lines := costed_lines
      || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'line_number', product_to_lock.line_number,
          'product_id', product_to_lock.product_id,
          'quantity', product_to_lock.quantity,
          'unit_cost_ron', preserved_unit_cost,
          'line_total_ron', parsed_line_total
        )
      );
  end loop;

  line_count := pg_catalog.jsonb_array_length(costed_lines);

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
    transfer_total,
    'inventory_transfer',
    new_transfer_id,
    normalized_notes,
    new_entry_origin,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  );

  insert into public.inventory_transfer_lines (
    business_id,
    inventory_transfer_id,
    product_id,
    line_number,
    quantity,
    unit_cost_ron,
    line_total_ron
  )
  select
    target_business_id,
    new_transfer_id,
    line.product_id,
    line.line_number,
    line.quantity,
    line.unit_cost_ron,
    line.line_total_ron
  from pg_catalog.jsonb_to_recordset(costed_lines) as line(
    line_number integer,
    product_id uuid,
    quantity bigint,
    unit_cost_ron numeric,
    line_total_ron numeric
  );

  insert into public.stock_movements (
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
    request_fingerprint
  )
  select
    line.business_id,
    line.product_id,
    'transfer',
    target_source_location_id,
    target_destination_location_id,
    line.quantity,
    line.unit_cost_ron,
    target_business_day_id,
    'inventory_transfer',
    new_transfer_id,
    'Product inventory transfer',
    current_user_id,
    line.id,
    pg_catalog.md5(
      pg_catalog.jsonb_build_object(
        'inventory_transfer_id', new_transfer_id,
        'inventory_transfer_line_id', line.id,
        'product_id', line.product_id,
        'source_location_id', target_source_location_id,
        'destination_location_id', target_destination_location_id,
        'quantity', line.quantity,
        'unit_cost_ron', line.unit_cost_ron
      )::text
    )
  from public.inventory_transfer_lines as line
  where line.business_id = target_business_id
    and line.inventory_transfer_id = new_transfer_id
  order by line.line_number;

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
      'amount_ron', transfer_total,
      'product_line_count', line_count,
      'record_mode', 'product_lines',
      'notes', normalized_notes,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  return new_transfer_id;
end;
$$;

revoke all on function public.create_inventory_product_transfer(
  uuid, uuid, uuid, uuid, uuid, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.create_inventory_product_transfer(
  uuid, uuid, uuid, uuid, uuid, jsonb, text, text
) to authenticated, service_role;

drop function public.reverse_inventory_value_transfer(uuid, uuid, text);

create function public.reverse_inventory_value_transfer(
  target_business_id uuid,
  target_transfer_id uuid,
  target_reason text,
  target_allow_negative_stock boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := nullif(
    pg_catalog.btrim(target_reason),
    ''
  );
  transfer_to_reverse public.inventory_value_movements%rowtype;
  product_movement record;
  reversed_product_movement_count integer := 0;
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

  for product_movement in
    select movement.id
    from public.stock_movements as movement
    where movement.business_id = target_business_id
      and movement.reference_type = 'inventory_transfer'
      and movement.reference_id = target_transfer_id
      and movement.movement_type = 'transfer'
      and movement.reversal_of_id is null
      and not exists (
        select 1
        from public.stock_movements as reversal
        where reversal.reversal_of_id = movement.id
      )
    order by movement.product_id
  loop
    perform public.reverse_stock_movement(
      target_business_id,
      product_movement.id,
      normalized_reason,
      gen_random_uuid(),
      target_allow_negative_stock
    );
    reversed_product_movement_count :=
      reversed_product_movement_count + 1;
  end loop;

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
      'amount_ron', transfer_to_reverse.amount_ron,
      'product_line_count', reversed_product_movement_count
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversal_movement_id', new_reversal_id,
      'product_stock_reversal_count', reversed_product_movement_count,
      'negative_stock_override', target_allow_negative_stock
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.reverse_inventory_value_transfer(
  uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.reverse_inventory_value_transfer(
  uuid, uuid, text, boolean
) to authenticated, service_role;

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
begin
  perform public.reverse_inventory_value_transfer(
    target_business_id,
    target_transfer_id,
    target_reason,
    false
  );
end;
$$;

revoke all on function public.reverse_inventory_value_transfer(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.reverse_inventory_value_transfer(
  uuid, uuid, text
) to authenticated, service_role;

create view public.inventory_transfer_line_summaries
with (security_invoker = true)
as
select
  line.id as line_id,
  line.business_id,
  line.inventory_transfer_id,
  line.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  line.line_number,
  line.quantity::text as quantity,
  line.unit_cost_ron::text as unit_cost_ron,
  line.line_total_ron::text as line_total_ron
from public.inventory_transfer_lines as line
inner join public.products as product
  on product.business_id = line.business_id
  and product.id = line.product_id;

create or replace view public.inventory_transfer_summaries
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
  end as status,
  coalesce(product_lines.line_count, 0)::integer as product_line_count
from public.inventory_value_movements as transfer
inner join public.inventory_locations as source_location
  on source_location.id = transfer.source_location_id
  and source_location.business_id = transfer.business_id
inner join public.inventory_locations as destination_location
  on destination_location.id = transfer.destination_location_id
  and destination_location.business_id = transfer.business_id
left join public.inventory_value_movements as reversal
  on reversal.reversal_of_id = transfer.id
left join lateral (
  select count(*) as line_count
  from public.inventory_transfer_lines as line
  where line.business_id = transfer.business_id
    and line.inventory_transfer_id = transfer.id
) as product_lines on true
where transfer.movement_type = 'inventory_transfer'
  and transfer.source_entity_type = 'inventory_transfer';

revoke all on table public.inventory_transfer_line_summaries
  from anon, authenticated;
grant select on table public.inventory_transfer_line_summaries
  to authenticated, service_role;

comment on table public.inventory_transfer_lines is
  'Immutable product quantities and preserved weighted-average historical cost moved from warehouse to shop.';
comment on function public.create_inventory_product_transfer(
  uuid, uuid, uuid, uuid, uuid, jsonb, text, text
) is
  'Atomically moves selected product quantities and their preserved warehouse cost to shop.';
comment on function public.reverse_inventory_value_transfer(
  uuid, uuid, text, boolean
) is
  'Reverses inventory value and linked product quantities; negative shop stock requires an explicit administrator override.';
comment on view public.inventory_transfer_line_summaries is
  'Product-line detail for quantity-aware inventory transfers.';

commit;
