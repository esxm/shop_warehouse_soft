begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(32);

select extensions.ok(
  to_regprocedure(
    'public.create_inventory_value_transfer(uuid,uuid,uuid,uuid,text,text,uuid,text)'
  ) is not null,
  'inventory transfer RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.reverse_inventory_value_transfer(uuid,uuid,text)'
  ) is not null,
  'inventory transfer reversal RPC exists'
);
select extensions.ok(
  to_regclass('public.inventory_transfer_summaries') is not null,
  'inventory transfer summary view exists'
);
select extensions.has_column(
  'public',
  'inventory_value_movements',
  'business_day_id',
  'inventory movements retain business-day metadata'
);
select extensions.has_column(
  'public',
  'inventory_value_movements',
  'notes',
  'inventory movements support transfer notes'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_value_movements',
    'INSERT'
  ),
  'browser users cannot insert inventory movements directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_value_movements',
    'UPDATE'
  ),
  'browser users cannot update inventory movements directly'
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
    '16000000-0000-4000-8000-000000000001',
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
    '16000000-0000-4000-8000-000000000002',
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

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '16000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table transfer_test_ids (
  business_id uuid,
  business_day_id uuid,
  warehouse_id uuid,
  shop_id uuid,
  transfer_id uuid
);

insert into transfer_test_ids (business_id)
values (
  public.create_business_foundation(
    'Inventory Transfer Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from transfer_test_ids),
  '16000000-0000-4000-8000-000000000002'
);

select public.create_opening_balance(
  (select business_id from transfer_test_ids),
  '2026-06-30',
  '0.00',
  '0.00',
  '100.00',
  '20.00',
  '[]'::jsonb,
  '[]'::jsonb
);

update transfer_test_ids
set
  business_day_id = public.create_business_day(
    business_id,
    '2026-07-01'
  ),
  warehouse_id = (
    select location.id
    from public.inventory_locations as location
    where location.business_id = transfer_test_ids.business_id
      and location.type = 'warehouse'
  ),
  shop_id = (
    select location.id
    from public.inventory_locations as location
    where location.business_id = transfer_test_ids.business_id
      and location.type = 'shop'
  );

select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from transfer_test_ids
    )
  ),
  '100.00',
  'warehouse starts with its opening inventory value'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (select shop_id from transfer_test_ids)
  ),
  '20.00',
  'shop starts with its opening inventory value'
);
select extensions.is(
  (
    select sum(balance_ron::numeric)
    from public.inventory_location_balances
    where business_id = (select business_id from transfer_test_ids)
  ),
  120.00::numeric,
  'opening total inventory is correct'
);

