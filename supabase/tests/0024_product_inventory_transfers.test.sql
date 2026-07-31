begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(37);

select extensions.ok(
  to_regclass('public.inventory_transfer_lines') is not null,
  'inventory transfer lines table exists'
);
select extensions.ok(
  to_regclass('public.inventory_transfer_line_summaries') is not null,
  'inventory transfer line summary view exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.inventory_transfer_lines'::regclass
  ),
  'inventory transfer lines use RLS'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_transfer_lines',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate transfer lines directly'
);
select extensions.ok(
  to_regprocedure(
    'public.create_inventory_product_transfer(uuid,uuid,uuid,uuid,uuid,jsonb,text,text)'
  ) is not null,
  'atomic product transfer RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_inventory_value_transfer(uuid,uuid,uuid,uuid,text,text,uuid,text)'
  ) is not null,
  'legacy value-only transfer RPC remains available'
);
select extensions.ok(
  to_regprocedure(
    'public.reverse_inventory_value_transfer(uuid,uuid,text,boolean)'
  ) is not null,
  'quantity-aware transfer reversal exists'
);
select extensions.ok(
  pg_get_functiondef(
    'public.create_inventory_product_transfer(uuid,uuid,uuid,uuid,uuid,jsonb,text,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'product transfer serializes availability checks'
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
    '35000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'transfer-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Transfer Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '35000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'transfer-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Transfer Employee"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values (
  '35000000-0000-4000-8000-000000000011',
  'Product Transfer Business',
  'Europe/Bucharest',
  '35000000-0000-4000-8000-000000000001'
);

insert into public.business_members (business_id, user_id, role, is_active)
values
  (
    '35000000-0000-4000-8000-000000000011',
    '35000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '35000000-0000-4000-8000-000000000011',
    '35000000-0000-4000-8000-000000000002',
    'employee',
    true
  );

insert into public.inventory_locations (id, business_id, name, type)
values
  (
    '35000000-0000-4000-8000-000000000012',
    '35000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '35000000-0000-4000-8000-000000000013',
    '35000000-0000-4000-8000-000000000011',
    'Shop',
    'shop'
  );

insert into public.business_days (
  id,
  business_id,
  business_date,
  opened_by
)
values (
  '35000000-0000-4000-8000-000000000021',
  '35000000-0000-4000-8000-000000000011',
  '2026-07-03',
  '35000000-0000-4000-8000-000000000001'
);

insert into public.suppliers (
  id,
  business_id,
  name,
  default_currency,
  created_by
)
values (
  '35000000-0000-4000-8000-000000000031',
  '35000000-0000-4000-8000-000000000011',
  'Transfer Stock Supplier',
  'RON',
  '35000000-0000-4000-8000-000000000001'
);

insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '35000000-0000-4000-8000-000000000041',
  '35000000-0000-4000-8000-000000000011',
  'Transfer products',
  '35000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000001'
);

insert into public.products (
  id,
  business_id,
  internal_code,
  name,
  category_id,
  created_by,
  updated_by
)
values
  (
    '35000000-0000-4000-8000-000000000051',
    '35000000-0000-4000-8000-000000000011',
    'MOVE-A',
    'Transfer product A',
    '35000000-0000-4000-8000-000000000041',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001'
  ),
  (
    '35000000-0000-4000-8000-000000000052',
    '35000000-0000-4000-8000-000000000011',
    'MOVE-B',
    'Transfer product B',
    '35000000-0000-4000-8000-000000000041',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '35000000-0000-4000-8000-000000000002',
  true
);

select public.create_supplier_purchase_with_lines_idempotent(
  target_business_id => '35000000-0000-4000-8000-000000000011',
  target_supplier_id => '35000000-0000-4000-8000-000000000031',
  target_business_day_id => '35000000-0000-4000-8000-000000000021',
  target_currency => 'RON',
  target_purchase_exchange_rate => '',
  target_destination_location_id =>
    '35000000-0000-4000-8000-000000000012',
  target_idempotency_key => '35000000-0000-4000-8000-000000000061',
  target_lines => '[
    {
      "product_id":"35000000-0000-4000-8000-000000000051",
      "quantity":"10",
      "unit_price_original_currency":"10.00"
    },
    {
      "product_id":"35000000-0000-4000-8000-000000000052",
      "quantity":"4",
      "unit_price_original_currency":"20.00"
    }
  ]'::jsonb,
  target_description => 'Transfer stock receipt'
);

