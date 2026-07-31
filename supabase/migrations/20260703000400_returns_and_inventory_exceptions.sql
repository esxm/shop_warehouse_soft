begin;

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null,
  return_date date not null,
  sale_id uuid not null,
  customer_id uuid,
  cash_refund_ron numeric(18, 2) not null,
  bank_refund_ron numeric(18, 2) not null,
  credit_reduction_ron numeric(18, 2) not null,
  total_refund_ron numeric(18, 2) not null,
  total_cost_ron numeric(18, 2) not null,
  reason text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default statement_timestamp(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint sale_returns_business_id_id_key unique (business_id, id),
  constraint sale_returns_business_idempotency_key
    unique (business_id, idempotency_key),
  constraint sale_returns_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint sale_returns_sale_business_fkey
    foreign key (business_id, sale_id)
    references public.sales (business_id, id),
  constraint sale_returns_customer_business_fkey
    foreign key (business_id, customer_id)
    references public.customers (business_id, id),
  constraint sale_returns_amounts_nonnegative
    check (
      cash_refund_ron >= 0
      and bank_refund_ron >= 0
      and credit_reduction_ron >= 0
    ),
  constraint sale_returns_total_consistent
    check (
      total_refund_ron > 0
      and total_cost_ron > 0
      and total_refund_ron =
        cash_refund_ron + bank_refund_ron + credit_reduction_ron
    ),
  constraint sale_returns_credit_customer_consistent
    check (
      (credit_reduction_ron = 0)
      or (credit_reduction_ron > 0 and customer_id is not null)
    ),
  constraint sale_returns_reason_valid
    check (char_length(btrim(reason)) between 10 and 500),
  constraint sale_returns_fingerprint_valid
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint sale_returns_reversal_consistent
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

create table public.sale_return_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  sale_return_id uuid not null,
  sale_line_id uuid not null references public.sale_lines (id),
  product_id uuid not null,
  line_number integer not null,
  quantity bigint not null,
  disposition text not null,
  unit_cost_ron numeric(18, 8) not null,
  unit_refund_ron numeric(18, 2) not null,
  line_cost_ron numeric(18, 2) not null,
  line_refund_ron numeric(18, 2) not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint sale_return_lines_return_business_fkey
    foreign key (business_id, sale_return_id)
    references public.sale_returns (business_id, id),
  constraint sale_return_lines_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint sale_return_lines_return_line_key
    unique (sale_return_id, line_number),
  constraint sale_return_lines_return_sale_line_key
    unique (sale_return_id, sale_line_id),
  constraint sale_return_lines_number_positive check (line_number > 0),
  constraint sale_return_lines_quantity_positive check (quantity > 0),
  constraint sale_return_lines_disposition_valid
    check (disposition in ('sellable', 'damaged')),
  constraint sale_return_lines_amounts_consistent
    check (
      unit_cost_ron > 0
      and unit_refund_ron > 0
      and line_cost_ron = round(quantity * unit_cost_ron, 2)
      and line_refund_ron = quantity * unit_refund_ron
      and line_cost_ron > 0
      and line_refund_ron > 0
    )
);

create table public.customer_credit_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  customer_id uuid not null,
  customer_credit_purchase_id uuid not null,
  sale_return_id uuid not null,
  amount_ron numeric(18, 2) not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint customer_credit_adjustments_purchase_business_fkey
    foreign key (business_id, customer_credit_purchase_id)
    references public.customer_credit_purchases (business_id, id),
  constraint customer_credit_adjustments_return_business_fkey
    foreign key (business_id, sale_return_id)
    references public.sale_returns (business_id, id),
  constraint customer_credit_adjustments_customer_business_fkey
    foreign key (business_id, customer_id)
    references public.customers (business_id, id),
  constraint customer_credit_adjustments_amount_positive
    check (amount_ron > 0),
  constraint customer_credit_adjustments_return_key unique (sale_return_id)
);

create table public.damaged_stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  product_id uuid not null,
  business_day_id uuid not null,
  movement_date date not null,
  direction text not null,
  quantity bigint not null,
  unit_cost_ron numeric(18, 8) not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default statement_timestamp(),
  reversal_of_id uuid references public.damaged_stock_movements (id),
  constraint damaged_stock_movements_business_id_id_key
    unique (business_id, id),
  constraint damaged_stock_movements_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint damaged_stock_movements_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint damaged_stock_movements_direction_valid
    check (direction in ('in', 'out')),
  constraint damaged_stock_movements_quantity_positive check (quantity > 0),
  constraint damaged_stock_movements_cost_positive check (unit_cost_ron > 0),
  constraint damaged_stock_movements_source_valid
    check (
      char_length(btrim(source_entity_type)) between 1 and 80
    ),
  constraint damaged_stock_movements_not_self_reversal
    check (reversal_of_id is null or reversal_of_id <> id)
);

create unique index damaged_stock_movements_one_reversal_key
  on public.damaged_stock_movements (reversal_of_id)
  where reversal_of_id is not null;
create unique index damaged_stock_movements_source_product_key
  on public.damaged_stock_movements (
    business_id,
    source_entity_type,
    source_entity_id,
    product_id
  )
  where reversal_of_id is null;

