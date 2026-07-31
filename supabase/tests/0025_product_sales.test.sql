begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(44);

select extensions.ok(
  to_regclass('public.sales') is not null,
  'sales table exists'
);
select extensions.ok(
  to_regclass('public.sale_lines') is not null,
  'sale lines table exists'
);
select extensions.ok(
  to_regclass('public.product_stock_valuation_by_location') is not null,
  'weighted product valuation view exists'
);
select extensions.ok(
  to_regclass('public.daily_product_sales_summaries') is not null,
  'daily product profit view exists'
);
select extensions.ok(
  (
    select bool_and(relation.relrowsecurity)
    from pg_catalog.pg_class as relation
    where relation.oid in (
      'public.sales'::regclass,
      'public.sale_lines'::regclass
    )
  ),
  'sales and lines use RLS'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.sales',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate sales directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.sale_lines',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate sale lines directly'
);
select extensions.ok(
  to_regprocedure(
    'public.create_product_sale(uuid,uuid,uuid,text,text,text,uuid,jsonb,uuid,text)'
  ) is not null,
  'atomic product sale RPC exists'
);
select extensions.ok(
  to_regprocedure('public.reverse_product_sale(uuid,uuid,text)')
    is not null,
  'administrator product sale reversal exists'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.upsert_daily_sales_draft(uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'employees cannot overwrite product-derived daily totals'
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
    '36000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'sales-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sales Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '36000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'sales-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sales Employee"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values (
  '36000000-0000-4000-8000-000000000011',
  'Product Sales Business',
  'Europe/Bucharest',
  '36000000-0000-4000-8000-000000000001'
);

insert into public.business_members (business_id, user_id, role, is_active)
values
  (
    '36000000-0000-4000-8000-000000000011',
    '36000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '36000000-0000-4000-8000-000000000011',
    '36000000-0000-4000-8000-000000000002',
    'employee',
    true
  );

insert into public.inventory_locations (id, business_id, name, type)
values
  (
    '36000000-0000-4000-8000-000000000012',
    '36000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '36000000-0000-4000-8000-000000000013',
    '36000000-0000-4000-8000-000000000011',
    'Shop',
    'shop'
  );

insert into public.financial_accounts (
  id,
  business_id,
  name,
  type
)
values
  (
    '36000000-0000-4000-8000-000000000014',
    '36000000-0000-4000-8000-000000000011',
    'Cash',
    'cash'
  ),
  (
    '36000000-0000-4000-8000-000000000015',
    '36000000-0000-4000-8000-000000000011',
    'Bank',
    'bank'
  );

insert into public.business_days (
  id,
  business_id,
  business_date,
  opened_by
)
values (
  '36000000-0000-4000-8000-000000000021',
  '36000000-0000-4000-8000-000000000011',
  '2026-07-03',
  '36000000-0000-4000-8000-000000000001'
);

insert into public.suppliers (
  id,
  business_id,
  name,
  default_currency,
  created_by
)
values (
  '36000000-0000-4000-8000-000000000031',
  '36000000-0000-4000-8000-000000000011',
  'Sales Stock Supplier',
  'USD',
  '36000000-0000-4000-8000-000000000001'
);

insert into public.customers (
  id,
  business_id,
  name,
  created_by
)
values
  (
    '36000000-0000-4000-8000-000000000032',
    '36000000-0000-4000-8000-000000000011',
    'Credit Customer',
    '36000000-0000-4000-8000-000000000001'
  ),
  (
    '36000000-0000-4000-8000-000000000033',
    '36000000-0000-4000-8000-000000000011',
    'Other Customer',
    '36000000-0000-4000-8000-000000000001'
  );

insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '36000000-0000-4000-8000-000000000041',
  '36000000-0000-4000-8000-000000000011',
  'Sale products',
  '36000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001'
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
    '36000000-0000-4000-8000-000000000051',
    '36000000-0000-4000-8000-000000000011',
    'AVG-USD',
    'Weighted USD product',
    '36000000-0000-4000-8000-000000000041',
    '36000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000001'
  ),
  (
    '36000000-0000-4000-8000-000000000052',
    '36000000-0000-4000-8000-000000000011',
    'FLEX-PRICE',
    'Flexible price product',
    '36000000-0000-4000-8000-000000000041',
    '36000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '36000000-0000-4000-8000-000000000002',
  true
);

