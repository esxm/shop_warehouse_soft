begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(32);

select extensions.ok(
  to_regprocedure('public.search_customers(uuid,text,boolean,integer)')
    is not null,
  'customer search RPC exists'
);
select extensions.ok(
  to_regprocedure('public.create_customer(uuid,text,text,text)') is not null,
  'customer create RPC exists'
);
select extensions.ok(
  to_regprocedure('public.update_customer(uuid,uuid,text,text,text)')
    is not null,
  'customer update RPC exists'
);
select extensions.ok(
  to_regprocedure('public.deactivate_customer(uuid,uuid)') is not null,
  'customer deactivation RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.customers'::regclass
  ),
  'customers keeps RLS enabled'
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
    '70000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'customer-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Customer Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'customer-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Customer Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-customer-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Customer Admin"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_business_foundation(
  'Customer Test Business',
  'Europe/Bucharest'
);

select public.add_business_employee(
  (select id from public.businesses limit 1),
  '70000000-0000-4000-8000-000000000002'
);

create temporary table customer_test_ids (
  business_id uuid not null,
  customer_id uuid
);

insert into customer_test_ids (business_id)
select id from public.businesses limit 1;

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer(
        %L::uuid,
        '  Ahmed Popescu  ',
        '+40 712-345-678',
        '  Prefers a phone call  '
      )
    $sql$,
    (select business_id from customer_test_ids)
  ),
  'employee can create a customer'
);

update customer_test_ids
set customer_id = (
  select id
  from public.customers
  where phone = '+40 712-345-678'
);

select extensions.is(
  (select count(*) from public.customers),
  1::bigint,
  'employee can view the created business customer'
);
select extensions.is(
  (
    select name || '|' || phone || '|' || notes
    from public.customers
    where id = (select customer_id from customer_test_ids)
  ),
  'Ahmed Popescu|+40 712-345-678|Prefers a phone call',
  'customer input is normalized before storage'
);
select extensions.is(
  (
    select count(*)
    from public.search_customers(
      (select business_id from customer_test_ids),
      'Ahmed',
      false,
      100
    )
  ),
  1::bigint,
  'search matches customer name'
);
select extensions.is(
  (
    select count(*)
    from public.search_customers(
      (select business_id from customer_test_ids),
      '712-345',
      false,
      100
    )
  ),
  1::bigint,
  'search matches customer phone'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_customer(
        %L::uuid,
        'ahmed popescu',
        '+40 (712) 345 678'
      )
    $sql$,
    (select business_id from customer_test_ids)
  ),
  '23505',
  'An active customer already has this name and phone',
  'obvious normalized name-and-phone duplicate is blocked'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer(
        %L::uuid,
        'Ahmed Popescu',
        '+40 722 000 001'
      )
    $sql$,
    (select business_id from customer_test_ids)
  ),
  'same-name customer with another phone is allowed'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer(
        %L::uuid,
        'Ahmed Popescu'
      )
    $sql$,
    (select business_id from customer_test_ids)
  ),
  'same-name customer without a phone is allowed'
);
select extensions.is(
  (select count(*) from public.customers),
  3::bigint,
  'legitimate same-name customers are preserved separately'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.update_customer(
        %L::uuid,
        %L::uuid,
        'Ahmed Ionescu',
        '+40 712 345 678',
        'Updated notes'
      )
    $sql$,
    (select business_id from customer_test_ids),
    (select customer_id from customer_test_ids)
  ),
  'employee can update customer metadata'
);
select extensions.is(
  (
    select name || '|' || notes
    from public.customers
    where id = (select customer_id from customer_test_ids)
  ),
  'Ahmed Ionescu|Updated notes',
  'updated customer metadata is stored'
);
select extensions.throws_ok(
  format(
    $sql$
      insert into public.customers (
        business_id,
        name,
        created_by
      )
      values (
        %L::uuid,
        'Direct Insert',
        '70000000-0000-4000-8000-000000000002'
      )
    $sql$,
    (select business_id from customer_test_ids)
  ),
  '42501',
  null,
  'employee cannot directly insert a customer'
);
select extensions.throws_ok(
  format(
    $sql$
      delete from public.customers where id = %L::uuid
    $sql$,
    (select customer_id from customer_test_ids)
  ),
  '42501',
  null,
  'employee cannot hard-delete a customer'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.deactivate_customer(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from customer_test_ids),
    (select customer_id from customer_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot deactivate a customer'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.deactivate_customer(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from customer_test_ids),
    (select customer_id from customer_test_ids)
  ),
  'administrator can deactivate a customer'
);
select extensions.is(
  (
    select count(*)
    from public.customers
    where id = (select customer_id from customer_test_ids)
      and not is_active
  ),
  1::bigint,
  'deactivation preserves the original customer row'
);
select extensions.is(
  (
    select count(*)
    from public.search_customers(
      (select business_id from customer_test_ids),
      null,
      false,
      100
    )
  ),
  2::bigint,
  'active-only search excludes the deactivated customer'
);
select extensions.is(
  (
    select count(*)
    from public.search_customers(
      (select business_id from customer_test_ids),
      null,
      true,
      100
    )
  ),
  3::bigint,
  'history search can include the deactivated customer'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.deactivate_customer(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from customer_test_ids),
    (select customer_id from customer_test_ids)
  ),
  '55000',
  'Customer is already inactive',
  'repeated deactivation fails safely'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer.created'
  ),
  3::bigint,
  'successful customer creations are audited'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer.updated'
  ),
  1::bigint,
  'customer metadata update is audited'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'customer.deactivated'
  ),
  1::bigint,
  'customer deactivation is audited'
);
select extensions.throws_ok(
  format(
    $sql$
      delete from public.customers where id = %L::uuid
    $sql$,
    (select customer_id from customer_test_ids)
  ),
  '42501',
  null,
  'administrator also cannot hard-delete a customer'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000003',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_business_foundation(
      'Other Customer Business',
      'Europe/Bucharest'
    )
  $sql$,
  'another administrator can create an isolated business'
);
select extensions.throws_ok(
  format(
    $sql$
      select *
      from public.search_customers(%L::uuid, null, true, 100)
    $sql$,
    (select business_id from customer_test_ids)
  ),
  '42501',
  'Active business membership is required',
  'cross-business customer search is blocked'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_customer(
        %L::uuid,
        'Ahmed Ionescu',
        '+40 712 345 678'
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  'the same name and phone can exist in another business'
);
select extensions.is(
  (select count(*) from public.customers),
  1::bigint,
  'RLS exposes only the current business customer'
);

select * from extensions.finish();

rollback;
