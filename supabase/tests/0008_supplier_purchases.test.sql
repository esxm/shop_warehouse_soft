begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(49);

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'supplier_purchases'
      and column_name = 'business_day_id'
  ),
  'supplier purchases reference a business day'
);
select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_value_movements'
      and column_name = 'business_day_id'
  ),
  'inventory movements can reference a business day'
);
select extensions.ok(
  to_regclass('public.supplier_purchase_summaries') is not null,
  'supplier purchase summary view exists'
);
select extensions.ok(
  to_regclass('public.inventory_value_movement_summaries') is not null,
  'exact-decimal inventory movement summary view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_supplier_purchase(uuid,uuid,uuid,text,text,text,uuid,text,date,text)'
  ) is not null,
  'supplier purchase create RPC exists'
);
select extensions.ok(
  to_regprocedure('public.reverse_supplier_purchase(uuid,uuid,text)')
    is not null,
  'supplier purchase reversal RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.supplier_purchases'::regclass
  ),
  'supplier purchases keep RLS enabled'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.inventory_value_movements'::regclass
  ),
  'inventory movements keep RLS enabled'
);

create function public.test_reject_supplier_purchase_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_entity_type = 'supplier_purchase'
    and exists (
      select 1
      from public.supplier_purchases as purchase
      where purchase.id = new.source_entity_id
        and purchase.description = 'Force late rollback'
    )
  then
    raise exception 'Forced late inventory failure'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger test_reject_supplier_purchase_receipt
before insert on public.inventory_value_movements
for each row
execute function public.test_reject_supplier_purchase_receipt();

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
    'b0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'purchase-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Purchase Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'purchase-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Purchase Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-purchase-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Purchase Admin"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table supplier_purchase_test_ids (
  business_id uuid,
  other_business_id uuid,
  supplier_id uuid,
  business_day_id uuid,
  warehouse_id uuid,
  shop_id uuid,
  other_warehouse_id uuid,
  ron_purchase_id uuid,
  usd_purchase_id uuid
);

insert into supplier_purchase_test_ids (business_id)
values (
  public.create_business_foundation(
    'Supplier Purchase Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from supplier_purchase_test_ids),
  'b0000000-0000-4000-8000-000000000002'
);

update supplier_purchase_test_ids
set
  supplier_id = public.create_supplier(
    business_id,
    'Inventory Supplier',
    '+40 700 111 222',
    null,
    'USD'
  ),
  business_day_id = public.create_business_day(
    business_id,
    '2026-07-01'
  ),
  warehouse_id = (
    select id
    from public.inventory_locations
    where business_id = supplier_purchase_test_ids.business_id
      and type = 'warehouse'
  ),
  shop_id = (
    select id
    from public.inventory_locations
    where business_id = supplier_purchase_test_ids.business_id
      and type = 'shop'
  );

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000003',
  true
);

update supplier_purchase_test_ids
set other_business_id = public.create_business_foundation(
  'Other Supplier Purchase Business',
  'Europe/Bucharest'
);

update supplier_purchase_test_ids
set other_warehouse_id = (
  select id
  from public.inventory_locations
  where business_id = supplier_purchase_test_ids.other_business_id
    and type = 'warehouse'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '125.50',
        '',
        %L::uuid,
        'Warehouse delivery',
        '2026-07-10',
        null
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  'employee can create a RON supplier purchase for the open day'
);

update supplier_purchase_test_ids
set ron_purchase_id = (
  select id
  from public.supplier_purchases
  where supplier_id = supplier_purchase_test_ids.supplier_id
    and currency = 'RON'
);

