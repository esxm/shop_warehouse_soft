begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(34);

select extensions.ok(
  to_regprocedure('public.search_suppliers(uuid,text,boolean,integer)')
    is not null,
  'supplier search RPC exists'
);
select extensions.ok(
  to_regprocedure('public.create_supplier(uuid,text,text,text,text)')
    is not null,
  'supplier create RPC exists'
);
select extensions.ok(
  to_regprocedure('public.update_supplier(uuid,uuid,text,text,text,text)')
    is not null,
  'supplier update RPC exists'
);
select extensions.ok(
  to_regprocedure('public.deactivate_supplier(uuid,uuid)') is not null,
  'supplier deactivation RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.suppliers'::regclass
  ),
  'suppliers keeps RLS enabled'
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
    'a0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'supplier-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Supplier Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'supplier-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Supplier Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-supplier-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Supplier Admin"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_business_foundation(
  'Supplier Test Business',
  'Europe/Bucharest'
);

select public.add_business_employee(
  (select id from public.businesses limit 1),
  'a0000000-0000-4000-8000-000000000002'
);

select public.create_opening_balance(
  (select id from public.businesses limit 1),
  '2026-01-01',
  '0.00',
  '0.00',
  '0.00',
  '0.00',
  '[]'::jsonb,
  '[
    {
      "name":"Historical Supplier",
      "currency":"USD",
      "original_amount":"100.00",
      "purchase_exchange_rate":"4.60"
    }
  ]'::jsonb
);

create temporary table supplier_test_ids (
  business_id uuid not null,
  supplier_id uuid,
  historical_supplier_id uuid,
  historical_purchase_id uuid
);

insert into supplier_test_ids (
  business_id,
  historical_supplier_id,
  historical_purchase_id
)
select
  business.id,
  supplier.id,
  purchase.id
from public.businesses as business
inner join public.suppliers as supplier
  on supplier.business_id = business.id
  and supplier.name = 'Historical Supplier'
inner join public.supplier_purchases as purchase
  on purchase.supplier_id = supplier.id;

select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier(
        %L::uuid,
        '  Supply Company  ',
        '+40 712-345-678',
        '  Main wholesale contact  ',
        'usd'
      )
    $sql$,
    (select business_id from supplier_test_ids)
  ),
  'employee can create a supplier'
);

update supplier_test_ids
set supplier_id = (
  select id
  from public.suppliers
  where phone = '+40 712-345-678'
);

