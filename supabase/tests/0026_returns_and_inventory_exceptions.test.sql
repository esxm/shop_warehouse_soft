begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(44);

select extensions.ok(
  to_regclass('public.sale_returns') is not null,
  'sale returns table exists'
);
select extensions.ok(
  to_regclass('public.sale_return_lines') is not null,
  'sale return lines table exists'
);
select extensions.ok(
  to_regclass('public.customer_credit_adjustments') is not null,
  'customer credit adjustments table exists'
);
select extensions.ok(
  to_regclass('public.inventory_exceptions') is not null,
  'inventory exceptions table exists'
);
select extensions.ok(
  to_regclass('public.damaged_stock_balances') is not null,
  'damaged stock balance view exists'
);
select extensions.ok(
  (
    select bool_and(relation.relrowsecurity)
    from pg_catalog.pg_class as relation
    where relation.oid in (
      'public.sale_returns'::regclass,
      'public.sale_return_lines'::regclass,
      'public.customer_credit_adjustments'::regclass,
      'public.damaged_stock_movements'::regclass,
      'public.inventory_exceptions'::regclass
    )
  ),
  'Step 36 tables use RLS'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.sale_returns',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate returns directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_exceptions',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate inventory exceptions directly'
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
    '37000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'returns-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Returns Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '37000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'returns-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Returns Employee"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values (
  '37000000-0000-4000-8000-000000000011',
  'Returns Business',
  'Europe/Bucharest',
  '37000000-0000-4000-8000-000000000001'
);

insert into public.business_members (business_id, user_id, role, is_active)
values
  (
    '37000000-0000-4000-8000-000000000011',
    '37000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '37000000-0000-4000-8000-000000000011',
    '37000000-0000-4000-8000-000000000002',
    'employee',
    true
  );

insert into public.inventory_locations (id, business_id, name, type)
values
  (
    '37000000-0000-4000-8000-000000000012',
    '37000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '37000000-0000-4000-8000-000000000013',
    '37000000-0000-4000-8000-000000000011',
    'Shop',
    'shop'
  );

insert into public.financial_accounts (id, business_id, name, type)
values
  (
    '37000000-0000-4000-8000-000000000014',
    '37000000-0000-4000-8000-000000000011',
    'Cash',
    'cash'
  ),
  (
    '37000000-0000-4000-8000-000000000015',
    '37000000-0000-4000-8000-000000000011',
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
  '37000000-0000-4000-8000-000000000021',
  '37000000-0000-4000-8000-000000000011',
  '2026-07-03',
  '37000000-0000-4000-8000-000000000001'
);

insert into public.suppliers (
  id,
  business_id,
  name,
  default_currency,
  created_by
)
values (
  '37000000-0000-4000-8000-000000000031',
  '37000000-0000-4000-8000-000000000011',
  'Returns Supplier',
  'RON',
  '37000000-0000-4000-8000-000000000001'
);

insert into public.customers (id, business_id, name, created_by)
values (
  '37000000-0000-4000-8000-000000000032',
  '37000000-0000-4000-8000-000000000011',
  'Returns Customer',
  '37000000-0000-4000-8000-000000000001'
);

insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '37000000-0000-4000-8000-000000000041',
  '37000000-0000-4000-8000-000000000011',
  'Return products',
  '37000000-0000-4000-8000-000000000001',
  '37000000-0000-4000-8000-000000000001'
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
    '37000000-0000-4000-8000-000000000051',
    '37000000-0000-4000-8000-000000000011',
    'RETURN-A',
    'Return product A',
    '37000000-0000-4000-8000-000000000041',
    '37000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001'
  ),
  (
    '37000000-0000-4000-8000-000000000052',
    '37000000-0000-4000-8000-000000000011',
    'RETURN-B',
    'Return product B',
    '37000000-0000-4000-8000-000000000041',
    '37000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '37000000-0000-4000-8000-000000000002',
  true
);

select public.create_supplier_purchase_with_lines_idempotent(
  target_business_id => '37000000-0000-4000-8000-000000000011',
  target_supplier_id => '37000000-0000-4000-8000-000000000031',
  target_business_day_id => '37000000-0000-4000-8000-000000000021',
  target_currency => 'RON',
  target_purchase_exchange_rate => '',
  target_destination_location_id =>
    '37000000-0000-4000-8000-000000000013',
  target_idempotency_key => '37000000-0000-4000-8000-000000000061',
  target_lines => '[
    {
      "product_id":"37000000-0000-4000-8000-000000000051",
      "quantity":"10",
      "unit_price_original_currency":"4.44"
    },
    {
      "product_id":"37000000-0000-4000-8000-000000000052",
      "quantity":"10",
      "unit_price_original_currency":"10.00"
    }
  ]'::jsonb
);