create table public.inventory_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null,
  exception_date date not null,
  product_id uuid not null,
  source_location_id uuid not null,
  exception_type text not null,
  quantity bigint not null,
  unit_cost_ron numeric(18, 8) not null,
  total_cost_ron numeric(18, 2) not null,
  reason text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default statement_timestamp(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint inventory_exceptions_business_id_id_key
    unique (business_id, id),
  constraint inventory_exceptions_business_idempotency_key
    unique (business_id, idempotency_key),
  constraint inventory_exceptions_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint inventory_exceptions_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint inventory_exceptions_location_business_fkey
    foreign key (business_id, source_location_id)
    references public.inventory_locations (business_id, id),
  constraint inventory_exceptions_type_valid
    check (exception_type in ('damage', 'missing', 'stolen')),
  constraint inventory_exceptions_quantity_positive check (quantity > 0),
  constraint inventory_exceptions_cost_consistent
    check (
      unit_cost_ron > 0
      and total_cost_ron = round(quantity * unit_cost_ron, 2)
      and total_cost_ron > 0
    ),
  constraint inventory_exceptions_reason_valid
    check (char_length(btrim(reason)) between 10 and 500),
  constraint inventory_exceptions_fingerprint_valid
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint inventory_exceptions_reversal_consistent
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

create index sale_returns_business_date_idx
  on public.sale_returns (business_id, return_date desc, created_at desc);
create index sale_returns_sale_idx
  on public.sale_returns (business_id, sale_id, created_at);
create index sale_return_lines_sale_line_idx
  on public.sale_return_lines (business_id, sale_line_id);
create index customer_credit_adjustments_purchase_idx
  on public.customer_credit_adjustments (customer_credit_purchase_id);
create index damaged_stock_movements_product_idx
  on public.damaged_stock_movements (business_id, product_id, created_at);
create index inventory_exceptions_business_date_idx
  on public.inventory_exceptions (
    business_id,
    exception_date desc,
    created_at desc
  );

alter table public.sale_returns enable row level security;
alter table public.sale_return_lines enable row level security;
alter table public.customer_credit_adjustments enable row level security;
alter table public.damaged_stock_movements enable row level security;
alter table public.inventory_exceptions enable row level security;

create policy sale_returns_select_member
on public.sale_returns
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy sale_return_lines_select_member
on public.sale_return_lines
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy customer_credit_adjustments_select_member
on public.customer_credit_adjustments
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy damaged_stock_movements_select_member
on public.damaged_stock_movements
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy inventory_exceptions_select_member
on public.inventory_exceptions
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.sale_returns from anon, authenticated;
revoke all on table public.sale_return_lines from anon, authenticated;
revoke all on table public.customer_credit_adjustments
  from anon, authenticated;
revoke all on table public.damaged_stock_movements from anon, authenticated;
revoke all on table public.inventory_exceptions from anon, authenticated;
grant select on table public.sale_returns to authenticated, service_role;
grant select on table public.sale_return_lines
  to authenticated, service_role;
grant select on table public.customer_credit_adjustments
  to authenticated, service_role;
grant select on table public.damaged_stock_movements
  to authenticated, service_role;
grant select on table public.inventory_exceptions
  to authenticated, service_role;
grant all on table public.sale_returns to service_role;
grant all on table public.sale_return_lines to service_role;
grant all on table public.customer_credit_adjustments to service_role;
grant all on table public.damaged_stock_movements to service_role;
grant all on table public.inventory_exceptions to service_role;

create function private.guard_sale_return_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Sale returns are immutable; use a reversal'
      using errcode = '55000';
  end if;

  if old.reversed_at is not null then
    raise exception 'Reversed sale returns are immutable'
      using errcode = '55000';
  end if;

  if (
    to_jsonb(new) - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) <> (
    to_jsonb(old) - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) then
    raise exception 'Sale return values are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function private.prevent_step36_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Exception records are immutable'
    using errcode = '55000';
end;
$$;

create function private.guard_inventory_exception_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Inventory exceptions are immutable; use a reversal'
      using errcode = '55000';
  end if;

  if old.reversed_at is not null then
    raise exception 'Reversed inventory exceptions are immutable'
      using errcode = '55000';
  end if;

  if (
    to_jsonb(new) - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) <> (
    to_jsonb(old) - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) then
    raise exception 'Inventory exception values are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger sale_returns_immutable
before update or delete on public.sale_returns
for each row execute function private.guard_sale_return_mutation();

create trigger sale_return_lines_immutable
before update or delete on public.sale_return_lines
for each row execute function private.prevent_step36_mutation();

create trigger customer_credit_adjustments_immutable
before update or delete on public.customer_credit_adjustments
for each row execute function private.prevent_step36_mutation();

create trigger damaged_stock_movements_immutable
before update or delete on public.damaged_stock_movements
for each row execute function private.prevent_step36_mutation();

create trigger inventory_exceptions_immutable
before update or delete on public.inventory_exceptions
for each row execute function private.guard_inventory_exception_mutation();

create unique index financial_account_entries_sale_return_refund_key
  on public.financial_account_entries (
    business_id,
    source_entity_id,
    financial_account_id,
    entry_type
  )
  where source_entity_type = 'sale_return'
    and reversal_of_id is null;

create unique index inventory_value_movements_sale_return_key
  on public.inventory_value_movements (
    business_id,
    source_entity_id,
    movement_type
  )
  where source_entity_type = 'sale_return'
    and movement_type = 'sale_return_sellable';

create unique index inventory_value_movements_exception_key
  on public.inventory_value_movements (
    business_id,
    source_entity_id,
    movement_type
  )
  where source_entity_type = 'inventory_exception'
    and reversal_of_id is null;

create function public.create_sale_return(
  target_business_id uuid,
  target_business_day_id uuid,
  target_sale_id uuid,
  target_cash_refund_ron text,
  target_bank_refund_ron text,
  target_credit_reduction_ron text,
  target_idempotency_key uuid,
  target_lines jsonb,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(target_reason), '');
  parsed_cash numeric;
  parsed_bank numeric;
  parsed_credit numeric;
  selected_day_date date;
  sale_to_return public.sales%rowtype;
  line_item jsonb;
  parsed_sale_line_id uuid;
  parsed_quantity bigint;
  parsed_disposition text;
  original_line public.sale_lines%rowtype;
  previously_returned bigint;
  seen_line_ids uuid[] := '{}'::uuid[];
  normalized_lines jsonb := '[]'::jsonb;
  return_total numeric := 0;
  return_cost numeric := 0;
  sellable_cost numeric := 0;
  request_fingerprint text;
  existing_return_id uuid;
  existing_fingerprint text;
  new_return_id uuid;
  credit_purchase public.customer_credit_purchases%rowtype;
  credit_allocated numeric := 0;
  credit_adjusted numeric := 0;
  credit_available numeric := 0;
  cash_account_id uuid;
  bank_account_id uuid;
  cash_entry_id uuid;
  bank_entry_id uuid;
  new_inventory_movement_id uuid;
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
    raise exception 'Return reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null then
    raise exception 'Return request identifier is required'
      using errcode = '22023';
  end if;

  if target_lines is null
    or pg_catalog.jsonb_typeof(target_lines) <> 'array'
    or pg_catalog.jsonb_array_length(target_lines) not between 1 and 100
  then
    raise exception 'Return requires 1 to 100 product lines'
      using errcode = '22023';
  end if;

  parsed_cash := private.parse_nonnegative_ron_amount(
    target_cash_refund_ron,
    'Cash refund'
  );
  parsed_bank := private.parse_nonnegative_ron_amount(
    target_bank_refund_ron,
    'Bank refund'
  );
  parsed_credit := private.parse_nonnegative_ron_amount(
    target_credit_reduction_ron,
    'Credit reduction'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      6136
    )
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_sale_id::text,
      6137
    )
  );

  select day.business_date
  into selected_day_date
  from public.business_days as day
  where day.business_id = target_business_id
    and day.id = target_business_day_id
    and day.status = 'open'
  for share;

  if not found then
    raise exception 'Returns require the current open business day'
      using errcode = '55000';
  end if;

  select sale.*
  into sale_to_return
  from public.sales as sale
  where sale.business_id = target_business_id
    and sale.id = target_sale_id
  for share;

  if not found then
    raise exception 'Original sale does not exist'
      using errcode = '22023';
  end if;

  if sale_to_return.reversed_at is not null then
    raise exception 'A reversed sale cannot receive returns'
      using errcode = '55000';
  end if;

  for line_item in
    select item.value
    from pg_catalog.jsonb_array_elements(target_lines) as item(value)
  loop
    if pg_catalog.jsonb_typeof(line_item) <> 'object'
      or not line_item ? 'sale_line_id'
      or not line_item ? 'quantity'
      or not line_item ? 'disposition'
      or line_item - array['sale_line_id', 'quantity', 'disposition']
        <> '{}'::jsonb
    then
      raise exception 'Each return line has invalid fields'
        using errcode = '22023';
    end if;

    begin
      parsed_sale_line_id := (line_item ->> 'sale_line_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Return sale line is invalid'
          using errcode = '22023';
    end;

    if parsed_sale_line_id = any(seen_line_ids) then
      raise exception 'Return contains a duplicate sale line'
        using errcode = '22023';
    end if;

    seen_line_ids := pg_catalog.array_append(
      seen_line_ids,
      parsed_sale_line_id
    );

    if coalesce(line_item ->> 'quantity', '') !~ '^[1-9][0-9]{0,17}$' then
      raise exception 'Return quantity must be a positive whole number'
        using errcode = '22023';
    end if;
    parsed_quantity := (line_item ->> 'quantity')::bigint;
    parsed_disposition := line_item ->> 'disposition';

    if parsed_disposition not in ('sellable', 'damaged') then
      raise exception 'Return disposition must be sellable or damaged'
        using errcode = '22023';
    end if;

    select line.*
    into original_line
    from public.sale_lines as line
    where line.business_id = target_business_id
      and line.sale_id = target_sale_id
      and line.id = parsed_sale_line_id
    for share;

    if not found then
      raise exception 'Return line does not belong to the original sale'
        using errcode = '22023';
    end if;

    select coalesce(sum(return_line.quantity), 0)
    into previously_returned
    from public.sale_return_lines as return_line
    inner join public.sale_returns as return_record
      on return_record.business_id = return_line.business_id
      and return_record.id = return_line.sale_return_id
      and return_record.reversed_at is null
    where return_line.business_id = target_business_id
      and return_line.sale_line_id = original_line.id;

    if parsed_quantity > original_line.quantity - previously_returned then
      raise exception 'Return quantity exceeds the unreturned sale quantity'
        using errcode = '22023';
    end if;

    return_total := return_total
      + parsed_quantity * original_line.unit_selling_price_ron;
    return_cost := return_cost
      + round(parsed_quantity * original_line.unit_cost_ron, 2);
    if parsed_disposition = 'sellable' then
      sellable_cost := sellable_cost
        + round(parsed_quantity * original_line.unit_cost_ron, 2);
    end if;

    normalized_lines := normalized_lines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'sale_line_id', original_line.id,
        'product_id', original_line.product_id,
        'quantity', parsed_quantity,
        'disposition', parsed_disposition,
        'unit_cost_ron', original_line.unit_cost_ron,
        'unit_refund_ron', original_line.unit_selling_price_ron
      )
    );
  end loop;

  if parsed_cash + parsed_bank + parsed_credit <> return_total then
    raise exception 'Refund split must equal the returned products total'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'business_day_id', target_business_day_id,
      'sale_id', target_sale_id,
      'cash_refund_ron', parsed_cash,
      'bank_refund_ron', parsed_bank,
      'credit_reduction_ron', parsed_credit,
      'lines', normalized_lines,
      'reason', normalized_reason
    )::text
  );

  select return_record.id, return_record.request_fingerprint
  into existing_return_id, existing_fingerprint
  from public.sale_returns as return_record
  where return_record.business_id = target_business_id
    and return_record.idempotency_key = target_idempotency_key;

  if existing_return_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Return request identifier was reused with different data'
        using errcode = '22023';
    end if;
    return existing_return_id;
  end if;

  if parsed_credit > 0 then
    if sale_to_return.customer_id is null then
      raise exception 'This sale has no customer credit to reduce'
        using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        target_business_id::text
          || ':' || sale_to_return.customer_id::text,
        9110
      )
    );

    select purchase.*
    into credit_purchase
    from public.customer_credit_purchases as purchase
    where purchase.business_id = target_business_id
      and purchase.sale_id = target_sale_id
      and purchase.reversed_at is null
    for update;

    if not found then
      raise exception 'Original sale credit receivable is unavailable'
        using errcode = '55000';
    end if;

    select coalesce(sum(allocation.amount_ron), 0)
    into credit_allocated
    from public.customer_payment_allocations as allocation
    inner join public.customer_payments as payment
      on payment.business_id = allocation.business_id
      and payment.id = allocation.payment_id
      and payment.reversed_at is null
    where allocation.business_id = target_business_id
      and allocation.customer_credit_purchase_id = credit_purchase.id;

    select coalesce(sum(adjustment.amount_ron), 0)
    into credit_adjusted
    from public.customer_credit_adjustments as adjustment
    inner join public.sale_returns as return_record
      on return_record.business_id = adjustment.business_id
      and return_record.id = adjustment.sale_return_id
      and return_record.reversed_at is null
    where adjustment.business_id = target_business_id
      and adjustment.customer_credit_purchase_id = credit_purchase.id;

    credit_available :=
      credit_purchase.amount_ron - credit_allocated - credit_adjusted;

    if parsed_credit > credit_available then
      raise exception 'Credit reduction exceeds the unpaid sale credit'
        using errcode = '22023';
    end if;
  end if;

  if parsed_cash > 0 then
    select account.id
    into cash_account_id
    from public.financial_accounts as account
    where account.business_id = target_business_id
      and account.type = 'cash'
      and account.currency = 'RON'
      and account.is_active
    for share;

    if not found then
      raise exception 'An active RON cash account is required'
        using errcode = '55000';
    end if;
  end if;

  if parsed_bank > 0 then
    select account.id
    into bank_account_id
    from public.financial_accounts as account
    where account.business_id = target_business_id
      and account.type = 'bank'
      and account.currency = 'RON'
      and account.is_active
    for share;

    if not found then
      raise exception 'An active RON bank account is required'
        using errcode = '55000';
    end if;
  end if;

  insert into public.sale_returns (
    business_id,
    business_day_id,
    return_date,
    sale_id,
    customer_id,
    cash_refund_ron,
    bank_refund_ron,
    credit_reduction_ron,
    total_refund_ron,
    total_cost_ron,
    reason,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    selected_day_date,
    target_sale_id,
    sale_to_return.customer_id,
    parsed_cash,
    parsed_bank,
    parsed_credit,
    return_total,
    return_cost,
    normalized_reason,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  )
  returning id into new_return_id;

  insert into public.sale_return_lines (
    business_id,
    sale_return_id,
    sale_line_id,
    product_id,
    line_number,
    quantity,
    disposition,
    unit_cost_ron,
    unit_refund_ron,
    line_cost_ron,
    line_refund_ron
  )
  select
    target_business_id,
    new_return_id,
    (item.value ->> 'sale_line_id')::uuid,
    (item.value ->> 'product_id')::uuid,
    item.ordinality::integer,
    (item.value ->> 'quantity')::bigint,
    item.value ->> 'disposition',
    (item.value ->> 'unit_cost_ron')::numeric,
    (item.value ->> 'unit_refund_ron')::numeric,
    round(
      (item.value ->> 'quantity')::bigint
        * (item.value ->> 'unit_cost_ron')::numeric,
      2
    ),
    (item.value ->> 'quantity')::bigint
      * (item.value ->> 'unit_refund_ron')::numeric
  from pg_catalog.jsonb_array_elements(normalized_lines)
    with ordinality as item(value, ordinality);

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
    'return',
    sale_to_return.shop_location_id,
    line.quantity,
    line.unit_cost_ron,
    target_business_day_id,
    'sale_return',
    new_return_id,
    normalized_reason,
    current_user_id,
    line.id,
    pg_catalog.md5(
      pg_catalog.jsonb_build_object(
        'sale_return_id', new_return_id,
        'sale_return_line_id', line.id,
        'product_id', line.product_id,
        'quantity', line.quantity,
        'unit_cost_ron', line.unit_cost_ron
      )::text
    )
  from public.sale_return_lines as line
  where line.business_id = target_business_id
    and line.sale_return_id = new_return_id
    and line.disposition = 'sellable'
  order by line.line_number;

  insert into public.damaged_stock_movements (
    business_id,
    product_id,
    business_day_id,
    movement_date,
    direction,
    quantity,
    unit_cost_ron,
    source_entity_type,
    source_entity_id,
    created_by
  )
  select
    line.business_id,
    line.product_id,
    target_business_day_id,
    selected_day_date,
    'in',
    line.quantity,
    line.unit_cost_ron,
    'sale_return',
    new_return_id,
    current_user_id
  from public.sale_return_lines as line
  where line.business_id = target_business_id
    and line.sale_return_id = new_return_id
    and line.disposition = 'damaged'
  order by line.line_number;

  if sellable_cost > 0 then
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
      created_by
    )
    values (
      target_business_id,
      target_business_day_id,
      selected_day_date,
      'sale_return_sellable',
      sale_to_return.shop_location_id,
      sellable_cost,
      'sale_return',
      new_return_id,
      normalized_reason,
      'operational',
      current_user_id
    )
    returning id into new_inventory_movement_id;
  end if;

  if parsed_cash > 0 then
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      business_day_id,
      entry_date,
      direction,
      amount_ron,
      entry_type,
      source_entity_type,
      source_entity_id,
      description,
      created_by,
      idempotency_key
    )
    values (
      target_business_id,
      cash_account_id,
      target_business_day_id,
      selected_day_date,
      'outflow',
      parsed_cash,
      'sale_refund_cash',
      'sale_return',
      new_return_id,
      'Customer sale refund',
      current_user_id,
      gen_random_uuid()
    )
    returning id into cash_entry_id;
  end if;

  if parsed_bank > 0 then
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      business_day_id,
      entry_date,
      direction,
      amount_ron,
      entry_type,
      source_entity_type,
      source_entity_id,
      description,
      created_by,
      idempotency_key
    )
    values (
      target_business_id,
      bank_account_id,
      target_business_day_id,
      selected_day_date,
      'outflow',
      parsed_bank,
      'sale_refund_bank',
      'sale_return',
      new_return_id,
      'Customer sale refund',
      current_user_id,
      gen_random_uuid()
    )
    returning id into bank_entry_id;
  end if;

  if parsed_credit > 0 then
    insert into public.customer_credit_adjustments (
      business_id,
      customer_id,
      customer_credit_purchase_id,
      sale_return_id,
      amount_ron
    )
    values (
      target_business_id,
      sale_to_return.customer_id,
      credit_purchase.id,
      new_return_id,
      parsed_credit
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
    'sale_return.created',
    'sale_return',
    new_return_id,
    pg_catalog.jsonb_build_object(
      'sale_id', target_sale_id,
      'business_day_id', target_business_day_id,
      'total_refund_ron', return_total,
      'total_cost_ron', return_cost,
      'cash_refund_ron', parsed_cash,
      'bank_refund_ron', parsed_bank,
      'credit_reduction_ron', parsed_credit,
      'lines', normalized_lines,
      'cash_entry_id', cash_entry_id,
      'bank_entry_id', bank_entry_id,
      'inventory_movement_id', new_inventory_movement_id
    ),
    normalized_reason
  );

  return new_return_id;