select public.create_supplier_purchase_with_lines_idempotent(
  target_business_id => '36000000-0000-4000-8000-000000000011',
  target_supplier_id => '36000000-0000-4000-8000-000000000031',
  target_business_day_id => '36000000-0000-4000-8000-000000000021',
  target_currency => 'USD',
  target_purchase_exchange_rate => '4.4',
  target_destination_location_id =>
    '36000000-0000-4000-8000-000000000013',
  target_idempotency_key => '36000000-0000-4000-8000-000000000061',
  target_lines => '[
    {
      "product_id":"36000000-0000-4000-8000-000000000051",
      "quantity":"3",
      "unit_price_original_currency":"1.00"
    }
  ]'::jsonb
);

select public.create_supplier_purchase_with_lines_idempotent(
  target_business_id => '36000000-0000-4000-8000-000000000011',
  target_supplier_id => '36000000-0000-4000-8000-000000000031',
  target_business_day_id => '36000000-0000-4000-8000-000000000021',
  target_currency => 'USD',
  target_purchase_exchange_rate => '4.5',
  target_destination_location_id =>
    '36000000-0000-4000-8000-000000000013',
  target_idempotency_key => '36000000-0000-4000-8000-000000000062',
  target_lines => '[
    {
      "product_id":"36000000-0000-4000-8000-000000000051",
      "quantity":"2",
      "unit_price_original_currency":"1.00"
    }
  ]'::jsonb
);

select public.create_supplier_purchase_with_lines_idempotent(
  target_business_id => '36000000-0000-4000-8000-000000000011',
  target_supplier_id => '36000000-0000-4000-8000-000000000031',
  target_business_day_id => '36000000-0000-4000-8000-000000000021',
  target_currency => 'RON',
  target_purchase_exchange_rate => '',
  target_destination_location_id =>
    '36000000-0000-4000-8000-000000000013',
  target_idempotency_key => '36000000-0000-4000-8000-000000000063',
  target_lines => '[
    {
      "product_id":"36000000-0000-4000-8000-000000000052",
      "quantity":"4",
      "unit_price_original_currency":"10.00"
    }
  ]'::jsonb
);

select extensions.is(
  (
    select quantity || '|' || average_unit_cost_ron || '|' || inventory_value_ron
    from public.product_stock_valuation_by_location
    where product_id = '36000000-0000-4000-8000-000000000051'
      and location_id = '36000000-0000-4000-8000-000000000013'
  ),
  '5|4.44000000|22.20000000',
  'different USD rates produce exact weighted average RON cost'
);
select extensions.is(
  (
    select average_unit_cost_ron
    from public.product_stock_valuation_by_location
    where product_id = '36000000-0000-4000-8000-000000000052'
      and location_id = '36000000-0000-4000-8000-000000000013'
  ),
  '10.00000000',
  'RON purchase establishes product unit cost'
);

