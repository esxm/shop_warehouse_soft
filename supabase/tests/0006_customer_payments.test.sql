begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(51);

select extensions.ok(
  to_regclass('public.customer_payments') is not null,
  'customer_payments table exists'
);
select extensions.ok(
  to_regclass('public.customer_payment_allocations') is not null,
  'customer_payment_allocations table exists'
);
select extensions.ok(
  to_regclass('public.customer_payment_summaries') is not null,
  'customer payment summary view exists'
);
select extensions.ok(
  to_regclass('public.customer_payment_allocation_details') is not null,
  'customer payment allocation detail view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_customer_payment(uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,text)'
  ) is not null,
  'atomic customer payment RPC exists'
);
select extensions.ok(
  to_regprocedure('public.reverse_customer_payment(uuid,uuid,text)')
    is not null,
  'customer payment reversal RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.customer_payments'::regclass
  ),
  'customer payments has RLS enabled'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.customer_payment_allocations'::regclass
  ),
  'customer allocations has RLS enabled'
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
    '90000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'payment-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Payment Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'payment-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Payment Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_business_foundation(
  'Customer Payment Test Business',
  'Europe/Bucharest'
);

create temporary table payment_test_ids (
  business_id uuid not null,
  customer_id uuid,
  first_day_id uuid,
  second_day_id uuid,
  payment_day_id uuid,
  first_purchase_id uuid,
  second_purchase_id uuid,
  first_payment_id uuid,
  manual_payment_id uuid,
  final_payment_id uuid,
  cash_account_id uuid,
  bank_account_id uuid
);

insert into payment_test_ids (
  business_id,
  cash_account_id,
  bank_account_id
)
select
  business.id,
  (
    select account.id
    from public.financial_accounts as account
    where account.business_id = business.id
      and account.type = 'cash'
  ),
  (
    select account.id
    from public.financial_accounts as account
    where account.business_id = business.id
      and account.type = 'bank'
  )
from public.businesses as business
limit 1;

select public.add_business_employee(
  (select business_id from payment_test_ids),
  '90000000-0000-4000-8000-000000000002'
);

update payment_test_ids
set
  customer_id = public.create_customer(
    business_id,
    'Payment Customer',
    '+40 700 111 222'
  ),
  first_day_id = public.create_business_day(
    business_id,
    '2026-01-01'
  );

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000002',
  true
);

update payment_test_ids
set first_purchase_id = public.create_customer_credit_purchase(
  business_id,
  customer_id,
  first_day_id,
  '500.00',
  'Oldest purchase'
);

select public.close_business_day(
  (select business_id from payment_test_ids),
  (select first_day_id from payment_test_ids)
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);

update payment_test_ids
set second_day_id = public.create_business_day(
  business_id,
  '2026-01-02'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000002',
  true
);

update payment_test_ids
set second_purchase_id = public.create_customer_credit_purchase(
  business_id,
  customer_id,
  second_day_id,
  '300.00',
  'Newer purchase'
);

select public.close_business_day(
  (select business_id from payment_test_ids),
  (select second_day_id from payment_test_ids)
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);

update payment_test_ids
set payment_day_id = public.create_business_day(
  business_id,
  '2026-01-03'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '600.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000001',
        'Cash collection',
        'oldest_first',
        '[]'::jsonb,
        null
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids)
  ),
  'employee can record an oldest-first payment atomically'
);

update payment_test_ids
set first_payment_id = (
  select id
  from public.customer_payments
  where idempotency_key = '91000000-0000-4000-8000-000000000001'
);