select public.create_product_sale(
  target_business_id => '37000000-0000-4000-8000-000000000011',
  target_business_day_id => '37000000-0000-4000-8000-000000000021',
  target_shop_location_id => '37000000-0000-4000-8000-000000000013',
  target_cash_amount_ron => '10.00',
  target_bank_amount_ron => '8.00',
  target_credit_amount_ron => '24.00',
  target_idempotency_key => '37000000-0000-4000-8000-000000000071',
  target_lines => '[
    {
      "product_id":"37000000-0000-4000-8000-000000000051",
      "quantity":"3",
      "unit_selling_price_ron":"6.00"
    },
    {
      "product_id":"37000000-0000-4000-8000-000000000052",
      "quantity":"2",
      "unit_selling_price_ron":"12.00"
    }
  ]'::jsonb,
  target_customer_id => '37000000-0000-4000-8000-000000000032',
  target_notes => 'Return test sale'
);

select extensions.throws_ok(
  $sql$
    select public.create_sale_return(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      (select id from public.sales where notes = 'Return test sale'),
      '5.00',
      '3.00',
      '10.00',
      '37000000-0000-4000-8000-000000000081',
      (
        select jsonb_agg(
          jsonb_build_object(
            'sale_line_id', id,
            'quantity', '1',
            'disposition',
              case when product_id =
                '37000000-0000-4000-8000-000000000051'
                then 'sellable' else 'damaged' end
          )
        )
        from public.sale_lines
        where sale_id = (
          select id from public.sales where notes = 'Return test sale'
        )
      ),
      'Customer returned two products'
    )
  $sql$,
  '42501',
  'Administrator access is required',
  'employee cannot create a return'
);

select set_config(
  'request.jwt.claim.sub',
  '37000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_sale_return(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      (select id from public.sales where notes = 'Return test sale'),
      '5.00',
      '3.00',
      '10.00',
      '37000000-0000-4000-8000-000000000081',
      (
        select jsonb_agg(
          jsonb_build_object(
            'sale_line_id', id,
            'quantity', '1',
            'disposition',
              case when product_id =
                '37000000-0000-4000-8000-000000000051'
                then 'sellable' else 'damaged' end
          )
          order by line_number
        )
        from public.sale_lines
        where sale_id = (
          select id from public.sales where notes = 'Return test sale'
        )
      ),
      'Customer returned two products'
    )
  $sql$,
  'administrator creates mixed-disposition return'
);

select extensions.is(
  (
    select
      cash_refund_ron || '|' || bank_refund_ron || '|'
      || credit_reduction_ron || '|' || total_refund_ron
      || '|' || total_cost_ron
    from public.sale_return_summaries
  ),
  '5.00|3.00|10.00|18.00|14.44',
  'return stores exact refund split and historical cost'
);
select extensions.is(
  (
    select string_agg(
      product_code || ':' || quantity || ':' || disposition,
      ',' order by line_number
    )
    from public.sale_return_line_summaries
  ),
  'RETURN-A:1:sellable,RETURN-B:1:damaged',
  'return preserves each product disposition'
);
select extensions.is(
  (
    select string_agg(
      product.internal_code || ':' || stock.quantity,
      ',' order by product.internal_code
    )
    from public.product_stock_by_location as stock
    inner join public.products as product on product.id = stock.product_id
    where stock.location_id = '37000000-0000-4000-8000-000000000013'
  ),
  'RETURN-A:8,RETURN-B:8',
  'sellable return restores stock while damaged return does not'
);
select extensions.is(
  (
    select damaged_quantity
    from public.damaged_stock_balances
    where product_id = '37000000-0000-4000-8000-000000000052'
  ),
  '1',
  'damaged customer return is tracked separately'
);
select extensions.is(
  (
    select amount_ron::text
    from public.inventory_value_movements
    where source_entity_type = 'sale_return'
      and movement_type = 'sale_return_sellable'
  ),
  '4.44',
  'only sellable return restores inventory value'
);
select extensions.is(
  (
    select string_agg(
      entry_type || ':' || amount_ron::text,
      ',' order by entry_type
    )
    from public.financial_account_entries
    where source_entity_type = 'sale_return'
      and reversal_of_id is null
  ),
  'sale_refund_bank:3.00,sale_refund_cash:5.00',
  'cash and bank refunds create exact outflows'
);
select extensions.is(
  (
    select outstanding_ron
    from public.customer_receivable_balances
    where customer_id = '37000000-0000-4000-8000-000000000032'
  ),
  '14.00',
  'credit reduction immediately lowers customer receivable'
);
select extensions.is(
  (
    select remaining_ron
    from public.customer_credit_purchase_balances
    where purchase_id = (
      select id
      from public.customer_credit_purchases
      where sale_id = (
        select id from public.sales where notes = 'Return test sale'
      )
    )
  ),
  '14.00',
  'linked purchase balance includes the return adjustment'
);
select extensions.is(
  (
    select credit_available_ron
    from public.returnable_sale_line_summaries
    where sale_id = (
      select id from public.sales where notes = 'Return test sale'
    )
    limit 1
  ),
  '14.00',
  'return form view exposes remaining cancellable credit'
);
select extensions.is(
  (
    select
      cash_sales_ron || '|' || bank_sales_ron || '|'
      || credit_sales_ron || '|' || total_sales_ron || '|' || returns_ron
    from public.daily_net_revenue_summaries
    where business_day_id = '37000000-0000-4000-8000-000000000021'
  ),
  '5.00|5.00|14.00|24.00|18.00',
  'daily revenue is net of active return-date refunds'
);