select extensions.lives_ok(
  $sql$
    select public.create_product_sale(
      target_business_id =>
        '36000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '36000000-0000-4000-8000-000000000021',
      target_shop_location_id =>
        '36000000-0000-4000-8000-000000000013',
      target_customer_id =>
        '36000000-0000-4000-8000-000000000032',
      target_cash_amount_ron => '10.00',
      target_bank_amount_ron => '5.00',
      target_credit_amount_ron => '8.00',
      target_idempotency_key =>
        '36000000-0000-4000-8000-000000000071',
      target_lines => '[
        {
          "product_id":"36000000-0000-4000-8000-000000000051",
          "quantity":"2",
          "unit_selling_price_ron":"6.00"
        },
        {
          "product_id":"36000000-0000-4000-8000-000000000052",
          "quantity":"1",
          "unit_selling_price_ron":"11.00"
        }
      ]'::jsonb,
      target_notes => 'Mixed payment sale'
    )
  $sql$,
  'employee records a mixed-payment multi-product sale'
);
select extensions.is(
  (
    select
      total_amount_ron
      || '|'
      || total_cost_ron
      || '|'
      || gross_profit_ron
      || '|'
      || profit_percent
    from public.sale_summaries
    where notes = 'Mixed payment sale'
  ),
  '23.00|18.88|4.12|21.8220',
  'sale stores exact revenue, cost, profit, and profit-on-cost percent'
);
select extensions.is(
  (
    select string_agg(
      product_code
        || ':'
        || quantity
        || '@'
        || unit_selling_price_ron
        || ':'
        || gross_profit_ron,
      ','
      order by line_number
    )
    from public.sale_line_summaries
    where sale_id = (
      select sale_id
      from public.sale_summaries
      where notes = 'Mixed payment sale'
    )
  ),
  'AVG-USD:2@6.00:3.12,FLEX-PRICE:1@11.00:1.00',
  'each sale line preserves its manual selling price and profit'
);
select extensions.is(
  (
    select
      cash_amount_ron
      || '|'
      || bank_amount_ron
      || '|'
      || credit_amount_ron
    from public.sale_summaries
    where notes = 'Mixed payment sale'
  ),
  '10.00|5.00|8.00',
  'sale preserves its mixed payment split'
);
select extensions.is(
  (
    select
      customer_id::text
      || '|'
      || amount_ron::text
      || '|'
      || sale_id::text
    from public.customer_credit_purchases
    where sale_id = (
      select id
      from public.sales
      where notes = 'Mixed payment sale'
    )
  ),
  (
    select
      '36000000-0000-4000-8000-000000000032|8.00|'
      || id::text
    from public.sales
    where notes = 'Mixed payment sale'
  ),
  'credit split creates one linked customer receivable'
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
      '36000000-0000-4000-8000-000000000013'
  ),
  'AVG-USD:3,FLEX-PRICE:3',
  'sale atomically deducts exact shop quantities'
);
select extensions.is(
  (
    select amount_ron::text
    from public.inventory_value_movements
    where source_entity_type = 'product_sale'
      and source_entity_id = (
        select id
        from public.sales
        where notes = 'Mixed payment sale'
      )
  ),
  '18.88',
  'sale removes exact historical product cost from inventory value'
);
select extensions.is(
  (
    select
      cash_sales_ron::text
      || '|'
      || bank_sales_ron::text
      || '|'
      || credit_sales_ron::text
      || '|'
      || total_sales_ron::text
    from public.daily_sales
    where business_day_id =
      '36000000-0000-4000-8000-000000000021'
  ),
  '10.00|5.00|8.00|23.00',
  'individual sale updates automatic daily totals'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  0::bigint,
  'cash and bank are not duplicated before automatic day close'
);