end;
$$;

create function public.reverse_sale_return(
  target_business_id uuid,
  target_sale_return_id uuid,
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
  return_to_reverse public.sale_returns%rowtype;
  product_movement record;
  damaged_movement public.damaged_stock_movements%rowtype;
  inventory_movement public.inventory_value_movements%rowtype;
  refund_entry public.financial_account_entries%rowtype;
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

  select return_record.*
  into return_to_reverse
  from public.sale_returns as return_record
  where return_record.business_id = target_business_id
    and return_record.id = target_sale_return_id
  for update;

  if not found then
    raise exception 'Sale return does not exist'
      using errcode = '22023';
  end if;

  if return_to_reverse.reversed_at is not null then
    raise exception 'Sale return is already reversed'
      using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || return_to_reverse.sale_id::text,
      6137
    )
  );

  for product_movement in
    select movement.id
    from public.stock_movements as movement
    where movement.business_id = target_business_id
      and movement.reference_type = 'sale_return'
      and movement.reference_id = target_sale_return_id
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
  end loop;

  for damaged_movement in
    select movement.*
    from public.damaged_stock_movements as movement
    where movement.business_id = target_business_id
      and movement.source_entity_type = 'sale_return'
      and movement.source_entity_id = target_sale_return_id
      and movement.reversal_of_id is null
      and not exists (
        select 1
        from public.damaged_stock_movements as reversal
        where reversal.reversal_of_id = movement.id
      )
    order by movement.product_id
  loop
    insert into public.damaged_stock_movements (
      business_id,
      product_id,
      business_day_id,
      movement_date,
      direction,
      quantity,
      unit_cost_ron,
      source_entity_type,
      source_entity_id,
      created_by,
      reversal_of_id
    )
    values (
      target_business_id,
      damaged_movement.product_id,
      damaged_movement.business_day_id,
      damaged_movement.movement_date,
      'out',
      damaged_movement.quantity,
      damaged_movement.unit_cost_ron,
      'sale_return',
      target_sale_return_id,
      current_user_id,
      damaged_movement.id
    );
  end loop;

  select movement.*
  into inventory_movement
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and movement.source_entity_type = 'sale_return'
    and movement.source_entity_id = target_sale_return_id
    and movement.movement_type = 'sale_return_sellable'
    and movement.reversal_of_id is null
  for update;

  if found then
    if exists (
      select 1
      from public.inventory_value_movements as reversal
      where reversal.reversal_of_id = inventory_movement.id
    ) then
      raise exception 'Sale return inventory value is already reversed'
        using errcode = '55000';
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
      notes,
      entry_origin,
      created_by,
      reversal_of_id
    )
    values (
      target_business_id,
      inventory_movement.business_day_id,
      inventory_movement.movement_date,
      'sale_return_sellable_reversal',
      inventory_movement.destination_location_id,
      inventory_movement.amount_ron,
      'sale_return',
      target_sale_return_id,
      normalized_reason,
      'operational',
      current_user_id,
      inventory_movement.id
    );
  end if;

  for refund_entry in
    select entry.*
    from public.financial_account_entries as entry
    where entry.business_id = target_business_id
      and entry.source_entity_type = 'sale_return'
      and entry.source_entity_id = target_sale_return_id
      and entry.reversal_of_id is null
      and entry.entry_type in ('sale_refund_cash', 'sale_refund_bank')
      and not exists (
        select 1
        from public.financial_account_entries as reversal
        where reversal.reversal_of_id = entry.id
      )
    order by entry.financial_account_id
  loop
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      entry_date,
      direction,
      amount_ron,
      entry_type,
      source_entity_type,
      source_entity_id,
      description,
      created_by,
      reversal_of_id
    )
    values (
      target_business_id,
      refund_entry.financial_account_id,
      refund_entry.entry_date,
      'inflow',
      refund_entry.amount_ron,
      refund_entry.entry_type || '_reversal',
      'sale_return',
      target_sale_return_id,
      'Sale refund reversal',
      current_user_id,
      refund_entry.id
    );
  end loop;

  update public.sale_returns
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where business_id = target_business_id
    and id = target_sale_return_id
    and reversed_at is null;

  if not found then
    raise exception 'Sale return reversal lost a concurrency race'
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
    'sale_return.reversed',
    'sale_return',
    target_sale_return_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'total_refund_ron', return_to_reverse.total_refund_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time
    ),
    normalized_reason
  );