select extensions.lives_ok(
  $sql$
    select public.create_customer_payment(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000032',
      '4.00',
      '37000000-0000-4000-8000-000000000014',
      '37000000-0000-4000-8000-000000000091',
      'Manual payment after return',
      'manual',
      jsonb_build_array(
        jsonb_build_object(
          'purchase_id',
          (
            select id
            from public.customer_credit_purchases
            where sale_id = (
              select id from public.sales where notes = 'Return test sale'
            )
          ),
          'amount_ron',
          '4.00'
        )
      ),
      null
    )
  $sql$,
  'manual allocation respects return-adjusted purchase balance'
);
select extensions.is(
  (
    select outstanding_ron
    from public.customer_receivable_balances
    where customer_id = '37000000-0000-4000-8000-000000000032'
  ),
  '10.00',
  'manual payment and credit reduction reconcile together'
);

select extensions.lives_ok(
  $sql$
    select public.create_customer_payment(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000032',
      '10.00',
      '37000000-0000-4000-8000-000000000014',
      '37000000-0000-4000-8000-000000000092',
      'Pay adjusted receivable',
      'oldest_first',
      '[]'::jsonb,
      null
    )
  $sql$,
  'oldest-first payment respects return-adjusted outstanding'
);
select extensions.throws_ok(
  $sql$
    select public.create_customer_payment(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000032',
      '0.01',
      '37000000-0000-4000-8000-000000000014',
      '37000000-0000-4000-8000-000000000093',
      null,
      'oldest_first',
      '[]'::jsonb,
      null
    )
  $sql$,
  '22023',
  'Customer payment exceeds outstanding receivables',
  'adjusted receivable cannot be overpaid'
);

select extensions.is(
  public.create_sale_return(
    '37000000-0000-4000-8000-000000000011',
    '37000000-0000-4000-8000-000000000021',
    (select id from public.sales where notes = 'Return test sale'),
    '5.00',
    '3.00',
    '10.00',
    '37000000-0000-4000-8000-000000000081',
    (
      select jsonb_agg(
        jsonb_build_object(
          'sale_line_id', id,
          'quantity', '1',
          'disposition',
            case when product_id =
              '37000000-0000-4000-8000-000000000051'
              then 'sellable' else 'damaged' end
        )
        order by line_number
      )
      from public.sale_lines
      where sale_id = (
        select id from public.sales where notes = 'Return test sale'
      )
    ),
    'Customer returned two products'
  ),
  (select id from public.sale_returns),
  'identical return retry returns the original record'
);
select extensions.is(
  (select count(*) from public.sale_returns),
  1::bigint,
  'identical return retry creates no duplicate effects'
);
select extensions.throws_ok(
  $sql$
    select public.create_sale_return(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      (select id from public.sales where notes = 'Return test sale'),
      '18.00',
      '0.00',
      '0.00',
      '37000000-0000-4000-8000-000000000082',
      (
        select jsonb_build_array(
          jsonb_build_object(
            'sale_line_id', id,
            'quantity', '3',
            'disposition', 'sellable'
          )
        )
        from public.sale_lines
        where sale_id = (
          select id from public.sales where notes = 'Return test sale'
        )
          and product_id = '37000000-0000-4000-8000-000000000051'
      ),
      'Attempt to return too many products'
    )
  $sql$,
  '22023',
  'Return quantity exceeds the unreturned sale quantity',
  'return rejects quantity above remaining sold pieces'
);

