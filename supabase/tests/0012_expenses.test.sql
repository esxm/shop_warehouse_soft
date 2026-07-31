begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(32);

select extensions.has_table(
  'public',
  'expense_categories',
  'expense categories table exists'
);
select extensions.has_table(
  'public',
  'expenses',
  'expenses table exists'
);
select extensions.ok(
  to_regclass('public.expense_summaries') is not null,
  'expense summary view exists'
);
select extensions.ok(
  to_regclass('public.monthly_expense_summaries') is not null,
  'monthly expense summary view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_expense(uuid,uuid,uuid,text,uuid,text,uuid,text)'
  ) is not null,
  'expense creation RPC exists'
);
select extensions.ok(
  to_regprocedure('public.reverse_expense(uuid,uuid,text)') is not null,
  'expense reversal RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.expense_categories'::regclass
  ),
  'expense categories have RLS enabled'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.expenses'::regclass
  ),
  'expenses have RLS enabled'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.expenses', 'UPDATE'),
  'browser users cannot update expenses directly'
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
    'f0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'expense-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Expense Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'expense-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Expense Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table expense_test_ids (
  business_id uuid,
  business_day_id uuid,
  cash_account_id uuid,
  category_id uuid,
  expense_id uuid,
  historical_expense_id uuid
);

insert into expense_test_ids (business_id)
values (
  public.create_business_foundation(
    'Expense Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from expense_test_ids),
  'f0000000-0000-4000-8000-000000000002'
);

update expense_test_ids
set
  business_day_id = public.create_business_day(
    business_id,
    '2026-06-15'
  ),
  cash_account_id = (
    select account.id
    from public.financial_accounts as account
    where account.business_id = expense_test_ids.business_id
      and account.type = 'cash'
  ),
  category_id = (
    select category.id
    from public.expense_categories as category
    where category.business_id = expense_test_ids.business_id
      and category.name = 'Electricity'
  );

select extensions.is(
  (
    select count(*)
    from public.expense_categories
    where business_id = (select business_id from expense_test_ids)
  ),
  8::bigint,
  'a new business receives eight default expense categories'
);

select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      update expense_test_ids
      set expense_id = public.create_expense(
        %L::uuid, %L::uuid, %L::uuid, '25.00', %L::uuid,
        'Electricity invoice', %L::uuid, null
      )
    $sql$,
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids),
    (select category_id from expense_test_ids),
    (select cash_account_id from expense_test_ids),
    'f1000000-0000-4000-8000-000000000001'
  ),
  'employee can record an expense on the open day'
);
select extensions.is(
  (
    select count(*)
    from public.expenses
    where business_id = (select business_id from expense_test_ids)
  ),
  1::bigint,
  'expense is stored once'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'expense'
      and source_entity_id = (select expense_id from expense_test_ids)
      and direction = 'outflow'
  ),
  1::bigint,
  'expense creates one account outflow'
);
select extensions.is(
  (
    select amount_ron
    from public.financial_account_entries
    where source_entity_type = 'expense'
      and source_entity_id = (select expense_id from expense_test_ids)
      and entry_type = 'expense'
  ),
  25.00::numeric,
  'account outflow equals the expense amount'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from expense_test_ids
    )
  ),
  '-25.00',
  'expense reduces the selected account balance'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_expense(
        %L::uuid, %L::uuid, %L::uuid, '25.00', %L::uuid,
        'Electricity invoice', %L::uuid, null
      )
    $sql$,
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids),
    (select category_id from expense_test_ids),
    (select cash_account_id from expense_test_ids),
    'f1000000-0000-4000-8000-000000000001'
  ),
  'an identical expense retry succeeds'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'expense'
      and source_entity_id = (select expense_id from expense_test_ids)
  ),
  1::bigint,
  'an identical retry does not duplicate the account effect'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_expense(
        %L::uuid, %L::uuid, %L::uuid, '26.00', %L::uuid,
        'Changed data', %L::uuid, null
      )
    $sql$,
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids),
    (select category_id from expense_test_ids),
    (select cash_account_id from expense_test_ids),
    'f1000000-0000-4000-8000-000000000001'
  ),
  '22023',
  'Expense request identifier was reused with different data',
  'idempotency identifiers cannot be reused with different expense data'
);