end;
$$;

create function public.create_inventory_exception(
  target_business_id uuid,
  target_business_day_id uuid,
  target_product_id uuid,
  target_source_location_id uuid,
  target_exception_type text,
  target_quantity text,
  target_idempotency_key uuid,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_type text := pg_catalog.lower(
    pg_catalog.btrim(target_exception_type)
  );
  normalized_reason text := nullif(pg_catalog.btrim(target_reason), '');
  parsed_quantity bigint;
  selected_day_date date;
  available_quantity bigint;
  average_unit_cost numeric;
  total_cost numeric;
  request_fingerprint text;
  existing_exception_id uuid;
  existing_fingerprint text;
  new_exception_id uuid;
  new_stock_movement_id uuid;
  new_inventory_movement_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if normalized_type not in ('damage', 'missing', 'stolen') then
    raise exception 'Inventory exception type is invalid'
      using errcode = '22023';
  end if;

  if normalized_reason is null
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Exception reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  if coalesce(target_quantity, '') !~ '^[1-9][0-9]{0,17}$' then
    raise exception 'Exception quantity must be a positive whole number'
      using errcode = '22023';
  end if;
  parsed_quantity := target_quantity::bigint;

  if target_idempotency_key is null then
    raise exception 'Exception request identifier is required'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'business_day_id', target_business_day_id,
      'product_id', target_product_id,
      'source_location_id', target_source_location_id,
      'exception_type', normalized_type,
      'quantity', parsed_quantity,
      'reason', normalized_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      6138
    )
  );

  select exception_record.id, exception_record.request_fingerprint
  into existing_exception_id, existing_fingerprint
  from public.inventory_exceptions as exception_record
  where exception_record.business_id = target_business_id
    and exception_record.idempotency_key = target_idempotency_key;

  if existing_exception_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception
        'Exception request identifier was reused with different data'
        using errcode = '22023';
    end if;
    return existing_exception_id;
  end if;

  select day.business_date
  into selected_day_date
  from public.business_days as day
  where day.business_id = target_business_id
    and day.id = target_business_day_id
    and day.status = 'open'
  for share;

  if not found then
    raise exception 'Inventory exceptions require the current open business day'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.products as product
    where product.business_id = target_business_id
      and product.id = target_product_id
  ) then
    raise exception 'Product does not exist'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_locations as location
    where location.business_id = target_business_id
      and location.id = target_source_location_id
      and location.is_active
  ) then
    raise exception 'Source inventory location is unavailable'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_product_id::text,
      9321
    )
  );

  select
    valuation.quantity::bigint,
    valuation.average_unit_cost_ron::numeric
  into available_quantity, average_unit_cost
  from public.product_stock_valuation_by_location as valuation
  where valuation.business_id = target_business_id
    and valuation.product_id = target_product_id
    and valuation.location_id = target_source_location_id
    and valuation.cost_is_complete;

  if not found or average_unit_cost is null then
    raise exception 'Product stock has no complete historical buying cost'
      using errcode = '55000';
  end if;

  if parsed_quantity > available_quantity then
    raise exception 'Exception quantity exceeds available stock'
      using errcode = '22023';
  end if;

  total_cost := round(parsed_quantity * average_unit_cost, 2);

  insert into public.inventory_exceptions (
    business_id,
    business_day_id,
    exception_date,
    product_id,
    source_location_id,
    exception_type,
    quantity,
    unit_cost_ron,
    total_cost_ron,
    reason,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    selected_day_date,
    target_product_id,
    target_source_location_id,
    normalized_type,
    parsed_quantity,
    average_unit_cost,
    total_cost,
    normalized_reason,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  )
  returning id into new_exception_id;

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
  values (
    target_business_id,
    target_product_id,
    case when normalized_type = 'damage'
      then 'damage'::public.stock_movement_type
      else 'adjustment'::public.stock_movement_type
    end,
    target_source_location_id,
    parsed_quantity,
    average_unit_cost,
    target_business_day_id,
    'inventory_exception',
    new_exception_id,
    normalized_reason,
    current_user_id,
    new_exception_id,
    request_fingerprint
  )
  returning id into new_stock_movement_id;

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
    'inventory_' || normalized_type,
    target_source_location_id,
    total_cost,
    'inventory_exception',
    new_exception_id,
    normalized_reason,
    'operational',
    current_user_id
  )
  returning id into new_inventory_movement_id;

  if normalized_type = 'damage' then
    insert into public.damaged_stock_movements (
      business_id,
      product_id,
      business_day_id,
      movement_date,
      direction,
      quantity,
      unit_cost_ron,
      source_entity_type,
      source_entity_id,
      created_by
    )
    values (
      target_business_id,
      target_product_id,
      target_business_day_id,
      selected_day_date,
      'in',
      parsed_quantity,
      average_unit_cost,
      'inventory_exception',
      new_exception_id,
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
    'inventory_exception.created',
    'inventory_exception',
    new_exception_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'product_id', target_product_id,
      'source_location_id', target_source_location_id,
      'exception_type', normalized_type,
      'quantity', parsed_quantity,
      'unit_cost_ron', average_unit_cost,
      'total_cost_ron', total_cost,
      'stock_movement_id', new_stock_movement_id,
      'inventory_movement_id', new_inventory_movement_id
    ),
    normalized_reason
  );

  return new_exception_id;
