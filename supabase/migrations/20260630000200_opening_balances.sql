begin;

create type public.transaction_currency as enum ('RON', 'USD');
create type public.financial_entry_direction as enum ('inflow', 'outflow');

create table public.opening_balance_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  opening_date date not null,
  cash_balance_ron numeric(18, 2) not null,
  bank_balance_ron numeric(18, 2) not null,
  warehouse_inventory_ron numeric(18, 2) not null,
  shop_inventory_ron numeric(18, 2) not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint opening_balance_batches_cash_nonnegative
    check (cash_balance_ron >= 0),
  constraint opening_balance_batches_bank_nonnegative
    check (bank_balance_ron >= 0),
  constraint opening_balance_batches_warehouse_nonnegative
    check (warehouse_inventory_ron >= 0),
  constraint opening_balance_batches_shop_nonnegative
    check (shop_inventory_ron >= 0),
  constraint opening_balance_batches_reversal_consistent
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
        and char_length(btrim(reversal_reason)) >= 10
      )
    )
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (btrim(name) <> ''),
  constraint customers_name_length check (char_length(name) <= 120),
  constraint customers_phone_not_blank
    check (phone is null or btrim(phone) <> ''),
  constraint customers_notes_not_blank
    check (notes is null or btrim(notes) <> '')
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  phone text,
  notes text,
  default_currency public.transaction_currency,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_not_blank check (btrim(name) <> ''),
  constraint suppliers_name_length check (char_length(name) <= 120),
  constraint suppliers_phone_not_blank
    check (phone is null or btrim(phone) <> ''),
  constraint suppliers_notes_not_blank
    check (notes is null or btrim(notes) <> '')
);

create table public.financial_account_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  financial_account_id uuid not null
    references public.financial_accounts (id),
  entry_date date not null,
  direction public.financial_entry_direction not null,
  amount_ron numeric(18, 2) not null,
  entry_type text not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  description text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.financial_account_entries (id),
  opening_batch_id uuid references public.opening_balance_batches (id),
  constraint financial_account_entries_amount_positive
    check (amount_ron > 0),
  constraint financial_account_entries_type_not_blank
    check (btrim(entry_type) <> ''),
  constraint financial_account_entries_source_not_blank
    check (btrim(source_entity_type) <> ''),
  constraint financial_account_entries_description_not_blank
    check (description is null or btrim(description) <> ''),
  constraint financial_account_entries_opening_source
    check (
      opening_batch_id is null
      or (
        entry_type = 'opening_balance'
        and source_entity_type = 'opening_balance_batch'
        and source_entity_id = opening_batch_id
        and direction = 'inflow'
      )
    ),
  constraint financial_account_entries_opening_account_key
    unique (opening_batch_id, financial_account_id)
);

create table public.inventory_value_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  movement_date date not null,
  movement_type text not null,
  source_location_id uuid references public.inventory_locations (id),
  destination_location_id uuid references public.inventory_locations (id),
  amount_ron numeric(18, 2) not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.inventory_value_movements (id),
  opening_batch_id uuid references public.opening_balance_batches (id),
  constraint inventory_value_movements_amount_positive
    check (amount_ron > 0),
  constraint inventory_value_movements_type_not_blank
    check (btrim(movement_type) <> ''),
  constraint inventory_value_movements_source_not_blank
    check (btrim(source_entity_type) <> ''),
  constraint inventory_value_movements_locations_differ
    check (
      source_location_id is null
      or destination_location_id is null
      or source_location_id <> destination_location_id
    ),
  constraint inventory_value_movements_has_location
    check (
      source_location_id is not null
      or destination_location_id is not null
    ),
  constraint inventory_value_movements_opening_source
    check (
      opening_batch_id is null
      or (
        movement_type = 'opening_balance'
        and source_entity_type = 'opening_balance_batch'
        and source_entity_id = opening_batch_id
        and source_location_id is null
        and destination_location_id is not null
      )
    ),
  constraint inventory_value_movements_opening_location_key
    unique (opening_batch_id, destination_location_id)
);