select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    'select public.close_business_day(%L::uuid, %L::uuid)',
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids)
  ),
  'administrator can close the test business day'
);

select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_expense(
        %L::uuid, %L::uuid, %L::uuid, '10.00', %L::uuid,
        'Closed-day transport', %L::uuid, null
      )
    $sql$,
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids),
    (select category_id from expense_test_ids),
    (select cash_account_id from expense_test_ids),
    'f1000000-0000-4000-8000-000000000002'
  ),
  '55000',
  'Employee requires the current open business day',
  'employee cannot record an expense on a closed day'
);
select extensions.throws_ok(
  format(
    'select public.reverse_expense(%L::uuid, %L::uuid, %L)',
    (select business_id from expense_test_ids),
    (select expense_id from expense_test_ids),
    'Employee attempted reversal'
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse an expense'
);

select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_expense(
        %L::uuid, %L::uuid, %L::uuid, '10.00', %L::uuid,
        'Closed-day expense', %L::uuid, null
      )
    $sql$,
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids),
    (select category_id from expense_test_ids),
    (select cash_account_id from expense_test_ids),
    'f1000000-0000-4000-8000-000000000003'
  ),
  '22023',
  'Historical expenses require an audit reason',
  'administrator must explain a historical expense'
);
select extensions.lives_ok(
  format(
    $sql$
      update expense_test_ids
      set historical_expense_id = public.create_expense(
        %L::uuid, %L::uuid, %L::uuid, '10.00', %L::uuid,
        'Closed-day expense', %L::uuid, 'Late invoice received'
      )
    $sql$,
    (select business_id from expense_test_ids),
    (select business_day_id from expense_test_ids),
    (select category_id from expense_test_ids),
    (select cash_account_id from expense_test_ids),
    'f1000000-0000-4000-8000-000000000004'
  ),
  'administrator can record an audited historical expense'
);
select extensions.is(
  (
    select entry_origin
    from public.expenses
    where id = (select historical_expense_id from expense_test_ids)
  ),
  'admin_historical',
  'historical expense records its origin'
);
select extensions.is(
  (
    select reason
    from public.audit_logs
    where entity_type = 'expense'
      and entity_id = (
        select historical_expense_id from expense_test_ids
      )
      and action = 'expense.created'
  ),
  'Late invoice received',
  'historical expense preserves its audit reason'
);
select extensions.is(
  (
    select total_ron
    from public.monthly_expense_summaries
    where business_id = (select business_id from expense_test_ids)
      and category_id = (select category_id from expense_test_ids)
      and month_start = '2026-06-01'
  ),
  '35.00',
  'monthly category total includes active expenses'
);
select extensions.lives_ok(
  format(
    'select public.reverse_expense(%L::uuid, %L::uuid, %L)',
    (select business_id from expense_test_ids),
    (select expense_id from expense_test_ids),
    'Invoice was entered twice'
  ),
  'administrator can reverse an expense'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'expense'
      and source_entity_id = (select expense_id from expense_test_ids)
  ),
  2::bigint,
  'reversal adds one compensating account entry'
);
select extensions.is(
  (
    select total_ron
    from public.monthly_expense_summaries
    where business_id = (select business_id from expense_test_ids)
      and category_id = (select category_id from expense_test_ids)
      and month_start = '2026-06-01'
  ),
  '10.00',
  'monthly category total excludes reversed expenses'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from expense_test_ids
    )
  ),
  '-10.00',
  'reversal restores the original expense amount to the account'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where action = 'expense.reversed'
      and entity_id = (select expense_id from expense_test_ids)
      and actor_user_id = 'f0000000-0000-4000-8000-000000000001'
      and reason = 'Invoice was entered twice'
  ),
  1,
  'expense reversal records the administrator and reason'
);
select extensions.throws_ok(
  format(
    'select public.reverse_expense(%L::uuid, %L::uuid, %L)',
    (select business_id from expense_test_ids),
    (select expense_id from expense_test_ids),
    'Repeated reversal attempt'
  ),
  '55000',
  'Expense is already reversed',
  'an expense cannot be reversed twice'
);

select extensions.finish();
rollback;
