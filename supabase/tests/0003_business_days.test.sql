begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(26);

select extensions.ok(
  to_regclass('public.business_days') is not null,
  'business_days table exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.business_days'::regclass
  ),
  'business_days has RLS enabled'
);
select extensions.ok(
  to_regclass('public.business_days_one_open_per_business_idx') is not null,
  'partial unique index limits a business to one open day'
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
    '60000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'business-day-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Business Day Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '60000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'business-day-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Business Day Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_business_foundation(
  'Business Day Test Business',
  'Europe/Bucharest'
);

select public.add_business_employee(
  (select id from public.businesses limit 1),
  '60000000-0000-0000-0000-000000000002'
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_business_day(%L::uuid, '2026-01-01')
    $sql$,
    (select id from public.businesses limit 1)
  ),
  'administrator can create the first business day'
);
select extensions.is(
  (select count(*) from public.business_days where status = 'open'),
  1::bigint,
  'one open day is stored'
);

select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000002',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_business_day(%L::uuid, '2026-01-02')
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot create a business day'
);
select extensions.is(
  (select count(*) from public.business_days),
  1::bigint,
  'employee can view the current business day'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.close_business_day(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from public.business_days limit 1),
    (select id from public.business_days limit 1)
  ),
  'employee can close the current open day'
);
select extensions.is(
  (select status::text from public.business_days limit 1),
  'closed',
  'closed status is persisted'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'business_day.closed'
  ),
  0::bigint,
  'employee cannot read administrator audit data'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.close_business_day(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from public.business_days limit 1),
    (select id from public.business_days limit 1)
  ),
  '55000',
  'Business day is already closed',
  'a repeated close fails safely'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reopen_business_day(
        %L::uuid,
        %L::uuid,
        'Employee must not reopen this day'
      )
    $sql$,
    (select business_id from public.business_days limit 1),
    (select id from public.business_days limit 1)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reopen a closed day'
);
select extensions.throws_ok(
  $sql$
    update public.business_days
    set status = 'open'
  $sql$,
  '42501',
  null,
  'employee cannot bypass RPC lifecycle rules with a direct update'
);

select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000001',
  true
);

select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'business_day.closed'
  ),
  1::bigint,
  'one close audit entry exists after the repeated request'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reopen_business_day(
        %L::uuid,
        %L::uuid,
        'short'
      )
    $sql$,
    (select business_id from public.business_days limit 1),
    (select id from public.business_days limit 1)
  ),
  '22023',
  'Reopen reason must contain 10 to 500 characters',
  'administrator must provide a meaningful reopen reason'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reopen_business_day(
        %L::uuid,
        %L::uuid,
        'Correcting transactions posted to the wrong business day'
      )
    $sql$,
    (select business_id from public.business_days limit 1),
    (select id from public.business_days limit 1)
  ),
  'administrator can reopen a closed day'
);
select extensions.is(
  (select status::text from public.business_days limit 1),
  'open',
  'reopened day becomes the single open day'
);
select extensions.is(
  (select reopen_reason from public.business_days limit 1),
  'Correcting transactions posted to the wrong business day',
  'normalized reopen reason is stored'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'business_day.reopened'
      and reason is not null
  ),
  1::bigint,
  'reopen action and reason are audited'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_business_day(%L::uuid, '2026-01-02')
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '23505',
  null,
  'a second open day is blocked'
);
select extensions.is(
  (select count(*) from public.business_days where status = 'open'),
  1::bigint,
  'duplicate open failure leaves one open day'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.close_business_day(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from public.business_days limit 1),
    (select id from public.business_days limit 1)
  ),
  'administrator can close a reopened day'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_business_day(%L::uuid, '2026-01-02')
    $sql$,
    (select id from public.businesses limit 1)
  ),
  'administrator can open the next day after closing'
);
select extensions.is(
  (select count(*) from public.business_days where status = 'open'),
  1::bigint,
  'opening the next day preserves the one-open-day invariant'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_business_day(%L::uuid, '2026-01-01')
    $sql$,
    (select id from public.businesses limit 1)
  ),
  '23505',
  null,
  'an existing business date cannot be duplicated'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'business_day.created'
  ),
  2::bigint,
  'only successful day creation requests are audited'
);

select * from extensions.finish();

rollback;