create table public.customer_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  customer_id uuid not null references public.customers (id),
  purchase_date date not null,
  amount_ron numeric(18, 2) not null,
  description text,
  due_date date,
  entry_origin text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.customer_credit_purchases (id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  opening_batch_id uuid references public.opening_balance_batches (id),
  constraint customer_credit_purchases_amount_positive
    check (amount_ron > 0),
  constraint customer_credit_purchases_origin_not_blank
    check (btrim(entry_origin) <> ''),
  constraint customer_credit_purchases_description_not_blank
    check (description is null or btrim(description) <> ''),
  constraint customer_credit_purchases_due_date_order
    check (due_date is null or due_date >= purchase_date),
  constraint customer_credit_purchases_reversal_consistent
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
        and btrim(reversal_reason) <> ''
      )
    ),
  constraint customer_credit_purchases_opening_origin
    check (
      opening_batch_id is null
      or entry_origin = 'opening_balance'
    )
);

create table public.supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  supplier_id uuid not null references public.suppliers (id),
  purchase_date date not null,
  currency public.transaction_currency not null,
  original_amount numeric(18, 2) not null,
  purchase_exchange_rate numeric(18, 8),
  inventory_cost_ron numeric(18, 2) not null,
  destination_location_id uuid references public.inventory_locations (id),
  description text,
  due_date date,
  entry_origin text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.supplier_purchases (id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  opening_batch_id uuid references public.opening_balance_batches (id),
  constraint supplier_purchases_original_amount_positive
    check (original_amount > 0),
  constraint supplier_purchases_inventory_cost_positive
    check (inventory_cost_ron > 0),
  constraint supplier_purchases_exchange_rate_positive
    check (
      purchase_exchange_rate is null
      or purchase_exchange_rate > 0
    ),
  constraint supplier_purchases_currency_values_consistent
    check (
      (
        currency = 'RON'
        and purchase_exchange_rate is null
        and inventory_cost_ron = original_amount
      )
      or (
        currency = 'USD'
        and purchase_exchange_rate is not null
        and inventory_cost_ron = round(
          original_amount * purchase_exchange_rate,
          2
        )
      )
    ),
  constraint supplier_purchases_description_not_blank
    check (description is null or btrim(description) <> ''),
  constraint supplier_purchases_due_date_order
    check (due_date is null or due_date >= purchase_date),
  constraint supplier_purchases_origin_not_blank
    check (btrim(entry_origin) <> ''),
  constraint supplier_purchases_opening_origin
    check (
      opening_batch_id is null
      or (
        entry_origin = 'opening_balance'
        and destination_location_id is null
      )
    ),
  constraint supplier_purchases_reversal_consistent
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
        and btrim(reversal_reason) <> ''
      )
    )
);

alter table public.financial_accounts
  add constraint financial_accounts_business_id_id_key
  unique (business_id, id);
alter table public.inventory_locations
  add constraint inventory_locations_business_id_id_key
  unique (business_id, id);
alter table public.opening_balance_batches
  add constraint opening_balance_batches_business_id_id_key
  unique (business_id, id);
alter table public.customers
  add constraint customers_business_id_id_key
  unique (business_id, id);
alter table public.suppliers
  add constraint suppliers_business_id_id_key
  unique (business_id, id);

alter table public.financial_account_entries
  add constraint financial_account_entries_account_business_fkey
  foreign key (business_id, financial_account_id)
  references public.financial_accounts (business_id, id),
  add constraint financial_account_entries_batch_business_fkey
  foreign key (business_id, opening_batch_id)
  references public.opening_balance_batches (business_id, id);

alter table public.inventory_value_movements
  add constraint inventory_value_movements_source_business_fkey
  foreign key (business_id, source_location_id)
  references public.inventory_locations (business_id, id),
  add constraint inventory_value_movements_destination_business_fkey
  foreign key (business_id, destination_location_id)
  references public.inventory_locations (business_id, id),
  add constraint inventory_value_movements_batch_business_fkey
  foreign key (business_id, opening_batch_id)
  references public.opening_balance_batches (business_id, id);

alter table public.customer_credit_purchases
  add constraint customer_credit_purchases_customer_business_fkey
  foreign key (business_id, customer_id)
  references public.customers (business_id, id),
  add constraint customer_credit_purchases_batch_business_fkey
  foreign key (business_id, opening_batch_id)
  references public.opening_balance_batches (business_id, id);

