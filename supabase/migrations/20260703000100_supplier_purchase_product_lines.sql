begin;

drop view public.stock_movement_summaries;

alter table public.stock_movements
  alter column unit_cost_ron type numeric(18, 8);

alter table public.supplier_purchases
  add column record_mode text not null default 'value_only',
  add constraint supplier_purchases_record_mode_valid
    check (record_mode in ('value_only', 'product_lines'));

alter table public.supplier_purchases
  drop constraint supplier_purchases_currency_values_consistent,
  add constraint supplier_purchases_currency_values_consistent
    check (
      (
        currency = 'RON'
        and purchase_exchange_rate is null
        and inventory_cost_ron = original_amount
      )
      or (
        currency = 'USD'
        and purchase_exchange_rate is not null
        and (
          record_mode = 'product_lines'
          or inventory_cost_ron = round(
            original_amount * purchase_exchange_rate,
            2
          )
        )
      )
    );

create table public.supplier_purchase_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  supplier_purchase_id uuid not null,
  product_id uuid not null,
  line_number integer not null,
  quantity bigint not null,
  unit_price_original_currency numeric(18, 2) not null,
  purchase_exchange_rate numeric(18, 8) not null,
  unit_cost_ron numeric(18, 8) not null,
  line_total_ron numeric(18, 2) not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint supplier_purchase_lines_purchase_business_fkey
    foreign key (business_id, supplier_purchase_id)
    references public.supplier_purchases (business_id, id),
  constraint supplier_purchase_lines_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint supplier_purchase_lines_purchase_line_key
    unique (supplier_purchase_id, line_number),
  constraint supplier_purchase_lines_purchase_product_key
    unique (supplier_purchase_id, product_id),
  constraint supplier_purchase_lines_number_positive
    check (line_number > 0),
  constraint supplier_purchase_lines_quantity_positive
    check (quantity > 0),
  constraint supplier_purchase_lines_unit_price_positive
    check (unit_price_original_currency > 0),
  constraint supplier_purchase_lines_exchange_rate_positive
    check (purchase_exchange_rate > 0),
  constraint supplier_purchase_lines_unit_cost_consistent
    check (
      unit_cost_ron = round(
        unit_price_original_currency * purchase_exchange_rate,
        8
      )
    ),
  constraint supplier_purchase_lines_total_consistent
    check (
      line_total_ron = round(quantity * unit_cost_ron, 2)
      and line_total_ron > 0
    )
);

create index supplier_purchase_lines_business_product_idx
  on public.supplier_purchase_lines (
    business_id,
    product_id,
    created_at desc
  );
create unique index stock_movements_supplier_purchase_product_key
  on public.stock_movements (business_id, reference_id, product_id)
  where movement_type = 'supplier_receipt'
    and reference_type = 'supplier_purchase'
    and reversal_of_id is null;

alter table public.supplier_purchase_lines enable row level security;

create policy supplier_purchase_lines_select_member
on public.supplier_purchase_lines
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.supplier_purchase_lines
  from anon, authenticated;
grant select on table public.supplier_purchase_lines
  to authenticated, service_role;
grant all on table public.supplier_purchase_lines to service_role;

create function private.prevent_supplier_purchase_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Supplier purchase lines are immutable'
    using errcode = '55000';
end;
$$;

create trigger supplier_purchase_lines_immutable
before update or delete on public.supplier_purchase_lines
for each row
execute function private.prevent_supplier_purchase_line_mutation();

create function private.validate_supplier_purchase_line_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_purchase record;
  purchase_to_check public.supplier_purchases%rowtype;
  line_count bigint;
  original_total numeric;
  inventory_total numeric;
  invalid_rate_count bigint;
