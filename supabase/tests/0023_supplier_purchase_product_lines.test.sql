begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(36);

select extensions.ok(
  to_regclass('public.supplier_purchase_lines') is not null,
  'supplier purchase lines table exists'
);
select extensions.ok(
  to_regclass('public.supplier_purchase_line_summaries') is not null,
  'supplier purchase line summary view exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.supplier_purchase_lines'::regclass
  ),
  'supplier purchase lines use RLS'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.supplier_purchase_lines',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate purchase lines directly'
);
select extensions.ok(
  to_regprocedure(
    'public.create_supplier_purchase_with_lines_idempotent(uuid,uuid,uuid,text,text,uuid,uuid,jsonb,text,date,text)'
  ) is not null,
  'atomic product-line purchase RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_supplier_purchase_idempotent(uuid,uuid,uuid,text,text,text,uuid,uuid,text,date,text)'
  ) is not null,
  'legacy value-only purchase RPC remains available'
);
select extensions.ok(
  to_regprocedure(
    'public.reverse_supplier_purchase(uuid,uuid,text,boolean)'
  ) is not null,
  'supplier purchase reversal supports quantity protection'
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
    '34000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'line-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Line Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '34000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'line-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Line Employee"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values (
  '34000000-0000-4000-8000-000000000011',
  'Product Line Business',
  'Europe/Bucharest',
  '34000000-0000-4000-8000-000000000001'
);

insert into public.business_members (business_id, user_id, role, is_active)
values
  (
    '34000000-0000-4000-8000-000000000011',
    '34000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '34000000-0000-4000-8000-000000000011',
    '34000000-0000-4000-8000-000000000002',
    'employee',
    true
  );

insert into public.inventory_locations (id, business_id, name, type)
values
  (
    '34000000-0000-4000-8000-000000000012',
    '34000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '34000000-0000-4000-8000-000000000013',
    '34000000-0000-4000-8000-000000000011',
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
  '34000000-0000-4000-8000-000000000021',
  '34000000-0000-4000-8000-000000000011',
  '2026-07-03',
  '34000000-0000-4000-8000-000000000001'
);

insert into public.suppliers (
  id,
  business_id,
  name,
  default_currency,
  created_by
)
values (
  '34000000-0000-4000-8000-000000000031',
  '34000000-0000-4000-8000-000000000011',
  'Product Supplier',
  'USD',
  '34000000-0000-4000-8000-000000000001'
);

insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '34000000-0000-4000-8000-000000000041',
  '34000000-0000-4000-8000-000000000011',
  'Received products',
  '34000000-0000-4000-8000-000000000001',
  '34000000-0000-4000-8000-000000000001'
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
    '34000000-0000-4000-8000-000000000051',
    '34000000-0000-4000-8000-000000000011',
    'LINE-A',
    'Line product A',
    '34000000-0000-4000-8000-000000000041',
    '34000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001'
  ),
  (
    '34000000-0000-4000-8000-000000000052',
    '34000000-0000-4000-8000-000000000011',
    'LINE-B',
    'Line product B',
    '34000000-0000-4000-8000-000000000041',
    '34000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '34000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_supplier_purchase_idempotent(
      '34000000-0000-4000-8000-000000000011',
      '34000000-0000-4000-8000-000000000031',
      '34000000-0000-4000-8000-000000000021',
      'RON',
      '20.00',
      '',
      '34000000-0000-4000-8000-000000000012',
      '34000000-0000-4000-8000-000000000061',
      'Historical value-only API record'
    )
  $sql$,
  'legacy value-only purchase creation still works'
);
select extensions.is(
  (
    select record_mode || '|' || product_line_count
    from public.supplier_purchase_summaries
    where description = 'Historical value-only API record'
  ),
  'value_only|0',
  'legacy purchase remains visible without fabricated product lines'
);

