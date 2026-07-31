begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(41);

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_account_entries'
      and column_name = 'business_day_id'
  ),
  'financial entries can reference a business day'
);
select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_account_entries'
      and column_name = 'idempotency_key'
  ),
  'financial entries expose an idempotency key'
);
select extensions.ok(
  to_regclass('public.financial_account_entry_summaries') is not null,
  'exact-decimal account history view exists'
);
select extensions.ok(
  to_regclass('public.financial_account_daily_totals') is not null,
  'daily account total view exists'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'financial_account_entries'
      and indexname =
        'financial_account_entries_business_idempotency_key'
  ),
  'business-scoped idempotency index exists'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'financial_account_entries'
      and indexname = 'financial_account_entries_source_idx'
  ),
  'general source lookup index exists'
);
select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_accounts'
      and column_name in ('balance', 'balance_ron', 'current_balance')
  ),
  0::bigint,
  'financial accounts have no editable balance column'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.financial_account_entries'::regclass
  ),
  'financial entries keep RLS enabled'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'ledger-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ledger Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'ledger-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ledger Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-ledger-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Ledger Admin"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table ledger_test_ids (
  business_id uuid,
  other_business_id uuid,
  business_day_id uuid,
  customer_id uuid,
  customer_purchase_id uuid,
  customer_payment_id uuid,
  supplier_id uuid,
  supplier_purchase_id uuid,
  supplier_payment_id uuid,
  cash_account_id uuid,
  bank_account_id uuid,
  warehouse_id uuid
);

insert into ledger_test_ids (business_id)
values (
  public.create_business_foundation(
    'Financial Ledger Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from ledger_test_ids),
  'd0000000-0000-4000-8000-000000000002'
);

update ledger_test_ids
set
  cash_account_id = (
    select id
    from public.financial_accounts
    where business_id = ledger_test_ids.business_id
      and type = 'cash'
  ),
  bank_account_id = (
    select id
    from public.financial_accounts
    where business_id = ledger_test_ids.business_id
      and type = 'bank'
  ),
  warehouse_id = (
    select id
    from public.inventory_locations
    where business_id = ledger_test_ids.business_id
      and type = 'warehouse'
  );

select extensions.lives_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2025-12-31',
        '100.00',
        '200.00',
        '0.00',
        '0.00'
      )
    $sql$,
    (select business_id from ledger_test_ids)
  ),
  'opening balances continue to write approved ledger entries'
);
select extensions.ok(
  (
    select bool_and(
      business_day_id is null
      and idempotency_key is null
      and source_entity_type = 'opening_balance_batch'
    )
    from public.financial_account_entries
    where entry_type = 'opening_balance'
  ),
  'opening entries intentionally have no business day or idempotency key'
);

update ledger_test_ids
set
  customer_id = public.create_customer(
    business_id,
    'Ledger Customer',
    '+40 700 555 111'
  ),
  supplier_id = public.create_supplier(
    business_id,
    'Ledger Supplier',
    '+40 700 555 222',
    null,
    'RON'
  ),
  business_day_id = public.create_business_day(
    business_id,
    '2026-01-05'
  );

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000002',
  true
);

