begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(19);

select extensions.ok(
  to_regprocedure('private.require_original_stock_cost()') is not null,
  'positive original stock-cost guard exists'
);
select extensions.ok(
  to_regclass('public.stock_movement_cost_details') is not null,
  'original-currency stock cost details exist'
);
select extensions.ok(
  to_regprocedure(
    'public.create_stock_movement_with_cost(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,text,public.transaction_currency,text,uuid,text,boolean,text)'
  ) is not null,
  'currency-aware stock movement RPC exists'
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
values (
  '00000000-0000-0000-0000-000000000000',
  '39000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'label-admin@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

insert into public.businesses (id, name, timezone, created_by)
values (
  '39000000-0000-4000-8000-000000000011',
  'Cost and Labels Business',
  'Europe/Bucharest',
  '39000000-0000-4000-8000-000000000001'
);
insert into public.business_members (business_id, user_id, role, is_active)
values (
  '39000000-0000-4000-8000-000000000011',
  '39000000-0000-4000-8000-000000000001',
  'admin',
  true
);
insert into public.inventory_locations (id, business_id, name, type)
values
  (
    '39000000-0000-4000-8000-000000000012',
    '39000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '39000000-0000-4000-8000-000000000013',
    '39000000-0000-4000-8000-000000000011',
    'Shop',
    'shop'
  );
insert into public.financial_accounts (id, business_id, name, type)
values (
  '39000000-0000-4000-8000-000000000014',
  '39000000-0000-4000-8000-000000000011',
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
  '39000000-0000-4000-8000-000000000021',
  '39000000-0000-4000-8000-000000000011',
  '2026-07-03',
  '39000000-0000-4000-8000-000000000001'
);
insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '39000000-0000-4000-8000-000000000041',
  '39000000-0000-4000-8000-000000000011',
  'Costed products',
  '39000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000001'
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
values (
  '39000000-0000-4000-8000-000000000051',
  '39000000-0000-4000-8000-000000000011',
  'COSTED',
  'Costed product',
  '39000000-0000-4000-8000-000000000041',
  '39000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '39000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_product_with_cost_currency(
      target_business_id => '39000000-0000-4000-8000-000000000011',
      target_internal_code => 'USD-COST',
      target_name => 'USD cost product',
      target_category_id => '39000000-0000-4000-8000-000000000041',
      target_default_purchase_cost => '2.00',
      target_default_purchase_currency => 'USD',
      target_default_purchase_exchange_rate => '4.50',
      target_default_selling_price_ron => '12.00'
    )
  $sql$,
  'product default USD price converts to RON'
);
select extensions.results_eq(
  $sql$
    select
      product.default_purchase_cost_original::text,
      product.default_purchase_currency::text,
      product.default_purchase_exchange_rate::text,
      product.default_purchase_cost_ron::text
    from public.products as product
    where product.business_id = '39000000-0000-4000-8000-000000000011'
      and product.internal_code = 'USD-COST'
  $sql$,
  $values$ values ('2.00', 'USD', '4.50000000', '9.00') $values$,
  'product retains original USD price, rate, and calculated RON cost'
);

select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id => '39000000-0000-4000-8000-000000000011',
      target_product_id => '39000000-0000-4000-8000-000000000051',
      target_movement_type => 'opening',
      target_quantity => '5',
      target_reference_type => 'manual_stock_entry',
      target_reference_id => '39000000-0000-4000-8000-000000000061',
      target_idempotency_key => '39000000-0000-4000-8000-000000000071',
      target_destination_location_id =>
        '39000000-0000-4000-8000-000000000013',
      target_unit_cost_ron => null,
      target_business_day_id => '39000000-0000-4000-8000-000000000021'
    )
  $sql$,
  '22023',
  'Original stock movements require a positive unit cost',
  'missing original stock cost is rejected'
);
select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id => '39000000-0000-4000-8000-000000000011',
      target_product_id => '39000000-0000-4000-8000-000000000051',
      target_movement_type => 'opening',
      target_quantity => '5',
      target_reference_type => 'manual_stock_entry',
      target_reference_id => '39000000-0000-4000-8000-000000000062',
      target_idempotency_key => '39000000-0000-4000-8000-000000000072',
      target_destination_location_id =>
        '39000000-0000-4000-8000-000000000013',
      target_unit_cost_ron => '0',
      target_business_day_id => '39000000-0000-4000-8000-000000000021'
    )
  $sql$,
  '22023',
  'Original stock movements require a positive unit cost',
  'zero original stock cost is rejected'
);
select extensions.lives_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id => '39000000-0000-4000-8000-000000000011',
      target_product_id => '39000000-0000-4000-8000-000000000051',
      target_movement_type => 'opening',
      target_quantity => '5',
      target_reference_type => 'manual_stock_entry',
      target_reference_id => '39000000-0000-4000-8000-000000000063',
      target_idempotency_key => '39000000-0000-4000-8000-000000000073',
      target_destination_location_id =>
        '39000000-0000-4000-8000-000000000013',
      target_unit_cost_ron => '2.00',
      target_business_day_id => '39000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'positive original stock cost is accepted'
);
select extensions.is(
  (
    select unit_cost_ron
    from public.stock_movement_summaries
    where reference_id = '39000000-0000-4000-8000-000000000063'
  ),
  '2.00000000',
  'stock history preserves positive unit cost'
);
select extensions.is(
  (
    select created_by_name
    from public.stock_movement_summaries
    where reference_id = '39000000-0000-4000-8000-000000000063'
  ),
  'Admin',
  'stock history falls back to administrator role'
);