select extensions.lives_ok(
  $sql$
    select public.create_supplier_purchase_with_lines_idempotent(
      target_business_id =>
        '34000000-0000-4000-8000-000000000011',
      target_supplier_id =>
        '34000000-0000-4000-8000-000000000031',
      target_business_day_id =>
        '34000000-0000-4000-8000-000000000021',
      target_currency => 'RON',
      target_purchase_exchange_rate => '',
      target_destination_location_id =>
        '34000000-0000-4000-8000-000000000012',
      target_idempotency_key =>
        '34000000-0000-4000-8000-000000000062',
      target_lines => '[
        {
          "product_id":"34000000-0000-4000-8000-000000000051",
          "quantity":"3",
          "unit_price_original_currency":"10.00"
        },
        {
          "product_id":"34000000-0000-4000-8000-000000000052",
          "quantity":"2",
          "unit_price_original_currency":"5.00"
        }
      ]'::jsonb,
      target_description => 'RON product delivery'
    )
  $sql$,
  'employee receives multiple RON products atomically'
);
select extensions.is(
  (
    select
      original_amount::text
      || '|'
      || inventory_cost_ron::text
      || '|'
      || record_mode
    from public.supplier_purchases
    where description = 'RON product delivery'
  ),
  '40.00|40.00|product_lines',
  'purchase total equals its product-line totals'
);
select extensions.is(
  (
    select
      count(*)::text
      || '|'
      || sum(quantity * unit_price_original_currency)::text
      || '|'
      || sum(line_total_ron)::text
    from public.supplier_purchase_lines
    where supplier_purchase_id = (
      select id
      from public.supplier_purchases
      where description = 'RON product delivery'
    )
  ),
  '2|40.00|40.00',
  'stored line totals reconcile to original and RON values'
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
      '34000000-0000-4000-8000-000000000012'
  ),
  'LINE-A:3,LINE-B:2',
  'receiving posts each quantity to the warehouse'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movements
    where reference_type = 'supplier_purchase'
      and reference_id = (
        select id
        from public.supplier_purchases
        where description = 'RON product delivery'
      )
      and movement_type = 'supplier_receipt'
  ),
  2::bigint,
  'one immutable stock receipt is linked to each product line'
);
select extensions.is(
  (
    select amount_ron::text
    from public.inventory_value_movements
    where source_entity_type = 'supplier_purchase'
      and source_entity_id = (
        select id
        from public.supplier_purchases
        where description = 'RON product delivery'
      )
      and movement_type = 'supplier_purchase_receipt'
  ),
  '40.00',
  'inventory value receipt equals historical line cost'
);
select extensions.is(
  (
    select product_line_count
    from public.supplier_purchase_summaries
    where description = 'RON product delivery'
  ),
  2,
  'backward-compatible purchase summary exposes line count'
);
select extensions.is(
  public.create_supplier_purchase_with_lines_idempotent(
    target_business_id =>
      '34000000-0000-4000-8000-000000000011',
    target_supplier_id =>
      '34000000-0000-4000-8000-000000000031',
    target_business_day_id =>
      '34000000-0000-4000-8000-000000000021',
    target_currency => 'RON',
    target_purchase_exchange_rate => '',
    target_destination_location_id =>
      '34000000-0000-4000-8000-000000000012',
    target_idempotency_key =>
      '34000000-0000-4000-8000-000000000062',
    target_lines => '[
      {
        "product_id":"34000000-0000-4000-8000-000000000051",
        "quantity":"3",
        "unit_price_original_currency":"10.00"
      },
      {
        "product_id":"34000000-0000-4000-8000-000000000052",
        "quantity":"2",
        "unit_price_original_currency":"5.00"
      }
    ]'::jsonb,
    target_description => 'RON product delivery'
  ),
  (
    select id
    from public.supplier_purchases
    where description = 'RON product delivery'
  ),
  'identical retry returns the original product purchase'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_purchases
    where description = 'RON product delivery'
  ),
  1::bigint,
  'identical retry does not duplicate the purchase'
);
select extensions.throws_ok(
  $sql$
    select public.create_supplier_purchase_with_lines_idempotent(
      target_business_id =>
        '34000000-0000-4000-8000-000000000011',
      target_supplier_id =>
        '34000000-0000-4000-8000-000000000031',
      target_business_day_id =>
        '34000000-0000-4000-8000-000000000021',
      target_currency => 'RON',
      target_purchase_exchange_rate => '',
      target_destination_location_id =>
        '34000000-0000-4000-8000-000000000012',
      target_idempotency_key =>
        '34000000-0000-4000-8000-000000000062',
      target_lines => '[
        {
          "product_id":"34000000-0000-4000-8000-000000000051",
          "quantity":"4",
          "unit_price_original_currency":"10.00"
        }
      ]'::jsonb,
      target_description => 'RON product delivery'
    )
  $sql$,
  '22023',
  'Purchase request identifier was reused with different data',
  'changed product lines cannot reuse an idempotency key'
);
select extensions.throws_ok(
  $sql$
    select public.create_supplier_purchase_with_lines_idempotent(
      target_business_id =>
        '34000000-0000-4000-8000-000000000011',
      target_supplier_id =>
        '34000000-0000-4000-8000-000000000031',
      target_business_day_id =>
        '34000000-0000-4000-8000-000000000021',
      target_currency => 'RON',
      target_purchase_exchange_rate => '',
      target_destination_location_id =>
        '34000000-0000-4000-8000-000000000012',
      target_idempotency_key =>
        '34000000-0000-4000-8000-000000000063',
      target_lines => '[
        {
          "product_id":"34000000-0000-4000-8000-000000000051",
          "quantity":"1",
          "unit_price_original_currency":"10.00"
        },
        {
          "product_id":"34000000-0000-4000-8000-000000000051",
          "quantity":"1",
          "unit_price_original_currency":"10.00"
        }
      ]'::jsonb
    )
  $sql$,
  '22023',
  'Each product may appear only once per purchase',
  'duplicate products are rejected'
);

