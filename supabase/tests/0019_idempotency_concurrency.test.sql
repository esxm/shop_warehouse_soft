begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(18);

select extensions.ok(
  to_regclass('private.financial_command_idempotency') is not null,
  'financial command idempotency registry exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_customer_credit_purchase_idempotent(uuid,uuid,uuid,text,uuid,text,date,text)'
  ) is not null,
  'customer credit purchases use an idempotent command RPC'
);
select extensions.ok(
  to_regprocedure(
    'public.create_supplier_purchase_idempotent(uuid,uuid,uuid,text,text,text,uuid,uuid,text,date,text)'
  ) is not null,
  'supplier purchases use an idempotent command RPC'
);
select extensions.ok(
  pg_catalog.pg_get_functiondef(
    'public.create_customer_credit_purchase_idempotent(uuid,uuid,uuid,text,uuid,text,date,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'customer purchase retries serialize on an advisory transaction lock'
);
select extensions.ok(
  pg_catalog.pg_get_functiondef(
    'public.create_supplier_purchase_idempotent(uuid,uuid,uuid,text,text,text,uuid,uuid,text,date,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'supplier purchase retries serialize on an advisory transaction lock'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.create_customer_credit_purchase(uuid,uuid,uuid,text,text,date,text)',
    'execute'
  ),
  'authenticated clients cannot bypass customer purchase idempotency'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.create_supplier_purchase(uuid,uuid,uuid,text,text,text,uuid,text,date,text)',
    'execute'
  ),
  'authenticated clients cannot bypass supplier purchase idempotency'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.create_customer_credit_purchase_idempotent(uuid,uuid,uuid,text,uuid,text,date,text)',
    'execute'
  ),
  'authenticated clients can execute the protected customer purchase command'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.create_supplier_purchase_idempotent(uuid,uuid,uuid,text,text,text,uuid,uuid,text,date,text)',
    'execute'
  ),
  'authenticated clients can execute the protected supplier purchase command'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.customer_payments'::regclass
      and conname = 'customer_payments_idempotency_key'
  ),
  'customer payment request keys are unique per business'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_payments'::regclass
      and conname = 'supplier_payments_idempotency_key'
  ),
  'supplier payment request keys are unique per business'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_idempotency_key'
  ),
  'expense request keys are unique per business'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.inventory_stocktakes'::regclass
      and conname = 'inventory_stocktakes_idempotency_key'
  ),
  'stocktake request keys are unique per business'
);
select extensions.ok(
  to_regclass(
    'public.inventory_value_movements_business_idempotency_key'
  ) is not null,
  'inventory transfer request keys are uniquely indexed'
);
select extensions.ok(
  pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'public.create_customer_payment(uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,text)'::regprocedure
    )
  ) like '%for update%'
  and pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'public.create_supplier_payment(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,jsonb,text)'::regprocedure
    )
  ) like '%for update%',
  'customer and supplier allocation commands lock payable rows'
);
select extensions.ok(
  pg_catalog.pg_get_functiondef(
    'private.close_daily_sales_core(uuid,uuid,uuid,boolean,timestamptz)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'daily close serializes requests with an advisory transaction lock'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.daily_sales_closures'::regclass
      and conname = 'daily_sales_closures_sequence_key'
  ),
  'daily closure sequence is unique'
);
select extensions.ok(
  to_regclass(
    'public.financial_account_entries_daily_sales_source_idx'
  ) is not null,
  'daily close ledger source is unique'
);

select * from extensions.finish();

rollback;
