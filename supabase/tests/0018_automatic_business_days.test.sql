begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(24);

select extensions.ok(
  to_regprocedure('public.ensure_current_business_day(uuid)') is not null,
  'automatic current-day RPC exists'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_extension
    where extname = 'pg_cron'
  ),
  'pg_cron is enabled'
);
select extensions.is(
  (
    select count(*)::integer
    from cron.job
    where jobname = 'automatic-business-day-rollover'
      and schedule = '* * * * *'
  ),
  1,
  'one automatic rollover job runs every minute'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.create_business_day(uuid,date)',
    'EXECUTE'
  ),
  'manual day opening is disabled'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.close_business_day(uuid,uuid)',
    'EXECUTE'
  ),
  'manual day closing is disabled'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.reopen_business_day(uuid,uuid,text)',
    'EXECUTE'
  ),
  'manual day reopening is disabled'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.close_daily_sales(uuid,uuid)',
    'EXECUTE'
  ),
  'manual daily-sales closing is disabled'
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
    '24000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'automatic-day-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Automatic Day Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '24000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'automatic-day-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Automatic Day Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table automatic_day_test_ids (
  business_id uuid,
  old_day_id uuid,
  old_sales_id uuid,
  current_day_id uuid
);

insert into automatic_day_test_ids (business_id)
values (
  public.create_business_foundation(
    'Automatic Day Test Business',
    'Europe/Bucharest'
  )
);

grant all on automatic_day_test_ids to service_role;
set local role service_role;

insert into public.business_members (business_id, user_id, role)
select
  business_id,
  '24000000-0000-4000-8000-000000000002',
  'employee'
from automatic_day_test_ids;

with inserted_day as (
  insert into public.business_days (
    business_id,
    business_date,
    opened_at,
    opened_by
  )
  select
    business_id,
    (clock_timestamp() at time zone 'Europe/Bucharest')::date - 1,
    (
      (
        (clock_timestamp() at time zone 'Europe/Bucharest')::date - 1
      )::timestamp at time zone 'Europe/Bucharest'
    ),
    '24000000-0000-4000-8000-000000000001'
  from automatic_day_test_ids
  returning id
)
update automatic_day_test_ids
set old_day_id = (select id from inserted_day);

with inserted_sales as (
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
  select
    business_id,
    old_day_id,
    0,
    0,
    0,
    0,
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001'
  from automatic_day_test_ids
  returning id
)
update automatic_day_test_ids
set old_sales_id = (select id from inserted_sales);

grant select on automatic_day_test_ids to authenticated;
set local role service_role;

update public.daily_sales
set
  cash_sales_ron = 100,
  bank_sales_ron = 50,
  credit_sales_ron = 0,
  total_sales_ron = 150,
  notes = 'Last employee draft',
  last_draft_by = '24000000-0000-4000-8000-000000000002',
  last_draft_at = clock_timestamp(),
  updated_by = '24000000-0000-4000-8000-000000000002',
  updated_at = clock_timestamp()
where id = (select old_sales_id from automatic_day_test_ids);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-4000-8000-000000000002',
  true
);

update automatic_day_test_ids
set current_day_id = public.ensure_current_business_day(business_id);

select extensions.ok(
  (select current_day_id is not null from automatic_day_test_ids),
  'member fallback initializes the current automatic day'
);
select extensions.is(
  (
    select status::text
    from public.business_days
    where id = (select old_day_id from automatic_day_test_ids)
  ),
  'closed',
  'the previous day closes automatically'
);
select extensions.results_eq(
  $$
    select
      cash_sales_ron::text,
      bank_sales_ron::text,
      credit_sales_ron::text,
      total_sales_ron::text
    from public.daily_sales_closures
    where daily_sales_id = (
      select old_sales_id from automatic_day_test_ids
    )
  $$,
  $$
    values ('100.00', '50.00', '0.00', '150.00')
  $$,
  'automatic close snapshots the last saved draft'
);
select extensions.is(
  (
    select last_draft_by
    from public.daily_sales
    where id = (select old_sales_id from automatic_day_test_ids)
  ),
  '24000000-0000-4000-8000-000000000002'::uuid,
  'last draft records the employee who saved it'
);
select extensions.is(
  (
    select closed_by
    from public.daily_sales
    where id = (select old_sales_id from automatic_day_test_ids)
  ),
  '24000000-0000-4000-8000-000000000002'::uuid,
  'automatic close is attributed to the last draft editor'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where business_id = (select business_id from automatic_day_test_ids)
      and type = 'cash'
  ),
  '100.00',
  'automatic close records the cash inflow once'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where business_id = (select business_id from automatic_day_test_ids)
      and type = 'bank'
  ),
  '50.00',
  'automatic close records the bank inflow once'
);
select extensions.is(
  (
    select status::text
    from public.business_days
    where id = (select current_day_id from automatic_day_test_ids)
  ),
  'open',
  'the current business-local day opens automatically'
);
select extensions.is(
  (
    select count(*)::integer
    from public.daily_sales
    where business_day_id = (
      select current_day_id from automatic_day_test_ids
    )
      and status = 'draft'
      and last_draft_by is null
      and last_draft_at is null
  ),
  1,
  'the current day receives one untouched automatic draft'
);