alter table public.supplier_purchases
  add constraint supplier_purchases_supplier_business_fkey
  foreign key (business_id, supplier_id)
  references public.suppliers (business_id, id),
  add constraint supplier_purchases_destination_business_fkey
  foreign key (business_id, destination_location_id)
  references public.inventory_locations (business_id, id),
  add constraint supplier_purchases_batch_business_fkey
  foreign key (business_id, opening_batch_id)
  references public.opening_balance_batches (business_id, id);

create index customers_business_active_name_idx
  on public.customers (business_id, is_active, name);
create unique index opening_balance_batches_one_active_idx
  on public.opening_balance_batches (business_id)
  where reversed_at is null;
create index suppliers_business_active_name_idx
  on public.suppliers (business_id, is_active, name);
create index financial_account_entries_account_date_idx
  on public.financial_account_entries (
    financial_account_id,
    entry_date,
    created_at
  );
create index financial_account_entries_business_date_idx
  on public.financial_account_entries (business_id, entry_date);
create index inventory_value_movements_business_date_idx
  on public.inventory_value_movements (business_id, movement_date);
create index inventory_value_movements_destination_date_idx
  on public.inventory_value_movements (
    destination_location_id,
    movement_date
  )
  where destination_location_id is not null;
create index inventory_value_movements_source_date_idx
  on public.inventory_value_movements (
    source_location_id,
    movement_date
  )
  where source_location_id is not null;
create index customer_credit_purchases_customer_date_idx
  on public.customer_credit_purchases (
    customer_id,
    purchase_date,
    created_at
  );
create index supplier_purchases_supplier_date_idx
  on public.supplier_purchases (
    supplier_id,
    purchase_date,
    created_at
  );

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function private.set_profile_updated_at();

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row
execute function private.set_profile_updated_at();

alter table public.opening_balance_batches enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.financial_account_entries enable row level security;
alter table public.inventory_value_movements enable row level security;
alter table public.customer_credit_purchases enable row level security;
alter table public.supplier_purchases enable row level security;

create policy opening_balance_batches_select_member
on public.opening_balance_batches
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy customers_select_member
on public.customers
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy suppliers_select_member
on public.suppliers
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy financial_account_entries_select_member
on public.financial_account_entries
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy inventory_value_movements_select_member
on public.inventory_value_movements
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy customer_credit_purchases_select_member
on public.customer_credit_purchases
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy supplier_purchases_select_member
on public.supplier_purchases
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.opening_balance_batches from anon, authenticated;
revoke all on table public.customers from anon, authenticated;
revoke all on table public.suppliers from anon, authenticated;
revoke all on table public.financial_account_entries from anon, authenticated;
revoke all on table public.inventory_value_movements from anon, authenticated;
revoke all on table public.customer_credit_purchases from anon, authenticated;
revoke all on table public.supplier_purchases from anon, authenticated;

grant select on table public.opening_balance_batches to authenticated;
grant select on table public.customers to authenticated;
grant select on table public.suppliers to authenticated;
grant select on table public.financial_account_entries to authenticated;
grant select on table public.inventory_value_movements to authenticated;
grant select on table public.customer_credit_purchases to authenticated;
grant select on table public.supplier_purchases to authenticated;

grant all on table public.opening_balance_batches to service_role;
grant all on table public.customers to service_role;
grant all on table public.suppliers to service_role;
grant all on table public.financial_account_entries to service_role;
grant all on table public.inventory_value_movements to service_role;
grant all on table public.customer_credit_purchases to service_role;
grant all on table public.supplier_purchases to service_role;

