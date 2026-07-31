begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(15);

create temporary table release_gate_definitions (
  name text primary key,
  body text not null
);

insert into release_gate_definitions (name, body)
values
  (
    'daily_net_revenue',
    lower(
      pg_get_viewdef('public.daily_net_revenue_summaries'::regclass, true)
    )
  ),
  (
    'profit',
    lower(
      pg_get_viewdef('public.product_sales_daily_analysis'::regclass, true)
    )
  ),
  (
    'financial_balances',
    lower(
      pg_get_viewdef('public.financial_account_balances'::regclass, true)
    )
  ),
  (
    'customer_receivables',
    lower(
      pg_get_viewdef('public.customer_receivable_balances'::regclass, true)
    )
  ),
  (
    'supplier_payables',
    lower(
      pg_get_viewdef('public.supplier_payable_balances'::regclass, true)
    )
  ),
  (
    'product_valuation',
    lower(
      pg_get_viewdef(
        'public.product_stock_valuation_by_location'::regclass,
        true
      )
    )
  ),
  (
    'supplier_purchase',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname in (
          'create_supplier_purchase',
          'create_supplier_purchase_with_lines_idempotent'
        )
    )
  ),
  (
    'inventory_transfer',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname in (
          'create_inventory_product_transfer',
          'create_inventory_value_transfer'
        )
    )
  ),
  (
    'daily_close',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname in ('public', 'private')
        and routine.proname in ('close_daily_sales', 'close_daily_sales_core')
    )
  ),
  (
    'reversals',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname like 'reverse_%'
    )
  ),
  (
    'employee_open_day_writes',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname in (
          'create_customer_credit_purchase',
          'create_customer_payment',
          'create_supplier_purchase_with_lines_idempotent',
          'create_supplier_payment',
          'create_product_sale',
          'create_inventory_product_transfer'
        )
    )
  ),
  (
    'admin_operations',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname in (
          'reopen_business_day',
          'reverse_supplier_purchase',
          'reverse_customer_payment',
          'set_business_employee_active'
        )
    )
  ),
  (
    'business_position',
    (
      select lower(string_agg(pg_get_functiondef(routine.oid), E'\n'))
      from pg_catalog.pg_proc as routine
      inner join pg_catalog.pg_namespace as namespace
        on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname = 'save_business_position_snapshot'
    )
  );

select extensions.ok(
  (
    select body like '%daily_sales_summaries%'
      and body not like '%customer_payments%'
    from release_gate_definitions
    where name = 'daily_net_revenue'
  ),
  'customer payments are not a revenue source'
);

select extensions.ok(
  (
    select body not like '%supplier_payments%'
      and body not like '%expenses%'
      and body like '%historical_cost_ron%'
    from release_gate_definitions
    where name = 'profit'
  ),
  'supplier payments and expenses are not product-profit inputs'
);

select extensions.ok(
  (
    select body like '%insert into public.supplier_purchases%'
      and body like '%insert into public.inventory_value_movements%'
      and body like '%insert into public.supplier_purchase_lines%'
      and body not like '%financial_account_entries%'
    from release_gate_definitions
    where name = 'supplier_purchase'
  ),
  'supplier purchases create payable and inventory without account outflow'
);

select extensions.ok(
  (
    select body like '%target_source_location_id%'
      and body like '%target_destination_location_id%'
      and body like '%insert into public.inventory_value_movements%'
      and body like '%insert into public.inventory_transfer_lines%'
    from release_gate_definitions
    where name = 'inventory_transfer'
  ),
  'inventory transfers move value and lines between locations'
);

select extensions.ok(
  (
    select body like '%financial_account_entries%'
      and body like '%sum(%'
      and body like '%direction%'
    from release_gate_definitions
    where name = 'financial_balances'
  ),
  'cash and bank balances are ledger sums'
);

select extensions.ok(
  (
    select body like '%customer_credit_purchases%'
      and body like '%customer_payment_allocations%'
      and body like '%customer_credit_adjustments%'
      and body like '%outstanding_ron%'
    from release_gate_definitions
    where name = 'customer_receivables'
  ),
  'customer receivables subtract active allocations'
);

select extensions.ok(
  (
    select body like '%supplier_purchases%'
      and body like '%supplier_payment_allocations%'
      and body like '%outstanding_original_amount%'
    from release_gate_definitions
    where name = 'supplier_payables'
  ),
  'supplier payables subtract active allocations'
);

select extensions.ok(
  (
    select body like '%sale_to_close.status = ''closed''%'
      and body like '%return sale_to_close.id%'
      and body like '%financial_account_entries%'
    from release_gate_definitions
    where name = 'daily_close'
  ),
  'daily close returns the existing closure instead of duplicating inflows'
);

select extensions.ok(
  (
    select body like '%reversal_of_id%'
      and body like '%audit_logs%'
      and body like '%financial_account_entries%'
    from release_gate_definitions
    where name = 'reversals'
  ),
  'reversals preserve originals and create compensating audited effects'
);

select extensions.ok(
  (
    select body like '%current open business day%'
      and body like '%business_day_id%'
    from release_gate_definitions
    where name = 'employee_open_day_writes'
  ),
  'employee writes are bound to open business days'
);

select extensions.ok(
  (
    select body like '%private.is_business_admin%'
      or body like '%administrator access is required%'
    from release_gate_definitions
    where name = 'admin_operations'
  ),
  'admin operations recheck administrator membership in the database'
);

select extensions.is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    inner join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  0::bigint,
  'cross-business tables keep RLS enabled'
);

select extensions.ok(
  (
    select body like '%inventory_value_usd%'
      and body not like '%currency_reference_rate%'
    from release_gate_definitions
    where name = 'product_valuation'
  ),
  'historical USD inventory value is stored instead of recomputed from current rates'
);

select extensions.ok(
  to_regclass('public.currency_reference_rate_summaries') is not null
    and (
      select body like '%currency%'
        and body like '%outstanding_original_amount%'
      from release_gate_definitions
      where name = 'supplier_payables'
    ),
  'current USD/RON rates can change supplier payable estimates only'
);

select extensions.ok(
  (
    select body like '%financial_account_balances%'
      and body like '%customer_receivable_balances%'
      and body like '%supplier_payable_balances%'
      and body not like '%daily_sales%'
      and body not like '%revenue%'
    from release_gate_definitions
    where name = 'business_position'
  ),
  'business position excludes revenue as a separate asset'
);

select * from extensions.finish();

rollback;
