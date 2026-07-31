begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(23);

select extensions.ok(
  to_regclass('public.product_stock_thresholds') is not null,
  'product stock thresholds table exists'
);
select extensions.ok(
  to_regclass('public.product_inventory_analysis_current') is not null,
  'current product inventory analysis view exists'
);
select extensions.ok(
  to_regclass('public.product_sales_daily_analysis') is not null,
  'daily product sales analysis view exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.product_stock_thresholds'::regclass
  ),
  'stock thresholds use RLS'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.product_stock_thresholds',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate thresholds directly'
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
    '38000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'analysis-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Analysis Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '38000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'analysis-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Analysis Employee"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values (
  '38000000-0000-4000-8000-000000000011',
  'Inventory Analysis Business',
  'Europe/Bucharest',
  '38000000-0000-4000-8000-000000000001'
);

insert into public.business_members (business_id, user_id, role, is_active)
values
  (
    '38000000-0000-4000-8000-000000000011',
    '38000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '38000000-0000-4000-8000-000000000011',
    '38000000-0000-4000-8000-000000000002',
    'employee',
    true
  );

insert into public.inventory_locations (id, business_id, name, type)
values
  (
    '38000000-0000-4000-8000-000000000012',
    '38000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '38000000-0000-4000-8000-000000000013',
    '38000000-0000-4000-8000-000000000011',
    'Shop',
    'shop'
  );

insert into public.financial_accounts (id, business_id, name, type)
values (
  '38000000-0000-4000-8000-000000000014',
  '38000000-0000-4000-8000-000000000011',
  'Cash',
  'cash'
);

insert into public.business_days (
  id,
  business_id,
  business_date,
  opened_by
)
values (
  '38000000-0000-4000-8000-000000000021',
  '38000000-0000-4000-8000-000000000011',
  '2026-07-03',
  '38000000-0000-4000-8000-000000000001'
);

insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '38000000-0000-4000-8000-000000000041',
  '38000000-0000-4000-8000-000000000011',
  'Analysis products',
  '38000000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000001'
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
    '38000000-0000-4000-8000-000000000051',
    '38000000-0000-4000-8000-000000000011',
    'FAST-A',
    'Fast product',
    '38000000-0000-4000-8000-000000000041',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000001'
  ),
  (
    '38000000-0000-4000-8000-000000000052',
    '38000000-0000-4000-8000-000000000011',
    'SLOW-B',
    'Slow product',
    '38000000-0000-4000-8000-000000000041',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-4000-8000-000000000001',
  true
);

select public.create_stock_movement_with_cost(
  target_business_id => '38000000-0000-4000-8000-000000000011',
  target_product_id => '38000000-0000-4000-8000-000000000051',
  target_movement_type => 'opening',
  target_quantity => '10',
  target_reference_type => 'analysis_setup',
  target_reference_id => '38000000-0000-4000-8000-000000000061',
  target_idempotency_key => '38000000-0000-4000-8000-000000000071',
  target_destination_location_id =>
    '38000000-0000-4000-8000-000000000013',
  target_unit_cost => '4.00',
  target_unit_cost_currency => 'RON',
  target_exchange_rate => '4.00000000',
  target_business_day_id => '38000000-0000-4000-8000-000000000021',
  target_notes => 'Fast product opening'
);
select public.create_stock_movement_with_cost(
  target_business_id => '38000000-0000-4000-8000-000000000011',
  target_product_id => '38000000-0000-4000-8000-000000000052',
  target_movement_type => 'opening',
  target_quantity => '5',
  target_reference_type => 'analysis_setup',
  target_reference_id => '38000000-0000-4000-8000-000000000062',
  target_idempotency_key => '38000000-0000-4000-8000-000000000072',
  target_destination_location_id =>
    '38000000-0000-4000-8000-000000000013',
  target_unit_cost => '10.00',
  target_unit_cost_currency => 'RON',
  target_exchange_rate => '4.00000000',
  target_business_day_id => '38000000-0000-4000-8000-000000000021',
  target_notes => 'Slow product opening'
);

