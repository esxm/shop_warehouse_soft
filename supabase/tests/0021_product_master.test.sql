begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(40);

select extensions.ok(
  to_regclass('public.product_categories') is not null,
  'product categories table exists'
);
select extensions.ok(
  to_regclass('public.products') is not null,
  'products table exists'
);
select extensions.ok(
  (
    select bool_and(relation.relrowsecurity)
    from pg_catalog.pg_class as relation
    where relation.oid in (
      'public.product_categories'::regclass,
      'public.products'::regclass
    )
  ),
  'product master tables have RLS enabled'
);
select extensions.ok(
  to_regclass('public.products_business_internal_code_key') is not null,
  'internal product code has a business-scoped unique index'
);
select extensions.ok(
  to_regprocedure('public.create_product_category(uuid,text)') is not null,
  'product category create RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_product(uuid,text,text,uuid,text,text)'
  ) is not null,
  'product create RPC exists'
);
select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'default_purchase_currency'
  ),
  'products store the default purchase-cost currency'
);
select extensions.ok(
  to_regprocedure(
    'public.create_product_with_currency(uuid,text,text,uuid,text,public.transaction_currency,text)'
  ) is not null,
  'currency-aware product create RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.update_product_with_currency(uuid,uuid,text,text,uuid,text,public.transaction_currency,text)'
  ) is not null,
  'currency-aware product update RPC exists'
);
select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'default_purchase_cost_original'
  ),
  'products preserve the original purchase cost'
);
select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'default_purchase_exchange_rate'
  ),
  'products preserve the default purchase exchange rate'
);
select extensions.ok(
  to_regprocedure(
    'public.create_product_with_cost_currency(uuid,text,text,uuid,text,public.transaction_currency,text,text)'
  ) is not null,
  'product create RPC converts original purchase currency'
);
select extensions.ok(
  to_regprocedure(
    'public.update_product_with_cost_currency(uuid,uuid,text,text,uuid,text,public.transaction_currency,text,text)'
  ) is not null,
  'product update RPC converts original purchase currency'
);
select extensions.ok(
  to_regprocedure('public.import_products(uuid,uuid,jsonb)') is not null,
  'atomic product import RPC exists'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.products',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot bypass product RPCs or delete products'
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
    '31000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'product-admin-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Product Admin One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'product-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Product Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'product-admin-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Product Admin Two"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values
  (
    '31000000-0000-4000-8000-000000000011',
    'Product Business One',
    'Europe/Bucharest',
    '31000000-0000-4000-8000-000000000001'
  ),
  (
    '31000000-0000-4000-8000-000000000012',
    'Product Business Two',
    'Europe/Bucharest',
    '31000000-0000-4000-8000-000000000003'
  );

insert into public.business_members (
  business_id,
  user_id,
  role,
  is_active
)
values
  (
    '31000000-0000-4000-8000-000000000011',
    '31000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '31000000-0000-4000-8000-000000000011',
    '31000000-0000-4000-8000-000000000002',
    'employee',
    true
  ),
  (
    '31000000-0000-4000-8000-000000000012',
    '31000000-0000-4000-8000-000000000003',
    'admin',
    true
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_product_category(
      '31000000-0000-4000-8000-000000000011',
      'Bathroom sets'
    )
  $sql$,
  'employee can create a product category'
);
select extensions.throws_ok(
  $sql$
    select public.create_product_category(
      '31000000-0000-4000-8000-000000000011',
      'bathroom SETS'
    )
  $sql$,
  '23505',
  null,
  'category names are unique per business without case sensitivity'
);
select extensions.lives_ok(
  $sql$
    select public.create_product(
      '31000000-0000-4000-8000-000000000011',
      'bath-001',
      'Bathroom set',
      (
        select id
        from public.product_categories
        where name = 'Bathroom sets'
      ),
      '100.00',
      '140.00'
    )
  $sql$,
  'employee can create a product with a manual code'
);
select extensions.is(
  (
    select
      internal_code
      || '|'
      || unit
      || '|'
      || default_purchase_cost_ron::text
      || '|'
      || default_selling_price_ron::text
    from public.products
    where name = 'Bathroom set'
  ),
  'BATH-001|piece|100.00|140.00',
  'product stores normalized code, piece unit, and default prices'
);
select extensions.lives_ok(
  $sql$
    select public.create_product(
      '31000000-0000-4000-8000-000000000011',
      '',
      'Bath mat',
      (
        select id
        from public.product_categories
        where name = 'Bathroom sets'
      ),
      null,
      '25.50'
    )
  $sql$,
  'blank internal code generates a product code'
);
select extensions.is(
  (
    select internal_code
    from public.products
    where name = 'Bath mat'
  ),
  'P000001',
  'generated code uses the business sequence'
);
select extensions.throws_ok(
  $sql$
    select public.create_product(
      '31000000-0000-4000-8000-000000000011',
      'BATH-001',
      'Duplicate code',
      (
        select id
        from public.product_categories
        where name = 'Bathroom sets'
      )
    )
  $sql$,
  '23505',
  null,
  'duplicate internal code is rejected'
);
select extensions.is(
  (
    select count(*)
    from public.search_products(
      '31000000-0000-4000-8000-000000000011',
      'bath',
      null,
      false,
      100
    )
  ),
  2::bigint,
  'product search matches names and codes'
);
select extensions.throws_ok(
  $sql$
    select public.deactivate_product(
      '31000000-0000-4000-8000-000000000011',
      (
        select id
        from public.products
        where internal_code = 'BATH-001'
      )
    )
  $sql$,
  '42501',
  'Administrator access is required',
  'employee cannot deactivate a product'
);
select extensions.is(
  public.import_products(
    '31000000-0000-4000-8000-000000000011',
    '31000000-0000-4000-8000-000000000021',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'internal_code', 'MAT-002',
        'name', 'Large bath mat',
        'category_id', (
          select id
          from public.product_categories
          where name = 'Bathroom sets'
        ),
        'default_purchase_cost_ron', '20.00',
        'default_selling_price_ron', '30.00'
      ),
      pg_catalog.jsonb_build_object(
        'internal_code', '',
        'name', 'Small bath mat',
        'category_id', (
          select id
          from public.product_categories
          where name = 'Bathroom sets'
        ),
        'default_purchase_cost_ron', '',
        'default_selling_price_ron', ''
      )
    )
  ),
  2,
  'validated CSV rows import atomically'
);
select extensions.is(
  (select count(*) from public.products),
  4::bigint,
  'product import creates every row once'
);
select extensions.is(
  public.import_products(
    '31000000-0000-4000-8000-000000000011',
    '31000000-0000-4000-8000-000000000021',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'internal_code', 'MAT-002',
        'name', 'Large bath mat',
        'category_id', (
          select id
          from public.product_categories
          where name = 'Bathroom sets'
        ),
        'default_purchase_cost_ron', '20.00',
        'default_selling_price_ron', '30.00'
      ),
      pg_catalog.jsonb_build_object(
        'internal_code', '',
        'name', 'Small bath mat',
        'category_id', (
          select id
          from public.product_categories
          where name = 'Bathroom sets'
        ),
        'default_purchase_cost_ron', '',
        'default_selling_price_ron', ''
      )
    )
  ),
  2,
  'identical product import retry returns the original result'
);
select extensions.is(
  (select count(*) from public.products),
  4::bigint,
  'identical retry does not duplicate products'
);
select extensions.throws_ok(
  $sql$
    select public.import_products(
      '31000000-0000-4000-8000-000000000011',
      '31000000-0000-4000-8000-000000000021',
      '[{"internal_code":"CHANGED","name":"Changed","category_id":"31000000-0000-4000-8000-000000000099","default_purchase_cost_ron":"","default_selling_price_ron":""}]'
    )
  $sql$,
  '22023',
  'Product import request identifier was reused with different data',
  'changed data cannot reuse an import request identifier'
);
select extensions.throws_ok(
  $sql$
    select public.import_products(
      '31000000-0000-4000-8000-000000000011',
      '31000000-0000-4000-8000-000000000022',
      '[{"internal_code":"BAD-ROW","name":"Bad row","category_id":"31000000-0000-4000-8000-000000000099","default_purchase_cost_ron":"","default_selling_price_ron":""}]'
    )
  $sql$,
  '22023',
  'Active product category does not exist',
  'invalid import row aborts the batch'
);
select extensions.is(
  (select count(*) from public.products),
  4::bigint,
  'failed import leaves no partial products'
);
select extensions.is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'employee cannot read product audit events'
);