select extensions.lives_ok(
  $sql$
    select public.create_product_sale(
      target_business_id =>
        '36000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '36000000-0000-4000-8000-000000000021',
      target_shop_location_id =>
        '36000000-0000-4000-8000-000000000013',
      target_customer_id => null,
      target_cash_amount_ron => '12.00',
      target_bank_amount_ron => '0.00',
      target_credit_amount_ron => '0.00',
      target_idempotency_key =>
        '36000000-0000-4000-8000-000000000072',
      target_lines => '[
        {
          "product_id":"36000000-0000-4000-8000-000000000052",
          "quantity":"1",
          "unit_selling_price_ron":"12.00"
        }
      ]'::jsonb,
      target_notes => 'Different price sale'
    )
  $sql$,
  'same product can be sold later at a different customer price'
);
select extensions.is(
  (
    select string_agg(
      line.unit_selling_price_ron,
      ','
      order by sale.sale_number
    )
    from public.sale_line_summaries as line
    inner join public.sales as sale
      on sale.id = line.sale_id
    where line.product_id = '36000000-0000-4000-8000-000000000052'
  ),
  '11.00,12.00',
  'separate sales preserve different selling prices'
);
select extensions.is(
  (
    select
      sale_count::text
      || '|'
      || total_amount_ron
      || '|'
      || total_cost_ron
      || '|'
      || gross_profit_ron
      || '|'
      || profit_percent
    from public.daily_product_sales_summaries
    where business_day_id =
      '36000000-0000-4000-8000-000000000021'
  ),
  '2|35.00|28.88|6.12|21.1911',
  'daily summary calculates exact total profit and percent'
);
select extensions.is(
  public.create_product_sale(
    target_business_id => '36000000-0000-4000-8000-000000000011',
    target_business_day_id => '36000000-0000-4000-8000-000000000021',
    target_shop_location_id => '36000000-0000-4000-8000-000000000013',
    target_customer_id => null,
    target_cash_amount_ron => '12.00',
    target_bank_amount_ron => '0.00',
    target_credit_amount_ron => '0.00',
    target_idempotency_key => '36000000-0000-4000-8000-000000000072',
    target_lines => '[
      {
        "product_id":"36000000-0000-4000-8000-000000000052",
        "quantity":"1",
        "unit_selling_price_ron":"12.00"
      }
    ]'::jsonb,
    target_notes => 'Different price sale'
  ),
  (
    select id
    from public.sales
    where notes = 'Different price sale'
  ),
  'identical retry returns the original sale'
);
select extensions.is(
  (select count(*) from public.sales),
  2::bigint,
  'identical retry does not duplicate a sale'
);
select extensions.throws_ok(
  $sql$
    select public.create_product_sale(
      target_business_id =>
        '36000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '36000000-0000-4000-8000-000000000021',
      target_shop_location_id =>
        '36000000-0000-4000-8000-000000000013',
      target_customer_id => null,
      target_cash_amount_ron => '13.00',
      target_bank_amount_ron => '0.00',
      target_credit_amount_ron => '0.00',
      target_idempotency_key =>
        '36000000-0000-4000-8000-000000000072',
      target_lines => '[
        {
          "product_id":"36000000-0000-4000-8000-000000000052",
          "quantity":"1",
          "unit_selling_price_ron":"13.00"
        }
      ]'::jsonb
    )
  $sql$,
  '22023',
  'Sale request identifier was reused with different data',
  'changed sale cannot reuse its request key'
);
select extensions.throws_ok(
  $sql$
    select public.create_product_sale(
      target_business_id =>
        '36000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '36000000-0000-4000-8000-000000000021',
      target_shop_location_id =>
        '36000000-0000-4000-8000-000000000013',
      target_customer_id => null,
      target_cash_amount_ron => '60.00',
      target_bank_amount_ron => '0.00',
      target_credit_amount_ron => '0.00',
      target_idempotency_key =>
        '36000000-0000-4000-8000-000000000073',
      target_lines => '[
        {
          "product_id":"36000000-0000-4000-8000-000000000051",
          "quantity":"10",
          "unit_selling_price_ron":"6.00"
        }
      ]'::jsonb
    )
  $sql$,
  '22023',
  'Insufficient shop quantity for sale line 1',
  'sale rejects insufficient shop stock'
);
select extensions.throws_ok(
  $sql$
    select public.create_product_sale(
      target_business_id =>
        '36000000-0000-4000-8000-000000000011',
      target_business_day_id =>
        '36000000-0000-4000-8000-000000000021',
      target_shop_location_id =>
        '36000000-0000-4000-8000-000000000013',
      target_customer_id => null,
      target_cash_amount_ron => '1.00',
      target_bank_amount_ron => '0.00',
      target_credit_amount_ron => '0.00',
      target_idempotency_key =>
        '36000000-0000-4000-8000-000000000074',
      target_lines => '[
        {
          "product_id":"36000000-0000-4000-8000-000000000051",
          "quantity":"1",
          "unit_selling_price_ron":"6.00"
        }
      ]'::jsonb
    )
  $sql$,
  '22023',
  'Payment split must equal the sale total',
  'sale rejects an unreconciled payment split'
);
select extensions.is(
  (select count(*) from public.sales),
  2::bigint,
  'failed sales leave no partial sale rows'
);