select extensions.is(
  (select count(*) from public.customer_payments),
  1::bigint,
  'one payment row is created'
);
select extensions.is(
  (
    select count(*)
    from public.customer_payment_allocations
    where payment_id = (select first_payment_id from payment_test_ids)
  ),
  2::bigint,
  'one payment can allocate across multiple purchases'
);
select extensions.is(
  (
    select amount_ron
    from public.customer_payment_allocations
    where payment_id = (select first_payment_id from payment_test_ids)
      and customer_credit_purchase_id = (
        select first_purchase_id from payment_test_ids
      )
  ),
  500.00::numeric,
  'oldest purchase is fully paid first'
);
select extensions.is(
  (
    select amount_ron
    from public.customer_payment_allocations
    where payment_id = (select first_payment_id from payment_test_ids)
      and customer_credit_purchase_id = (
        select second_purchase_id from payment_test_ids
      )
  ),
  100.00::numeric,
  'remaining payment partially pays the newer purchase'
);
select extensions.is(
  (
    select derived_status
    from public.customer_credit_purchase_balances
    where purchase_id = (select first_purchase_id from payment_test_ids)
  ),
  'paid',
  'oldest purchase derives paid status'
);
select extensions.is(
  (
    select remaining_ron::numeric
    from public.customer_credit_purchase_balances
    where purchase_id = (select second_purchase_id from payment_test_ids)
  ),
  200.00::numeric,
  'newer purchase derives its partial remaining balance'
);
select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from payment_test_ids)
  ),
  200.00::numeric,
  'customer receivable is reduced by the payment'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from payment_test_ids
    )
  ),
  600.00::numeric,
  'cash account increases by the payment exactly once'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_id = (select first_payment_id from payment_test_ids)
      and entry_type = 'customer_payment'
      and direction = 'inflow'
  ),
  1::bigint,
  'payment creates one immutable account inflow'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_id = (select first_payment_id from payment_test_ids)
      and (
        entry_type ilike '%revenue%'
        or entry_type ilike '%sale%'
      )
  ),
  0::bigint,
  'customer payment creates no revenue or sale ledger entry'
);
select extensions.is(
  (
    select sum(amount_ron)
    from public.customer_credit_purchases
    where customer_id = (select customer_id from payment_test_ids)
  ),
  800.00::numeric,
  'payment does not change recorded revenue purchase amounts'
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '600.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000001',
        'Cash collection',
        'oldest_first',
        '[]'::jsonb,
        null
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids)
  ),
  'retrying an identical payment request succeeds idempotently'
);
select extensions.is(
  (select count(*) from public.customer_payments),
  1::bigint,
  'identical retry does not duplicate the payment'
);
select extensions.is(
  (select count(*) from public.customer_payment_allocations),
  2::bigint,
  'identical retry does not duplicate allocations'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where entry_type = 'customer_payment'
  ),
  1::bigint,
  'identical retry does not duplicate account inflow'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '601.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000001'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids)
  ),
  '22023',
  'Payment request identifier was reused with different data',
  'idempotency key cannot be reused with changed payment data'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '200.01',
        %L::uuid,
        '91000000-0000-4000-8000-000000000002'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select bank_account_id from payment_test_ids)
  ),
  '22023',
  'Customer payment exceeds outstanding receivables',
  'payment above outstanding balance is rejected'
);
select extensions.is(
  (select count(*) from public.customer_payments),
  1::bigint,
  'overpayment failure creates no partial payment'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '50.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000003',
        null,
        'manual',
        %L::jsonb
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids),
    format(
      '[{"purchase_id":"%s","amount_ron":"25.00"},'
        || '{"purchase_id":"%s","amount_ron":"25.00"}]',
      (select second_purchase_id from payment_test_ids),
      (select second_purchase_id from payment_test_ids)
    )
  ),
  '22023',
  'Manual allocation contains a duplicate purchase',
  'employee manual allocation reaches normal allocation validation'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '50.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000004',
        'Administrator allocation',
        'manual',
        %L::jsonb,
        null
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids),
    format(
      '[{"purchase_id":"%s","amount_ron":"50.00"}]',
      (select second_purchase_id from payment_test_ids)
    )
  ),
  'administrator can override payment allocation'
);

update payment_test_ids
set manual_payment_id = (
  select id
  from public.customer_payments
  where idempotency_key = '91000000-0000-4000-8000-000000000004'
);