reset role;
insert into public.inventory_value_movements (
  business_id,
  business_day_id,
  movement_date,
  movement_type,
  destination_location_id,
  amount_ron,
  source_entity_type,
  source_entity_id,
  notes,
  entry_origin,
  created_by
)
values
  (
    '38000000-0000-4000-8000-000000000011',
    '38000000-0000-4000-8000-000000000021',
    '2026-07-03',
    'analysis_setup',
    '38000000-0000-4000-8000-000000000013',
    40.00,
    'analysis_setup',
    '38000000-0000-4000-8000-000000000061',
    'Fast product opening value',
    'operational',
    '38000000-0000-4000-8000-000000000001'
  ),
  (
    '38000000-0000-4000-8000-000000000011',
    '38000000-0000-4000-8000-000000000021',
    '2026-07-03',
    'analysis_setup',
    '38000000-0000-4000-8000-000000000013',
    50.00,
    'analysis_setup',
    '38000000-0000-4000-8000-000000000062',
    'Slow product opening value',
    'operational',
    '38000000-0000-4000-8000-000000000001'
  );
set local role authenticated;

select public.create_product_sale(
  target_business_id => '38000000-0000-4000-8000-000000000011',
  target_business_day_id => '38000000-0000-4000-8000-000000000021',
  target_shop_location_id => '38000000-0000-4000-8000-000000000013',
  target_cash_amount_ron => '36.00',
  target_bank_amount_ron => '0.00',
  target_credit_amount_ron => '0.00',
  target_idempotency_key => '38000000-0000-4000-8000-000000000081',
  target_lines => '[
    {
      "product_id":"38000000-0000-4000-8000-000000000051",
      "quantity":"4",
      "unit_selling_price_ron":"6.00"
    },
    {
      "product_id":"38000000-0000-4000-8000-000000000052",
      "quantity":"1",
      "unit_selling_price_ron":"12.00"
    }
  ]'::jsonb,
  target_notes => 'Analysis sale'
);

select public.create_sale_return(
  '38000000-0000-4000-8000-000000000011',
  '38000000-0000-4000-8000-000000000021',
  (select id from public.sales where notes = 'Analysis sale'),
  '18.00',
  '0.00',
  '0.00',
  '38000000-0000-4000-8000-000000000082',
  (
    select jsonb_agg(
      jsonb_build_object(
        'sale_line_id', id,
        'quantity', '1',
        'disposition',
          case when product_id =
            '38000000-0000-4000-8000-000000000051'
            then 'damaged' else 'sellable' end
      )
      order by line_number
    )
    from public.sale_lines
    where sale_id = (
      select id from public.sales where notes = 'Analysis sale'
    )
  ),
  'One damaged return and one sellable return'
);

select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  $sql$
    select public.set_product_stock_threshold(
      '38000000-0000-4000-8000-000000000011',
      '38000000-0000-4000-8000-000000000051',
      '38000000-0000-4000-8000-000000000013',
      '7'
    )
  $sql$,
  '42501',
  'Administrator access is required',
  'employee cannot change low-stock threshold'
);