select extensions.throws_ok(
  $sql$
    select public.reverse_product_sale(
      '36000000-0000-4000-8000-000000000011',
      (
        select id
        from public.sales
        where notes = 'Different price sale'
      ),
      'Employee cannot reverse this sale'
    )
  $sql$,
  '42501',
  'Administrator access is required',
  'employee cannot remove a sale'
);
select extensions.throws_ok(
  $sql$
    update public.sales
    set cash_amount_ron = 0
    where notes = 'Different price sale'
  $sql$,
  '42501',
  null,
  'employee cannot edit a sale even while the day is open'
);

select set_config(
  'request.jwt.claim.sub',
  '36000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.reverse_product_sale(
      '36000000-0000-4000-8000-000000000011',
      (
        select id
        from public.sales
        where notes = 'Different price sale'
      ),
      'Wrong selling price entered for this sale'
    )
  $sql$,
  'administrator can reverse an open-day sale'
);
select extensions.is(
  (
    select status
    from public.sale_summaries
    where notes = 'Different price sale'
  ),
  'reversed',
  'administrator correction preserves the original sale'
);
select extensions.is(
  (
    select quantity
    from public.product_stock_by_location
    where product_id = '36000000-0000-4000-8000-000000000052'
      and location_id = '36000000-0000-4000-8000-000000000013'
  ),
  '3',
  'sale reversal restores sold quantity'
);
select extensions.is(
  (
    select
      sale_count::text
      || '|'
      || total_amount_ron
      || '|'
      || total_cost_ron
      || '|'
      || gross_profit_ron
      || '|'
      || profit_percent
    from public.daily_product_sales_summaries
    where business_day_id =
      '36000000-0000-4000-8000-000000000021'
  ),
  '1|23.00|18.88|4.12|21.8220',
  'daily profit removes the reversed sale'
);
select extensions.is(
  (
    select
      cash_sales_ron::text
      || '|'
      || bank_sales_ron::text
      || '|'
      || credit_sales_ron::text
      || '|'
      || total_sales_ron::text
    from public.daily_sales
    where business_day_id =
      '36000000-0000-4000-8000-000000000021'
  ),
  '10.00|5.00|8.00|23.00',
  'daily payment totals remove the reversed sale'
);
select extensions.is(
  (
    select quantity || '|' || inventory_value_ron
    from public.product_stock_valuation_by_location
    where product_id = '36000000-0000-4000-8000-000000000051'
      and location_id = '36000000-0000-4000-8000-000000000013'
  ),
  '3|13.32000000',
  'remaining inventory value equals quantity times weighted cost'
);
select extensions.is(
  (
    select quantity || '|' || inventory_value_ron
    from public.product_stock_valuation_by_location
    where product_id = '36000000-0000-4000-8000-000000000052'
      and location_id = '36000000-0000-4000-8000-000000000013'
  ),
  '3|30.00000000',
  'reversed sale restores product inventory value'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'product_sale.reversed'
      and reason = 'Wrong selling price entered for this sale'
  ),
  1::bigint,
  'administrator sale correction is audited'
);

reset role;
select extensions.lives_ok(
  $sql$
    select private.close_daily_sales_core(
      '36000000-0000-4000-8000-000000000011',
      (
        select id
        from public.daily_sales
        where business_day_id =
          '36000000-0000-4000-8000-000000000021'
      ),
      '36000000-0000-4000-8000-000000000001',
      true,
      pg_catalog.clock_timestamp()
    )
  $sql$,
  'automatic close accepts product-derived daily totals'
);
select extensions.is(
  (
    select string_agg(
      entry_type || ':' || amount_ron::text,
      ','
      order by entry_type
    )
    from public.financial_account_entries
    where source_entity_type = 'daily_sales_closure'
  ),
  'daily_sales_bank:5.00,daily_sales_cash:10.00',
  'day close posts cash and bank totals exactly once'
);
select extensions.is(
  (
    select outstanding_ron
    from public.customer_receivable_balances
    where customer_id = '36000000-0000-4000-8000-000000000032'
  ),
  '8.00',
  'credit sale remains in the linked customer receivable'
);
select extensions.is(
  (
    select status::text || '|' || total_sales_ron::text
    from public.daily_sales
    where business_day_id =
      '36000000-0000-4000-8000-000000000021'
  ),
  'closed|23.00',
  'automatic day close preserves individual-sale total'
);

select * from extensions.finish();

rollback;