select extensions.lives_ok(
  $sql$
    select public.reverse_sale_return(
      '37000000-0000-4000-8000-000000000011',
      (select id from public.sale_returns),
      'Return was entered against wrong sale'
    )
  $sql$,
  'administrator reverses the complete return transaction'
);
select extensions.is(
  (
    select status || '|' || reversal_reason
    from public.sale_return_summaries
  ),
  'reversed|Return was entered against wrong sale',
  'return reversal preserves original record and reason'
);
select extensions.is(
  (
    select outstanding_ron
    from public.customer_receivable_balances
    where customer_id = '37000000-0000-4000-8000-000000000032'
  ),
  '10.00',
  'reversing return restores its credit receivable effect'
);
select extensions.is(
  (
    select damaged_quantity
    from public.damaged_stock_balances
    where product_id = '37000000-0000-4000-8000-000000000052'
  ),
  '0',
  'reversing return removes its damaged quantity'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'sale_return'
      and reversal_of_id is not null
  ),
  2::bigint,
  'return reversal compensates both refund account entries'
);

select set_config(
  'request.jwt.claim.sub',
  '37000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  $sql$
    select public.create_inventory_exception(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000051',
      '37000000-0000-4000-8000-000000000013',
      'damage',
      '1',
      '37000000-0000-4000-8000-000000000101',
      'Product was damaged in the shop'
    )
  $sql$,
  '42501',
  'Administrator access is required',
  'employee cannot record inventory exception'
);

select set_config(
  'request.jwt.claim.sub',
  '37000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  $sql$
    select public.create_inventory_exception(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000051',
      '37000000-0000-4000-8000-000000000013',
      'damage',
      '1',
      '37000000-0000-4000-8000-000000000101',
      'Product was damaged in the shop'
    )
  $sql$,
  'administrator records damaged stock'
);
select extensions.is(
  (
    select
      exception_type || '|' || quantity || '|'
      || unit_cost_ron || '|' || total_cost_ron
    from public.inventory_exception_summaries
    where exception_type = 'damage'
  ),
  'damage|1|4.44000000|4.44',
  'damage preserves quantity and weighted historical cost'
);
select extensions.is(
  (
    select damaged_quantity
    from public.damaged_stock_balances
    where product_id = '37000000-0000-4000-8000-000000000051'
  ),
  '1',
  'damage moves one piece into separately tracked damaged stock'
);

select extensions.lives_ok(
  $sql$
    select public.create_inventory_exception(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000052',
      '37000000-0000-4000-8000-000000000013',
      'stolen',
      '1',
      '37000000-0000-4000-8000-000000000102',
      'Physical count confirmed stolen stock'
    )
  $sql$,
  'administrator records stolen stock'
);
select extensions.is(
  (
    select damaged_quantity
    from public.damaged_stock_balances
    where product_id = '37000000-0000-4000-8000-000000000052'
  ),
  '0',
  'stolen stock is not added to damaged stock'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_exception'
      and reversal_of_id is null
  ),
  2::bigint,
  'damage and stolen stock each remove inventory value'
);
select extensions.throws_ok(
  $sql$
    select public.create_inventory_exception(
      '37000000-0000-4000-8000-000000000011',
      '37000000-0000-4000-8000-000000000021',
      '37000000-0000-4000-8000-000000000051',
      '37000000-0000-4000-8000-000000000013',
      'missing',
      '99',
      '37000000-0000-4000-8000-000000000103',
      'Physical count confirms missing stock'
    )
  $sql$,
  '22023',
  'Exception quantity exceeds available stock',
  'inventory exception rejects insufficient stock'
);
select extensions.lives_ok(
  $sql$
    select public.reverse_inventory_exception(
      '37000000-0000-4000-8000-000000000011',
      (
        select id
        from public.inventory_exceptions
        where exception_type = 'damage'
      ),
      'Damage record used the wrong product'
    )
  $sql$,
  'administrator reverses a damage event'
);
select extensions.is(
  (
    select status
    from public.inventory_exception_summaries
    where exception_type = 'damage'
  ),
  'reversed',
  'inventory exception reversal preserves history'
);
select extensions.is(
  (
    select damaged_quantity
    from public.damaged_stock_balances
    where product_id = '37000000-0000-4000-8000-000000000051'
  ),
  '0',
  'damage reversal removes damaged-stock effect'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action in (
      'sale_return.created',
      'sale_return.reversed',
      'inventory_exception.created',
      'inventory_exception.reversed'
    )
  ),
  5::bigint,
  'return and exception commands write audit events'
);

select * from extensions.finish();

rollback;