select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.set_product_stock_threshold(
      '38000000-0000-4000-8000-000000000011',
      '38000000-0000-4000-8000-000000000051',
      '38000000-0000-4000-8000-000000000013',
      '7'
    )
  $sql$,
  'administrator sets location-specific threshold'
);
select extensions.lives_ok(
  $sql$
    select public.set_product_stock_threshold(
      '38000000-0000-4000-8000-000000000011',
      '38000000-0000-4000-8000-000000000052',
      '38000000-0000-4000-8000-000000000013',
      '4'
    )
  $sql$,
  'administrator sets another product threshold'
);
select extensions.is(
  (
    select quantity || '|' || minimum_quantity || '|' || is_low_stock::text
    from public.product_inventory_analysis_current
    where product_id = '38000000-0000-4000-8000-000000000051'
      and location_id = '38000000-0000-4000-8000-000000000013'
  ),
  '6|7|true',
  'current analysis flags quantity at or below threshold'
);
select extensions.is(
  (
    select quantity || '|' || minimum_quantity || '|' || is_low_stock::text
    from public.product_inventory_analysis_current
    where product_id = '38000000-0000-4000-8000-000000000052'
      and location_id = '38000000-0000-4000-8000-000000000013'
  ),
  '5|4|false',
  'current analysis leaves adequate stock unflagged'
);
select extensions.is(
  (
    select inventory_value_ron || '|' || average_unit_cost_ron
    from public.product_inventory_analysis_current
    where product_id = '38000000-0000-4000-8000-000000000051'
      and location_id = '38000000-0000-4000-8000-000000000013'
  ),
  '24.00000000|4.00000000',
  'current analysis retains weighted historical inventory value'
);
select extensions.is(
  (
    select
      sold_quantity || '|' || returned_quantity || '|' || net_quantity
      || '|' || gross_sales_ron || '|' || refunds_ron
      || '|' || net_revenue_ron || '|' || historical_cost_ron
      || '|' || gross_margin_ron || '|' || gross_margin_percent
    from public.product_sales_daily_analysis
    where product_id = '38000000-0000-4000-8000-000000000051'
  ),
  '4|1|3|24.00|6.00|18.00|16.00|2.00|11.1111',
  'damaged return reduces revenue but keeps historical cost as loss'
);
select extensions.is(
  (
    select
      sold_quantity || '|' || returned_quantity || '|' || net_quantity
      || '|' || net_revenue_ron || '|' || historical_cost_ron
      || '|' || gross_margin_ron
    from public.product_sales_daily_analysis
    where product_id = '38000000-0000-4000-8000-000000000052'
  ),
  '1|1|0|0.00|0.00|0.00',
  'sellable return reverses revenue and historical cost'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movement_summaries
    where business_id = '38000000-0000-4000-8000-000000000011'
      and business_date = '2026-07-03'
  ),
  5::bigint,
  'movement history contains openings, sales, and sellable return'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where business_id = '38000000-0000-4000-8000-000000000011'
      and action = 'product_stock_threshold.set'
  ),
  2::bigint,
  'threshold changes are audited'
);
select extensions.lives_ok(
  $sql$
    select public.set_product_stock_threshold(
      '38000000-0000-4000-8000-000000000011',
      '38000000-0000-4000-8000-000000000051',
      '38000000-0000-4000-8000-000000000013',
      '0'
    )
  $sql$,
  'zero disables low-stock alert without deleting history'
);
select extensions.is(
  (
    select minimum_quantity || '|' || is_low_stock::text
    from public.product_inventory_analysis_current
    where product_id = '38000000-0000-4000-8000-000000000051'
      and location_id = '38000000-0000-4000-8000-000000000013'
  ),
  '0|false',
  'zero threshold disables alert'
);
select extensions.throws_ok(
  $sql$
    select public.set_product_stock_threshold(
      '38000000-0000-4000-8000-000000000011',
      '38000000-0000-4000-8000-000000000051',
      '38000000-0000-4000-8000-000000000013',
      '-1'
    )
  $sql$,
  '22023',
  'Minimum quantity must be a non-negative whole number',
  'negative threshold is rejected'
);
select extensions.is(
  (
    select count(*)
    from public.product_sales_daily_analysis
    where business_id = '38000000-0000-4000-8000-000000000011'
      and activity_date between '2026-07-01' and '2026-07-31'
  ),
  2::bigint,
  'date-filterable product analysis has one row per product and day'
);
select extensions.ok(
  has_table_privilege(
    'authenticated',
    'public.product_inventory_analysis_current',
    'SELECT'
  )
  and has_table_privilege(
    'authenticated',
    'public.product_sales_daily_analysis',
    'SELECT'
  ),
  'authenticated members can read inventory analysis views'
);
select extensions.ok(
  to_regprocedure(
    'public.set_product_stock_threshold(uuid,uuid,uuid,text)'
  ) is not null,
  'threshold command exists'
);
select extensions.is(
  (
    select count(*)
    from public.product_stock_thresholds
    where business_id = '38000000-0000-4000-8000-000000000011'
  ),
  2::bigint,
  'threshold updates preserve one row per product and location'
);
select extensions.is(
  (
    select count(*)
    from public.damaged_stock_balances
    where business_id = '38000000-0000-4000-8000-000000000011'
      and damaged_quantity::bigint > 0
  ),
  1::bigint,
  'inventory analysis remains linked to damaged stock tracking'
);

select * from extensions.finish();

rollback;