end;
$$;

create function public.reverse_inventory_exception(
  target_business_id uuid,
  target_inventory_exception_id uuid,
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
  exception_to_reverse public.inventory_exceptions%rowtype;
  stock_movement_id uuid;
  inventory_movement public.inventory_value_movements%rowtype;
  damaged_movement public.damaged_stock_movements%rowtype;
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

  select exception_record.*
  into exception_to_reverse
  from public.inventory_exceptions as exception_record
  where exception_record.business_id = target_business_id
    and exception_record.id = target_inventory_exception_id
  for update;

  if not found then
    raise exception 'Inventory exception does not exist'
      using errcode = '22023';
  end if;

  if exception_to_reverse.reversed_at is not null then
    raise exception 'Inventory exception is already reversed'
      using errcode = '55000';
  end if;

  select movement.id
  into stock_movement_id
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.reference_type = 'inventory_exception'
    and movement.reference_id = target_inventory_exception_id
    and movement.reversal_of_id is null
  for update;

  if not found then
    raise exception 'Inventory exception stock movement does not exist'
      using errcode = '55000';
  end if;

  perform public.reverse_stock_movement(
    target_business_id,
    stock_movement_id,
    normalized_reason,
    gen_random_uuid(),
    false
  );

  select movement.*
  into inventory_movement
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and movement.source_entity_type = 'inventory_exception'
    and movement.source_entity_id = target_inventory_exception_id
    and movement.reversal_of_id is null
  for update;

  if not found then
    raise exception 'Inventory exception value movement does not exist'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = inventory_movement.id
  ) then
    raise exception 'Inventory exception value is already reversed'
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
    exception_to_reverse.business_day_id,
    exception_to_reverse.exception_date,
    'inventory_exception_reversal',
    exception_to_reverse.source_location_id,
    exception_to_reverse.total_cost_ron,
    'inventory_exception',
    target_inventory_exception_id,
    normalized_reason,
    'operational',
    current_user_id,
    inventory_movement.id
  );

  select movement.*
  into damaged_movement
  from public.damaged_stock_movements as movement
  where movement.business_id = target_business_id
    and movement.source_entity_type = 'inventory_exception'
    and movement.source_entity_id = target_inventory_exception_id
    and movement.reversal_of_id is null
  for update;

  if found then
    insert into public.damaged_stock_movements (
      business_id,
      product_id,
      business_day_id,
      movement_date,
      direction,
      quantity,
      unit_cost_ron,
      source_entity_type,
      source_entity_id,
      created_by,
      reversal_of_id
    )
    values (
      target_business_id,
      damaged_movement.product_id,
      damaged_movement.business_day_id,
      damaged_movement.movement_date,
      'out',
      damaged_movement.quantity,
      damaged_movement.unit_cost_ron,
      'inventory_exception',
      target_inventory_exception_id,
      current_user_id,
      damaged_movement.id
    );
  end if;

  update public.inventory_exceptions
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where business_id = target_business_id
    and id = target_inventory_exception_id
    and reversed_at is null;

  if not found then
    raise exception 'Inventory exception reversal lost a concurrency race'
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
    'inventory_exception.reversed',
    'inventory_exception',
    target_inventory_exception_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'quantity', exception_to_reverse.quantity,
      'total_cost_ron', exception_to_reverse.total_cost_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time
    ),
    normalized_reason
  );