create function private.parse_opening_money(
  input_value text,
  input_name text,
  allow_zero boolean
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  if input_value is null
    or input_value !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$'
  then
    raise exception '% must be a plain decimal with at most two decimal places',
      input_name
      using errcode = '22023';
  end if;

  parsed_value := input_value::numeric;

  if parsed_value < 0 or (not allow_zero and parsed_value = 0) then
    raise exception '% must be % zero',
      input_name,
      case when allow_zero then 'at least' else 'greater than' end
      using errcode = '22023';
  end if;

  return parsed_value;
end;
$$;

create function private.parse_opening_exchange_rate(
  input_value text,
  input_name text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  if input_value is null
    or input_value !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$'
  then
    raise exception '% must be a positive decimal with at most eight decimal places',
      input_name
      using errcode = '22023';
  end if;

  parsed_value := input_value::numeric;

  if parsed_value <= 0 then
    raise exception '% must be greater than zero', input_name
      using errcode = '22023';
  end if;

  return parsed_value;
end;
$$;

revoke all on function private.parse_opening_money(text, text, boolean)
  from public;
revoke all on function private.parse_opening_exchange_rate(text, text)
  from public;

create function public.create_opening_balance(
  target_business_id uuid,
  target_opening_date date,
  target_cash_balance_ron text,
  target_bank_balance_ron text,
  target_warehouse_inventory_ron text,
  target_shop_inventory_ron text,
  target_customer_receivables jsonb default '[]'::jsonb,
  target_supplier_payables jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  business_timezone text;
  cash_account_id uuid;
  bank_account_id uuid;
  warehouse_location_id uuid;
  shop_location_id uuid;
  new_batch_id uuid;
  cash_amount numeric;
  bank_amount numeric;
  warehouse_amount numeric;
  shop_amount numeric;
  customer_item jsonb;
  customer_name text;
  customer_amount numeric;
  new_customer_id uuid;
  supplier_item jsonb;
  supplier_name text;
  supplier_currency text;
  supplier_amount numeric;
  supplier_rate numeric;
  supplier_inventory_cost numeric;
  new_supplier_id uuid;
  customer_total numeric := 0;
  supplier_historical_total numeric := 0;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if business_timezone is null then
    raise exception 'Business does not exist'
      using errcode = '22023';
  end if;

  if target_opening_date is null
    or target_opening_date > (
      pg_catalog.now() at time zone business_timezone
    )::date
  then
    raise exception 'Opening date must not be in the future'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(
    coalesce(target_customer_receivables, '[]'::jsonb)
  ) <> 'array'
    or pg_catalog.jsonb_array_length(
      coalesce(target_customer_receivables, '[]'::jsonb)
    ) > 100
  then
    raise exception 'Customer receivables must be an array of at most 100 items'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(
    coalesce(target_supplier_payables, '[]'::jsonb)
  ) <> 'array'
    or pg_catalog.jsonb_array_length(
      coalesce(target_supplier_payables, '[]'::jsonb)
    ) > 100
  then
    raise exception 'Supplier payables must be an array of at most 100 items'
      using errcode = '22023';
  end if;

  cash_amount := private.parse_opening_money(
    target_cash_balance_ron,
    'Cash balance',
    true
  );
  bank_amount := private.parse_opening_money(
    target_bank_balance_ron,
    'Bank balance',
    true
  );
  warehouse_amount := private.parse_opening_money(
    target_warehouse_inventory_ron,
    'Warehouse inventory',
    true
  );
  shop_amount := private.parse_opening_money(
    target_shop_inventory_ron,
    'Shop inventory',
    true
  );

  select account.id
  into cash_account_id
  from public.financial_accounts as account
  where account.business_id = target_business_id
    and account.type = 'cash'
    and account.currency = 'RON'
    and account.is_active;

  select account.id
  into bank_account_id
  from public.financial_accounts as account
  where account.business_id = target_business_id
    and account.type = 'bank'
    and account.currency = 'RON'
    and account.is_active;

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

  if cash_account_id is null
    or bank_account_id is null
    or warehouse_location_id is null
    or shop_location_id is null
  then
    raise exception 'Active cash, bank, warehouse, and shop records are required'
      using errcode = '23503';
  end if;

  insert into public.opening_balance_batches (
    business_id,
    opening_date,
    cash_balance_ron,
    bank_balance_ron,
    warehouse_inventory_ron,
    shop_inventory_ron,
    created_by
  )
  values (
    target_business_id,
    target_opening_date,
    cash_amount,
    bank_amount,
    warehouse_amount,
    shop_amount,
    current_user_id
  )
  returning id into new_batch_id;

  if cash_amount > 0 then
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
      opening_batch_id
    )
    values (
      target_business_id,
      cash_account_id,
      target_opening_date,
      'inflow',
      cash_amount,
      'opening_balance',
      'opening_balance_batch',
      new_batch_id,
      'Opening cash balance',
      current_user_id,
      new_batch_id
    );
  end if;

  if bank_amount > 0 then
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
      opening_batch_id
    )
    values (
      target_business_id,
      bank_account_id,
      target_opening_date,
      'inflow',
      bank_amount,
      'opening_balance',
      'opening_balance_batch',
      new_batch_id,
      'Opening bank balance',
      current_user_id,
      new_batch_id
    );
  end if;

  if warehouse_amount > 0 then
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      destination_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      created_by,
      opening_batch_id
    )
    values (
      target_business_id,
      target_opening_date,
      'opening_balance',
      warehouse_location_id,
      warehouse_amount,
      'opening_balance_batch',
      new_batch_id,
      current_user_id,
      new_batch_id
    );
  end if;

  if shop_amount > 0 then
    insert into public.inventory_value_movements (
      business_id,
      movement_date,
      movement_type,
      destination_location_id,
      amount_ron,
      source_entity_type,
      source_entity_id,
      created_by,
      opening_batch_id
    )
    values (
      target_business_id,
      target_opening_date,
      'opening_balance',
      shop_location_id,
      shop_amount,
      'opening_balance_batch',
      new_batch_id,
      current_user_id,
      new_batch_id
    );
  end if;

  for customer_item in
    select item.value
    from pg_catalog.jsonb_array_elements(
      coalesce(target_customer_receivables, '[]'::jsonb)
    ) as item(value)
  loop
    if pg_catalog.jsonb_typeof(customer_item) <> 'object'
      or not customer_item ? 'name'
      or not customer_item ? 'amount_ron'
      or customer_item - array['name', 'amount_ron'] <> '{}'::jsonb
    then
      raise exception 'Each customer receivable requires only name and amount_ron'
        using errcode = '22023';
    end if;

    customer_name := nullif(btrim(customer_item ->> 'name'), '');

    if customer_name is null or char_length(customer_name) > 120 then
      raise exception 'Customer name must contain 1 to 120 characters'
        using errcode = '22023';
    end if;

    customer_amount := private.parse_opening_money(
      customer_item ->> 'amount_ron',
      'Customer receivable',
      false
    );

    insert into public.customers (
      business_id,
      name,
      created_by
    )
    values (
      target_business_id,
      customer_name,
      current_user_id
    )
    returning id into new_customer_id;

    insert into public.customer_credit_purchases (
      business_id,
      customer_id,
      purchase_date,
      amount_ron,
      description,
      entry_origin,
      created_by,
      opening_batch_id
    )
    values (
      target_business_id,
      new_customer_id,
      target_opening_date,
      customer_amount,
      'Opening customer receivable',
      'opening_balance',
      current_user_id,
      new_batch_id
    );

    customer_total := customer_total + customer_amount;
  end loop;

  for supplier_item in
    select item.value
    from pg_catalog.jsonb_array_elements(
      coalesce(target_supplier_payables, '[]'::jsonb)
    ) as item(value)
  loop
    if pg_catalog.jsonb_typeof(supplier_item) <> 'object'
      or not supplier_item ? 'name'
      or not supplier_item ? 'currency'
      or not supplier_item ? 'original_amount'
      or supplier_item - array[
        'name',
        'currency',
        'original_amount',
        'purchase_exchange_rate'
      ] <> '{}'::jsonb
    then
      raise exception 'Each supplier payable has invalid fields'
        using errcode = '22023';
    end if;

    supplier_name := nullif(btrim(supplier_item ->> 'name'), '');
    supplier_currency := supplier_item ->> 'currency';

    if supplier_name is null or char_length(supplier_name) > 120 then
      raise exception 'Supplier name must contain 1 to 120 characters'
        using errcode = '22023';
    end if;

    if supplier_currency not in ('RON', 'USD') then
      raise exception 'Supplier currency must be RON or USD'
        using errcode = '22023';
    end if;

    supplier_amount := private.parse_opening_money(
      supplier_item ->> 'original_amount',
      'Supplier payable',
      false
    );

    if supplier_currency = 'USD' then
      supplier_rate := private.parse_opening_exchange_rate(
        supplier_item ->> 'purchase_exchange_rate',
        'Purchase exchange rate'
      );
      supplier_inventory_cost := round(supplier_amount * supplier_rate, 2);
    else
      if supplier_item ? 'purchase_exchange_rate'
        and supplier_item -> 'purchase_exchange_rate' <> 'null'::jsonb
        and nullif(supplier_item ->> 'purchase_exchange_rate', '') is not null
      then
        raise exception 'RON supplier payable must not include an exchange rate'
          using errcode = '22023';
      end if;

      supplier_rate := null;
      supplier_inventory_cost := supplier_amount;
    end if;

    insert into public.suppliers (
      business_id,
      name,
      default_currency,
      created_by
    )
    values (
      target_business_id,
      supplier_name,
      supplier_currency::public.transaction_currency,
      current_user_id
    )
    returning id into new_supplier_id;

    insert into public.supplier_purchases (
      business_id,
      supplier_id,
      purchase_date,
      currency,
      original_amount,
      purchase_exchange_rate,
      inventory_cost_ron,
      description,
      entry_origin,
      created_by,
      opening_batch_id
    )
    values (
      target_business_id,
      new_supplier_id,
      target_opening_date,
      supplier_currency::public.transaction_currency,
      supplier_amount,
      supplier_rate,
      supplier_inventory_cost,
      'Opening supplier payable',
      'opening_balance',
      current_user_id,
      new_batch_id
    );

    supplier_historical_total :=
      supplier_historical_total + supplier_inventory_cost;
  end loop;

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
    'opening_balance.created',
    'opening_balance_batch',
    new_batch_id,
    pg_catalog.jsonb_build_object(
      'opening_date', target_opening_date,
      'cash_balance_ron', cash_amount::text,
      'bank_balance_ron', bank_amount::text,
      'warehouse_inventory_ron', warehouse_amount::text,
      'shop_inventory_ron', shop_amount::text,
      'customer_receivable_count',
        pg_catalog.jsonb_array_length(
          coalesce(target_customer_receivables, '[]'::jsonb)
        ),
      'customer_receivable_total_ron', customer_total::text,
      'supplier_payable_count',
        pg_catalog.jsonb_array_length(
          coalesce(target_supplier_payables, '[]'::jsonb)
        ),
      'supplier_historical_total_ron', supplier_historical_total::text
    )
  );

  return new_batch_id;
