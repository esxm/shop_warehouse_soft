begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(58);

select extensions.ok(
  to_regclass('public.daily_sales') is not null,
  'daily sales table exists'
);
select extensions.ok(
  to_regclass('public.daily_sales_closures') is not null,
  'daily sales closure history exists'
);
select extensions.ok(
  to_regclass('public.business_day_credit_sales') is not null,
  'derived business-day credit-sales view exists'
);
select extensions.ok(
  to_regclass('public.daily_sales_summaries') is not null,
  'daily sales summary view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.upsert_daily_sales_draft(uuid,uuid,text,text,text,text)'
  ) is not null,
  'daily sales draft RPC exists'
);
select extensions.ok(
  to_regprocedure('public.close_daily_sales(uuid,uuid)') is not null,
  'atomic daily sales close RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.daily_sales'::regclass
  ),
  'daily sales has RLS enabled'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.daily_sales_closures'::regclass
  ),
  'daily sales closures has RLS enabled'
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
    'e0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'sales-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sales Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'sales-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sales Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-sales-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Sales Admin"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table daily_sales_test_ids (
  business_id uuid,
  other_business_id uuid,
  business_day_id uuid,
  customer_id uuid,
  daily_sales_id uuid,
  first_closure_id uuid,
  cash_account_id uuid,
  bank_account_id uuid
);

insert into daily_sales_test_ids (business_id)
values (
  public.create_business_foundation(
    'Daily Sales Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from daily_sales_test_ids),
  'e0000000-0000-4000-8000-000000000002'
);

select public.create_opening_balance(
  (select business_id from daily_sales_test_ids),
  '2025-12-31',
  '100.00',
  '200.00',
  '0.00',
  '0.00'
);

update daily_sales_test_ids
set
  business_day_id = public.create_business_day(
    business_id,
    '2026-01-06'
  ),
  customer_id = public.create_customer(
    business_id,
    'Daily Sales Customer',
    '+40 700 666 111'
  ),
  cash_account_id = (
    select id
    from public.financial_accounts
    where business_id = daily_sales_test_ids.business_id
      and type = 'cash'
  ),
  bank_account_id = (
    select id
    from public.financial_accounts
    where business_id = daily_sales_test_ids.business_id
      and type = 'bank'
  );

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-4000-8000-000000000002',
  true
);

