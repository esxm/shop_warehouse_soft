begin;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null,
  sale_date date not null,
  sale_number integer not null,
  shop_location_id uuid not null,
  customer_id uuid,
  cash_amount_ron numeric(18, 2) not null,
  bank_amount_ron numeric(18, 2) not null,
  credit_amount_ron numeric(18, 2) not null,
  total_amount_ron numeric(18, 2) not null,
  total_cost_ron numeric(18, 2) not null,
  gross_profit_ron numeric(18, 2) not null,
  profit_percent numeric(18, 4) not null,
  notes text,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default statement_timestamp(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint sales_business_id_id_key unique (business_id, id),
  constraint sales_business_day_number_key
    unique (business_id, business_day_id, sale_number),
  constraint sales_business_idempotency_key
    unique (business_id, idempotency_key),
  constraint sales_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint sales_shop_business_fkey
    foreign key (business_id, shop_location_id)
    references public.inventory_locations (business_id, id),
  constraint sales_customer_business_fkey
    foreign key (business_id, customer_id)
    references public.customers (business_id, id),
  constraint sales_number_positive check (sale_number > 0),
  constraint sales_payments_nonnegative
    check (
      cash_amount_ron >= 0
      and bank_amount_ron >= 0
      and credit_amount_ron >= 0
    ),
  constraint sales_payment_total_consistent
    check (
      total_amount_ron > 0
      and total_amount_ron =
        cash_amount_ron + bank_amount_ron + credit_amount_ron
    ),
  constraint sales_cost_profit_consistent
    check (
      total_cost_ron > 0
      and gross_profit_ron = total_amount_ron - total_cost_ron
      and profit_percent = round(
        gross_profit_ron / total_cost_ron * 100,
        4
      )
    ),
  constraint sales_credit_customer_consistent
    check (
      (credit_amount_ron = 0 and customer_id is null)
      or (credit_amount_ron > 0 and customer_id is not null)
    ),
  constraint sales_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  constraint sales_fingerprint_valid
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint sales_reversal_consistent
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

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  sale_id uuid not null,
  product_id uuid not null,
  line_number integer not null,
  quantity bigint not null,
  unit_cost_ron numeric(18, 8) not null,
  unit_selling_price_ron numeric(18, 2) not null,
  line_cost_ron numeric(18, 2) not null,
  line_total_ron numeric(18, 2) not null,
  gross_profit_ron numeric(18, 2) not null,
  profit_percent numeric(18, 4) not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint sale_lines_sale_business_fkey
    foreign key (business_id, sale_id)
    references public.sales (business_id, id),
  constraint sale_lines_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint sale_lines_sale_line_key unique (sale_id, line_number),
  constraint sale_lines_sale_product_key unique (sale_id, product_id),
  constraint sale_lines_number_positive check (line_number > 0),
  constraint sale_lines_quantity_positive check (quantity > 0),
  constraint sale_lines_unit_cost_positive check (unit_cost_ron > 0),
  constraint sale_lines_selling_price_positive
    check (unit_selling_price_ron > 0),
  constraint sale_lines_amounts_consistent
    check (
      line_cost_ron = round(quantity * unit_cost_ron, 2)
      and line_total_ron = quantity * unit_selling_price_ron
      and gross_profit_ron = line_total_ron - line_cost_ron
      and profit_percent = round(
        gross_profit_ron / line_cost_ron * 100,
        4
      )
      and line_cost_ron > 0
      and line_total_ron > 0
    )
);

alter table public.customer_credit_purchases
  add column sale_id uuid,
  add constraint customer_credit_purchases_sale_business_fkey
    foreign key (business_id, sale_id)
    references public.sales (business_id, id);

create unique index customer_credit_purchases_sale_key
  on public.customer_credit_purchases (sale_id)
  where sale_id is not null;
create index sales_business_day_created_idx
  on public.sales (business_id, business_day_id, created_at desc);
create index sales_business_customer_idx
  on public.sales (business_id, customer_id, created_at desc)
  where customer_id is not null;
create index sale_lines_business_product_idx
  on public.sale_lines (business_id, product_id, created_at desc);
create unique index stock_movements_sale_product_key
  on public.stock_movements (business_id, reference_id, product_id)
  where movement_type = 'sale'
    and reference_type = 'product_sale'
    and reversal_of_id is null;