select extensions.is(
  (
    select
      original_amount::text
      || '|'
      || inventory_cost_ron::text
      || '|'
      || coalesce(purchase_exchange_rate::text, 'null')
    from public.supplier_purchases
    where id = (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  '125.50|125.50|null',
  'RON amount becomes inventory cost without an exchange rate'
);
select extensions.is(
  (
    select
      purchase_date::text
      || '|'
      || business_day_id::text
      || '|'
      || entry_origin
    from public.supplier_purchases
    where id = (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  (
    select
      '2026-07-01|'
      || business_day_id::text
      || '|operational'
    from supplier_purchase_test_ids
  ),
  'purchase date and origin are derived from the selected business day'
);
select extensions.is(
  (
    select
      movement_type
      || '|'
      || amount_ron::text
      || '|'
      || destination_location_id::text
      || '|'
      || business_day_id::text
    from public.inventory_value_movements
    where source_entity_id = (
      select ron_purchase_id from supplier_purchase_test_ids
    )
  ),
  (
    select
      'supplier_purchase_receipt|125.50|'
      || warehouse_id::text
      || '|'
      || business_day_id::text
    from supplier_purchase_test_ids
  ),
  'RON purchase creates one linked inventory receipt at the destination'
);
select extensions.is(
  (
    select outstanding_original_amount
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
      and currency = 'RON'
  ),
  '125.50',
  'RON purchase increases the supplier payable'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from supplier_purchase_test_ids
    )
  ),
  '125.50',
  'RON purchase increases warehouse inventory value'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  0::bigint,
  'supplier purchase does not create a cash or bank movement'
);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000001',
  true
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier_purchase.created'
      and entity_id = (
        select ron_purchase_id from supplier_purchase_test_ids
      )
  ),
  1::bigint,
  'RON purchase creation is audited'
);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '100.00',
        '4.60000000',
        %L::uuid,
        'Shop delivery',
        null,
        null
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select shop_id from supplier_purchase_test_ids)
  ),
  'employee can create a USD supplier purchase with a manual rate'
);

update supplier_purchase_test_ids
set usd_purchase_id = (
  select id
  from public.supplier_purchases
  where supplier_id = supplier_purchase_test_ids.supplier_id
    and currency = 'USD'
  order by created_at
  limit 1
);

select extensions.is(
  (
    select
      original_amount::text
      || '|'
      || purchase_exchange_rate::text
      || '|'
      || inventory_cost_ron::text
    from public.supplier_purchases
    where id = (select usd_purchase_id from supplier_purchase_test_ids)
  ),
  '100.00|4.60000000|460.00',
  'USD historical rate fixes the inventory cost in RON'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select shop_id from supplier_purchase_test_ids
    )
  ),
  '460.00',
  'USD purchase increases shop inventory by its historical RON cost'
);
select extensions.is(
  (
    select outstanding_original_amount || '|' || historical_ron_amount
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
      and currency = 'USD'
  ),
  '100.00|460.00',
  'USD payable preserves original and historical RON values'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  0::bigint,
  'USD purchase also leaves cash and bank unchanged'
);