end;
$$;

do $migration$
declare
  original_definition text;
  revised_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure(
      'public.create_customer_payment(uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,text)'
    )
  )
  into original_definition;

  if original_definition is null then
    raise exception 'create_customer_payment function was not found';
  end if;

  revised_definition := pg_catalog.replace(
    original_definition,
    '- coalesce(active_allocations.allocated_ron, 0)',
    '- coalesce(active_allocations.allocated_ron, 0)'
      || E'\n          - coalesce(active_adjustments.adjusted_ron, 0)'
  );

  revised_definition := pg_catalog.replace(
    revised_definition,
    E') as active_allocations on true\n',
    E') as active_allocations on true\n'
      || E'  left join lateral (\n'
      || E'    select sum(adjustment.amount_ron) as adjusted_ron\n'
      || E'    from public.customer_credit_adjustments as adjustment\n'
      || E'    inner join public.sale_returns as return_record\n'
      || E'      on return_record.business_id = adjustment.business_id\n'
      || E'      and return_record.id = adjustment.sale_return_id\n'
      || E'      and return_record.reversed_at is null\n'
      || E'    where adjustment.customer_credit_purchase_id = purchase.id\n'
      || E'  ) as active_adjustments on true\n'
  );

  if revised_definition = original_definition
    or revised_definition not like '%customer_credit_adjustments%'
  then
    raise exception 'Customer payment outstanding calculation was not updated';
  end if;

  execute revised_definition;
end;
$migration$;

create or replace function private.prevent_allocated_purchase_reversal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.reversed_at is null
    and new.reversed_at is not null
    and (
      exists (
        select 1
        from public.customer_payment_allocations as allocation
        inner join public.customer_payments as payment
          on payment.id = allocation.payment_id
          and payment.reversed_at is null
        where allocation.customer_credit_purchase_id = old.id
      )
      or exists (
        select 1
        from public.customer_credit_adjustments as adjustment
        inner join public.sale_returns as return_record
          on return_record.business_id = adjustment.business_id
          and return_record.id = adjustment.sale_return_id
          and return_record.reversed_at is null
        where adjustment.customer_credit_purchase_id = old.id
      )
    )
  then
    raise exception
      'Reverse allocated payments and active returns before the purchase'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function private.prevent_sale_reversal_with_returns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.reversed_at is null
    and new.reversed_at is not null
    and exists (
      select 1
      from public.sale_returns as return_record
      where return_record.business_id = old.business_id
        and return_record.sale_id = old.id
        and return_record.reversed_at is null
    )
  then
    raise exception 'Reverse active returns before reversing the sale'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger sales_prevent_reversal_with_returns
before update of reversed_at on public.sales
for each row execute function private.prevent_sale_reversal_with_returns();