begin
  for target_purchase in
    select distinct
      line.business_id,
      line.supplier_purchase_id
    from new_supplier_purchase_lines as line
  loop
    select purchase.*
    into purchase_to_check
    from public.supplier_purchases as purchase
    where purchase.business_id = target_purchase.business_id
      and purchase.id = target_purchase.supplier_purchase_id
    for share;

    if not found
      or purchase_to_check.record_mode <> 'product_lines'
    then
      raise exception 'Product lines require a product-line supplier purchase'
        using errcode = '23514';
    end if;

    select
      count(*),
      sum(line.quantity * line.unit_price_original_currency),
      sum(line.line_total_ron),
      count(*) filter (
        where (
          purchase_to_check.currency = 'RON'
          and line.purchase_exchange_rate <> 1
        ) or (
          purchase_to_check.currency = 'USD'
          and line.purchase_exchange_rate
            <> purchase_to_check.purchase_exchange_rate
        )
      )
    into
      line_count,
      original_total,
      inventory_total,
      invalid_rate_count
    from public.supplier_purchase_lines as line
    where line.business_id = target_purchase.business_id
      and line.supplier_purchase_id =
        target_purchase.supplier_purchase_id;

    if line_count = 0
      or original_total <> purchase_to_check.original_amount
      or inventory_total <> purchase_to_check.inventory_cost_ron
      or invalid_rate_count <> 0
    then
      raise exception 'Supplier purchase line totals do not reconcile'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end;
$$;

create trigger supplier_purchase_lines_validate_totals
after insert on public.supplier_purchase_lines
referencing new table as new_supplier_purchase_lines
for each statement
execute function private.validate_supplier_purchase_line_totals();

revoke all on function private.prevent_supplier_purchase_line_mutation()
  from public;
revoke all on function private.validate_supplier_purchase_line_totals()
  from public;

alter table private.financial_command_idempotency
  drop constraint financial_command_idempotency_command_name,
  add constraint financial_command_idempotency_command_name
    check (
      command_name in (
        'create_customer_credit_purchase',
        'create_supplier_purchase',
        'create_supplier_purchase_with_lines'
      )
    );