select extensions.throws_ok(
  format(
    $sql$
      update public.supplier_purchases
      set original_amount = 1
      where id = %L::uuid
    $sql$,
    (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  '42501',
  'permission denied for table supplier_purchases',
  'browser role cannot edit immutable supplier purchases'
);
select extensions.throws_ok(
  format(
    $sql$
      insert into public.supplier_purchases (
        business_id,
        business_day_id,
        supplier_id,
        purchase_date,
        currency,
        original_amount,
        inventory_cost_ron,
        destination_location_id,
        entry_origin,
        created_by
      )
      values (
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '2026-07-01',
        'RON',
        1,
        1,
        %L::uuid,
        'operational',
        auth.uid()
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  '42501',
  'permission denied for table supplier_purchases',
  'browser role cannot bypass the purchase RPC'
);
select extensions.throws_ok(
  format(
    $sql$
      insert into public.inventory_value_movements (
        business_id,
        business_day_id,
        movement_date,
        movement_type,
        destination_location_id,
        amount_ron,
        source_entity_type,
        source_entity_id,
        created_by
      )
      values (
        %L::uuid,
        %L::uuid,
        '2026-07-01',
        'arbitrary',
        %L::uuid,
        999,
        'arbitrary',
        gen_random_uuid(),
        auth.uid()
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  '42501',
  'permission denied for table inventory_value_movements',
  'browser role cannot create arbitrary inventory value'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select other_warehouse_id from supplier_purchase_test_ids)
  ),
  '22023',
  'Destination location does not exist',
  'cross-business destination is rejected'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_purchases
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
  ),
  2::bigint,
  'invalid destination rolls back the purchase'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '10.00',
        '',
        %L::uuid
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  '22023',
  'Purchase exchange rate must be a positive decimal with at most eight decimal places',
  'USD purchase requires a manual exchange rate'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_purchases
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
  ),
  2::bigint,
  'missing USD rate leaves no partial purchase'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '4.50',
        %L::uuid
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  '22023',
  'RON purchases must not include an exchange rate',
  'RON purchase rejects an exchange rate'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_purchases
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
  ),
  2::bigint,
  'invalid RON rate leaves no partial inventory receipt'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '25.00',
        '',
        %L::uuid,
        'Force late rollback'
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  '55000',
  'Forced late inventory failure',
  'late inventory failure aborts supplier purchase creation'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_purchases
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
  ),
  2::bigint,
  'late failure rolls back the purchase inserted earlier in the RPC'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'supplier_purchase'
      and movement_type = 'supplier_purchase_receipt'
  ),
  2::bigint,
  'late failure leaves no partial inventory movement'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000001',
  true
);
select public.close_business_day(
  (select business_id from supplier_purchase_test_ids),
  (select business_day_id from supplier_purchase_test_ids)
);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000002',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '10.00',
        '4.50',
        %L::uuid
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select shop_id from supplier_purchase_test_ids)
  ),
  '55000',
  'Employee requires the current open business day',
  'employee cannot record a purchase on a closed day'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000001',
  true
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '10.00',
        '4.50',
        %L::uuid
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select shop_id from supplier_purchase_test_ids)
  ),
  '22023',
  'Historical entries require an audit reason',
  'administrator historical purchase requires a reason'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '10.00',
        '4.50',
        %L::uuid,
        'Late supplier invoice',
        null,
        'Invoice arrived after day closing'
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select shop_id from supplier_purchase_test_ids)
  ),
  'administrator can record an audited historical purchase'
);
select extensions.is(
  (
    select purchase.entry_origin || '|' || audit.reason
    from public.supplier_purchases as purchase
    inner join public.audit_logs as audit
      on audit.entity_id = purchase.id
      and audit.action = 'supplier_purchase.created'
    where purchase.description = 'Late supplier invoice'
  ),
  'admin_historical|Invoice arrived after day closing',
  'historical origin and audit reason are preserved'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_supplier_purchase(
        %L::uuid,
        %L::uuid,
        'Employee cannot reverse this purchase'
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse a supplier purchase'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_supplier_purchase(
        %L::uuid,
        %L::uuid,
        'Duplicate warehouse invoice entered'
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  'administrator can reverse the payable and inventory receipt'
);
select extensions.ok(
  (
    select reversed_at is not null
      and reversed_by = 'b0000000-0000-4000-8000-000000000001'::uuid
    from public.supplier_purchases
    where id = (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  'reversal marks the original purchase without deleting it'
);
select extensions.is(
  (
    select
      reversal.movement_type
      || '|'
      || reversal.source_location_id::text
      || '|'
      || reversal.amount_ron::text
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = (
      select original.id
      from public.inventory_value_movements as original
      where original.source_entity_id = (
        select ron_purchase_id from supplier_purchase_test_ids
      )
        and original.movement_type = 'supplier_purchase_receipt'
    )
  ),
  (
    select
      'supplier_purchase_reversal|'
      || warehouse_id::text
      || '|125.50'
    from supplier_purchase_test_ids
  ),
  'reversal creates one linked compensating warehouse outflow'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from supplier_purchase_test_ids
    )
  ),
  '0.00',
  'reversal removes the original inventory effect'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_purchase_test_ids)
      and currency = 'RON'
  ),
  0::bigint,
  'reversal removes the original payable effect'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier_purchase.reversed'
      and entity_id = (
        select ron_purchase_id from supplier_purchase_test_ids
      )
      and reason = 'Duplicate warehouse invoice entered'
  ),
  1::bigint,
  'supplier purchase reversal is audited with its reason'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_supplier_purchase(
        %L::uuid,
        %L::uuid,
        'Trying to reverse the same purchase again'
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select ron_purchase_id from supplier_purchase_test_ids)
  ),
  '55000',
  'Supplier purchase is already reversed',
  'same supplier purchase cannot be reversed twice'
);
select extensions.is(
  (select count(*) from public.financial_account_entries),
  0::bigint,
  'creation and reversal never change cash or bank'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000003',
  true
);
select extensions.is(
  (select count(*) from public.supplier_purchases),
  0::bigint,
  'RLS hides supplier purchases from another business'
);
select extensions.is(
  (select count(*) from public.inventory_value_movements),
  0::bigint,
  'RLS hides inventory movements from another business'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_purchase(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid
      )
    $sql$,
    (select business_id from supplier_purchase_test_ids),
    (select supplier_id from supplier_purchase_test_ids),
    (select business_day_id from supplier_purchase_test_ids),
    (select warehouse_id from supplier_purchase_test_ids)
  ),
  '42501',
  'Active business membership is required',
  'another business administrator cannot create a purchase in this tenant'
);

select extensions.finish();
rollback;