select public.create_customer_credit_purchase(
  (select business_id from daily_sales_test_ids),
  (select customer_id from daily_sales_test_ids),
  (select business_day_id from daily_sales_test_ids),
  '40.00',
  'First credit sale'
);
select public.create_customer_credit_purchase(
  (select business_id from daily_sales_test_ids),
  (select customer_id from daily_sales_test_ids),
  (select business_day_id from daily_sales_test_ids),
  '60.00',
  'Second credit sale'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.upsert_daily_sales_draft(
        %L::uuid,
        %L::uuid,
        '300.00',
        '200.00',
        '90.00',
        'Mismatch draft'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  '22023',
  'Credit sales must equal customer credit purchases',
  'draft rejects a credit-sales mismatch'
);
select extensions.is(
  (select count(*) from public.daily_sales),
  0::bigint,
  'credit mismatch leaves no draft'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.upsert_daily_sales_draft(
        %L::uuid,
        %L::uuid,
        '300.00',
        '200.00',
        '100.00',
        'Initial sales draft'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  'employee can create a valid daily sales draft'
);
update daily_sales_test_ids
set daily_sales_id = (select id from public.daily_sales limit 1);
select extensions.is(
  (
    select
      cash_sales_ron::text
      || '|'
      || bank_sales_ron::text
      || '|'
      || credit_sales_ron::text
      || '|'
      || total_sales_ron::text
      || '|'
      || status::text
    from public.daily_sales
    where id = (select daily_sales_id from daily_sales_test_ids)
  ),
  '300.00|200.00|100.00|600.00|draft',
  'draft stores calculated total and draft status'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.upsert_daily_sales_draft(
        %L::uuid,
        %L::uuid,
        '350.00',
        '200.00',
        '100.00',
        'Updated sales draft'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  'employee can update a draft while day is open'
);
select extensions.is(
  (
    select count(*)::text || '|' || max(total_sales_ron)::text
    from public.daily_sales
  ),
  '1|650.00',
  'draft update preserves one row and recalculates total'
);
select extensions.is(
  (
    select credit_sales_ron
    from public.business_day_credit_sales
    where business_day_id = (
      select business_day_id from daily_sales_test_ids
    )
  ),
  '100.00',
  'credit sales view derives non-reversed credit purchases'
);

select public.create_customer_credit_purchase(
  (select business_id from daily_sales_test_ids),
  (select customer_id from daily_sales_test_ids),
  (select business_day_id from daily_sales_test_ids),
  '20.00',
  'Late credit sale'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.close_daily_sales(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select daily_sales_id from daily_sales_test_ids)
  ),
  '22023',
  'Credit sales changed; update the draft before closing',
  'close revalidates credit sales and rejects a stale draft'
);
select extensions.is(
  (
    select status::text
    from public.business_days
    where id = (select business_day_id from daily_sales_test_ids)
  ),
  'open',
  'stale close leaves business day open'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'daily_sales_closure'
  ),
  0::bigint,
  'stale close leaves no account effects'
);
select extensions.is(
  (
    select status::text
    from public.daily_sales
    where id = (select daily_sales_id from daily_sales_test_ids)
  ),
  'draft',
  'stale close leaves sales editable'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.upsert_daily_sales_draft(
        %L::uuid,
        %L::uuid,
        '350.00',
        '200.00',
        '120.00',
        'Credit total refreshed'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  'employee can refresh draft after credit sales change'
);
select extensions.is(
  (
    select total_sales_ron::text
    from public.daily_sales
    where id = (select daily_sales_id from daily_sales_test_ids)
  ),
  '670.00',
  'refreshed total equals cash plus bank plus credit'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.close_daily_sales(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select daily_sales_id from daily_sales_test_ids)
  ),
  'employee can atomically close reviewed daily sales'
);
update daily_sales_test_ids
set first_closure_id = (
  select active_closure_id
  from public.daily_sales
  where id = daily_sales_test_ids.daily_sales_id
);
select extensions.is(
  (
    select sale.status::text || '|' || day.status::text
    from public.daily_sales as sale
    inner join public.business_days as day
      on day.id = sale.business_day_id
    where sale.id = (select daily_sales_id from daily_sales_test_ids)
  ),
  'closed|closed',
  'daily sales and business day close together'
);
select extensions.is(
  (
    select
      close_sequence::text
      || '|'
      || cash_sales_ron::text
      || '|'
      || bank_sales_ron::text
      || '|'
      || credit_sales_ron::text
      || '|'
      || total_sales_ron::text
    from public.daily_sales_closures
    where id = (select first_closure_id from daily_sales_test_ids)
  ),
  '1|350.00|200.00|120.00|670.00',
  'closure preserves the reviewed sales snapshot'
);
select extensions.is(
  (
    select direction::text || '|' || amount_ron::text
    from public.financial_account_entries
    where source_entity_id = (
      select first_closure_id from daily_sales_test_ids
    )
      and entry_type = 'daily_sales_cash'
  ),
  'inflow|350.00',
  'close creates one cash sales inflow'
);
select extensions.is(
  (
    select direction::text || '|' || amount_ron::text
    from public.financial_account_entries
    where source_entity_id = (
      select first_closure_id from daily_sales_test_ids
    )
      and entry_type = 'daily_sales_bank'
  ),
  'inflow|200.00',
  'close creates one bank sales inflow'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_id = (
      select first_closure_id from daily_sales_test_ids
    )
      and entry_type like '%credit%'
  ),
  0::bigint,
  'credit sales create no cash or bank inflow'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from daily_sales_test_ids
    )
  ),
  '450.00',
  'cash balance increases by cash sales only'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select bank_account_id from daily_sales_test_ids
    )
  ),
  '400.00',
  'bank balance increases by bank sales only'
);

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-4000-8000-000000000001',
  true
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'daily_sales.closed'
      and entity_id = (select daily_sales_id from daily_sales_test_ids)
  ),
  1::bigint,
  'daily sales close is audited once'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'business_day.closed'
      and entity_id = (select business_day_id from daily_sales_test_ids)
  ),
  1::bigint,
  'atomic close audits the business day once'
);

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  $sql$
    update public.daily_sales
    set cash_sales_ron = 999
  $sql$,
  '42501',
  'permission denied for table daily_sales',
  'browser role cannot update daily sales directly'
);
select extensions.throws_ok(
  $sql$
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
      gen_random_uuid(),
      gen_random_uuid(),
      1,
      1,
      1,
      3,
      auth.uid(),
      auth.uid()
    )
  $sql$,
  '42501',
  'permission denied for table daily_sales',
  'browser role cannot insert daily sales directly'
);
select extensions.throws_ok(
  $sql$
    delete from public.daily_sales
  $sql$,
  '42501',
  'permission denied for table daily_sales',
  'browser role cannot delete daily sales history'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.close_daily_sales(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select daily_sales_id from daily_sales_test_ids)
  ),
  'duplicate daily sales close returns safely'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_id = (
      select first_closure_id from daily_sales_test_ids
    )
  ),
  2::bigint,
  'duplicate close does not duplicate account inflows'
);
select extensions.is(
  (
    select count(*)
    from public.daily_sales_closures
    where daily_sales_id = (
      select daily_sales_id from daily_sales_test_ids
    )
  ),
  1::bigint,
  'duplicate close does not duplicate closure history'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.close_business_day(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  '55000',
  'Business day is already closed',
  'legacy close wrapper still rejects an already closed day'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.upsert_daily_sales_draft(
        %L::uuid,
        %L::uuid,
        '999.00',
        '200.00',
        '120.00'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  '55000',
  'Daily sales draft requires an open business day',
  'closed daily sales cannot be edited'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reopen_business_day(
        %L::uuid,
        %L::uuid,
        'Employee cannot reopen closed sales'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reopen daily sales'
);

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reopen_business_day(
        %L::uuid,
        %L::uuid,
        'Correcting daily cash and bank sales'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  'administrator can reopen and reverse daily sales close'
);
select extensions.is(
  (
    select sale.status::text || '|' || day.status::text
    from public.daily_sales as sale
    inner join public.business_days as day
      on day.id = sale.business_day_id
    where sale.id = (select daily_sales_id from daily_sales_test_ids)
  ),
  'draft|open',
  'reopen restores draft and open-day statuses'
);
select extensions.ok(
  (
    select reversed_at is not null
      and reversal_reason = 'Correcting daily cash and bank sales'
    from public.daily_sales_closures
    where id = (select first_closure_id from daily_sales_test_ids)
  ),
  'reopen preserves and marks the prior closure reversed'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where reversal_of_id in (
      select id
      from public.financial_account_entries
      where source_entity_id = (
        select first_closure_id from daily_sales_test_ids
      )
        and reversal_of_id is null
    )
  ),
  2::bigint,
  'reopen creates compensating entries for cash and bank'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from daily_sales_test_ids
    )
  ),
  '100.00',
  'reopen restores cash to its pre-close balance'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select bank_account_id from daily_sales_test_ids
    )
  ),
  '200.00',
  'reopen restores bank to its pre-close balance'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'daily_sales.reopened'
      and reason = 'Correcting daily cash and bank sales'
  ),
  1::bigint,
  'daily sales reopen and reason are audited'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.upsert_daily_sales_draft(
        %L::uuid,
        %L::uuid,
        '360.00',
        '210.00',
        '120.00',
        'Corrected sales draft'
      )
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select business_day_id from daily_sales_test_ids)
  ),
  'administrator can update the reopened draft'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.close_daily_sales(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select daily_sales_id from daily_sales_test_ids)
  ),
  'corrected draft can close as a replacement'
);
select extensions.is(
  (
    select close_sequence::text || '|' || status::text
    from public.daily_sales_summaries
    where daily_sales_id = (
      select daily_sales_id from daily_sales_test_ids
    )
  ),
  '2|closed',
  'replacement close advances preserved close sequence'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from daily_sales_test_ids
    )
  ),
  '460.00',
  'replacement close applies corrected cash sales once'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select bank_account_id from daily_sales_test_ids
    )
  ),
  '410.00',
  'replacement close applies corrected bank sales once'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_id = (
      select active_closure_id
      from public.daily_sales
      where id = (select daily_sales_id from daily_sales_test_ids)
    )
      and reversal_of_id is null
  ),
  2::bigint,
  'replacement closure has one active cash and bank entry'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'daily_sales_closure'
  ),
  6::bigint,
  'ledger preserves original, reversal, and replacement sales effects'
);

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-4000-8000-000000000003',
  true
);
update daily_sales_test_ids
set other_business_id = public.create_business_foundation(
  'Other Daily Sales Business',
  'Europe/Bucharest'
);
select extensions.is(
  (select count(*) from public.daily_sales),
  0::bigint,
  'RLS hides daily sales from another business'
);
select extensions.is(
  (select count(*) from public.daily_sales_closures),
  0::bigint,
  'RLS hides daily sales closures from another business'
);
select extensions.is(
  (select count(*) from public.daily_sales_summaries),
  0::bigint,
  'RLS hides daily sales summary rows from another business'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.close_daily_sales(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from daily_sales_test_ids),
    (select daily_sales_id from daily_sales_test_ids)
  ),
  '42501',
  'Active business membership is required',
  'another business cannot close this tenant daily sales'
);

select extensions.finish();
rollback;