create function public.create_supplier_purchase_with_lines_idempotent(
  target_business_id uuid,
  target_supplier_id uuid,
  target_business_day_id uuid,
  target_currency text,
  target_purchase_exchange_rate text,
  target_destination_location_id uuid,
  target_idempotency_key uuid,
  target_lines jsonb,
  target_description text default null,
  target_due_date date default null,
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
  target_command_name constant text :=
    'create_supplier_purchase_with_lines';
  normalized_currency text := pg_catalog.upper(
    pg_catalog.btrim(target_currency)
  );
  normalized_rate text := nullif(
    pg_catalog.btrim(target_purchase_exchange_rate),
    ''
  );
  normalized_description text := nullif(
    pg_catalog.btrim(target_description),
    ''
  );
  normalized_reason text := nullif(
    pg_catalog.btrim(target_audit_reason),
    ''
  );
  parsed_rate numeric;
  effective_rate numeric;
  selected_day_date date;
  selected_day_status public.business_day_status;
  selected_supplier_active boolean;
  selected_location_active boolean;
  selected_location_type public.inventory_location_type;
  new_entry_origin text;
  normalized_lines jsonb := '[]'::jsonb;
  line_record record;
  parsed_product_id uuid;
  parsed_product_active boolean;
  parsed_quantity bigint;
  parsed_unit_price numeric;
  parsed_unit_cost numeric;
  parsed_line_total_ron numeric;
  original_total numeric := 0;
  inventory_total numeric := 0;
  seen_product_ids uuid[] := array[]::uuid[];
  line_count integer;
  request_fingerprint text;
  existing_result_id uuid;
  existing_fingerprint text;
  new_purchase_id uuid := gen_random_uuid();
  new_value_movement_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);

  if target_idempotency_key is null then
    raise exception 'Purchase request identifier is required'
      using errcode = '22023';
  end if;

  if normalized_currency is null
    or normalized_currency not in ('RON', 'USD')
  then
    raise exception 'Purchase currency must be RON or USD'
      using errcode = '22023';
  end if;

  if normalized_currency = 'RON' then
    if normalized_rate is not null then
      raise exception 'RON purchases must not include an exchange rate'
        using errcode = '22023';
    end if;

    parsed_rate := null;
    effective_rate := 1;
  else
    parsed_rate := private.parse_positive_exchange_rate(
      normalized_rate,
      'Purchase exchange rate'
    );
    effective_rate := parsed_rate;
  end if;

  if normalized_description is not null
    and char_length(normalized_description) > 500
  then
    raise exception 'Description must not exceed 500 characters'
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
    raise exception 'Purchase requires 1 to 100 product lines'
      using errcode = '22023';
  end if;

  for line_record in
    select line.value, line.ordinality
    from pg_catalog.jsonb_array_elements(target_lines)
      with ordinality as line(value, ordinality)
  loop
    if pg_catalog.jsonb_typeof(line_record.value) <> 'object'
      or (
        line_record.value
          - array[
            'product_id',
            'quantity',
            'unit_price_original_currency'
          ]
      ) <> '{}'::jsonb
    then
      raise exception 'Purchase line % has unsupported fields',
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
        raise exception 'Purchase line % product is invalid',
          line_record.ordinality
          using errcode = '22023';
    end;

    if parsed_product_id is null then
      raise exception 'Purchase line % product is required',
        line_record.ordinality
        using errcode = '22023';
    end if;

    if parsed_product_id = any(seen_product_ids) then
      raise exception 'Each product may appear only once per purchase'
        using errcode = '22023';
    end if;

    select product.is_active
    into parsed_product_active
    from public.products as product
    where product.business_id = target_business_id
      and product.id = parsed_product_id
    for share;

    if parsed_product_active is null then
      raise exception 'Purchase line % product does not exist',
        line_record.ordinality
        using errcode = '22023';
    end if;

    if not parsed_product_active then
      raise exception 'Inactive products cannot be received'
        using errcode = '55000';
    end if;

    parsed_quantity := private.parse_stock_quantity(
      line_record.value ->> 'quantity'
    );
    parsed_unit_price := private.parse_positive_ron_amount(
      line_record.value ->> 'unit_price_original_currency',
      'Purchase line unit price'
    );
    parsed_unit_cost := round(
      parsed_unit_price * effective_rate,
      8
    );
    parsed_line_total_ron := round(
      parsed_quantity * parsed_unit_cost,
      2
    );

    if parsed_quantity * parsed_unit_price
        > 9999999999999999.99
      or parsed_line_total_ron > 9999999999999999.99
    then
      raise exception 'Purchase line % total is too large',
        line_record.ordinality
        using errcode = '22003';
    end if;

    original_total :=
      original_total + parsed_quantity * parsed_unit_price;
    inventory_total :=
      inventory_total + parsed_line_total_ron;

    if original_total > 9999999999999999.99
      or inventory_total > 9999999999999999.99
    then
      raise exception 'Supplier purchase total is too large'
        using errcode = '22003';
    end if;

    normalized_lines := normalized_lines
      || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'line_number', line_record.ordinality,
          'product_id', parsed_product_id,
          'quantity', parsed_quantity,
          'unit_price_original_currency', parsed_unit_price,
          'purchase_exchange_rate', effective_rate,
          'unit_cost_ron', parsed_unit_cost,
          'line_total_ron', parsed_line_total_ron
        )
      );
    seen_product_ids := pg_catalog.array_append(
      seen_product_ids,
      parsed_product_id
    );
  end loop;

  line_count := pg_catalog.jsonb_array_length(normalized_lines);

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'supplier_id', target_supplier_id,
      'business_day_id', target_business_day_id,
      'currency', normalized_currency,
      'purchase_exchange_rate', parsed_rate,
      'destination_location_id', target_destination_location_id,
      'lines', normalized_lines,
      'description', normalized_description,
      'due_date', target_due_date,
      'audit_reason', normalized_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text
        || ':'
        || target_command_name
        || ':'
        || target_idempotency_key::text,
      9250
    )
  );

  select
    command.result_entity_id,
    command.request_fingerprint
  into existing_result_id, existing_fingerprint
  from private.financial_command_idempotency as command
  where command.business_id = target_business_id
    and command.command_name = target_command_name
    and command.idempotency_key = target_idempotency_key;

  if existing_result_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Purchase request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_result_id;
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
      raise exception 'Administrator access is required for historical entries'
        using errcode = '42501';
    end if;

    if normalized_reason is null then
      raise exception 'Historical entries require an audit reason'
        using errcode = '22023';
    end if;

    new_entry_origin := 'admin_historical';
  else
    new_entry_origin := 'operational';
  end if;

  if target_due_date is not null
    and target_due_date < selected_day_date
  then
    raise exception 'Due date must not be before the purchase date'
      using errcode = '22023';
  end if;

  select supplier.is_active
  into selected_supplier_active
  from public.suppliers as supplier
  where supplier.id = target_supplier_id
    and supplier.business_id = target_business_id
  for share;

  if selected_supplier_active is null then
    raise exception 'Supplier does not exist'
      using errcode = '22023';
  end if;

  if not selected_supplier_active then
    raise exception 'Inactive suppliers cannot receive new purchases'
      using errcode = '55000';
  end if;

  select location.is_active, location.type
  into selected_location_active, selected_location_type
  from public.inventory_locations as location
  where location.id = target_destination_location_id
    and location.business_id = target_business_id
  for share;

  if selected_location_type is null then
    raise exception 'Destination location does not exist'
      using errcode = '22023';
  end if;

  if not selected_location_active then
    raise exception 'Destination location is inactive'
      using errcode = '55000';
  end if;

  insert into public.supplier_purchases (
    id,
    business_id,
    business_day_id,
    supplier_id,
    purchase_date,
    currency,
    original_amount,
    purchase_exchange_rate,
    inventory_cost_ron,
    destination_location_id,
    description,
    due_date,
    entry_origin,
    record_mode,
    created_by
  )
  values (
    new_purchase_id,
    target_business_id,
    target_business_day_id,
    target_supplier_id,
    selected_day_date,
    normalized_currency::public.transaction_currency,
    original_total,
    parsed_rate,
    inventory_total,
    target_destination_location_id,
    normalized_description,
    target_due_date,
    new_entry_origin,
    'product_lines',
    current_user_id
  );

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    destination_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    selected_day_date,
    'supplier_purchase_receipt',
    target_destination_location_id,
    inventory_total,
    'supplier_purchase',
    new_purchase_id,
    current_user_id
  )
  returning id into new_value_movement_id;

  insert into public.supplier_purchase_lines (
    business_id,
    supplier_purchase_id,
    product_id,
    line_number,
    quantity,
    unit_price_original_currency,
    purchase_exchange_rate,
    unit_cost_ron,
    line_total_ron
  )
  select
    target_business_id,
    new_purchase_id,
    line.product_id,
    line.line_number,
    line.quantity,
    line.unit_price_original_currency,
    line.purchase_exchange_rate,
    line.unit_cost_ron,
    line.line_total_ron
  from pg_catalog.jsonb_to_recordset(normalized_lines) as line(
    line_number integer,
    product_id uuid,
    quantity bigint,
    unit_price_original_currency numeric,
    purchase_exchange_rate numeric,
    unit_cost_ron numeric,
    line_total_ron numeric
  );

  insert into public.stock_movements (
    business_id,
    product_id,
    movement_type,
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
    'supplier_receipt',
    target_destination_location_id,
    line.quantity,
    line.unit_cost_ron,
    target_business_day_id,
    'supplier_purchase',
    new_purchase_id,
    'Supplier product receipt',
    current_user_id,
    line.id,
    pg_catalog.md5(
      pg_catalog.jsonb_build_object(
        'supplier_purchase_id', new_purchase_id,
        'supplier_purchase_line_id', line.id,
        'product_id', line.product_id,
        'destination_location_id', target_destination_location_id,
        'quantity', line.quantity,
        'unit_cost_ron', line.unit_cost_ron
      )::text
    )
  from public.supplier_purchase_lines as line
  where line.business_id = target_business_id
    and line.supplier_purchase_id = new_purchase_id
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
    'supplier_purchase.created',
    'supplier_purchase',
    new_purchase_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'supplier_id', target_supplier_id,
      'purchase_date', selected_day_date,
      'currency', normalized_currency,
      'original_amount', original_total,
      'purchase_exchange_rate', parsed_rate,
      'inventory_cost_ron', inventory_total,
      'destination_location_id', target_destination_location_id,
      'inventory_movement_id', new_value_movement_id,
      'product_line_count', line_count,
      'record_mode', 'product_lines',
      'description', normalized_description,
      'due_date', target_due_date,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  insert into private.financial_command_idempotency (
    business_id,
    command_name,
    idempotency_key,
    request_fingerprint,
    result_entity_id,
    created_by
  )
  values (
    target_business_id,
    target_command_name,
    target_idempotency_key,
    request_fingerprint,
    new_purchase_id,
    current_user_id
  );

  return new_purchase_id;
end;
$$;

revoke all on function public.create_supplier_purchase_with_lines_idempotent(
  uuid, uuid, uuid, text, text, uuid, uuid, jsonb, text, date, text
) from public, anon, authenticated;
grant execute on function public.create_supplier_purchase_with_lines_idempotent(
  uuid, uuid, uuid, text, text, uuid, uuid, jsonb, text, date, text
) to authenticated, service_role;

drop function public.reverse_supplier_purchase(uuid, uuid, text);

create function public.reverse_supplier_purchase(
  target_business_id uuid,
  target_purchase_id uuid,
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
  normalized_reason text := pg_catalog.btrim(target_reason);
  reversal_time timestamptz := pg_catalog.now();
  purchase_to_reverse public.supplier_purchases%rowtype;
  movement_to_reverse public.inventory_value_movements%rowtype;
  product_movement record;
  reversed_product_movement_count integer := 0;
  new_movement_id uuid;
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

  select purchase.*
  into purchase_to_reverse
  from public.supplier_purchases as purchase
  where purchase.id = target_purchase_id
    and purchase.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Supplier purchase does not exist'
      using errcode = '22023';
  end if;

  if purchase_to_reverse.entry_origin = 'opening_balance' then
    raise exception 'Opening payables must use opening-balance reversal'
      using errcode = '55000';
  end if;

  if purchase_to_reverse.reversed_at is not null then
    raise exception 'Supplier purchase is already reversed'
      using errcode = '55000';
  end if;

  select movement.*
  into movement_to_reverse
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and movement.source_entity_type = 'supplier_purchase'
    and movement.source_entity_id = target_purchase_id
    and movement.movement_type = 'supplier_purchase_receipt'
  for update;

  if not found then
    raise exception 'Supplier purchase inventory receipt does not exist'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = movement_to_reverse.id
  ) then
    raise exception 'Supplier purchase is already reversed'
      using errcode = '55000';
  end if;

  for product_movement in
    select movement.id
    from public.stock_movements as movement
    where movement.business_id = target_business_id
      and movement.reference_type = 'supplier_purchase'
      and movement.reference_id = target_purchase_id
      and movement.movement_type = 'supplier_receipt'
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

  update public.supplier_purchases
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_purchase_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Supplier purchase reversal lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    source_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    created_by,
    reversal_of_id
  )
  values (
    target_business_id,
    purchase_to_reverse.business_day_id,
    purchase_to_reverse.purchase_date,
    'supplier_purchase_reversal',
    purchase_to_reverse.destination_location_id,
    purchase_to_reverse.inventory_cost_ron,
    'supplier_purchase',
    target_purchase_id,
    current_user_id,
    movement_to_reverse.id
  )
  returning id into new_movement_id;

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
    'supplier_purchase.reversed',
    'supplier_purchase',
    target_purchase_id,
    pg_catalog.jsonb_build_object(
      'status', 'unpaid',
      'original_amount', purchase_to_reverse.original_amount,
      'inventory_cost_ron', purchase_to_reverse.inventory_cost_ron,
      'inventory_movement_id', movement_to_reverse.id,
      'product_line_count', reversed_product_movement_count
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time,
      'reversal_movement_id', new_movement_id,
      'product_stock_reversal_count', reversed_product_movement_count,
      'negative_stock_override', target_allow_negative_stock
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.reverse_supplier_purchase(
  uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.reverse_supplier_purchase(
  uuid, uuid, text, boolean
) to authenticated, service_role;

create function public.reverse_supplier_purchase(
  target_business_id uuid,
  target_purchase_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reverse_supplier_purchase(
    target_business_id,
    target_purchase_id,
    target_reason,
    false
  );
end;
$$;

revoke all on function public.reverse_supplier_purchase(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.reverse_supplier_purchase(
  uuid, uuid, text
) to authenticated, service_role;

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

revoke all on table public.stock_movement_summaries
  from anon, authenticated;
grant select on table public.stock_movement_summaries
  to authenticated, service_role;

create view public.supplier_purchase_line_summaries
with (security_invoker = true)
as
select
  line.id as line_id,
  line.business_id,
  line.supplier_purchase_id,
  line.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  line.line_number,
  line.quantity::text as quantity,
  line.unit_price_original_currency::text
    as unit_price_original_currency,
  line.purchase_exchange_rate::text as purchase_exchange_rate,
  line.unit_cost_ron::text as unit_cost_ron,
  line.line_total_ron::text as line_total_ron
from public.supplier_purchase_lines as line
inner join public.products as product
  on product.business_id = line.business_id
  and product.id = line.product_id;

create or replace view public.supplier_purchase_summaries
with (security_invoker = true)
as
select
  purchase.id as purchase_id,
  purchase.business_id,
  purchase.business_day_id,
  purchase.supplier_id,
  supplier.name as supplier_name,
  purchase.purchase_date,
  purchase.currency,
  purchase.original_amount::text as original_amount,
  purchase.purchase_exchange_rate::text as purchase_exchange_rate,
  purchase.inventory_cost_ron::text as inventory_cost_ron,
  purchase.destination_location_id,
  location.name as destination_location_name,
  location.type as destination_location_type,
  purchase.description,
  purchase.due_date,
  purchase.entry_origin,
  purchase.created_by,
  purchase.created_at,
  case
    when purchase.reversed_at is not null then 'reversed'
    when coalesce(active_allocations.allocated_original_amount, 0) = 0
      then 'unpaid'
    when coalesce(active_allocations.allocated_original_amount, 0)
      = purchase.original_amount
      then 'paid'
    else 'partial'
  end as derived_status,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason,
  coalesce(
    active_allocations.allocated_original_amount,
    0
  )::text as allocated_original_amount,
  (
    case
      when purchase.reversed_at is null
        then purchase.original_amount
          - coalesce(active_allocations.allocated_original_amount, 0)
      else 0::numeric
    end
  )::text as remaining_original_amount,
  (
    case
      when purchase.reversed_at is null
        then purchase.inventory_cost_ron
          - coalesce(active_allocations.historical_ron_value, 0)
      else 0::numeric
    end
  )::text as remaining_historical_ron,
  purchase.record_mode,
  coalesce(product_lines.line_count, 0)::integer as product_line_count
from public.supplier_purchases as purchase
inner join public.suppliers as supplier
  on supplier.id = purchase.supplier_id
  and supplier.business_id = purchase.business_id
left join public.inventory_locations as location
  on location.id = purchase.destination_location_id
  and location.business_id = purchase.business_id
left join lateral (
  select count(*) as line_count
  from public.supplier_purchase_lines as line
  where line.business_id = purchase.business_id
    and line.supplier_purchase_id = purchase.id
) as product_lines on true
left join lateral (
  select
    sum(allocation.allocated_original_amount)
      as allocated_original_amount,
    sum(allocation.historical_ron_value) as historical_ron_value
  from public.supplier_payment_allocations as allocation
  inner join public.supplier_payments as payment
    on payment.id = allocation.supplier_payment_id
    and payment.reversed_at is null
  where allocation.supplier_purchase_id = purchase.id
) as active_allocations on true;

revoke all on table public.supplier_purchase_line_summaries
  from anon, authenticated;
grant select on table public.supplier_purchase_line_summaries
  to authenticated, service_role;

comment on table public.supplier_purchase_lines is
  'Immutable product quantities and historical costs received by a supplier purchase.';
comment on function public.create_supplier_purchase_with_lines_idempotent(
  uuid, uuid, uuid, text, text, uuid, uuid, jsonb, text, date, text
) is
  'Atomically creates a payable, reconciled inventory value, product lines, and quantity receipts.';
comment on function public.reverse_supplier_purchase(
  uuid, uuid, text, boolean
) is
  'Reverses supplier payable, value, and product quantity effects; negative stock requires an explicit administrator override.';
comment on view public.supplier_purchase_line_summaries is
  'Backward-compatible product-line detail for supplier purchases that have exact received quantities.';

commit;