select set_config(
  'request.jwt.claim.sub',
  '16000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      update transfer_test_ids
      set transfer_id = public.create_inventory_value_transfer(
        %L::uuid, %L::uuid, %L::uuid, %L::uuid,
        '30.00', 'Restock shop', %L::uuid, null
      )
    $sql$,
    (select business_id from transfer_test_ids),
    (select business_day_id from transfer_test_ids),
    (select warehouse_id from transfer_test_ids),
    (select shop_id from transfer_test_ids),
    '16100000-0000-4000-8000-000000000001'
  ),
  'employee can transfer warehouse value on the open day'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where movement_type = 'inventory_transfer'
      and id = (select transfer_id from transfer_test_ids)
  ),
  1::bigint,
  'transfer creates one immutable inventory movement'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from transfer_test_ids
    )
  ),
  '70.00',
  'transfer decreases warehouse value'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (select shop_id from transfer_test_ids)
  ),
  '50.00',
  'transfer increases shop value'
);
select extensions.is(
  (
    select sum(balance_ron::numeric)
    from public.inventory_location_balances
    where business_id = (select business_id from transfer_test_ids)
  ),
  120.00::numeric,
  'transfer does not change total inventory value'
);
select extensions.is(
  (
    select status
    from public.inventory_transfer_summaries
    where transfer_id = (select transfer_id from transfer_test_ids)
  ),
  'active',
  'new transfer appears active in history'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_inventory_value_transfer(
        %L::uuid, %L::uuid, %L::uuid, %L::uuid,
        '30.00', 'Restock shop', %L::uuid, null
      )
    $sql$,
    (select business_id from transfer_test_ids),
    (select business_day_id from transfer_test_ids),
    (select warehouse_id from transfer_test_ids),
    (select shop_id from transfer_test_ids),
    '16100000-0000-4000-8000-000000000001'
  ),
  'identical transfer retry succeeds'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_transfer'
      and movement_type = 'inventory_transfer'
  ),
  1::bigint,
  'identical retry does not duplicate the transfer'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_inventory_value_transfer(
        %L::uuid, %L::uuid, %L::uuid, %L::uuid,
        '31.00', 'Changed transfer', %L::uuid, null
      )
    $sql$,
    (select business_id from transfer_test_ids),
    (select business_day_id from transfer_test_ids),
    (select warehouse_id from transfer_test_ids),
    (select shop_id from transfer_test_ids),
    '16100000-0000-4000-8000-000000000001'
  ),
  '22023',
  'Transfer request identifier was reused with different data',
  'idempotency identifier cannot be reused with changed data'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_inventory_value_transfer(
        %L::uuid, %L::uuid, %L::uuid, %L::uuid,
        '70.01', null, %L::uuid, null
      )
    $sql$,
    (select business_id from transfer_test_ids),
    (select business_day_id from transfer_test_ids),
    (select warehouse_id from transfer_test_ids),
    (select shop_id from transfer_test_ids),
    '16100000-0000-4000-8000-000000000002'
  ),
  '22023',
  'Inventory movement exceeds source inventory value',
  'transfer exceeding warehouse value is rejected'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from transfer_test_ids
    )
  ),
  '70.00',
  'rejected transfer does not change warehouse value'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_transfer'
  ),
  1::bigint,
  'rejected transfer leaves no partial movement'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_inventory_value_transfer(
        %L::uuid, %L::uuid, %L::uuid, %L::uuid,
        '5.00', null, %L::uuid, null
      )
    $sql$,
    (select business_id from transfer_test_ids),
    (select business_day_id from transfer_test_ids),
    (select shop_id from transfer_test_ids),
    (select warehouse_id from transfer_test_ids),
    '16100000-0000-4000-8000-000000000003'
  ),
  '22023',
  'Phase 1 supports warehouse-to-shop transfers only',
  'Phase 1 rejects shop-to-warehouse creation'
);
select extensions.throws_ok(
  format(
    'select public.reverse_inventory_value_transfer(%L::uuid, %L::uuid, %L)',
    (select business_id from transfer_test_ids),
    (select transfer_id from transfer_test_ids),
    'Employee attempted reversal'
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse a transfer'
);

select set_config(
  'request.jwt.claim.sub',
  '16000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    'select public.reverse_inventory_value_transfer(%L::uuid, %L::uuid, %L)',
    (select business_id from transfer_test_ids),
    (select transfer_id from transfer_test_ids),
    'Transfer was entered twice'
  ),
  'administrator can reverse an inventory transfer'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from transfer_test_ids
    )
  ),
  '100.00',
  'reversal restores warehouse value'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (select shop_id from transfer_test_ids)
  ),
  '20.00',
  'reversal restores shop value'
);
select extensions.is(
  (
    select sum(balance_ron::numeric)
    from public.inventory_location_balances
    where business_id = (select business_id from transfer_test_ids)
  ),
  120.00::numeric,
  'reversal keeps total inventory unchanged'
);
select extensions.is(
  (
    select status
    from public.inventory_transfer_summaries
    where transfer_id = (select transfer_id from transfer_test_ids)
  ),
  'reversed',
  'transfer history shows the reversal'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where reversal_of_id = (select transfer_id from transfer_test_ids)
      and source_location_id = (select shop_id from transfer_test_ids)
      and destination_location_id = (
        select warehouse_id from transfer_test_ids
      )
  ),
  1::bigint,
  'reversal is one linked shop-to-warehouse movement'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where action = 'inventory_transfer.reversed'
      and entity_id = (select transfer_id from transfer_test_ids)
      and actor_user_id = '16000000-0000-4000-8000-000000000001'
      and reason = 'Transfer was entered twice'
  ),
  1,
  'transfer reversal records the administrator and reason'
);
select extensions.throws_ok(
  format(
    'select public.reverse_inventory_value_transfer(%L::uuid, %L::uuid, %L)',
    (select business_id from transfer_test_ids),
    (select transfer_id from transfer_test_ids),
    'Repeated transfer reversal'
  ),
  '55000',
  'Inventory transfer is already reversed',
  'transfer cannot be reversed twice'
);

select extensions.finish();
rollback;
