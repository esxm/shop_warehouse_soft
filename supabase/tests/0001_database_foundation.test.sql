begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(42);

select extensions.ok(
  to_regclass('public.businesses') is not null,
  'businesses table exists'
);
select extensions.ok(
  to_regclass('public.profiles') is not null,
  'profiles table exists'
);
select extensions.ok(
  to_regclass('public.business_members') is not null,
  'business_members table exists'
);
select extensions.ok(
  to_regclass('public.inventory_locations') is not null,
  'inventory_locations table exists'
);
select extensions.ok(
  to_regclass('public.financial_accounts') is not null,
  'financial_accounts table exists'
);
select extensions.ok(
  to_regclass('public.audit_logs') is not null,
  'audit_logs table exists'
);

select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.businesses'::regclass),
  'businesses has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.business_members'::regclass),
  'business_members has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.inventory_locations'::regclass),
  'inventory_locations has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.financial_accounts'::regclass),
  'financial_accounts has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.audit_logs'::regclass),
  'audit_logs has RLS enabled'
);

select extensions.is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    inner join pg_catalog.pg_type as enum_type
      on enum_type.oid = enum_value.enumtypid
    inner join pg_catalog.pg_namespace as enum_schema
      on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'member_role'
  ),
  'admin,employee',
  'member roles are fixed'
);
select extensions.is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    inner join pg_catalog.pg_type as enum_type
      on enum_type.oid = enum_value.enumtypid
    inner join pg_catalog.pg_namespace as enum_schema
      on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'inventory_location_type'
  ),
  'warehouse,shop',
  'inventory location types are fixed'
);
select extensions.is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    inner join pg_catalog.pg_type as enum_type
      on enum_type.oid = enum_value.enumtypid
    inner join pg_catalog.pg_namespace as enum_schema
      on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'financial_account_type'
  ),
  'cash,bank',
  'financial account types are fixed'
);

select extensions.is(
  (
    select count(*)
    from pg_catalog.pg_constraint
    where contype = 'f'
      and conrelid in (
        'public.businesses'::regclass,
        'public.profiles'::regclass,
        'public.business_members'::regclass,
        'public.inventory_locations'::regclass,
        'public.financial_accounts'::regclass,
        'public.audit_logs'::regclass
      )
  ),
  8::bigint,
  'all foundation foreign keys exist'
);
select extensions.ok(
  to_regclass('public.business_members_user_active_idx') is not null,
  'membership lookup index exists'
);
select extensions.ok(
  to_regclass('public.audit_logs_business_created_idx') is not null,
  'audit timeline index exists'
);

select extensions.ok(
  to_regprocedure('private.is_business_member(uuid)') is not null,
  'non-recursive membership helper exists'
);
select extensions.ok(
  to_regprocedure('private.is_business_admin(uuid)') is not null,
  'non-recursive admin helper exists'
);
select extensions.ok(
  to_regprocedure('private.can_view_profile(uuid)') is not null,
  'non-recursive profile helper exists'
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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'admin-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Employee"}',
    now(),
    now()
  );

select extensions.is(
  (select count(*) from public.profiles),
  3::bigint,
  'auth trigger creates profiles'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.lives_ok(
  $sql$
    select public.create_business_foundation(
      'Business One',
      'Europe/Bucharest'
    )
  $sql$,
  'first admin can bootstrap a business'
);
select extensions.is(
  (select count(*) from public.businesses),
  1::bigint,
  'first admin sees only their business'
);
select extensions.is(
  (select count(*) from public.inventory_locations where type = 'warehouse'),
  1::bigint,
  'bootstrap creates one warehouse'
);
select extensions.is(
  (select count(*) from public.inventory_locations where type = 'shop'),
  1::bigint,
  'bootstrap creates one shop'
);
select extensions.is(
  (select count(*) from public.financial_accounts where type = 'cash'),
  1::bigint,
  'bootstrap creates one cash account'
);
select extensions.is(
  (select count(*) from public.financial_accounts where type = 'bank'),
  1::bigint,
  'bootstrap creates one bank account'
);
select extensions.ok(
  private.is_business_admin(
    (select id from public.businesses limit 1)
  ),
  'business creator is an active admin'
);
select extensions.is(
  (select count(*) from public.audit_logs),
  1::bigint,
  'bootstrap creates an audit record visible to the admin'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_business_foundation(
      'Business Two',
      'Europe/Bucharest'
    )
  $sql$,
  'second admin can bootstrap a separate business'
);
select extensions.is(
  (select count(*) from public.businesses),
  1::bigint,
  'RLS hides the first business from the second admin'
);
select extensions.is(
  (select count(*) from public.business_members),
  1::bigint,
  'RLS hides first-business memberships from the second admin'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select extensions.lives_ok(
  $sql$
    insert into public.business_members (
      business_id,
      user_id,
      role
    )
    select
      id,
      '10000000-0000-0000-0000-000000000003',
      'employee'
    from public.businesses
  $sql$,
  'admin can add an employee'
);
select extensions.is(
  (
    select role::text
    from public.business_members
    where user_id = '10000000-0000-0000-0000-000000000003'
  ),
  'employee',
  'new member has the employee role'
);
select extensions.is(
  (select count(*) from public.profiles),
  2::bigint,
  'admin sees profiles only for users in their business'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);

select extensions.is(
  (select count(*) from public.businesses),
  1::bigint,
  'employee sees only their business'
);
select extensions.lives_ok(
  $sql$
    update public.business_members
    set role = 'admin'
    where user_id = '10000000-0000-0000-0000-000000000003'
  $sql$,
  'employee promotion attempt is safely filtered'
);
select extensions.is(
  (
    select role::text
    from public.business_members
    where user_id = '10000000-0000-0000-0000-000000000003'
  ),
  'employee',
  'employee cannot promote themselves'
);
select extensions.is(
  private.is_business_admin(
    (select id from public.businesses limit 1)
  ),
  false,
  'employee does not pass the admin helper'
);
select extensions.is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'employee cannot read audit logs'
);
select extensions.is(
  (select count(*) from public.business_members),
  1::bigint,
  'employee sees only their own membership row'
);

select * from extensions.finish();

rollback;