create unique index inventory_value_movements_product_sale_key
  on public.inventory_value_movements (
    business_id,
    source_entity_id,
    movement_type
  )
  where source_entity_type = 'product_sale';

alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;

create policy sales_select_member
on public.sales
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy sale_lines_select_member
on public.sale_lines
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.sales from anon, authenticated;
revoke all on table public.sale_lines from anon, authenticated;
grant select on table public.sales to authenticated, service_role;
grant select on table public.sale_lines to authenticated, service_role;
grant all on table public.sales to service_role;
grant all on table public.sale_lines to service_role;

create function private.prevent_sale_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Sale lines are immutable'
    using errcode = '55000';
end;
$$;

create function private.guard_sale_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Sales are immutable; use an administrator reversal'
      using errcode = '55000';
  end if;

  if old.reversed_at is not null then
    raise exception 'Reversed sales are immutable'
      using errcode = '55000';
  end if;

  if (
    to_jsonb(new)
      - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) <> (
    to_jsonb(old)
      - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) then
    raise exception 'Sale values are immutable; reverse and re-enter the sale'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger sale_lines_immutable
before update or delete on public.sale_lines
for each row
execute function private.prevent_sale_line_mutation();

create trigger sales_immutable
before update or delete on public.sales
for each row
execute function private.guard_sale_mutation();

create function private.validate_sale_line_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_sale record;
  sale_to_check public.sales%rowtype;
  line_count bigint;
  revenue_total numeric;
  cost_total numeric;
  profit_total numeric;
begin
  for target_sale in
    select distinct line.business_id, line.sale_id
    from new_sale_lines as line
  loop
    select sale.*
    into sale_to_check
    from public.sales as sale
    where sale.business_id = target_sale.business_id
      and sale.id = target_sale.sale_id
    for share;

    if not found then
      raise exception 'Sale does not exist'
        using errcode = '23514';
    end if;

    select
      count(*),
      sum(line.line_total_ron),
      sum(line.line_cost_ron),
      sum(line.gross_profit_ron)
    into
      line_count,
      revenue_total,
      cost_total,
      profit_total
    from public.sale_lines as line
    where line.business_id = target_sale.business_id
      and line.sale_id = target_sale.sale_id;

    if line_count = 0
      or revenue_total <> sale_to_check.total_amount_ron
      or cost_total <> sale_to_check.total_cost_ron
      or profit_total <> sale_to_check.gross_profit_ron
    then
      raise exception 'Sale line totals do not reconcile'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end;
$$;

create trigger sale_lines_validate_totals
after insert on public.sale_lines
referencing new table as new_sale_lines
for each statement
execute function private.validate_sale_line_totals();

revoke all on function private.prevent_sale_line_mutation() from public;
revoke all on function private.guard_sale_mutation() from public;
revoke all on function private.validate_sale_line_totals() from public;

