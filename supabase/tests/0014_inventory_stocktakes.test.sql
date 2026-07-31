begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(40);

select extensions.has_table(
  'public',
  'inventory_stocktakes',
  'inventory stocktakes table exists'
);
select extensions.ok(
  to_regclass('public.inventory_stocktake_summaries') is not null,
  'inventory stocktake summary view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_inventory_stocktake(uuid,date,text,text,text,text,uuid)'
  ) is not null,
  'inventory stocktake RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.reverse_inventory_stocktake(uuid,uuid,text)'
  ) is not null,
  'inventory stocktake reversal RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.inventory_stocktakes'::regclass
  ),
  'inventory stocktakes have RLS enabled'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_stocktakes',
    'INSERT'
  ),
  'browser users cannot insert stocktakes directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_stocktakes',
    'UPDATE'
  ),
  'browser users cannot overwrite stocktake history'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_stocktakes',
    'DELETE'
  ),
  'browser users cannot delete stocktake history'
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
    '17000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'stocktake-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Stocktake Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '17000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'stocktake-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Stocktake Employee"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table stocktake_test_ids (
  business_id uuid,
  warehouse_id uuid,
  shop_id uuid,
  stocktake_id uuid,
  replacement_stocktake_id uuid
);

insert into stocktake_test_ids (business_id)
values (
  public.create_business_foundation(
    'Inventory Stocktake Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from stocktake_test_ids),
  '17000000-0000-4000-8000-000000000002'
);

select public.create_opening_balance(
  (select business_id from stocktake_test_ids),
  '2026-06-30',
  '0.00',
  '0.00',
  '100.00',
  '50.00',
  '[]'::jsonb,
  '[]'::jsonb
);

update stocktake_test_ids
set
  warehouse_id = (
    select location.id
    from public.inventory_locations as location
    where location.business_id = stocktake_test_ids.business_id
      and location.type = 'warehouse'
  ),
  shop_id = (
    select location.id
    from public.inventory_locations as location
    where location.business_id = stocktake_test_ids.business_id
      and location.type = 'shop'
  );

select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_inventory_stocktake(
        %L::uuid, '2026-07-01'::date, '90.00', '60.00',
        'Employee physical count', null, %L::uuid
      )
    $sql$,
    (select business_id from stocktake_test_ids),
    '17100000-0000-4000-8000-000000000001'
  ),
  '42501',
  'Administrator access is required',
  'employee cannot create a stocktake'
);

select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_inventory_stocktake(
        %L::uuid, '2026-07-01'::date, '90.00', '60.00',
        'short', null, %L::uuid
      )
    $sql$,
    (select business_id from stocktake_test_ids),
    '17100000-0000-4000-8000-000000000002'
  ),
  '22023',
  'Stocktake reason must contain 10 to 500 characters',
  'stocktake requires a meaningful reason'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_stocktakes
    where business_id = (select business_id from stocktake_test_ids)
  ),
  0::bigint,
  'rejected stocktake leaves no record'
);

