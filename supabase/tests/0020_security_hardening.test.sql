begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(25);

select extensions.is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    inner join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  0::bigint,
  'every public application table has RLS enabled'
);
select extensions.ok(
  (
    select bool_and(
      not has_table_privilege(
        'anon',
        pg_catalog.format('%I.%I', namespace.nspname, relation.relname),
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
      )
    )
    from pg_catalog.pg_class as relation
    inner join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p', 'v', 'm')
  ),
  'anonymous users have no public relation privileges'
);
select extensions.ok(
  (
    select bool_and(
      not has_function_privilege('anon', routine.oid, 'EXECUTE')
    )
    from pg_catalog.pg_proc as routine
    inner join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
  ),
  'anonymous users cannot execute public application functions'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_auth_rate_limit(text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot manipulate authentication throttles'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.consume_auth_rate_limit(text,text)',
    'EXECUTE'
  ),
  'the isolated service role can consume authentication throttles'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select extensions.is(
  public.consume_auth_rate_limit('login_email', 'rate@example.test'),
  0,
  'first login attempt is allowed'
);
select extensions.is(
  public.consume_auth_rate_limit('login_email', 'rate@example.test'),
  0,
  'second login attempt is allowed'
);
select extensions.is(
  public.consume_auth_rate_limit('login_email', 'rate@example.test'),
  0,
  'third login attempt is allowed'
);
select extensions.is(
  public.consume_auth_rate_limit('login_email', 'rate@example.test'),
  0,
  'fourth login attempt is allowed'
);
select extensions.is(
  public.consume_auth_rate_limit('login_email', 'rate@example.test'),
  0,
  'fifth login attempt is allowed'
);
select extensions.ok(
  public.consume_auth_rate_limit('login_email', 'rate@example.test') > 0,
  'sixth login attempt is throttled'
);
select extensions.lives_ok(
  $sql$
    select public.clear_auth_rate_limit(
      'login_email',
      'rate@example.test'
    )
  $sql$,
  'successful authentication can clear its throttle'
);
select extensions.is(
  public.consume_auth_rate_limit('login_email', 'rate@example.test'),
  0,
  'a cleared login throttle allows a new attempt'
);
select extensions.is(
  array[
    public.consume_auth_rate_limit(
      'password_reset_email',
      'reset@example.test'
    ),
    public.consume_auth_rate_limit(
      'password_reset_email',
      'reset@example.test'
    ),
    public.consume_auth_rate_limit(
      'password_reset_email',
      'reset@example.test'
    )
  ],
  array[0, 0, 0],
  'three password reset requests are allowed in the window'
);
select extensions.ok(
  public.consume_auth_rate_limit(
    'password_reset_email',
    'reset@example.test'
  ) > 0,
  'the fourth password reset request is throttled'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.set_business_employee_active(uuid,uuid,boolean)',
    'EXECUTE'
  ),
  'authenticated admins can reach the employee access RPC'
);

reset role;

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
    '26000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'security-admin-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Security Admin One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '26000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'security-admin-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Security Admin Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '26000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'security-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Security Employee"}',
    now(),
    now()
  );

insert into public.businesses (
  id,
  name,
  timezone,
  created_by
)
values
  (
    '26000000-0000-4000-8000-000000000011',
    'Security Business One',
    'Europe/Bucharest',
    '26000000-0000-4000-8000-000000000001'
  ),
  (
    '26000000-0000-4000-8000-000000000012',
    'Security Business Two',
    'Europe/Bucharest',
    '26000000-0000-4000-8000-000000000002'
  );

insert into public.business_members (
  business_id,
  user_id,
  role,
  is_active
)
values
  (
    '26000000-0000-4000-8000-000000000011',
    '26000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '26000000-0000-4000-8000-000000000012',
    '26000000-0000-4000-8000-000000000002',
    'admin',
    true
  ),
  (
    '26000000-0000-4000-8000-000000000011',
    '26000000-0000-4000-8000-000000000003',
    'employee',
    true
  );

insert into public.audit_logs (
  business_id,
  actor_user_id,
  action,
  entity_type
)
values (
  '26000000-0000-4000-8000-000000000011',
  '26000000-0000-4000-8000-000000000001',
  'security.fixture',
  'security_test'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '26000000-0000-4000-8000-000000000003',
  true
);

select extensions.is(
  (select count(*) from public.businesses),
  1::bigint,
  'employee sees only their own business'
);
select extensions.is(
  (
    select count(*)
    from public.businesses
    where id = '26000000-0000-4000-8000-000000000012'
  ),
  0::bigint,
  'RLS hides another tenant business'
);
select extensions.is(
  (select count(*) from public.business_members),
  1::bigint,
  'employee sees only their own membership row'
);
select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'employee sees only their own profile'
);
select extensions.is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'employee cannot read private audit events'
);
select extensions.throws_ok(
  $sql$
    select public.set_business_employee_active(
      '26000000-0000-4000-8000-000000000011',
      '26000000-0000-4000-8000-000000000003',
      false
    )
  $sql$,
  '42501',
  'Administrator access is required',
  'employee cannot call the admin access operation directly'
);

select set_config(
  'request.jwt.claim.sub',
  '26000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.set_business_employee_active(
      '26000000-0000-4000-8000-000000000011',
      '26000000-0000-4000-8000-000000000003',
      false
    )
  $sql$,
  'admin can deactivate employee access'
);

select set_config(
  'request.jwt.claim.sub',
  '26000000-0000-4000-8000-000000000003',
  true
);
select extensions.is(
  (select count(*) from public.businesses),
  0::bigint,
  'deactivated employee immediately loses business access'
);

select set_config(
  'request.jwt.claim.sub',
  '26000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.set_business_employee_active(
      '26000000-0000-4000-8000-000000000011',
      '26000000-0000-4000-8000-000000000003',
      true
    )
  $sql$,
  'admin can reactivate employee access'
);

select * from extensions.finish();

rollback;