create function public.create_product_sale(
  target_business_id uuid,
  target_business_day_id uuid,
  target_shop_location_id uuid,
  target_cash_amount_ron text,
  target_bank_amount_ron text,
  target_credit_amount_ron text,
  target_idempotency_key uuid,
  target_lines jsonb,
  target_customer_id uuid default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_notes text := nullif(pg_catalog.btrim(target_notes), '');
  parsed_cash numeric;
  parsed_bank numeric;
  parsed_credit numeric;
  selected_day_date date;
  selected_day_status public.business_day_status;
  shop_location_active boolean;
  shop_location_type public.inventory_location_type;
  selected_customer_active boolean;
  active_cash_account_exists boolean;
  active_bank_account_exists boolean;
  daily_sale public.daily_sales%rowtype;
  requested_lines jsonb := '[]'::jsonb;
  costed_lines jsonb := '[]'::jsonb;
  line_record record;
  product_to_lock record;
  parsed_product_id uuid;
  parsed_product_active boolean;
  parsed_quantity bigint;
  parsed_selling_price numeric;
  seen_product_ids uuid[] := array[]::uuid[];
  shop_quantity bigint;
  shop_cost_balance numeric;
  preserved_unit_cost numeric;
  parsed_line_cost numeric;
  parsed_line_total numeric;
  parsed_line_profit numeric;
  parsed_line_profit_percent numeric;
  sale_total numeric := 0;
  sale_cost numeric := 0;
  sale_profit numeric;
  sale_profit_percent numeric;
  next_sale_number integer;
  request_fingerprint text;
  existing_sale_id uuid;
  existing_fingerprint text;
  new_sale_id uuid := gen_random_uuid();
  new_credit_purchase_id uuid;
  new_cogs_movement_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if target_idempotency_key is null then
    raise exception 'Sale request identifier is required'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 500
  then
    raise exception 'Sale notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  parsed_cash := private.parse_nonnegative_ron_amount(
    target_cash_amount_ron,
    'Cash amount'
  );
  parsed_bank := private.parse_nonnegative_ron_amount(
    target_bank_amount_ron,
    'Bank amount'
  );
  parsed_credit := private.parse_nonnegative_ron_amount(
    target_credit_amount_ron,
    'Credit amount'
  );

  if target_lines is null
    or pg_catalog.jsonb_typeof(target_lines) <> 'array'
    or pg_catalog.jsonb_array_length(target_lines) not between 1 and 100
  then
    raise exception 'Sale requires 1 to 100 product lines'
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
            'unit_selling_price_ron'
          ]
      ) <> '{}'::jsonb
    then
      raise exception 'Sale line % has unsupported fields',
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
        raise exception 'Sale line % product is invalid',
          line_record.ordinality
          using errcode = '22023';
    end;

    if parsed_product_id is null then
      raise exception 'Sale line % product is required',
        line_record.ordinality
        using errcode = '22023';
    end if;

    if parsed_product_id = any(seen_product_ids) then
      raise exception 'Each product may appear only once per sale'
        using errcode = '22023';
    end if;

    select product.is_active
    into parsed_product_active
    from public.products as product
    where product.business_id = target_business_id
      and product.id = parsed_product_id
    for share;

    if parsed_product_active is null then
      raise exception 'Sale line % product does not exist',
        line_record.ordinality
        using errcode = '22023';
    end if;

    if not parsed_product_active then
      raise exception 'Inactive products cannot be sold'
        using errcode = '55000';
    end if;

    parsed_quantity := private.parse_stock_quantity(
      line_record.value ->> 'quantity'
    );
    parsed_selling_price := private.parse_positive_ron_amount(
      line_record.value ->> 'unit_selling_price_ron',
      'Selling price'
    );

    requested_lines := requested_lines
      || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'line_number', line_record.ordinality,
          'product_id', parsed_product_id,
          'quantity', parsed_quantity,
          'unit_selling_price_ron', parsed_selling_price
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
      'shop_location_id', target_shop_location_id,
      'customer_id', target_customer_id,
      'cash_amount_ron', parsed_cash,
      'bank_amount_ron', parsed_bank,
      'credit_amount_ron', parsed_credit,
      'lines', requested_lines,
      'notes', normalized_notes
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9350
    )
  );

  select sale.id, sale.request_fingerprint
  into existing_sale_id, existing_fingerprint
  from public.sales as sale
  where sale.business_id = target_business_id
    and sale.idempotency_key = target_idempotency_key;

  if existing_sale_id is not null then
    if existing_fingerprint is distinct from request_fingerprint then
      raise exception 'Sale request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_sale_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select day.business_date, day.status
  into selected_day_date, selected_day_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for update;

  if selected_day_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if selected_day_status <> 'open' then
    raise exception 'Product sales require the current open business day'
      using errcode = '55000';
  end if;

  select location.is_active, location.type
  into shop_location_active, shop_location_type
  from public.inventory_locations as location
  where location.id = target_shop_location_id
    and location.business_id = target_business_id
  for share;

  if shop_location_type is null then
    raise exception 'Shop inventory location does not exist'
      using errcode = '22023';
  end if;

  if not shop_location_active or shop_location_type <> 'shop' then
    raise exception 'Product sales require an active shop location'
      using errcode = '55000';
  end if;

  if parsed_credit > 0 then
    if target_customer_id is null then
      raise exception 'Credit sales require a customer'
        using errcode = '22023';
    end if;

    select customer.is_active
    into selected_customer_active
    from public.customers as customer
    where customer.business_id = target_business_id
      and customer.id = target_customer_id
    for share;

    if selected_customer_active is null then
      raise exception 'Customer does not exist'
        using errcode = '22023';
    end if;

    if not selected_customer_active then
      raise exception 'Inactive customers cannot receive credit sales'
        using errcode = '55000';
    end if;
  elsif target_customer_id is not null then
    raise exception 'Customer is used only when the sale includes credit'
      using errcode = '22023';
  end if;

  if parsed_cash > 0 then
    select exists (
      select 1
      from public.financial_accounts as account
      where account.business_id = target_business_id
        and account.type = 'cash'
        and account.currency = 'RON'
        and account.is_active
    )
    into active_cash_account_exists;

    if not active_cash_account_exists then
      raise exception 'An active RON cash account is required'
        using errcode = '55000';
    end if;
  end if;

  if parsed_bank > 0 then
    select exists (
      select 1
      from public.financial_accounts as account
      where account.business_id = target_business_id
        and account.type = 'bank'
        and account.currency = 'RON'
        and account.is_active
    )
    into active_bank_account_exists;

    if not active_bank_account_exists then
      raise exception 'An active RON bank account is required'
        using errcode = '55000';
    end if;
  end if;

  select daily.*
  into daily_sale
  from public.daily_sales as daily
  where daily.business_id = target_business_id
    and daily.business_day_id = target_business_day_id
  for update;

  if not found then
    insert into public.daily_sales (
      business_id,
      business_day_id,
      cash_sales_ron,
      bank_sales_ron,
      credit_sales_ron,
      total_sales_ron,
      created_by,
      updated_by
    )
    values (
      target_business_id,
      target_business_day_id,
      0,
      0,
      0,
      0,
      current_user_id,
      current_user_id
    )
    returning * into daily_sale;
  end if;

  if daily_sale.status <> 'draft' then
    raise exception 'Closed daily sales cannot receive product sales'
      using errcode = '55000';
  end if;

  for product_to_lock in
    select
      line.product_id,
      line.line_number,
      line.quantity,
      line.unit_selling_price_ron
    from pg_catalog.jsonb_to_recordset(requested_lines) as line(
      line_number integer,
      product_id uuid,
      quantity bigint,
      unit_selling_price_ron numeric
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

    shop_quantity := private.get_product_stock_balance(
      target_business_id,
      product_to_lock.product_id,
      target_shop_location_id
    );

    if shop_quantity < product_to_lock.quantity then
      raise exception 'Insufficient shop quantity for sale line %',
        product_to_lock.line_number
        using errcode = '22023';
    end if;

    if private.has_uncosted_product_stock_activity(
      target_business_id,
      product_to_lock.product_id,
      target_shop_location_id
    ) then
      raise exception 'Shop cost is unavailable for sale line %',
        product_to_lock.line_number
        using errcode = '55000';
    end if;

    shop_cost_balance := private.get_product_stock_cost_balance(
      target_business_id,
      product_to_lock.product_id,
      target_shop_location_id
    );

    if shop_quantity <= 0 or shop_cost_balance <= 0 then
      raise exception 'Shop cost is unavailable for sale line %',
        product_to_lock.line_number
        using errcode = '55000';
    end if;

    preserved_unit_cost := round(
      shop_cost_balance / shop_quantity,
      8
    );
    parsed_line_cost := round(
      product_to_lock.quantity * preserved_unit_cost,
      2
    );
    parsed_line_total :=
      product_to_lock.quantity
        * product_to_lock.unit_selling_price_ron;
    parsed_line_profit := parsed_line_total - parsed_line_cost;
    parsed_line_profit_percent := round(
      parsed_line_profit / parsed_line_cost * 100,
      4
    );

    sale_total := sale_total + parsed_line_total;
    sale_cost := sale_cost + parsed_line_cost;

    if sale_total > 9999999999999999.99
      or sale_cost > 9999999999999999.99
    then
      raise exception 'Product sale total is too large'
        using errcode = '22003';
    end if;

    costed_lines := costed_lines
      || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'line_number', product_to_lock.line_number,
          'product_id', product_to_lock.product_id,
          'quantity', product_to_lock.quantity,
          'unit_cost_ron', preserved_unit_cost,
          'unit_selling_price_ron',
            product_to_lock.unit_selling_price_ron,
          'line_cost_ron', parsed_line_cost,
          'line_total_ron', parsed_line_total,
          'gross_profit_ron', parsed_line_profit,
          'profit_percent', parsed_line_profit_percent
        )
      );
  end loop;

  if parsed_cash + parsed_bank + parsed_credit <> sale_total then
    raise exception 'Payment split must equal the sale total'
      using errcode = '22023';
  end if;

  sale_profit := sale_total - sale_cost;
  sale_profit_percent := round(sale_profit / sale_cost * 100, 4);

  select coalesce(max(sale.sale_number), 0) + 1
  into next_sale_number
  from public.sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = target_business_day_id;

  insert into public.sales (
    id,
    business_id,
    business_day_id,
    sale_date,
    sale_number,
    shop_location_id,
    customer_id,
    cash_amount_ron,
    bank_amount_ron,
    credit_amount_ron,
    total_amount_ron,
    total_cost_ron,
    gross_profit_ron,
    profit_percent,
    notes,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    new_sale_id,
    target_business_id,
    target_business_day_id,
    selected_day_date,
    next_sale_number,
    target_shop_location_id,
    target_customer_id,
    parsed_cash,
    parsed_bank,
    parsed_credit,
    sale_total,
    sale_cost,
    sale_profit,
    sale_profit_percent,
    normalized_notes,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  );

  insert into public.sale_lines (
    business_id,
    sale_id,
    product_id,
    line_number,
    quantity,
    unit_cost_ron,
    unit_selling_price_ron,
    line_cost_ron,
    line_total_ron,
    gross_profit_ron,
    profit_percent
  )
  select
    target_business_id,
    new_sale_id,
    line.product_id,
    line.line_number,
    line.quantity,
    line.unit_cost_ron,
    line.unit_selling_price_ron,
    line.line_cost_ron,
    line.line_total_ron,
    line.gross_profit_ron,
    line.profit_percent
  from pg_catalog.jsonb_to_recordset(costed_lines) as line(
    line_number integer,
    product_id uuid,
    quantity bigint,
    unit_cost_ron numeric,
    unit_selling_price_ron numeric,
    line_cost_ron numeric,
    line_total_ron numeric,
    gross_profit_ron numeric,
    profit_percent numeric
  );

  insert into public.stock_movements (
    business_id,
    product_id,
    movement_type,
    source_location_id,
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
    'sale',
    target_shop_location_id,
    line.quantity,
    line.unit_cost_ron,
    target_business_day_id,
    'product_sale',
    new_sale_id,
    'Product sale',
    current_user_id,
    line.id,
    pg_catalog.md5(
      pg_catalog.jsonb_build_object(
        'sale_id', new_sale_id,
        'sale_line_id', line.id,
        'product_id', line.product_id,
        'shop_location_id', target_shop_location_id,
        'quantity', line.quantity,
        'unit_cost_ron', line.unit_cost_ron
      )::text
    )
  from public.sale_lines as line
  where line.business_id = target_business_id
    and line.sale_id = new_sale_id
  order by line.line_number;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    source_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    notes,
    entry_origin,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    selected_day_date,
    'product_sale_cogs',
    target_shop_location_id,
    sale_cost,
    'product_sale',
    new_sale_id,
    'Cost of products sold',
    'operational',
    current_user_id
  )
  returning id into new_cogs_movement_id;

  if parsed_credit > 0 then
    new_credit_purchase_id := public.create_customer_credit_purchase(
      target_business_id,
      target_customer_id,
      target_business_day_id,
      parsed_credit::text,
      'Product sale #' || next_sale_number::text,
      null,
      null
    );

    update public.customer_credit_purchases
    set sale_id = new_sale_id
    where business_id = target_business_id
      and id = new_credit_purchase_id;
  end if;

  update public.daily_sales
  set
    cash_sales_ron = cash_sales_ron + parsed_cash,
    bank_sales_ron = bank_sales_ron + parsed_bank,
    credit_sales_ron = credit_sales_ron + parsed_credit,
    total_sales_ron = total_sales_ron + sale_total,
    updated_by = current_user_id,
    updated_at = pg_catalog.clock_timestamp()
  where id = daily_sale.id
    and status = 'draft';

  if not found then
    raise exception 'Daily sales update lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  )
  values (
    target_business_id,
    current_user_id,
    'product_sale.created',
    'product_sale',
    new_sale_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'sale_number', next_sale_number,
      'shop_location_id', target_shop_location_id,
      'customer_id', target_customer_id,
      'cash_amount_ron', parsed_cash,
      'bank_amount_ron', parsed_bank,
      'credit_amount_ron', parsed_credit,
      'total_amount_ron', sale_total,
      'total_cost_ron', sale_cost,
      'gross_profit_ron', sale_profit,
      'profit_percent', sale_profit_percent,
      'line_count', pg_catalog.jsonb_array_length(costed_lines),
      'customer_credit_purchase_id', new_credit_purchase_id,
      'inventory_cogs_movement_id', new_cogs_movement_id
    )
  );

  return new_sale_id;