select extensions.is(
  (
    select name || '|' || phone || '|' || notes || '|' || default_currency
    from public.suppliers
    where id = (select supplier_id from supplier_test_ids)
  ),
  'Supply Company|+40 712-345-678|Main wholesale contact|USD',
  'supplier input and default currency are normalized'
);
select extensions.is(
  (
    select count(*)
    from public.search_suppliers(
      (select business_id from supplier_test_ids),
      'Supply',
      false,
      100
    )
  ),
  1::bigint,
  'search matches active supplier name'
);
select extensions.is(
  (
    select count(*)
    from public.search_suppliers(
      (select business_id from supplier_test_ids),
      '712-345',
      false,
      100
    )
  ),
  1::bigint,
  'search matches supplier phone'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier(
        %L::uuid,
        'supply company',
        '+40 (712) 345 678',
        null,
        'RON'
      )
    $sql$,
    (select business_id from supplier_test_ids)
  ),
  '23505',
  'An active supplier already has this name and phone',
  'obvious normalized supplier duplicate is blocked'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier(
        %L::uuid,
        'Supply Company',
        '+40 722 000 001'
      )
    $sql$,
    (select business_id from supplier_test_ids)
  ),
  'same-name supplier with another phone is allowed'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier(
        %L::uuid,
        'Supply Company'
      )
    $sql$,
    (select business_id from supplier_test_ids)
  ),
  'same-name supplier without a phone is allowed'
);
select extensions.is(
  (
    select count(*)
    from public.suppliers
    where name = 'Supply Company'
  ),
  3::bigint,
  'legitimate same-name suppliers remain separate'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.update_supplier(
        %L::uuid,
        %L::uuid,
        'Supply SRL',
        '+40 712 345 678',
        'Updated contact details',
        'RON'
      )
    $sql$,
    (select business_id from supplier_test_ids),
    (select supplier_id from supplier_test_ids)
  ),
  'employee can edit supplier contact information'
);
select extensions.is(
  (
    select name || '|' || notes || '|' || default_currency
    from public.suppliers
    where id = (select supplier_id from supplier_test_ids)
  ),
  'Supply SRL|Updated contact details|RON',
  'supplier metadata update is stored'
);
select extensions.throws_ok(
  format(
    $sql$
      insert into public.suppliers (
        business_id,
        name,
        created_by
      )
      values (
        %L::uuid,
        'Direct Supplier',
        'a0000000-0000-4000-8000-000000000002'
      )
    $sql$,
    (select business_id from supplier_test_ids)
  ),
  '42501',
  null,
  'employee cannot directly insert a supplier'
);
select extensions.throws_ok(
  format(
    $sql$
      delete from public.suppliers where id = %L::uuid
    $sql$,
    (select supplier_id from supplier_test_ids)
  ),
  '42501',
  null,
  'employee cannot hard-delete a supplier'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.deactivate_supplier(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from supplier_test_ids),
    (select historical_supplier_id from supplier_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot deactivate a supplier'
);

select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.deactivate_supplier(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from supplier_test_ids),
    (select historical_supplier_id from supplier_test_ids)
  ),
  'administrator can deactivate a supplier'
);
select extensions.is(
  (
    select count(*)
    from public.suppliers
    where id = (select historical_supplier_id from supplier_test_ids)
      and not is_active
  ),
  1::bigint,
  'deactivation preserves the supplier row'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_purchases
    where id = (select historical_purchase_id from supplier_test_ids)
      and supplier_id = (
        select historical_supplier_id from supplier_test_ids
      )
  ),
  1::bigint,
  'historical supplier purchase survives deactivation'
);
select extensions.is(
  (
    select inventory_cost_ron
    from public.supplier_purchases
    where id = (select historical_purchase_id from supplier_test_ids)
  ),
  460.00::numeric,
  'historical purchase value remains unchanged'
);
select extensions.is(
  (
    select count(*)
    from public.search_suppliers(
      (select business_id from supplier_test_ids),
      'Historical Supplier',
      false,
      100
    )
  ),
  0::bigint,
  'active-only search excludes deactivated supplier'
);
select extensions.is(
  (
    select count(*)
    from public.search_suppliers(
      (select business_id from supplier_test_ids),
      'Historical Supplier',
      true,
      100
    )
  ),
  1::bigint,
  'history search includes deactivated supplier'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.deactivate_supplier(%L::uuid, %L::uuid)
    $sql$,
    (select business_id from supplier_test_ids),
    (select historical_supplier_id from supplier_test_ids)
  ),
  '55000',
  'Supplier is already inactive',
  'repeated supplier deactivation fails safely'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier.created'
  ),
  3::bigint,
  'successful supplier creations are audited'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier.updated'
  ),
  1::bigint,
  'supplier update is audited'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier.deactivated'
  ),
  1::bigint,
  'supplier deactivation is audited'
);
select extensions.throws_ok(
  format(
    $sql$
      delete from public.suppliers where id = %L::uuid
    $sql$,
    (select historical_supplier_id from supplier_test_ids)
  ),
  '42501',
  null,
  'administrator also cannot hard-delete a supplier'
);

select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000003',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_business_foundation(
      'Other Supplier Business',
      'Europe/Bucharest'
    )
  $sql$,
  'another administrator can create an isolated business'
);
select extensions.throws_ok(
  format(
    $sql$
      select *
      from public.search_suppliers(%L::uuid, null, true, 100)
    $sql$,
    (select business_id from supplier_test_ids)
  ),
  '42501',
  'Active business membership is required',
  'cross-business supplier search is blocked'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier(
        %L::uuid,
        'Supply SRL',
        '+40 712 345 678',
        null,
        'USD'
      )
    $sql$,
    (select id from public.businesses limit 1)
  ),
  'same supplier contact can exist in another business'
);
select extensions.is(
  (select count(*) from public.suppliers),
  1::bigint,
  'RLS exposes only the current business supplier'
);
select extensions.is(
  (
    select default_currency::text
    from public.suppliers
    limit 1
  ),
  'USD',
  'supplier default currency remains business-scoped metadata'
);

select * from extensions.finish();

rollback;
