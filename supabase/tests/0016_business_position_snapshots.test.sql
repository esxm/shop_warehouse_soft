begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(16);

select extensions.has_table(
  'public',
  'business_position_snapshots',
  'business-position snapshot history exists'
);
select extensions.ok(
  to_regclass('public.business_position_snapshot_summaries') is not null,
  'exact-decimal snapshot summary exists'
);
select extensions.ok(
  to_regprocedure(
    'public.save_business_position_snapshot(uuid,date,text)'
  ) is not null,
  'snapshot RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.business_position_snapshots'::regclass
  ),
  'snapshots have RLS enabled'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.business_position_snapshots',
    'INSERT'
  ),
  'browser users cannot insert snapshots directly'
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
    '23000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'position-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Position Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '23000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'position-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Position Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table position_test_ids (
  business_id uuid,
  snapshot_id uuid,
  snapshot_date date
);

insert into position_test_ids (business_id, snapshot_date)
values (
  public.create_business_foundation(
    'Position Test Business',
    'Europe/Bucharest'
  ),
  (clock_timestamp() at time zone 'Europe/Bucharest')::date
);

insert into public.business_members (business_id, user_id, role)
select
  business_id,
  '23000000-0000-4000-8000-000000000002',
  'employee'
from position_test_ids;

update position_test_ids
set snapshot_id = public.save_business_position_snapshot(
  business_id,
  snapshot_date,
  null
);

select extensions.ok(
  (select snapshot_id is not null from position_test_ids),
  'administrator can save the current position'
);
select extensions.is(
  (
    select net_business_value_ron
    from public.business_position_snapshot_summaries
    where id = (select snapshot_id from position_test_ids)
  ),
  '0.00',
  'zero foundation position is calculated exactly'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where action = 'business_position_snapshot.saved'
      and entity_id = (select snapshot_id from position_test_ids)
  ),
  1,
  'saving a snapshot creates one audit event'
);

select extensions.throws_ok(
  format(
    'select public.save_business_position_snapshot(%L, %L, null)',
    (select business_id from position_test_ids),
    (select snapshot_date from position_test_ids)
  ),
  '23505',
  'A business-position snapshot already exists for this date',
  'only one snapshot is allowed for a business date'
);

grant select on position_test_ids to service_role;
set local role service_role;

select extensions.throws_ok(
  format(
    'update public.business_position_snapshots set cash_ron = 1 where id = %L',
    (select snapshot_id from position_test_ids)
  ),
  '55000',
  'Business-position snapshots are immutable',
  'snapshot history cannot be updated'
);
select extensions.throws_ok(
  format(
    'delete from public.business_position_snapshots where id = %L',
    (select snapshot_id from position_test_ids)
  ),
  '55000',
  'Business-position snapshots are immutable',
  'snapshot history cannot be deleted'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-4000-8000-000000000002',
  true
);

select extensions.throws_ok(
  format(
    'select public.save_business_position_snapshot(%L, %L, %L)',
    (select business_id from position_test_ids),
    (select snapshot_date from position_test_ids),
    '4.5'
  ),
  '42501',
  'Administrator access is required',
  'employee cannot save a snapshot'
);
select extensions.is(
  (
    select count(*)::integer
    from public.business_position_snapshot_summaries
    where business_id = (select business_id from position_test_ids)
  ),
  1,
  'business member can read snapshot history'
);

select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-4000-8000-000000000001',
  true
);

select extensions.throws_ok(
  format(
    'select public.save_business_position_snapshot(%L, %L, %L)',
    (select business_id from position_test_ids),
    ((select snapshot_date from position_test_ids) - 1),
    '4.5'
  ),
  '22023',
  'Snapshot date must be the current business date',
  'snapshots cannot be backdated'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.business_position_snapshots',
    'UPDATE'
  ),
  'browser users cannot update snapshots'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.business_position_snapshots',
    'DELETE'
  ),
  'browser users cannot delete snapshots'
);

select extensions.finish();

rollback;