set local role service_role;

select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where action = 'daily_sales.automatically_closed'
      and entity_id = (select old_sales_id from automatic_day_test_ids)
      and actor_user_id = '24000000-0000-4000-8000-000000000002'
  ),
  1,
  'automatic close audits the last draft employee'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-4000-8000-000000000002',
  true
);

select extensions.is(
  public.ensure_current_business_day(
    (select business_id from automatic_day_test_ids)
  ),
  (select current_day_id from automatic_day_test_ids),
  'repeated initialization returns the same current day'
);
select extensions.is(
  (
    select count(*)::integer
    from public.business_days
    where business_id = (select business_id from automatic_day_test_ids)
      and status = 'open'
  ),
  1,
  'rollover remains idempotent with one open day'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.ensure_current_business_day(uuid)',
    'EXECUTE'
  ),
  'members can invoke only the safe automatic fallback'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-4000-8000-000000000001',
  true
);

create temporary table zero_account_rollover_ids (
  business_id uuid,
  old_day_id uuid,
  old_sales_id uuid,
  current_day_id uuid
);

insert into zero_account_rollover_ids (business_id)
values (
  public.create_business_foundation(
    'Zero Account Rollover Test Business',
    'Europe/Bucharest'
  )
);

grant all on zero_account_rollover_ids to service_role;
set local role service_role;

delete from public.financial_accounts
where business_id = (
  select business_id from zero_account_rollover_ids
);

with inserted_day as (
  insert into public.business_days (
    business_id,
    business_date,
    opened_at,
    opened_by
  )
  select
    business_id,
    (clock_timestamp() at time zone 'Europe/Bucharest')::date - 1,
    (
      (
        (clock_timestamp() at time zone 'Europe/Bucharest')::date - 1
      )::timestamp at time zone 'Europe/Bucharest'
    ),
    '24000000-0000-4000-8000-000000000001'
  from zero_account_rollover_ids
  returning id
)
update zero_account_rollover_ids
set old_day_id = (select id from inserted_day);

with inserted_sales as (
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
  select
    business_id,
    old_day_id,
    0,
    0,
    0,
    0,
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001'
  from zero_account_rollover_ids
  returning id
)
update zero_account_rollover_ids
set old_sales_id = (select id from inserted_sales);

grant select on zero_account_rollover_ids to authenticated;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-4000-8000-000000000001',
  true
);

update zero_account_rollover_ids
set current_day_id = public.ensure_current_business_day(business_id);

select extensions.is(
  (
    select status::text
    from public.business_days
    where id = (select old_day_id from zero_account_rollover_ids)
  ),
  'closed',
  'zero-sales previous day closes without financial accounts'
);
select extensions.results_eq(
  $$
    select
      cash_sales_ron::text,
      bank_sales_ron::text,
      credit_sales_ron::text,
      total_sales_ron::text
    from public.daily_sales_closures
    where daily_sales_id = (
      select old_sales_id from zero_account_rollover_ids
    )
  $$,
  $$
    values ('0.00', '0.00', '0.00', '0.00')
  $$,
  'zero-sales close still records an auditable closure'
);
select extensions.is(
  (
    select count(*)::integer
    from public.financial_account_entries
    where business_id = (select business_id from zero_account_rollover_ids)
  ),
  0,
  'zero-sales close does not post financial account entries'
);
select extensions.is(
  (
    select status::text
    from public.business_days
    where id = (select current_day_id from zero_account_rollover_ids)
  ),
  'open',
  'zero-sales rollover opens the current day without financial accounts'
);

select extensions.finish();

rollback;