select extensions.lives_ok(
  $sql$
    select public.create_supplier_purchase_with_lines_idempotent(
      target_business_id =>
        '34000000-0000-4000-8000-000000000011',
      target_supplier_id =>
        '34000000-0000-4000-8000-000000000031',
      target_business_day_id =>
        '34000000-0000-4000-8000-000000000021',
      target_currency => 'USD',
      target_purchase_exchange_rate => '1.5',
      target_destination_location_id =>
        '34000000-0000-4000-8000-000000000013',
      target_idempotency_key =>
        '34000000-0000-4000-8000-000000000064',
      target_lines => '[
        {
          "product_id":"34000000-0000-4000-8000-000000000051",
          "quantity":"3",
          "unit_price_original_currency":"0.01"
        },
        {
          "product_id":"34000000-0000-4000-8000-000000000052",
          "quantity":"1",
          "unit_price_original_currency":"0.01"
        }
      ]'::jsonb,
      target_description => 'USD rounding delivery'
    )
  $sql$,
  'USD product lines can be received directly into the shop'
);
select extensions.is(
  (
    select
      original_amount::text
      || '|'
      || inventory_cost_ron::text
      || '|'
      || purchase_exchange_rate::text
    from public.supplier_purchases
    where description = 'USD rounding delivery'
  ),
  '0.04|0.07|1.50000000',
  'USD inventory value uses the sum of historical line costs'
);
select extensions.is(
  (
    select sum(line_total_ron)::text
    from public.supplier_purchase_lines
    where supplier_purchase_id = (
      select id
      from public.supplier_purchases
      where description = 'USD rounding delivery'
    )
  ),
  '0.07',
  'line-level USD rounding reconciles exactly to inventory value'
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
      '34000000-0000-4000-8000-000000000013'
  ),
  'LINE-A:3,LINE-B:1',
  'USD receipt posts exact shop quantities'
);

select set_config(
  'request.jwt.claim.sub',
  '34000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.reverse_supplier_purchase(
      '34000000-0000-4000-8000-000000000011',
      (
        select id
        from public.supplier_purchases
        where description = 'RON product delivery'
      ),
      'Duplicate RON product invoice entered',
      false
    )
  $sql$,
  'administrator reverses payable, value, and quantities together'
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
      '34000000-0000-4000-8000-000000000012'
  ),
  'LINE-A:0,LINE-B:0',
  'purchase reversal removes warehouse quantities'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id =
      '34000000-0000-4000-8000-000000000012'
  ),
  '20.00',
  'reversal preserves legacy value-only inventory'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movements
    where reversal_of_id in (
      select id
      from public.stock_movements
      where reference_type = 'supplier_purchase'
        and reference_id = (
          select id
          from public.supplier_purchases
          where description = 'RON product delivery'
        )
    )
  ),
  2::bigint,
  'each product receipt receives a linked reversal'
);

select extensions.lives_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '34000000-0000-4000-8000-000000000011',
      target_product_id =>
        '34000000-0000-4000-8000-000000000051',
      target_movement_type => 'damage',
      target_quantity => '3',
      target_reference_type => 'test_damage',
      target_reference_id =>
        '34000000-0000-4000-8000-000000000071',
      target_idempotency_key =>
        '34000000-0000-4000-8000-000000000072',
      target_source_location_id =>
        '34000000-0000-4000-8000-000000000013',
      target_business_day_id =>
        '34000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'later stock use can consume received pieces'
);
select extensions.throws_ok(
  $sql$
    select public.reverse_supplier_purchase(
      '34000000-0000-4000-8000-000000000011',
      (
        select id
        from public.supplier_purchases
        where description = 'USD rounding delivery'
      ),
      'USD product invoice must be removed',
      false
    )
  $sql$,
  '22023',
  'Reversal would make product quantity negative',
  'purchase reversal rejects negative product stock by default'
);
select extensions.ok(
  (
    select reversed_at is null
    from public.supplier_purchases
    where description = 'USD rounding delivery'
  ),
  'failed quantity reversal leaves the purchase active'
);
select extensions.lives_ok(
  $sql$
    select public.reverse_supplier_purchase(
      '34000000-0000-4000-8000-000000000011',
      (
        select id
        from public.supplier_purchases
        where description = 'USD rounding delivery'
      ),
      'Physical count confirms received stock is gone',
      true
    )
  $sql$,
  'administrator can document a negative-stock reversal override'
);
select extensions.is(
  (
    select quantity
    from public.product_stock_by_location
    where product_id =
      '34000000-0000-4000-8000-000000000051'
      and location_id =
        '34000000-0000-4000-8000-000000000013'
  ),
  '-3',
  'documented reversal override exposes the negative quantity'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'stock_movement.negative_override_reversed'
      and reason = 'Physical count confirms received stock is gone'
  ),
  1::bigint,
  'negative purchase reversal creates a reasoned stock audit event'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_payable_balances
    where supplier_id =
      '34000000-0000-4000-8000-000000000031'
      and currency = 'USD'
  ),
  0::bigint,
  'successful reversal removes the USD payable'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier_purchase.reversed'
      and entity_id = (
        select id
        from public.supplier_purchases
        where description = 'USD rounding delivery'
      )
  ),
  1::bigint,
  'supplier purchase reversal is audited once'
);

select * from extensions.finish();

rollback;