select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where business_id = '39000000-0000-4000-8000-000000000011'
      and inventory_location_id =
        '39000000-0000-4000-8000-000000000013'
  ),
  '10.00',
  'manual product stock automatically mirrors its historical value'
);

select extensions.lives_ok(
  $sql$
    select public.create_stock_movement_with_cost(
      target_business_id => '39000000-0000-4000-8000-000000000011',
      target_product_id => '39000000-0000-4000-8000-000000000051',
      target_movement_type => 'opening',
      target_quantity => '4',
      target_reference_type => 'manual_stock_entry',
      target_reference_id => '39000000-0000-4000-8000-000000000064',
      target_idempotency_key => '39000000-0000-4000-8000-000000000074',
      target_destination_location_id =>
        '39000000-0000-4000-8000-000000000012',
      target_unit_cost => '1.00',
      target_unit_cost_currency => 'USD',
      target_exchange_rate => '4.50',
      target_business_day_id => '39000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'USD opening stock converts to historical RON cost'
);
select extensions.results_eq(
  $sql$
    select
      detail.cost_currency::text,
      detail.original_unit_cost::text,
      detail.exchange_rate::text,
      detail.cost_source
    from public.stock_movement_cost_details as detail
    inner join public.stock_movements as movement
      on movement.id = detail.stock_movement_id
    where movement.reference_id =
      '39000000-0000-4000-8000-000000000064'
  $sql$,
  $values$
    values ('USD', '1.00', '4.50000000', 'manual_purchase')
  $values$,
  'USD purchase price and exchange rate remain traceable'
);
select extensions.lives_ok(
  $sql$
    select public.create_stock_movement_with_cost(
      target_business_id => '39000000-0000-4000-8000-000000000011',
      target_product_id => '39000000-0000-4000-8000-000000000051',
      target_movement_type => 'transfer',
      target_quantity => '2',
      target_reference_type => 'manual_stock_entry',
      target_reference_id => '39000000-0000-4000-8000-000000000065',
      target_idempotency_key => '39000000-0000-4000-8000-000000000075',
      target_source_location_id =>
        '39000000-0000-4000-8000-000000000012',
      target_destination_location_id =>
        '39000000-0000-4000-8000-000000000013',
      target_business_day_id => '39000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'manual transfer derives cost without a typed price'
);
select extensions.is(
  (
    select unit_cost_ron
    from public.stock_movement_summaries
    where reference_id = '39000000-0000-4000-8000-000000000065'
  ),
  '4.50000000',
  'manual transfer preserves source weighted average cost'
);
select extensions.is(
  (
    select detail.cost_source
    from public.stock_movement_cost_details as detail
    inner join public.stock_movements as movement
      on movement.id = detail.stock_movement_id
    where movement.reference_id =
      '39000000-0000-4000-8000-000000000065'
  ),
  'source_weighted_average',
  'manual transfer records its automatic cost source'
);

select public.create_product_sale(
  target_business_id => '39000000-0000-4000-8000-000000000011',
  target_business_day_id => '39000000-0000-4000-8000-000000000021',
  target_shop_location_id => '39000000-0000-4000-8000-000000000013',
  target_cash_amount_ron => '3.00',
  target_bank_amount_ron => '0.00',
  target_credit_amount_ron => '0.00',
  target_idempotency_key => '39000000-0000-4000-8000-000000000081',
  target_lines => '[
    {
      "product_id":"39000000-0000-4000-8000-000000000051",
      "quantity":"1",
      "unit_selling_price_ron":"3.00"
    }
  ]'::jsonb,
  target_notes => 'Admin label sale'
);

select extensions.is(
  (
    select created_by_name
    from public.sale_summaries
    where notes = 'Admin label sale'
  ),
  'Admin',
  'sale history falls back to administrator role'
);
select extensions.is(
  (
    select created_by::text
    from public.sale_summaries
    where notes = 'Admin label sale'
  ),
  '39000000-0000-4000-8000-000000000001',
  'sale history retains exact authenticated creator'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movements
    where business_id = '39000000-0000-4000-8000-000000000011'
      and reversal_of_id is null
      and unit_cost_ron <= 0
  ),
  0::bigint,
  'no original zero-cost stock movement was recorded'
);

select * from extensions.finish();

rollback;