update ledger_test_ids
set
  customer_purchase_id = public.create_customer_credit_purchase(
    business_id,
    customer_id,
    business_day_id,
    '60.00',
    'Ledger customer purchase'
  ),
  supplier_purchase_id = public.create_supplier_purchase(
    business_id,
    supplier_id,
    business_day_id,
    'RON',
    '80.00',
    '',
    warehouse_id,
    'Ledger supplier purchase'
  );

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '30.00',
        %L::uuid,
        'd1000000-0000-4000-8000-000000000001'
      )
    $sql$,
    (select business_id from ledger_test_ids),
    (select business_day_id from ledger_test_ids),
    (select customer_id from ledger_test_ids),
    (select cash_account_id from ledger_test_ids)
  ),
  'customer payment writes an approved account inflow'
);
update ledger_test_ids
set customer_payment_id = (
  select id
  from public.customer_payments
  where idempotency_key = 'd1000000-0000-4000-8000-000000000001'
);
select extensions.is(
  (
    select
      entry.business_day_id::text
      || '|'
      || entry.idempotency_key::text
      || '|'
      || entry.entry_date::text
    from public.financial_account_entries as entry
    where entry.source_entity_id = (
      select customer_payment_id from ledger_test_ids
    )
      and entry.entry_type = 'customer_payment'
  ),
  (
    select
      business_day_id::text
      || '|d1000000-0000-4000-8000-000000000001|2026-01-05'
    from ledger_test_ids
  ),
  'customer ledger entry inherits day, idempotency, and date metadata'
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '50.00',
        '',
        %L::uuid,
        'd1000000-0000-4000-8000-000000000002'
      )
    $sql$,
    (select business_id from ledger_test_ids),
    (select business_day_id from ledger_test_ids),
    (select supplier_id from ledger_test_ids),
    (select bank_account_id from ledger_test_ids)
  ),
  'supplier payment writes an approved account outflow'
);
update ledger_test_ids
set supplier_payment_id = (
  select id
  from public.supplier_payments
  where idempotency_key = 'd1000000-0000-4000-8000-000000000002'
);
select extensions.is(
  (
    select
      entry.business_day_id::text
      || '|'
      || entry.idempotency_key::text
      || '|'
      || entry.entry_date::text
    from public.financial_account_entries as entry
    where entry.source_entity_id = (
      select supplier_payment_id from ledger_test_ids
    )
      and entry.entry_type = 'supplier_payment'
  ),
  (
    select
      business_day_id::text
      || '|d1000000-0000-4000-8000-000000000002|2026-01-05'
    from ledger_test_ids
  ),
  'supplier ledger entry inherits day, idempotency, and date metadata'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (select cash_account_id from ledger_test_ids)
  ),
  '130.00',
  'cash balance is derived from opening and customer inflow'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (select bank_account_id from ledger_test_ids)
  ),
  '150.00',
  'bank balance is derived from opening and supplier outflow'
);
select extensions.is(
  (
    select signed_amount_ron
    from public.financial_account_entry_summaries
    where entry_type = 'customer_payment'
      and source_entity_id = (
        select customer_payment_id from ledger_test_ids
      )
  ),
  '30.00',
  'history exposes customer inflow as exact positive decimal text'
);
select extensions.is(
  (
    select signed_amount_ron
    from public.financial_account_entry_summaries
    where entry_type = 'supplier_payment'
      and source_entity_id = (
        select supplier_payment_id from ledger_test_ids
      )
  ),
  '-50.00',
  'history exposes supplier outflow as exact negative decimal text'
);
select extensions.is(
  (
    select inflow_ron || '|' || outflow_ron || '|' || net_movement_ron
    from public.financial_account_daily_totals
    where financial_account_id = (select cash_account_id from ledger_test_ids)
      and entry_date = '2026-01-05'
  ),
  '30.00|0|30.00',
  'daily cash totals derive inflow, outflow, and net'
);
select extensions.is(
  (
    select inflow_ron || '|' || outflow_ron || '|' || net_movement_ron
    from public.financial_account_daily_totals
    where financial_account_id = (select bank_account_id from ledger_test_ids)
      and entry_date = '2026-01-05'
  ),
  '0|50.00|-50.00',
  'daily bank totals derive inflow, outflow, and net'
);
select extensions.ok(
  (
    select bool_and(
      btrim(source_entity_type) <> ''
      and source_entity_id is not null
    )
    from public.financial_account_entries
  ),
  'every financial movement links to a source entity'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid,
        'd1000000-0000-4000-8000-000000000001'
      )
    $sql$,
    (select business_id from ledger_test_ids),
    (select business_day_id from ledger_test_ids),
    (select supplier_id from ledger_test_ids),
    (select bank_account_id from ledger_test_ids)
  ),
  '23505',
  null,
  'duplicate ledger idempotency key rejects a second financial effect'
);
select extensions.is(
  (select count(*) from public.supplier_payments),
  1::bigint,
  'duplicate ledger key rolls back supplier payment row'
);
select extensions.is(
  (select count(*) from public.supplier_payment_allocations),
  1::bigint,
  'duplicate ledger key rolls back supplier allocation'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'supplier_payment'
      and reversal_of_id is null
  ),
  1::bigint,
  'duplicate ledger key leaves one supplier outflow'
);