select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id =
      '35000000-0000-4000-8000-000000000012'
  ),
  '180.00',
  'supplier receipt establishes warehouse value'
);

select extensions.lives_ok(
  $sql$
    select public.create_inventory_value_transfer(
      '35000000-0000-4000-8000-000000000011',
      '35000000-0000-4000-8000-000000000021',
      '35000000-0000-4000-8000-000000000012',
      '35000000-0000-4000-8000-000000000013',
      '10.00',
      'Legacy transfer',
      '35000000-0000-4000-8000-000000000062'
    )
  $sql$,
  'legacy value-only transfer still works'
);
select extensions.is(
  (
    select product_line_count
    from public.inventory_transfer_summaries
    where notes = 'Legacy transfer'
  ),
  0,
  'legacy transfer remains visible without fabricated product lines'
);

select extensions.lives_ok(
  $sql$
    select public.create_inventory_product_transfer(
      target_business_id =>
        '35000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '35000000-0000-4000-8000-000000000021',
      target_source_location_id =>
        '35000000-0000-4000-8000-000000000012',
      target_destination_location_id =>
        '35000000-0000-4000-8000-000000000013',
      target_idempotency_key =>
        '35000000-0000-4000-8000-000000000063',
      target_lines => '[
        {
          "product_id":"35000000-0000-4000-8000-000000000051",
          "quantity":"3"
        },
        {
          "product_id":"35000000-0000-4000-8000-000000000052",
          "quantity":"2"
        }
      ]'::jsonb,
      target_notes => 'Product transfer'
    )
  $sql$,
  'employee transfers multiple products atomically'
);
select extensions.is(
  (
    select amount_ron::text
    from public.inventory_value_movements
    where notes = 'Product transfer'
  ),
  '70.00',
  'product transfer derives value from preserved unit costs'
);
select extensions.is(
  (
    select string_agg(
      product.internal_code
        || ':'
        || line.quantity
        || '@'
        || line.unit_cost_ron::text,
      ','
      order by product.internal_code
    )
    from public.inventory_transfer_lines as line
    inner join public.products as product
      on product.id = line.product_id
    where line.inventory_transfer_id = (
      select id
      from public.inventory_value_movements
      where notes = 'Product transfer'
    )
  ),
  'MOVE-A:3@10.00000000,MOVE-B:2@20.00000000',
  'transfer lines preserve each warehouse unit cost'
);
select extensions.is(
  (
    select sum(line_total_ron)::text
    from public.inventory_transfer_lines
    where inventory_transfer_id = (
      select id
      from public.inventory_value_movements
      where notes = 'Product transfer'
    )
  ),
  '70.00',
  'product line totals reconcile to transferred inventory value'
);
select extensions.is(
  (
    select string_agg(
      product.internal_code || ':' || stock.quantity,
      ','
      order by product.internal_code
    )
    from public.product_stock_by_location as stock
    inner join public.products as product
      on product.id = stock.product_id
    where stock.location_id =
      '35000000-0000-4000-8000-000000000012'
  ),
  'MOVE-A:7,MOVE-B:2',
  'transfer decreases exact warehouse quantities'
);
select extensions.is(
  (
    select string_agg(
      product.internal_code || ':' || stock.quantity,
      ','
      order by product.internal_code
    )
    from public.product_stock_by_location as stock
    inner join public.products as product
      on product.id = stock.product_id
    where stock.location_id =
      '35000000-0000-4000-8000-000000000013'
  ),
  'MOVE-A:3,MOVE-B:2',
  'transfer increases exact shop quantities'
);
select extensions.is(
  (
    select string_agg(
      type::text || ':' || balance_ron,
      ','
      order by type
    )
    from public.inventory_location_balances
    where business_id = '35000000-0000-4000-8000-000000000011'
  ),
  'warehouse:100.00,shop:80.00',
  'location values include legacy and product transfers without changing total'
);
select extensions.is(
  (
    select product_line_count
    from public.inventory_transfer_summaries
    where notes = 'Product transfer'
  ),
  2,
  'transfer history exposes product-line count'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movements
    where reference_type = 'inventory_transfer'
      and reference_id = (
        select id
        from public.inventory_value_movements
        where notes = 'Product transfer'
      )
      and movement_type = 'transfer'
  ),
  2::bigint,
  'one immutable stock movement is linked to each transfer line'
);