create or replace view public.customer_credit_purchase_balances
with (security_invoker = true)
as
select
  purchase.id as purchase_id,
  purchase.business_id,
  purchase.business_day_id,
  purchase.customer_id,
  purchase.purchase_date,
  purchase.amount_ron::text as amount_ron,
  coalesce(active_allocations.allocated_ron, 0)::text as allocated_ron,
  (
    case
      when purchase.reversed_at is null
        then purchase.amount_ron
          - coalesce(active_allocations.allocated_ron, 0)
          - coalesce(active_adjustments.adjusted_ron, 0)
      else 0::numeric
    end
  )::text as remaining_ron,
  case
    when purchase.reversed_at is not null then 'reversed'
    when coalesce(active_allocations.allocated_ron, 0)
      + coalesce(active_adjustments.adjusted_ron, 0) = 0
      then 'unpaid'
    when coalesce(active_allocations.allocated_ron, 0)
      + coalesce(active_adjustments.adjusted_ron, 0)
      = purchase.amount_ron
      then 'paid'
    else 'partial'
  end as derived_status,
  purchase.description,
  purchase.due_date,
  purchase.entry_origin,
  purchase.created_by,
  purchase.created_at,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason
from public.customer_credit_purchases as purchase
left join lateral (
  select sum(allocation.amount_ron) as allocated_ron
  from public.customer_payment_allocations as allocation
  inner join public.customer_payments as payment
    on payment.id = allocation.payment_id
    and payment.reversed_at is null
  where allocation.customer_credit_purchase_id = purchase.id
) as active_allocations on true
left join lateral (
  select sum(adjustment.amount_ron) as adjusted_ron
  from public.customer_credit_adjustments as adjustment
  inner join public.sale_returns as return_record
    on return_record.business_id = adjustment.business_id
    and return_record.id = adjustment.sale_return_id
    and return_record.reversed_at is null
  where adjustment.customer_credit_purchase_id = purchase.id
) as active_adjustments on true;

create or replace view public.customer_receivable_balances
with (security_invoker = true)
as
select
  customer.id as customer_id,
  customer.business_id,
  customer.name,
  coalesce(
    sum(
      case
        when purchase.reversed_at is null
          then purchase.amount_ron
            - coalesce(active_allocations.allocated_ron, 0)
            - coalesce(active_adjustments.adjusted_ron, 0)
        else 0::numeric
      end
    ),
    0
  )::text as outstanding_ron
from public.customers as customer
left join public.customer_credit_purchases as purchase
  on purchase.customer_id = customer.id
left join lateral (
  select sum(allocation.amount_ron) as allocated_ron
  from public.customer_payment_allocations as allocation
  inner join public.customer_payments as payment
    on payment.id = allocation.payment_id
    and payment.reversed_at is null
  where allocation.customer_credit_purchase_id = purchase.id
) as active_allocations on true
left join lateral (
  select sum(adjustment.amount_ron) as adjusted_ron
  from public.customer_credit_adjustments as adjustment
  inner join public.sale_returns as return_record
    on return_record.business_id = adjustment.business_id
    and return_record.id = adjustment.sale_return_id
    and return_record.reversed_at is null
  where adjustment.customer_credit_purchase_id = purchase.id
) as active_adjustments on true
group by customer.id, customer.business_id, customer.name;

create view public.returnable_sale_line_summaries
with (security_invoker = true)
as
select
  sale.business_id,
  sale.id as sale_id,
  sale.sale_number,
  sale.sale_date,
  sale.shop_location_id,
  location.name as shop_location_name,
  sale.customer_id,
  customer.name as customer_name,
  sale.credit_amount_ron::text as original_credit_ron,
  greatest(
    coalesce(credit_purchase.amount_ron, 0)
      - coalesce(credit_allocations.allocated_ron, 0)
      - coalesce(credit_adjustments.adjusted_ron, 0),
    0
  )::text as credit_available_ron,
  line.id as sale_line_id,
  line.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  line.quantity::text as sold_quantity,
  coalesce(returned.returned_quantity, 0)::text as returned_quantity,
  (line.quantity - coalesce(returned.returned_quantity, 0))::text
    as returnable_quantity,
  line.unit_cost_ron::text as unit_cost_ron,
  line.unit_selling_price_ron::text as unit_selling_price_ron
from public.sales as sale
inner join public.sale_lines as line
  on line.business_id = sale.business_id
  and line.sale_id = sale.id
inner join public.products as product
  on product.business_id = line.business_id
  and product.id = line.product_id
inner join public.inventory_locations as location
  on location.business_id = sale.business_id
  and location.id = sale.shop_location_id
left join public.customers as customer
  on customer.business_id = sale.business_id
  and customer.id = sale.customer_id
left join public.customer_credit_purchases as credit_purchase
  on credit_purchase.business_id = sale.business_id
  and credit_purchase.sale_id = sale.id
  and credit_purchase.reversed_at is null
left join lateral (
  select sum(allocation.amount_ron) as allocated_ron
  from public.customer_payment_allocations as allocation
  inner join public.customer_payments as payment
    on payment.business_id = allocation.business_id
    and payment.id = allocation.payment_id
    and payment.reversed_at is null
  where allocation.business_id = sale.business_id
    and allocation.customer_credit_purchase_id = credit_purchase.id
) as credit_allocations on true
left join lateral (
  select sum(adjustment.amount_ron) as adjusted_ron
  from public.customer_credit_adjustments as adjustment
  inner join public.sale_returns as return_record
    on return_record.business_id = adjustment.business_id
    and return_record.id = adjustment.sale_return_id
    and return_record.reversed_at is null
  where adjustment.business_id = sale.business_id
    and adjustment.customer_credit_purchase_id = credit_purchase.id
) as credit_adjustments on true
left join lateral (
  select sum(return_line.quantity) as returned_quantity
  from public.sale_return_lines as return_line
  inner join public.sale_returns as return_record
    on return_record.business_id = return_line.business_id
    and return_record.id = return_line.sale_return_id
    and return_record.reversed_at is null
  where return_line.business_id = line.business_id
    and return_line.sale_line_id = line.id
) as returned on true
where sale.reversed_at is null
  and line.quantity - coalesce(returned.returned_quantity, 0) > 0;

create view public.sale_return_line_summaries
with (security_invoker = true)
as
select
  line.business_id,
  line.id as line_id,
  line.sale_return_id,
  line.sale_line_id,
  line.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  line.line_number,
  line.quantity::text as quantity,
  line.disposition,
  line.unit_cost_ron::text as unit_cost_ron,
  line.unit_refund_ron::text as unit_refund_ron,
  line.line_cost_ron::text as line_cost_ron,
  line.line_refund_ron::text as line_refund_ron
from public.sale_return_lines as line
inner join public.products as product
  on product.business_id = line.business_id
  and product.id = line.product_id;