select extensions.throws_ok(
  $sql$
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      entry_date,
      direction,
      amount_ron,
      entry_type,
      source_entity_type,
      source_entity_id,
      created_by
    )
    values (
      gen_random_uuid(),
      gen_random_uuid(),
      '2026-01-05',
      'inflow',
      999,
      'arbitrary',
      'arbitrary',
      gen_random_uuid(),
      auth.uid()
    )
  $sql$,
  '42501',
  'permission denied for table financial_account_entries',
  'browser role cannot insert arbitrary account movements'
);
select extensions.throws_ok(
  $sql$
    update public.financial_account_entries
    set amount_ron = 999
  $sql$,
  '42501',
  'permission denied for table financial_account_entries',
  'browser role cannot edit account history'
);
select extensions.throws_ok(
  $sql$
    delete from public.financial_account_entries
  $sql$,
  '42501',
  'permission denied for table financial_account_entries',
  'browser role cannot delete account history'
);

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_customer_payment(
        %L::uuid,
        %L::uuid,
        'Reverse customer payment for ledger test'
      )
    $sql$,
    (select business_id from ledger_test_ids),
    (select customer_payment_id from ledger_test_ids)
  ),
  'customer payment reversal writes compensating outflow'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_supplier_payment(
        %L::uuid,
        %L::uuid,
        'Reverse supplier payment for ledger test'
      )
    $sql$,
    (select business_id from ledger_test_ids),
    (select supplier_payment_id from ledger_test_ids)
  ),
  'supplier payment reversal writes compensating inflow'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (select cash_account_id from ledger_test_ids)
  ),
  '100.00',
  'customer payment reversal restores cash'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (select bank_account_id from ledger_test_ids)
  ),
  '200.00',
  'supplier payment reversal restores bank'
);
select extensions.ok(
  (
    select
      reversal.business_day_id = original.business_day_id
      and reversal.idempotency_key is null
      and reversal.direction = 'outflow'
    from public.financial_account_entries as reversal
    inner join public.financial_account_entries as original
      on original.id = reversal.reversal_of_id
    where reversal.entry_type = 'customer_payment_reversal'
  ),
  'customer reversal copies business day and links the original entry'
);
select extensions.ok(
  (
    select
      reversal.business_day_id = original.business_day_id
      and reversal.idempotency_key is null
      and reversal.direction = 'inflow'
    from public.financial_account_entries as reversal
    inner join public.financial_account_entries as original
      on original.id = reversal.reversal_of_id
    where reversal.entry_type = 'supplier_payment_reversal'
  ),
  'supplier reversal copies business day and links the original entry'
);
select extensions.is(
  (
    select inflow_ron || '|' || outflow_ron || '|' || net_movement_ron
    from public.financial_account_daily_totals
    where financial_account_id = (select cash_account_id from ledger_test_ids)
      and entry_date = '2026-01-05'
  ),
  '30.00|30.00|0.00',
  'daily cash totals include compensating reversal'
);
select extensions.is(
  (
    select inflow_ron || '|' || outflow_ron || '|' || net_movement_ron
    from public.financial_account_daily_totals
    where financial_account_id = (select bank_account_id from ledger_test_ids)
      and entry_date = '2026-01-05'
  ),
  '50.00|50.00|0.00',
  'daily bank totals include compensating reversal'
);
select extensions.is(
  (select count(*) from public.financial_account_entry_summaries),
  6::bigint,
  'history preserves opening, payment, and reversal entries'
);

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000003',
  true
);
update ledger_test_ids
set other_business_id = public.create_business_foundation(
  'Other Ledger Business',
  'Europe/Bucharest'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  0::bigint,
  'RLS hides account entries from another business'
);
select extensions.is(
  (select count(*) from public.financial_account_entry_summaries),
  0::bigint,
  'RLS hides account history view rows from another business'
);
select extensions.is(
  (select count(*) from public.financial_account_daily_totals),
  0::bigint,
  'RLS hides daily totals from another business'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '10.00',
        %L::uuid,
        'd1000000-0000-4000-8000-000000000003'
      )
    $sql$,
    (select business_id from ledger_test_ids),
    (select business_day_id from ledger_test_ids),
    (select customer_id from ledger_test_ids),
    (select cash_account_id from ledger_test_ids)
  ),
  '42501',
  'Active business membership is required',
  'another business cannot create ledger effects in this tenant'
);

select extensions.finish();
rollback;