select extensions.is(
  public.create_inventory_product_transfer(
    target_business_id => '35000000-0000-4000-8000-000000000011',
    target_business_day_id => '35000000-0000-4000-8000-000000000021',
    target_source_location_id => '35000000-0000-4000-8000-000000000012',
    target_destination_location_id => '35000000-0000-4000-8000-000000000013',
    target_idempotency_key => '35000000-0000-4000-8000-000000000063',
    target_lines => '[
      {
        "product_id":"35000000-0000-4000-8000-000000000051",
        "quantity":"3"
      },
      {
        "product_id":"35000000-0000-4000-8000-000000000052",
        "quantity":"2"
      }
    ]'::jsonb,
    target_notes => 'Product transfer'
  ),
  (
    select id
    from public.inventory_value_movements
    where notes = 'Product transfer'
  ),
  'identical retry returns the original transfer'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where notes = 'Product transfer'
  ),
  1::bigint,
  'identical retry does not duplicate value movement'
);
select extensions.throws_ok(
  $sql$
    select public.create_inventory_product_transfer(
      target_business_id =>
        '35000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '35000000-0000-4000-8000-000000000021',
      target_source_location_id =>
        '35000000-0000-4000-8000-000000000012',
      target_destination_location_id =>
        '35000000-0000-4000-8000-000000000013',
      target_idempotency_key =>
        '35000000-0000-4000-8000-000000000063',
      target_lines => '[
        {
          "product_id":"35000000-0000-4000-8000-000000000051",
          "quantity":"4"
        }
      ]'::jsonb,
      target_notes => 'Product transfer'
    )
  $sql$,
  '22023',
  'Transfer request identifier was reused with different data',
  'changed request cannot reuse transfer idempotency key'
);
select extensions.throws_ok(
  $sql$
    select public.create_inventory_product_transfer(
      target_business_id =>
        '35000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '35000000-0000-4000-8000-000000000021',
      target_source_location_id =>
        '35000000-0000-4000-8000-000000000012',
      target_destination_location_id =>
        '35000000-0000-4000-8000-000000000013',
      target_idempotency_key =>
        '35000000-0000-4000-8000-000000000064',
      target_lines => '[
        {
          "product_id":"35000000-0000-4000-8000-000000000051",
          "quantity":"8"
        }
      ]'::jsonb
    )
  $sql$,
  '22023',
  'Insufficient warehouse quantity for transfer line 1',
  'transfer rejects insufficient warehouse quantity'
);
select extensions.is(
  (
    select quantity
    from public.product_stock_by_location
    where product_id = '35000000-0000-4000-8000-000000000051'
      and location_id = '35000000-0000-4000-8000-000000000012'
  ),
  '7',
  'failed transfer leaves warehouse quantity unchanged'
);
select extensions.throws_ok(
  $sql$
    select public.create_inventory_product_transfer(
      target_business_id =>
        '35000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '35000000-0000-4000-8000-000000000021',
      target_source_location_id =>
        '35000000-0000-4000-8000-000000000012',
      target_destination_location_id =>
        '35000000-0000-4000-8000-000000000013',
      target_idempotency_key =>
        '35000000-0000-4000-8000-000000000065',
      target_lines => '[
        {
          "product_id":"35000000-0000-4000-8000-000000000051",
          "quantity":"1"
        },
        {
          "product_id":"35000000-0000-4000-8000-000000000051",
          "quantity":"1"
        }
      ]'::jsonb
    )
  $sql$,
  '22023',
  'Each product may appear only once per transfer',
  'duplicate transfer product is rejected'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where idempotency_key in (
      '35000000-0000-4000-8000-000000000064',
      '35000000-0000-4000-8000-000000000065'
    )
  ),
  0::bigint,
  'invalid multi-line transfers leave no partial value movement'
);