end;
$$;

create function public.reverse_product_sale(
  target_business_id uuid,
  target_sale_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(target_reason), '');
  reversal_time timestamptz := pg_catalog.clock_timestamp();
  sale_to_reverse public.sales%rowtype;
  daily_sale public.daily_sales%rowtype;
  credit_purchase_id uuid;
  cogs_movement public.inventory_value_movements%rowtype;
  product_movement record;
  reversed_line_count integer := 0;
  new_cogs_reversal_id uuid;
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

  select sale.*
  into sale_to_reverse
  from public.sales as sale
  where sale.business_id = target_business_id
    and sale.id = target_sale_id
  for update;

  if not found then
    raise exception 'Product sale does not exist'
      using errcode = '22023';
  end if;

  if sale_to_reverse.reversed_at is not null then
    raise exception 'Product sale is already reversed'
      using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  if not exists (
    select 1
    from public.business_days as day
    where day.business_id = target_business_id
      and day.id = sale_to_reverse.business_day_id
      and day.status = 'open'
  ) then
    raise exception 'Closed-day sales require the returns and refunds workflow'
      using errcode = '55000';
  end if;

  select daily.*
  into daily_sale
  from public.daily_sales as daily
  where daily.business_id = target_business_id
    and daily.business_day_id = sale_to_reverse.business_day_id
  for update;

  if not found or daily_sale.status <> 'draft' then
    raise exception 'Closed daily sales cannot be corrected directly'
      using errcode = '55000';
  end if;

  select purchase.id
  into credit_purchase_id
  from public.customer_credit_purchases as purchase
  where purchase.business_id = target_business_id
    and purchase.sale_id = target_sale_id
  for update;

  if credit_purchase_id is not null then
    perform public.reverse_customer_credit_purchase(
      target_business_id,
      credit_purchase_id,
      normalized_reason
    );
  end if;

  for product_movement in
    select movement.id
    from public.stock_movements as movement
    where movement.business_id = target_business_id
      and movement.reference_type = 'product_sale'
      and movement.reference_id = target_sale_id
      and movement.movement_type = 'sale'
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
      false
    );
    reversed_line_count := reversed_line_count + 1;
  end loop;

  select movement.*
  into cogs_movement
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and movement.source_entity_type = 'product_sale'
    and movement.source_entity_id = target_sale_id
    and movement.movement_type = 'product_sale_cogs'
  for update;

  if not found then
    raise exception 'Product sale inventory cost movement does not exist'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = cogs_movement.id
  ) then
    raise exception 'Product sale is already reversed'
      using errcode = '55000';
  end if;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
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
    sale_to_reverse.business_day_id,
    sale_to_reverse.sale_date,
    'product_sale_cogs_reversal',
    sale_to_reverse.shop_location_id,
    sale_to_reverse.total_cost_ron,
    'product_sale',
    target_sale_id,
    'Product sale cost reversal',
    'operational',
    current_user_id,
    cogs_movement.id
  )
  returning id into new_cogs_reversal_id;

  update public.sales
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where business_id = target_business_id
    and id = target_sale_id
    and reversed_at is null;

  if not found then
    raise exception 'Product sale reversal lost a concurrency race'
      using errcode = '40001';
  end if;

  update public.daily_sales
  set
    cash_sales_ron = cash_sales_ron - sale_to_reverse.cash_amount_ron,
    bank_sales_ron = bank_sales_ron - sale_to_reverse.bank_amount_ron,
    credit_sales_ron =
      credit_sales_ron - sale_to_reverse.credit_amount_ron,
    total_sales_ron = total_sales_ron - sale_to_reverse.total_amount_ron,
    updated_by = current_user_id,
    updated_at = reversal_time
  where id = daily_sale.id
    and status = 'draft'
    and cash_sales_ron >= sale_to_reverse.cash_amount_ron
    and bank_sales_ron >= sale_to_reverse.bank_amount_ron
    and credit_sales_ron >= sale_to_reverse.credit_amount_ron
    and total_sales_ron >= sale_to_reverse.total_amount_ron;

  if not found then
    raise exception 'Daily sales no longer reconcile with this sale'
      using errcode = '55000';
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
    'product_sale.reversed',
    'product_sale',
    target_sale_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'total_amount_ron', sale_to_reverse.total_amount_ron,
      'total_cost_ron', sale_to_reverse.total_cost_ron,
      'gross_profit_ron', sale_to_reverse.gross_profit_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time,
      'stock_reversal_count', reversed_line_count,
      'inventory_cogs_reversal_id', new_cogs_reversal_id,
      'customer_credit_purchase_id', credit_purchase_id
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.create_product_sale(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, uuid, text
) from public, anon, authenticated;
revoke all on function public.reverse_product_sale(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_product_sale(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, uuid, text
) to authenticated, service_role;
grant execute on function public.reverse_product_sale(uuid, uuid, text)
  to authenticated, service_role;

revoke execute on function public.upsert_daily_sales_draft(
  uuid, uuid, text, text, text, text
) from authenticated;

create view public.sale_line_summaries
with (security_invoker = true)
as
select
  line.id as line_id,
  line.business_id,
  line.sale_id,
  line.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  line.line_number,
  line.quantity::text as quantity,
  line.unit_cost_ron::text as unit_cost_ron,
  line.unit_selling_price_ron::text as unit_selling_price_ron,
  line.line_cost_ron::text as line_cost_ron,
  line.line_total_ron::text as line_total_ron,
  line.gross_profit_ron::text as gross_profit_ron,
  line.profit_percent::text as profit_percent
from public.sale_lines as line
inner join public.products as product
  on product.business_id = line.business_id
  and product.id = line.product_id;

create view public.sale_summaries
with (security_invoker = true)
as
select
  sale.id as sale_id,
  sale.business_id,
  sale.business_day_id,
  sale.sale_date,
  sale.sale_number,
  sale.shop_location_id,
  location.name as shop_location_name,
  sale.customer_id,
  customer.name as customer_name,
  sale.cash_amount_ron::text as cash_amount_ron,
  sale.bank_amount_ron::text as bank_amount_ron,
  sale.credit_amount_ron::text as credit_amount_ron,
  sale.total_amount_ron::text as total_amount_ron,
  sale.total_cost_ron::text as total_cost_ron,
  sale.gross_profit_ron::text as gross_profit_ron,
  sale.profit_percent::text as profit_percent,
  sale.notes,
  sale.created_by,
  profile.full_name as created_by_name,
  sale.created_at,
  sale.reversed_at,
  sale.reversed_by,
  sale.reversal_reason,
  credit_purchase.id as customer_credit_purchase_id,
  case
    when sale.reversed_at is null then 'active'
    else 'reversed'
  end as status
from public.sales as sale
inner join public.inventory_locations as location
  on location.business_id = sale.business_id
  and location.id = sale.shop_location_id
left join public.customers as customer
  on customer.business_id = sale.business_id
  and customer.id = sale.customer_id
left join public.profiles as profile
  on profile.id = sale.created_by
left join public.customer_credit_purchases as credit_purchase
  on credit_purchase.business_id = sale.business_id
  and credit_purchase.sale_id = sale.id;

create view public.daily_product_sales_summaries
with (security_invoker = true)
as
select
  day.business_id,
  day.id as business_day_id,
  day.business_date,
  count(sale.id) filter (
    where sale.reversed_at is null
  )::integer as sale_count,
  coalesce(sum(sale.cash_amount_ron) filter (
    where sale.reversed_at is null
  ), 0)::text as cash_amount_ron,
  coalesce(sum(sale.bank_amount_ron) filter (
    where sale.reversed_at is null
  ), 0)::text as bank_amount_ron,
  coalesce(sum(sale.credit_amount_ron) filter (
    where sale.reversed_at is null
  ), 0)::text as credit_amount_ron,
  coalesce(sum(sale.total_amount_ron) filter (
    where sale.reversed_at is null
  ), 0)::text as total_amount_ron,
  coalesce(sum(sale.total_cost_ron) filter (
    where sale.reversed_at is null
  ), 0)::text as total_cost_ron,
  coalesce(sum(sale.gross_profit_ron) filter (
    where sale.reversed_at is null
  ), 0)::text as gross_profit_ron,
  case
    when coalesce(sum(sale.total_cost_ron) filter (
      where sale.reversed_at is null
    ), 0) = 0 then '0.0000'
    else round(
      sum(sale.gross_profit_ron) filter (
        where sale.reversed_at is null
      )
      / sum(sale.total_cost_ron) filter (
        where sale.reversed_at is null
      )
      * 100,
      4
    )::text
  end as profit_percent
from public.business_days as day
left join public.sales as sale
  on sale.business_id = day.business_id
  and sale.business_day_id = day.id
group by day.business_id, day.id, day.business_date;

create view public.product_stock_valuation_by_location
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
  coalesce(stock.quantity, 0)::text as quantity,
  coalesce(stock.inventory_value_ron, 0)::text as inventory_value_ron,
  case
    when coalesce(stock.quantity, 0) > 0
      and coalesce(stock.uncosted_count, 0) = 0
      then round(
        stock.inventory_value_ron / stock.quantity,
        8
      )::text
    else null
  end as average_unit_cost_ron,
  coalesce(stock.uncosted_count, 0) = 0 as cost_is_complete
from public.products as product
inner join public.product_categories as category
  on category.business_id = product.business_id
  and category.id = product.category_id
inner join public.inventory_locations as location
  on location.business_id = product.business_id
left join lateral (
  select
    coalesce(sum(
      case
        when movement.destination_location_id = location.id
          then movement.quantity
        when movement.source_location_id = location.id
          then -movement.quantity
        else 0
      end
    ), 0) as quantity,
    coalesce(sum(
      case
        when movement.destination_location_id = location.id
          then movement.quantity * movement.unit_cost_ron
        when movement.source_location_id = location.id
          then -movement.quantity * movement.unit_cost_ron
        else 0
      end
    ) filter (
      where movement.unit_cost_ron is not null
    ), 0) as inventory_value_ron,
    count(*) filter (
      where movement.unit_cost_ron is null
    ) as uncosted_count
  from public.stock_movements as movement
  where movement.business_id = product.business_id
    and movement.product_id = product.id
    and movement.reversal_of_id is null
    and (
      movement.source_location_id = location.id
      or movement.destination_location_id = location.id
    )
    and not exists (
      select 1
      from public.stock_movements as reversal
      where reversal.reversal_of_id = movement.id
    )
) as stock on true;

revoke all on table public.sale_line_summaries
  from anon, authenticated;
revoke all on table public.sale_summaries
  from anon, authenticated;
revoke all on table public.daily_product_sales_summaries
  from anon, authenticated;
revoke all on table public.product_stock_valuation_by_location
  from anon, authenticated;
grant select on table public.sale_line_summaries
  to authenticated, service_role;
grant select on table public.sale_summaries
  to authenticated, service_role;
grant select on table public.daily_product_sales_summaries
  to authenticated, service_role;
grant select on table public.product_stock_valuation_by_location
  to authenticated, service_role;

comment on table public.sales is
  'Immutable individual product sales with exact payment split, cost, and profit.';
comment on table public.sale_lines is
  'Immutable sold product quantities with preserved weighted cost and manual selling price.';
comment on function public.create_product_sale(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, uuid, text
) is
  'Atomically records one product sale, stock and cost outflows, daily totals, and optional customer receivable.';
comment on function public.reverse_product_sale(uuid, uuid, text) is
  'Administrator-only open-day correction that reverses stock, cost, receivable, and daily totals.';
comment on view public.product_stock_valuation_by_location is
  'Derived quantity, weighted average unit cost, and historical RON inventory value per product and location.';

commit;