create view public.sale_return_summaries
with (security_invoker = true)
as
select
  return_record.business_id,
  return_record.id as sale_return_id,
  return_record.business_day_id,
  return_record.return_date,
  return_record.sale_id,
  sale.sale_number,
  return_record.customer_id,
  customer.name as customer_name,
  return_record.cash_refund_ron::text as cash_refund_ron,
  return_record.bank_refund_ron::text as bank_refund_ron,
  return_record.credit_reduction_ron::text as credit_reduction_ron,
  return_record.total_refund_ron::text as total_refund_ron,
  return_record.total_cost_ron::text as total_cost_ron,
  return_record.reason,
  return_record.created_by,
  profile.full_name as created_by_name,
  return_record.created_at,
  case when return_record.reversed_at is null
    then 'active'
    else 'reversed'
  end as status,
  return_record.reversed_at,
  return_record.reversal_reason
from public.sale_returns as return_record
inner join public.sales as sale
  on sale.business_id = return_record.business_id
  and sale.id = return_record.sale_id
left join public.customers as customer
  on customer.business_id = return_record.business_id
  and customer.id = return_record.customer_id
left join public.profiles as profile
  on profile.id = return_record.created_by;

create view public.inventory_exception_summaries
with (security_invoker = true)
as
select
  exception_record.business_id,
  exception_record.id as inventory_exception_id,
  exception_record.business_day_id,
  exception_record.exception_date,
  exception_record.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  exception_record.source_location_id,
  location.name as source_location_name,
  location.type as source_location_type,
  exception_record.exception_type,
  exception_record.quantity::text as quantity,
  exception_record.unit_cost_ron::text as unit_cost_ron,
  exception_record.total_cost_ron::text as total_cost_ron,
  exception_record.reason,
  exception_record.created_by,
  profile.full_name as created_by_name,
  exception_record.created_at,
  case when exception_record.reversed_at is null
    then 'active'
    else 'reversed'
  end as status,
  exception_record.reversed_at,
  exception_record.reversal_reason
from public.inventory_exceptions as exception_record
inner join public.products as product
  on product.business_id = exception_record.business_id
  and product.id = exception_record.product_id
inner join public.inventory_locations as location
  on location.business_id = exception_record.business_id
  and location.id = exception_record.source_location_id
left join public.profiles as profile
  on profile.id = exception_record.created_by;

create view public.damaged_stock_balances
with (security_invoker = true)
as
select
  product.business_id,
  product.id as product_id,
  product.internal_code,
  product.name as product_name,
  coalesce(
    sum(
      case
        when movement.direction = 'in' then movement.quantity
        else -movement.quantity
      end
    ),
    0
  )::text as damaged_quantity,
  coalesce(
    sum(
      case
        when movement.direction = 'in'
          then movement.quantity * movement.unit_cost_ron
        else -movement.quantity * movement.unit_cost_ron
      end
    ),
    0
  )::text as historical_cost_ron
from public.products as product
left join public.damaged_stock_movements as movement
  on movement.business_id = product.business_id
  and movement.product_id = product.id
group by
  product.business_id,
  product.id,
  product.internal_code,
  product.name;

create view public.daily_net_revenue_summaries
with (security_invoker = true)
as
select
  daily.business_id,
  daily.business_day_id,
  daily.business_date,
  daily.status,
  (
    daily.cash_sales_ron::numeric
      - coalesce(refunds.cash_refund_ron, 0)
  )::text as cash_sales_ron,
  (
    daily.bank_sales_ron::numeric
      - coalesce(refunds.bank_refund_ron, 0)
  )::text as bank_sales_ron,
  (
    daily.credit_sales_ron::numeric
      - coalesce(refunds.credit_reduction_ron, 0)
  )::text as credit_sales_ron,
  (
    daily.total_sales_ron::numeric
      - coalesce(refunds.total_refund_ron, 0)
  )::text as total_sales_ron,
  coalesce(refunds.total_refund_ron, 0)::text as returns_ron
from public.daily_sales_summaries as daily
left join lateral (
  select
    sum(return_record.cash_refund_ron) as cash_refund_ron,
    sum(return_record.bank_refund_ron) as bank_refund_ron,
    sum(return_record.credit_reduction_ron) as credit_reduction_ron,
    sum(return_record.total_refund_ron) as total_refund_ron
  from public.sale_returns as return_record
  where return_record.business_id = daily.business_id
    and return_record.return_date = daily.business_date
    and return_record.reversed_at is null
) as refunds on true;

revoke all on table public.returnable_sale_line_summaries
  from anon, authenticated;
revoke all on table public.sale_return_line_summaries
  from anon, authenticated;
revoke all on table public.sale_return_summaries
  from anon, authenticated;
revoke all on table public.inventory_exception_summaries
  from anon, authenticated;
revoke all on table public.damaged_stock_balances
  from anon, authenticated;
revoke all on table public.daily_net_revenue_summaries
  from anon, authenticated;
grant select on table public.returnable_sale_line_summaries
  to authenticated, service_role;
grant select on table public.sale_return_line_summaries
  to authenticated, service_role;
grant select on table public.sale_return_summaries
  to authenticated, service_role;
grant select on table public.inventory_exception_summaries
  to authenticated, service_role;
grant select on table public.damaged_stock_balances
  to authenticated, service_role;
grant select on table public.daily_net_revenue_summaries
  to authenticated, service_role;

revoke all on function public.create_sale_return(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.reverse_sale_return(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.create_inventory_exception(
  uuid, uuid, uuid, uuid, text, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.reverse_inventory_exception(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_sale_return(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text
) to authenticated, service_role;
grant execute on function public.reverse_sale_return(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.create_inventory_exception(
  uuid, uuid, uuid, uuid, text, text, uuid, text
) to authenticated, service_role;
grant execute on function public.reverse_inventory_exception(uuid, uuid, text)
  to authenticated, service_role;

comment on table public.sale_returns is
  'Immutable, sale-linked customer returns with exact refund and credit-reduction effects.';
comment on table public.customer_credit_adjustments is
  'Immutable receivable reductions created by active sale returns.';
comment on table public.damaged_stock_movements is
  'Immutable ledger of non-sellable damaged product quantities.';
comment on table public.inventory_exceptions is
  'Reasoned damage, missing, and stolen stock events with compensating reversals.';
comment on view public.daily_net_revenue_summaries is
  'Daily cash, bank, credit, and total revenue net of active return-date refunds.';
comment on function public.create_sale_return(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text
) is
  'Administrator-only atomic sale return, refund, credit reduction, and stock disposition command.';
comment on function public.create_inventory_exception(
  uuid, uuid, uuid, uuid, text, text, uuid, text
) is
  'Administrator-only atomic damage, missing, or stolen stock command.';

commit;