select extensions.lives_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '35000000-0000-4000-8000-000000000011',
      target_product_id =>
        '35000000-0000-4000-8000-000000000051',
      target_movement_type => 'damage',
      target_quantity => '3',
      target_reference_type => 'test_shop_damage',
      target_reference_id =>
        '35000000-0000-4000-8000-000000000071',
      target_idempotency_key =>
        '35000000-0000-4000-8000-000000000072',
      target_source_location_id =>
        '35000000-0000-4000-8000-000000000013',
      target_unit_cost_ron => '10',
      target_business_day_id =>
        '35000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'later shop activity can consume transferred pieces'
);

select set_config(
  'request.jwt.claim.sub',
  '35000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  $sql$
    select public.reverse_inventory_value_transfer(
      '35000000-0000-4000-8000-000000000011',
      (
        select id
        from public.inventory_value_movements
        where notes = 'Product transfer'
      ),
      'Product transfer was entered incorrectly',
      false
    )
  $sql$,
  '22023',
  'Reversal would make product quantity negative',
  'reversal rejects insufficient shop quantity'
);
select extensions.ok(
  not exists (
    select 1
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = (
      select id
      from public.inventory_value_movements
      where notes = 'Product transfer'
    )
  ),
  'failed reversal leaves value and quantities active'
);
select extensions.lives_ok(
  $sql$
    select public.reverse_inventory_value_transfer(
      '35000000-0000-4000-8000-000000000011',
      (
        select id
        from public.inventory_value_movements
        where notes = 'Product transfer'
      ),
      'Physical shop count confirms transferred stock is gone',
      true
    )
  $sql$,
  'administrator can document a negative-shop-stock override'
);
select extensions.is(
  (
    select string_agg(
      product.internal_code || ':' || stock.quantity,
      ','
      order by product.internal_code
    )
    from public.product_stock_by_location as stock
    inner join public.products as product
      on product.id = stock.product_id
    where stock.location_id =
      '35000000-0000-4000-8000-000000000012'
  ),
  'MOVE-A:10,MOVE-B:4',
  'reversal restores all warehouse quantities'
);
select extensions.is(
  (
    select string_agg(
      product.internal_code || ':' || stock.quantity,
      ','
      order by product.internal_code
    )
    from public.product_stock_by_location as stock
    inner join public.products as product
      on product.id = stock.product_id
    where stock.location_id =
      '35000000-0000-4000-8000-000000000013'
  ),
  'MOVE-A:-3,MOVE-B:0',
  'documented reversal exposes consumed shop stock'
);
select extensions.is(
  (
    select string_agg(
      type::text || ':' || balance_ron,
      ','
      order by type
    )
    from public.inventory_location_balances
    where business_id = '35000000-0000-4000-8000-000000000011'
  ),
  'warehouse:170.00,shop:10.00',
  'product reversal preserves the legacy value-only transfer'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movements
    where reversal_of_id in (
      select id
      from public.stock_movements
      where reference_type = 'inventory_transfer'
        and reference_id = (
          select id
          from public.inventory_value_movements
          where notes = 'Product transfer'
        )
    )
  ),
  2::bigint,
  'reversal links one immutable stock correction per product'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'stock_movement.negative_override_reversed'
      and reason =
        'Physical shop count confirms transferred stock is gone'
  ),
  1::bigint,
  'negative reversal override is audited with its reason'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'inventory_transfer.reversed'
      and entity_id = (
        select id
        from public.inventory_value_movements
        where notes = 'Product transfer'
      )
  ),
  1::bigint,
  'product transfer reversal is audited once'
);

select * from extensions.finish();

rollback;
