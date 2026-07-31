begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(36);

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_credit_purchases'
      and column_name = 'business_day_id'
  ),
  'customer credit purchases reference a business day'
);
select extensions.ok(
  to_regclass('public.customer_credit_purchase_balances') is not null,
  'derived purchase-balance view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_customer_credit_purchase(uuid,uuid,uuid,text,text,date,text)'
  ) is not null,
  'credit-purchase create RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.reverse_customer_credit_purchase(uuid,uuid,text)'
  ) is not null,
  'credit-purchase reversal RPC exists'
);
select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_credit_purchases'
      and column_name = 'remaining_ron'
  ),
  0::bigint,
  'remaining balance is not stored on the purchase table'
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
    '80000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'credit-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Credit Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '80000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'credit-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Credit Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_business_foundation(
  'Credit Purchase Test Business',
  'Europe/Bucharest'
);

create temporary table credit_purchase_test_ids (
  business_id uuid not null,
  customer_id uuid,
  first_day_id uuid,
  second_day_id uuid,
  first_purchase_id uuid
);

insert into credit_purchase_test_ids (business_id)
select id from public.businesses limit 1;

select public.add_business_employee(
  (select business_id from credit_purchase_test_ids),
  '80000000-0000-4000-8000-000000000002'
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_opening_balance(
        %L::uuid,
        '2025-12-31',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        '[{"name":"Opening Customer","amount_ron":"50.00"}]'::jsonb
      )
    $sql$,
    (select business_id from credit_purchase_test_ids)
  ),
  'opening receivable remains compatible with the Step 8 schema'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        'Must use the complete opening reversal workflow'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (
      select id
      from public.customer_credit_purchases
      where entry_origin = 'opening_balance'
      limit 1
    )
  ),
  '55000',
  'Opening receivables must use opening-balance reversal',
  'an opening receivable cannot be reversed outside its atomic batch'
);

update credit_purchase_test_ids
set customer_id = public.create_customer(
  business_id,
  'Operational Customer',
  '+40 700 800 900'
);

update credit_purchase_test_ids
set first_day_id = public.create_business_day(
  business_id,
  '2026-01-01'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '500.00',
        'First separate purchase',
        '2026-01-10'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  'employee can create a purchase for the current open day'
);

update credit_purchase_test_ids
set first_purchase_id = (
  select id
  from public.customer_credit_purchases
  where customer_id = credit_purchase_test_ids.customer_id
    and amount_ron = 500.00
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '300.00',
        'Second separate purchase'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  'employee can create a second separate purchase'
);
select extensions.is(
  (
    select count(*)
    from public.customer_credit_purchases
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  2::bigint,
  'each customer purchase is stored separately'
);
select extensions.is(
  (
    select sum(amount_ron)
    from public.customer_credit_purchases
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  800.00::numeric,
  'separate purchases preserve their exact total'
);
select extensions.is(
  (
    select count(*)
    from public.customer_credit_purchases
    where customer_id = (select customer_id from credit_purchase_test_ids)
      and purchase_date = '2026-01-01'
  ),
  2::bigint,
  'purchase date is derived from the selected business day'
);
select extensions.is(
  (
    select sum(allocated_ron::numeric)
    from public.customer_credit_purchase_balances
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  0.00::numeric,
  'allocated balance starts at zero before Step 9 payments'
);
select extensions.is(
  (
    select sum(remaining_ron::numeric)
    from public.customer_credit_purchase_balances
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  800.00::numeric,
  'remaining balance is derived from active purchases'
);
select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  800.00::numeric,
  'customer receivable summary equals active purchase total'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '0.00'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  '22023',
  'Credit purchase amount must be greater than zero',
  'zero credit purchase is rejected'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '10.00',
        null,
        '2025-12-31'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  '22023',
  'Due date must not be before the purchase date',
  'due date before purchase date is rejected'
);
select extensions.throws_ok(
  format(
    $sql$
      update public.customer_credit_purchases
      set amount_ron = 1.00
      where id = %L::uuid
    $sql$,
    (select first_purchase_id from credit_purchase_test_ids)
  ),
  '42501',
  null,
  'employee cannot edit an immutable purchase directly'
);
select extensions.throws_ok(
  format(
    $sql$
      delete from public.customer_credit_purchases
      where id = %L::uuid
    $sql$,
    (select first_purchase_id from credit_purchase_test_ids)
  ),
  '42501',
  null,
  'employee cannot hard-delete an immutable purchase'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.close_business_day(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  'employee can close the completed business day'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000001',
  true
);

update credit_purchase_test_ids
set second_day_id = public.create_business_day(
  business_id,
  '2026-01-02'
);

select extensions.is(
  (
    select status::text
    from public.business_days
    where id = (select second_day_id from credit_purchase_test_ids)
  ),
  'open',
  'the next current business day is open'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000002',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '20.00'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  '55000',
  'Employee requires the current open business day',
  'employee cannot backdate into a closed day'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '100.00',
        'Purchase on next open day'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select second_day_id from credit_purchase_test_ids)
  ),
  'employee can use the new current open day'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000001',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '200.00'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  '22023',
  'Historical entries require an audit reason',
  'administrator historical purchase requires a reason'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '200.00',
        'Replacement historical purchase',
        null,
        'Replacing the incorrectly recorded purchase'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select customer_id from credit_purchase_test_ids),
    (select first_day_id from credit_purchase_test_ids)
  ),
  'administrator can create a reasoned historical replacement'
);
select extensions.is(
  (
    select entry_origin
    from public.customer_credit_purchases
    where customer_id = (select customer_id from credit_purchase_test_ids)
      and amount_ron = 200.00
  ),
  'admin_historical',
  'historical entry origin is traceable'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer_credit_purchase.created'
      and reason = 'Replacing the incorrectly recorded purchase'
  ),
  1::bigint,
  'historical reason is stored in the audit log'
);
select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  1100.00::numeric,
  'all active purchases contribute to the receivable'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000002',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        'Employee must not reverse this purchase'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select first_purchase_id from credit_purchase_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse a credit purchase'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        'Original amount was entered incorrectly'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select first_purchase_id from credit_purchase_test_ids)
  ),
  'administrator can reverse a credit purchase with a reason'
);
select extensions.is(
  (
    select count(*)
    from public.customer_credit_purchases
    where id = (select first_purchase_id from credit_purchase_test_ids)
      and reversed_at is not null
  ),
  1::bigint,
  'reversal preserves and marks the original purchase'
);
select extensions.is(
  (
    select remaining_ron::numeric
    from public.customer_credit_purchase_balances
    where purchase_id = (
      select first_purchase_id from credit_purchase_test_ids
    )
  ),
  0.00::numeric,
  'reversed purchase has zero derived remaining balance'
);
select extensions.is(
  (
    select outstanding_ron::numeric
    from public.customer_receivable_balances
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  600.00::numeric,
  'reversal removes only the original purchase from receivable'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_customer_credit_purchase(
        %L::uuid,
        %L::uuid,
        'Attempting an invalid second reversal'
      )
    $sql$,
    (select business_id from credit_purchase_test_ids),
    (select first_purchase_id from credit_purchase_test_ids)
  ),
  '55000',
  'Customer credit purchase is already reversed',
  'double reversal is blocked'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer_credit_purchase.reversed'
  ),
  1::bigint,
  'successful reversal is audited once'
);
select extensions.is(
  (
    select count(*)
    from public.customer_credit_purchases
    where customer_id = (select customer_id from credit_purchase_test_ids)
  ),
  4::bigint,
  'reversal and replacement preserve complete purchase history'
);

select * from extensions.finish();

rollback;
