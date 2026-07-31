begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(17);

select extensions.has_table(
  'public',
  'currency_reference_rates',
  'currency reference rate history exists'
);
select extensions.ok(
  to_regclass('public.currency_reference_rate_summaries') is not null,
  'exact-decimal reference rate summary exists'
);
select extensions.ok(
  to_regprocedure(
    'public.record_usd_ron_reference_rate(uuid,text,date)'
  ) is not null,
  'reference rate RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.currency_reference_rates'::regclass
  ),
  'reference rates have RLS enabled'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.currency_reference_rates',
    'INSERT'
  ),
  'browser users cannot insert rates directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.currency_reference_rates',
    'UPDATE'
  ),
  'browser users cannot overwrite rate history'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.currency_reference_rates',
    'DELETE'
  ),
  'browser users cannot delete rate history'
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
    '18000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'dashboard-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dashboard Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '18000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'dashboard-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dashboard Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '18000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table dashboard_test_ids (
  business_id uuid,
  first_rate_id uuid,
  second_rate_id uuid
);

insert into dashboard_test_ids (business_id)
values (
  public.create_business_foundation(
    'Dashboard Test Business',
    'Europe/Bucharest'
  )
);

insert into public.business_members (
  business_id,
  user_id,
  role
)
select
  business_id,
  '18000000-0000-4000-8000-000000000002',
  'employee'
from dashboard_test_ids;

update dashboard_test_ids
set first_rate_id = public.record_usd_ron_reference_rate(
  business_id,
  '4.50000000',
  date '2026-06-30'
);

select extensions.ok(
  (select first_rate_id is not null from dashboard_test_ids),
  'administrator can record a reference rate'
);
select extensions.is(
  (
    select rate
    from public.currency_reference_rate_summaries
    where id = (select first_rate_id from dashboard_test_ids)
  ),
  '4.50000000',
  'reference rate view preserves exact decimal text'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where action = 'currency_reference_rate.recorded'
      and entity_id = (select first_rate_id from dashboard_test_ids)
  ),
  1,
  'recording a rate creates one audit event'
);

update dashboard_test_ids
set second_rate_id = public.record_usd_ron_reference_rate(
  business_id,
  '4.60000000',
  date '2026-07-01'
);

select extensions.is(
  (
    select rate
    from public.currency_reference_rate_summaries
    where business_id = (select business_id from dashboard_test_ids)
    order by effective_date desc, created_at desc
    limit 1
  ),
  '4.60000000',
  'latest effective rate can be selected deterministically'
);

grant select on dashboard_test_ids to service_role;
set local role service_role;

select extensions.throws_ok(
  format(
    'update public.currency_reference_rates set rate = 4.7 where id = %L',
    (select second_rate_id from dashboard_test_ids)
  ),
  '55000',
  'Currency reference rates are immutable',
  'rate history cannot be updated'
);
select extensions.throws_ok(
  format(
    'delete from public.currency_reference_rates where id = %L',
    (select second_rate_id from dashboard_test_ids)
  ),
  '55000',
  'Currency reference rates are immutable',
  'rate history cannot be deleted'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '18000000-0000-4000-8000-000000000002',
  true
);

select extensions.throws_ok(
  format(
    'select public.record_usd_ron_reference_rate(%L, %L, %L)',
    (select business_id from dashboard_test_ids),
    '4.70000000',
    date '2026-07-01'
  ),
  '42501',
  'Administrator access is required',
  'employee cannot record a reference rate'
);
select extensions.is(
  (
    select count(*)::integer
    from public.currency_reference_rate_summaries
    where business_id = (select business_id from dashboard_test_ids)
  ),
  2,
  'business member can read reference rate history'
);

select set_config(
  'request.jwt.claim.sub',
  '18000000-0000-4000-8000-000000000001',
  true
);

select extensions.throws_ok(
  format(
    'select public.record_usd_ron_reference_rate(%L, %L, %L)',
    (select business_id from dashboard_test_ids),
    '0',
    date '2026-07-01'
  ),
  '22023',
  'USD/RON reference rate must be greater than zero',
  'zero reference rate is rejected'
);
select extensions.throws_ok(
  format(
    'select public.record_usd_ron_reference_rate(%L, %L, %L)',
    (select business_id from dashboard_test_ids),
    '4.123456789',
    date '2026-07-01'
  ),
  '22023',
  'USD/RON reference rate is invalid',
  'over-precise reference rate is rejected'
);

select extensions.finish();

rollback;
