begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(36);

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
    '50000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'opening-admin-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Opening Admin One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '50000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'opening-admin-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Opening Admin Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '50000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'opening-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Opening Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_business_foundation(
  'Opening Test Business One',
  'Europe/Bucharest'
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2026-01-01',
        '1000.00',
        '500.00',
        '2000.00',
        '300.00',
        '[
          {"name":"Customer One","amount_ron":"500.00"},
          {"name":"Customer Two","amount_ron":"300.00"}
        ]'::jsonb,
        '[
          {
            "name":"Supplier RON",
            "currency":"RON",
            "original_amount":"700.00",
            "purchase_exchange_rate":null
          },
          {
            "name":"Supplier USD",
            "currency":"USD",
            "original_amount":"1000.00",
            "purchase_exchange_rate":"4.60"
          }
        ]'::jsonb
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  'administrator can create an opening balance atomically'
);

select extensions.is(
  (select count(*) from public.opening_balance_batches),
  1::bigint,
  'one opening batch is created'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  2::bigint,
  'cash and bank ledger entries are created'
);
select extensions.is(
  (select sum(amount_ron) from public.financial_account_entries),
  1500.00::numeric,
  'account opening entries preserve the declared total'
);
select extensions.is(
  (select count(*) from public.inventory_value_movements),
  2::bigint,
  'warehouse and shop movements are created'
);
select extensions.is(
  (select sum(amount_ron) from public.inventory_value_movements),
  2300.00::numeric,
  'inventory movements preserve the declared total'
);
select extensions.is(
  (select count(*) from public.customers),
  2::bigint,
  'opening customers are created'
);
select extensions.is(
  (select count(*) from public.customer_credit_purchases),
  2::bigint,
  'separate opening customer purchases are created'
);
select extensions.is(
  (select sum(amount_ron) from public.customer_credit_purchases),
  800.00::numeric,
  'customer opening receivables preserve their total'
);
select extensions.is(
  (select count(*) from public.suppliers),
  2::bigint,
  'opening suppliers are created'
);
select extensions.is(
  (select count(*) from public.supplier_purchases),
  2::bigint,
  'separate opening supplier purchases are created'
);
select extensions.is(
  (
    select inventory_cost_ron
    from public.supplier_purchases
    where currency = 'USD'
  ),
  4600.00::numeric,
  'USD supplier historical RON value is fixed at the opening rate'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'opening_balance.created'
  ),
  1::bigint,
  'opening setup writes one audit record'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.financial_account_balances
    where type = 'cash'
  ),
  1000.00::numeric,
  'cash balance view derives the opening cash entry'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.inventory_location_balances
    where type = 'warehouse'
  ),
  2000.00::numeric,
  'warehouse balance view derives the opening movement'
);
select extensions.is(
  (
    select sum(outstanding_ron::numeric)
    from public.customer_receivable_balances
  ),
  800.00::numeric,
  'customer receivable view derives opening purchases'
);
select extensions.is(
  (select count(*) from public.supplier_payable_balances),
  2::bigint,
  'supplier payable view preserves each original currency'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2026-01-01',
        '0.00',
        '0.00',
        '0.00',
        '0.00'
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '23505',
  null,
  'duplicate opening initialization is blocked'
);
select extensions.is(
  (select count(*) from public.opening_balance_batches),
  1::bigint,
  'duplicate failure does not create another batch'
);

select public.add_business_employee(
  (select id from public.businesses limit 1),
  '50000000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000003',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2026-01-01',
        '0.00',
        '0.00',
        '0.00',
        '0.00'
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot create opening balances'
);

select extensions.throws_ok(
  format(
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
      select
        account.business_id,
        account.id,
        '2026-01-01',
        'inflow',
        1,
        'bypass_attempt',
        'test',
        gen_random_uuid(),
        '50000000-0000-0000-0000-000000000003'
      from public.financial_accounts as account
      limit 1
    $sql$
  ),
  '42501',
  null,
  'authenticated users cannot directly insert ledger entries'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_opening_balance(
        %L::uuid,
        %L::uuid,
        'Employee must not reverse this setup'
      )
    $sql$,
    (select id from public.businesses limit 1),
    (
      select id
      from public.opening_balance_batches
      where reversed_at is null
      limit 1
    )
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse opening balances'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000001',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_opening_balance(
        %L::uuid,
        %L::uuid,
        'Correcting inaccurate opening values'
      )
    $sql$,
    (select id from public.businesses limit 1),
    (
      select id
      from public.opening_balance_batches
      where reversed_at is null
      limit 1
    )
  ),
  'administrator can reverse opening balances atomically'
);
select extensions.is(
  (
    select count(*)
    from public.opening_balance_batches
    where reversed_at is not null
  ),
  1::bigint,
  'original opening batch remains as reversed history'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.financial_account_balances
    where type = 'cash'
  ),
  0.00::numeric,
  'reversal compensates the cash opening entry'
);
select extensions.is(
  (
    select sum(balance_ron::numeric)
    from public.inventory_location_balances
  ),
  0.00::numeric,
  'reversal compensates all inventory opening movements'
);
select extensions.is(
  (
    select sum(outstanding_ron::numeric)
    from public.customer_receivable_balances
  ),
  0.00::numeric,
  'reversal removes opening customer receivables from current balances'
);
select extensions.is(
  (select count(*) from public.supplier_payable_balances),
  0::bigint,
  'reversal removes opening supplier payables from current balances'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'opening_balance.reversed'
  ),
  1::bigint,
  'reversal writes its own audit record'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2026-01-02',
        '0.00',
        '0.00',
        '0.00',
        '0.00'
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  'a corrected active opening batch can replace the reversed batch'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000002',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_business_foundation(
      'Opening Test Business Two',
      'Europe/Bucharest'
    )
  $sql$,
  'second administrator can create an isolated business'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2026-01-01',
        '-0.01',
        '0.00',
        '0.00',
        '0.00'
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '22023',
  null,
  'negative opening amounts are rejected by the database'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2026-01-01',
        '10.00',
        '20.00',
        '30.00',
        '40.00',
        '[{"name":"Rolled Back Customer","amount_ron":"50.00"}]'::jsonb,
        '[
          {
            "name":"Invalid USD Supplier",
            "currency":"USD",
            "original_amount":"100.00",
            "purchase_exchange_rate":null
          }
        ]'::jsonb
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '22023',
  null,
  'invalid late supplier input rolls back the complete operation'
);
select extensions.is(
  (select count(*) from public.opening_balance_batches),
  0::bigint,
  'rollback removes the opening batch'
);
select extensions.is(
  (select count(*) from public.customers),
  0::bigint,
  'rollback removes customers created earlier in the function'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  0::bigint,
  'rollback removes ledger entries created earlier in the function'
);

select * from extensions.finish();

rollback;