select extensions.is(
  (
    select allocation_strategy
    from public.customer_payments
    where id = (select manual_payment_id from payment_test_ids)
  ),
  'manual',
  'manual allocation strategy is traceable'
);
select extensions.is(
  (
    select amount_ron
    from public.customer_payment_allocations
    where payment_id = (select manual_payment_id from payment_test_ids)
      and customer_credit_purchase_id = (
        select second_purchase_id from payment_test_ids
      )
  ),
  50.00::numeric,
  'administrator allocation applies to the selected purchase'
);
select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from payment_test_ids)
  ),
  150.00::numeric,
  'manual allocation reduces the selected outstanding balance'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '40.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000005',
        null,
        'manual',
        %L::jsonb
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids),
    format(
      '[{"purchase_id":"%s","amount_ron":"30.00"}]',
      (select second_purchase_id from payment_test_ids)
    )
  ),
  '22023',
  'Manual allocations must equal the payment amount',
  'manual allocations must exactly equal payment amount'
);
select extensions.is(
  (select count(*) from public.customer_payments),
  2::bigint,
  'invalid manual allocation rolls back the payment'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '150.00',
        %L::uuid,
        '91000000-0000-4000-8000-000000000006'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select bank_account_id from payment_test_ids)
  ),
  'employee can complete a partial purchase with a later payment'
);

update payment_test_ids
set final_payment_id = (
  select id
  from public.customer_payments
  where idempotency_key = '91000000-0000-4000-8000-000000000006'
);

select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from payment_test_ids)
  ),
  0.00::numeric,
  'multiple payments can fully settle the receivable'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from payment_test_ids
    )
  ),
  650.00::numeric,
  'cash balance includes each successful cash payment once'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.financial_account_balances
    where financial_account_id = (
      select bank_account_id from payment_test_ids
    )
  ),
  150.00::numeric,
  'bank balance includes the successful bank payment once'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '0.01',
        %L::uuid,
        '91000000-0000-4000-8000-000000000007'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select bank_account_id from payment_test_ids)
  ),
  '22023',
  'Customer payment exceeds outstanding receivables',
  'payment is rejected when no receivable remains'
);
select extensions.throws_ok(
  format(
    $sql$
      insert into public.customer_payments (
        business_id,
        business_day_id,
        customer_id,
        payment_date,
        amount_ron,
        financial_account_id,
        entry_origin,
        allocation_strategy,
        idempotency_key,
        request_fingerprint,
        created_by
      )
      values (
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '2026-01-03',
        1.00,
        %L::uuid,
        'operational',
        'oldest_first',
        gen_random_uuid(),
        'bypass',
        '90000000-0000-4000-8000-000000000002'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select payment_day_id from payment_test_ids),
    (select customer_id from payment_test_ids),
    (select cash_account_id from payment_test_ids)
  ),
  '42501',
  null,
  'employee cannot directly insert a payment'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_customer_payment(
        %L::uuid,
        %L::uuid,
        'Employee must not reverse this payment'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select first_payment_id from payment_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse a payment'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        'Allocated purchase must not reverse first'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select first_purchase_id from payment_test_ids)
  ),
  '55000',
  'Reverse allocated customer payments before the purchase',
  'purchase with an active allocation cannot be reversed'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_customer_payment(
        %L::uuid,
        %L::uuid,
        'Correcting an incorrectly recorded cash payment'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select first_payment_id from payment_test_ids)
  ),
  'administrator reverses allocations and account effect atomically'
);
select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from payment_test_ids)
  ),
  600.00::numeric,
  'payment reversal restores receivables'
);
select extensions.is(
  (
    select balance_ron::numeric
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from payment_test_ids
    )
  ),
  50.00::numeric,
  'payment reversal removes the original cash inflow'
);
select extensions.is(
  (
    select count(*)
    from public.customer_payment_allocations
    where payment_id = (select first_payment_id from payment_test_ids)
  ),
  2::bigint,
  'reversal preserves original allocation rows for history'
);
select extensions.is(
  (
    select derived_status
    from public.customer_payment_summaries
    where payment_id = (select first_payment_id from payment_test_ids)
  ),
  'reversed',
  'payment history derives reversed status'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_id = (select first_payment_id from payment_test_ids)
      and entry_type = 'customer_payment_reversal'
      and direction = 'outflow'
  ),
  1::bigint,
  'reversal creates one linked compensating account outflow'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_customer_payment(
        %L::uuid,
        %L::uuid,
        'Attempting an invalid second payment reversal'
      )
    $sql$,
    (select business_id from payment_test_ids),
    (select first_payment_id from payment_test_ids)
  ),
  '55000',
  'Customer payment is already reversed',
  'double payment reversal is blocked'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer_payment.created'
  ),
  3::bigint,
  'only three successful unique payments are audited'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer_payment.reversed'
  ),
  1::bigint,
  'successful payment reversal is audited once'
);

select * from extensions.finish();

rollback;