end;
$$;

revoke all on function public.create_opening_balance(
  uuid,
  date,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_opening_balance(
  uuid,
  date,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to authenticated, service_role;

create function public.reverse_opening_balance(
  target_business_id uuid,
  target_batch_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := btrim(target_reason);
  reversal_time timestamptz := pg_catalog.now();
  active_batch_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if normalized_reason is null or char_length(normalized_reason) < 10 then
    raise exception 'Reversal reason must contain at least 10 characters'
      using errcode = '22023';
  end if;

  select batch.id
  into active_batch_id
  from public.opening_balance_batches as batch
  where batch.id = target_batch_id
    and batch.business_id = target_business_id
    and batch.reversed_at is null
  for update;

  if active_batch_id is null then
    raise exception 'Active opening balance batch does not exist'
      using errcode = '22023';
  end if;

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
  select
    entry.business_id,
    entry.financial_account_id,
    entry.entry_date,
    case
      when entry.direction = 'inflow'
        then 'outflow'::public.financial_entry_direction
      else 'inflow'::public.financial_entry_direction
    end,
    entry.amount_ron,
    'opening_balance_reversal',
    'opening_balance_batch',
    target_batch_id,
    'Opening balance reversal',
    current_user_id,
    entry.id
  from public.financial_account_entries as entry
  where entry.opening_batch_id = target_batch_id
    and entry.reversal_of_id is null;

  insert into public.inventory_value_movements (
    business_id,
    movement_date,
    movement_type,
    source_location_id,
    destination_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    created_by,
    reversal_of_id
  )
  select
    movement.business_id,
    movement.movement_date,
    'opening_balance_reversal',
    movement.destination_location_id,
    movement.source_location_id,
    movement.amount_ron,
    'opening_balance_batch',
    target_batch_id,
    current_user_id,
    movement.id
  from public.inventory_value_movements as movement
  where movement.opening_batch_id = target_batch_id
    and movement.reversal_of_id is null;

  update public.customer_credit_purchases
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where opening_batch_id = target_batch_id
    and reversed_at is null;

  update public.supplier_purchases
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where opening_batch_id = target_batch_id
    and reversed_at is null;

  update public.opening_balance_batches
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_batch_id
    and business_id = target_business_id
    and reversed_at is null;

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
    'opening_balance.reversed',
    'opening_balance_batch',
    target_batch_id,
    pg_catalog.jsonb_build_object('status', 'active'),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.reverse_opening_balance(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reverse_opening_balance(uuid, uuid, text)
  to authenticated, service_role;

create view public.opening_balance_summaries
with (security_invoker = true)
as
select
  batch.id,
  batch.business_id,
  batch.opening_date,
  batch.cash_balance_ron::text as cash_balance_ron,
  batch.bank_balance_ron::text as bank_balance_ron,
  batch.warehouse_inventory_ron::text as warehouse_inventory_ron,
  batch.shop_inventory_ron::text as shop_inventory_ron,
  batch.created_by,
  batch.created_at,
  (
    select count(*)
    from public.customer_credit_purchases as purchase
    where purchase.opening_batch_id = batch.id
  )::integer as customer_receivable_count,
  (
    select count(*)
    from public.supplier_purchases as purchase
    where purchase.opening_batch_id = batch.id
  )::integer as supplier_payable_count
from public.opening_balance_batches as batch
where batch.reversed_at is null;

create view public.financial_account_balances
with (security_invoker = true)
as
select
  account.id as financial_account_id,
  account.business_id,
  account.name,
  account.type,
  account.currency,
  coalesce(
    sum(
      case
        when entry.direction = 'inflow' then entry.amount_ron
        else -entry.amount_ron
      end
    ),
    0
  )::text as balance_ron
from public.financial_accounts as account
left join public.financial_account_entries as entry
  on entry.financial_account_id = account.id
group by
  account.id,
  account.business_id,
  account.name,
  account.type,
  account.currency;

create view public.inventory_location_balances
with (security_invoker = true)
as
select
  location.id as inventory_location_id,
  location.business_id,
  location.name,
  location.type,
  coalesce(
    sum(
      case
        when movement.destination_location_id = location.id
          then movement.amount_ron
        when movement.source_location_id = location.id
          then -movement.amount_ron
        else 0
      end
    ),
    0
  )::text as balance_ron
from public.inventory_locations as location
left join public.inventory_value_movements as movement
  on movement.destination_location_id = location.id
  or movement.source_location_id = location.id
group by
  location.id,
  location.business_id,
  location.name,
  location.type;

create view public.customer_receivable_balances
with (security_invoker = true)
as
select
  customer.id as customer_id,
  customer.business_id,
  customer.name,
  coalesce(sum(purchase.amount_ron), 0)::text as outstanding_ron
from public.customers as customer
left join public.customer_credit_purchases as purchase
  on purchase.customer_id = customer.id
  and purchase.reversed_at is null
group by customer.id, customer.business_id, customer.name;

create view public.supplier_payable_balances
with (security_invoker = true)
as
select
  supplier.id as supplier_id,
  supplier.business_id,
  supplier.name,
  purchase.currency,
  coalesce(sum(purchase.original_amount), 0)::text
    as outstanding_original_amount,
  coalesce(sum(purchase.inventory_cost_ron), 0)::text
    as historical_ron_amount
from public.suppliers as supplier
inner join public.supplier_purchases as purchase
  on purchase.supplier_id = supplier.id
  and purchase.reversed_at is null
group by
  supplier.id,
  supplier.business_id,
  supplier.name,
  purchase.currency;

revoke all on table public.opening_balance_summaries from anon, authenticated;
revoke all on table public.financial_account_balances from anon, authenticated;
revoke all on table public.inventory_location_balances from anon, authenticated;
revoke all on table public.customer_receivable_balances from anon, authenticated;
revoke all on table public.supplier_payable_balances from anon, authenticated;

grant select on table public.opening_balance_summaries to authenticated;
grant select on table public.financial_account_balances to authenticated;
grant select on table public.inventory_location_balances to authenticated;
grant select on table public.customer_receivable_balances to authenticated;
grant select on table public.supplier_payable_balances to authenticated;

grant select on table public.opening_balance_summaries to service_role;
grant select on table public.financial_account_balances to service_role;
grant select on table public.inventory_location_balances to service_role;
grant select on table public.customer_receivable_balances to service_role;
grant select on table public.supplier_payable_balances to service_role;

comment on function public.create_opening_balance(
  uuid,
  date,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) is
  'Atomically initializes account, inventory, customer, and supplier opening records for one business.';

commit;