select extensions.lives_ok(
  format(
    $sql$
      update stocktake_test_ids
      set stocktake_id = public.create_inventory_stocktake(
        %L::uuid, '2026-07-01'::date, '90.00', '60.00',
        'Completed physical inventory count',
        'Counted after closing', %L::uuid
      )
    $sql$,
    (select business_id from stocktake_test_ids),
    '17100000-0000-4000-8000-000000000003'
  ),
  'administrator can record a stocktake atomically'
);
select extensions.is(
  (
    select warehouse_expected_value_ron
    from public.inventory_stocktakes
    where id = (select stocktake_id from stocktake_test_ids)
  ),
  100.00::numeric,
  'stocktake preserves warehouse expected value'
);
select extensions.is(
  (
    select shop_expected_value_ron
    from public.inventory_stocktakes
    where id = (select stocktake_id from stocktake_test_ids)
  ),
  50.00::numeric,
  'stocktake preserves shop expected value'
);
select extensions.is(
  (
    select warehouse_actual_value_ron
    from public.inventory_stocktakes
    where id = (select stocktake_id from stocktake_test_ids)
  ),
  90.00::numeric,
  'stocktake preserves warehouse actual value'
);
select extensions.is(
  (
    select shop_actual_value_ron
    from public.inventory_stocktakes
    where id = (select stocktake_id from stocktake_test_ids)
  ),
  60.00::numeric,
  'stocktake preserves shop actual value'
);
select extensions.is(
  (
    select warehouse_difference_ron
    from public.inventory_stocktakes
    where id = (select stocktake_id from stocktake_test_ids)
  ),
  -10.00::numeric,
  'warehouse negative difference is calculated'
);
select extensions.is(
  (
    select shop_difference_ron
    from public.inventory_stocktakes
    where id = (select stocktake_id from stocktake_test_ids)
  ),
  10.00::numeric,
  'shop positive difference is calculated'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from stocktake_test_ids
    )
  ),
  '90.00',
  'negative adjustment decreases warehouse to actual value'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (select shop_id from stocktake_test_ids)
  ),
  '60.00',
  'positive adjustment increases shop to actual value'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_stocktake'
      and source_entity_id = (select stocktake_id from stocktake_test_ids)
      and movement_type = 'inventory_stocktake_adjustment'
  ),
  2::bigint,
  'stocktake creates one nonzero adjustment per location'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_stocktake'
      and source_entity_id = (select stocktake_id from stocktake_test_ids)
      and movement_type = 'inventory_stocktake_adjustment'
      and source_location_id = (
        select warehouse_id from stocktake_test_ids
      )
  ),
  1::bigint,
  'negative warehouse difference creates a source movement'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_stocktake'
      and source_entity_id = (select stocktake_id from stocktake_test_ids)
      and movement_type = 'inventory_stocktake_adjustment'
      and destination_location_id = (select shop_id from stocktake_test_ids)
  ),
  1::bigint,
  'positive shop difference creates a destination movement'
);
select extensions.is(
  (
    select reason
    from public.audit_logs
    where action = 'inventory_stocktake.created'
      and entity_id = (select stocktake_id from stocktake_test_ids)
  ),
  'Completed physical inventory count',
  'stocktake reason is preserved in the audit log'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_inventory_stocktake(
        %L::uuid, '2026-07-01'::date, '90.00', '60.00',
        'Completed physical inventory count',
        'Counted after closing', %L::uuid
      )
    $sql$,
    (select business_id from stocktake_test_ids),
    '17100000-0000-4000-8000-000000000003'
  ),
  'identical stocktake retry succeeds'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_stocktakes
    where business_id = (select business_id from stocktake_test_ids)
  ),
  1::bigint,
  'identical retry does not duplicate stocktake history'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_stocktake'
      and source_entity_id = (select stocktake_id from stocktake_test_ids)
  ),
  2::bigint,
  'identical retry does not duplicate adjustments'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_inventory_stocktake(
        %L::uuid, '2026-07-01'::date, '91.00', '60.00',
        'Changed physical inventory count',
        null, %L::uuid
      )
    $sql$,
    (select business_id from stocktake_test_ids),
    '17100000-0000-4000-8000-000000000003'
  ),
  '22023',
  'Stocktake request identifier was reused with different data',
  'stocktake idempotency key rejects changed data'
);

select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  format(
    'select public.reverse_inventory_stocktake(%L::uuid, %L::uuid, %L)',
    (select business_id from stocktake_test_ids),
    (select stocktake_id from stocktake_test_ids),
    'Employee attempted reversal'
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse a stocktake'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_stocktake_summaries
    where business_id = (select business_id from stocktake_test_ids)
  ),
  1::bigint,
  'employee can read stocktake history'
);

select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    'select public.reverse_inventory_stocktake(%L::uuid, %L::uuid, %L)',
    (select business_id from stocktake_test_ids),
    (select stocktake_id from stocktake_test_ids),
    'Physical count was entered incorrectly'
  ),
  'administrator can reverse a stocktake'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from stocktake_test_ids
    )
  ),
  '100.00',
  'reversal restores warehouse expected value'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (select shop_id from stocktake_test_ids)
  ),
  '50.00',
  'reversal restores shop expected value'
);
select extensions.is(
  (
    select status
    from public.inventory_stocktake_summaries
    where stocktake_id = (select stocktake_id from stocktake_test_ids)
  ),
  'reversed',
  'stocktake history is preserved as reversed'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_value_movements
    where source_entity_type = 'inventory_stocktake'
      and source_entity_id = (select stocktake_id from stocktake_test_ids)
      and movement_type = 'inventory_stocktake_reversal'
  ),
  2::bigint,
  'reversal creates one compensating movement per adjustment'
);
select extensions.throws_ok(
  format(
    'select public.reverse_inventory_stocktake(%L::uuid, %L::uuid, %L)',
    (select business_id from stocktake_test_ids),
    (select stocktake_id from stocktake_test_ids),
    'Repeated stocktake reversal'
  ),
  '55000',
  'Inventory stocktake is already reversed',
  'stocktake cannot be reversed twice'
);
select extensions.lives_ok(
  format(
    $sql$
      update stocktake_test_ids
      set replacement_stocktake_id = public.create_inventory_stocktake(
        %L::uuid, '2026-07-01'::date, '105.00', '45.00',
        'Corrected physical inventory count',
        null, %L::uuid
      )
    $sql$,
    (select business_id from stocktake_test_ids),
    '17100000-0000-4000-8000-000000000004'
  ),
  'administrator can record a corrected replacement stocktake'
);
select extensions.is(
  (
    select count(*)
    from public.inventory_stocktakes
    where business_id = (select business_id from stocktake_test_ids)
  ),
  2::bigint,
  'replacement stocktake preserves the original history row'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (
      select warehouse_id from stocktake_test_ids
    )
  ),
  '105.00',
  'replacement stocktake applies its positive warehouse adjustment'
);
select extensions.is(
  (
    select balance_ron
    from public.inventory_location_balances
    where inventory_location_id = (select shop_id from stocktake_test_ids)
  ),
  '45.00',
  'replacement stocktake applies its negative shop adjustment'
);

select extensions.finish();
rollback;