select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.deactivate_product(
      '31000000-0000-4000-8000-000000000011',
      (
        select id
        from public.products
        where internal_code = 'BATH-001'
      )
    )
  $sql$,
  'admin can deactivate a product without deleting it'
);
select extensions.is(
  (
    select count(*)
    from public.search_products(
      '31000000-0000-4000-8000-000000000011',
      null,
      null,
      false,
      100
    )
  ),
  3::bigint,
  'active-only search excludes the deactivated product'
);
select extensions.throws_ok(
  $sql$
    select public.deactivate_product_category(
      '31000000-0000-4000-8000-000000000011',
      (
        select id
        from public.product_categories
        where name = 'Bathroom sets'
      )
    )
  $sql$,
  '55000',
  'Category has active products',
  'category with active products cannot be deactivated'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'product.created'
  ),
  4::bigint,
  'every product creation is audited'
);

select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000003',
  true
);
select extensions.throws_ok(
  $sql$
    select *
    from public.search_products(
      '31000000-0000-4000-8000-000000000011',
      null,
      null,
      true,
      100
    )
  $sql$,
  '42501',
  'Active business membership is required',
  'cross-business product search is rejected'
);
select extensions.lives_ok(
  $sql$
    select public.create_product_category(
      '31000000-0000-4000-8000-000000000012',
      'Bathroom sets'
    )
  $sql$,
  'another business can reuse a category name'
);
select extensions.lives_ok(
  $sql$
    select public.create_product(
      '31000000-0000-4000-8000-000000000012',
      'BATH-001',
      'Other business bathroom set',
      (
        select id
        from public.product_categories
        where name = 'Bathroom sets'
      )
    )
  $sql$,
  'another business can reuse an internal code'
);
select extensions.is(
  (select count(*) from public.products),
  1::bigint,
  'RLS exposes only the current business products'
);

select * from extensions.finish();

rollback;
