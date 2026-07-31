begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(28);

select extensions.ok(
  to_regclass('public.stock_movements') is not null,
  'stock movements table exists'
);
select extensions.ok(
  to_regclass('public.product_stock_by_location') is not null,
  'stock-by-location view exists'
);
select extensions.ok(
  to_regclass('public.stock_movement_summaries') is not null,
  'stock movement history view exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.stock_movements'::regclass
  ),
  'stock movements use RLS'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.stock_movements',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated clients cannot mutate the ledger directly'
);
select extensions.ok(
  to_regprocedure(
    'public.create_stock_movement(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,text,uuid,text,boolean,text)'
  ) is not null,
  'stock movement RPC exists'
);
select extensions.ok(
  to_regprocedure(
    'public.reverse_stock_movement(uuid,uuid,text,uuid,boolean)'
  ) is not null,
  'stock reversal RPC exists'
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
    '32000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'stock-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Stock Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '32000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'stock-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Stock Employee"}',
    now(),
    now()
  );

insert into public.businesses (id, name, timezone, created_by)
values (
  '32000000-0000-4000-8000-000000000011',
  'Stock Ledger Business',
  'Europe/Bucharest',
  '32000000-0000-4000-8000-000000000001'
);

insert into public.business_members (business_id, user_id, role, is_active)
values
  (
    '32000000-0000-4000-8000-000000000011',
    '32000000-0000-4000-8000-000000000001',
    'admin',
    true
  ),
  (
    '32000000-0000-4000-8000-000000000011',
    '32000000-0000-4000-8000-000000000002',
    'employee',
    true
  );

insert into public.inventory_locations (
  id,
  business_id,
  name,
  type
)
values
  (
    '32000000-0000-4000-8000-000000000012',
    '32000000-0000-4000-8000-000000000011',
    'Warehouse',
    'warehouse'
  ),
  (
    '32000000-0000-4000-8000-000000000013',
    '32000000-0000-4000-8000-000000000011',
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
  '32000000-0000-4000-8000-000000000021',
  '32000000-0000-4000-8000-000000000011',
  '2026-07-02',
  '32000000-0000-4000-8000-000000000001'
);

insert into public.product_categories (
  id,
  business_id,
  name,
  created_by,
  updated_by
)
values (
  '32000000-0000-4000-8000-000000000031',
  '32000000-0000-4000-8000-000000000011',
  'Stock products',
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001'
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
  '32000000-0000-4000-8000-000000000041',
  '32000000-0000-4000-8000-000000000011',
  'STOCK-001',
  'Tracked product',
  '32000000-0000-4000-8000-000000000031',
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '32000000-0000-4000-8000-000000000001',
  true
);

select extensions.lives_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'opening',
      target_quantity => '10',
      target_reference_type => 'test_opening',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000051',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000061',
      target_destination_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'administrator records opening stock'
);
select extensions.is(
  (
    select quantity
    from public.product_stock_by_location
    where product_id = '32000000-0000-4000-8000-000000000041'
      and location_type = 'warehouse'
  ),
  '10',
  'opening movement derives warehouse quantity'
);
select extensions.is(
  public.create_stock_movement(
    target_business_id =>
      '32000000-0000-4000-8000-000000000011',
    target_product_id =>
      '32000000-0000-4000-8000-000000000041',
    target_movement_type => 'opening',
    target_quantity => '10',
    target_reference_type => 'test_opening',
    target_reference_id =>
      '32000000-0000-4000-8000-000000000051',
    target_idempotency_key =>
      '32000000-0000-4000-8000-000000000061',
    target_destination_location_id => (
      select id
      from public.inventory_locations
      where business_id = '32000000-0000-4000-8000-000000000011'
        and type = 'warehouse'
    ),
    target_business_day_id =>
      '32000000-0000-4000-8000-000000000021'
  ),
  (
    select id
    from public.stock_movements
    where idempotency_key =
      '32000000-0000-4000-8000-000000000061'
  ),
  'identical retry returns the original movement'
);
select extensions.is(
  (select count(*) from public.stock_movements),
  1::bigint,
  'identical retry does not duplicate stock'
);
select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'opening',
      target_quantity => '11',
      target_reference_type => 'test_opening',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000051',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000061',
      target_destination_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021'
    )
  $sql$,
  '22023',
  'Stock movement request identifier was reused with different data',
  'changed retry is rejected'
);

select extensions.lives_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'transfer',
      target_quantity => '4',
      target_reference_type => 'test_transfer',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000052',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000062',
      target_source_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_destination_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'shop'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021'
    )
  $sql$,
  'transfer moves exact product quantity'
);
select extensions.is(
  (
    select string_agg(
      location_type::text || ':' || quantity,
      ','
      order by location_type
    )
    from public.product_stock_by_location
    where product_id = '32000000-0000-4000-8000-000000000041'
  ),
  'warehouse:6,shop:4',
  'location balances derive both transfer effects'
);

select set_config(
  'request.jwt.claim.sub',
  '32000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'damage',
      target_quantity => '7',
      target_reference_type => 'test_damage',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000053',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000063',
      target_source_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021'
    )
  $sql$,
  '22023',
  'Stock movement would make product quantity negative',
  'employee cannot create negative stock'
);
select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'damage',
      target_quantity => '7',
      target_reference_type => 'test_damage',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000053',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000064',
      target_source_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021',
      target_allow_negative => true,
      target_override_reason => 'Employee attempted override'
    )
  $sql$,
  '42501',
  'Administrator access is required to override stock',
  'employee cannot enable the override'
);
select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'opening',
      target_quantity => '1',
      target_reference_type => 'test_opening',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000054',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000065',
      target_destination_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021'
    )
  $sql$,
  '42501',
  'Administrator access is required for opening stock',
  'employee cannot record opening stock'
);

select set_config(
  'request.jwt.claim.sub',
  '32000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'damage',
      target_quantity => '7',
      target_reference_type => 'test_damage',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000053',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000066',
      target_source_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021',
      target_allow_negative => true
    )
  $sql$,
  '22023',
  'Negative-stock override requires a reason',
  'administrator override requires a reason'
);
select extensions.lives_ok(
  $sql$
    select public.create_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_product_id =>
        '32000000-0000-4000-8000-000000000041',
      target_movement_type => 'damage',
      target_quantity => '7',
      target_reference_type => 'test_damage',
      target_reference_id =>
        '32000000-0000-4000-8000-000000000053',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000067',
      target_source_location_id => (
        select id
        from public.inventory_locations
        where business_id =
          '32000000-0000-4000-8000-000000000011'
          and type = 'warehouse'
      ),
      target_business_day_id =>
        '32000000-0000-4000-8000-000000000021',
      target_allow_negative => true,
      target_override_reason =>
        'Physical count confirms one missing piece'
    )
  $sql$,
  'administrator can document a negative-stock override'
);
select extensions.is(
  (
    select quantity
    from public.product_stock_by_location
    where product_id = '32000000-0000-4000-8000-000000000041'
      and location_type = 'warehouse'
  ),
  '-1',
  'documented override can create a negative balance'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'stock_movement.negative_override_created'
      and reason = 'Physical count confirms one missing piece'
  ),
  1::bigint,
  'negative override creates a reasoned audit event'
);
select extensions.throws_ok(
  $sql$
    select public.deactivate_product(
      '32000000-0000-4000-8000-000000000011',
      '32000000-0000-4000-8000-000000000041'
    )
  $sql$,
  '55000',
  'Product with stock cannot be deactivated',
  'product with nonzero stock cannot be deactivated'
);

select extensions.lives_ok(
  $sql$
    select public.reverse_stock_movement(
      target_business_id =>
        '32000000-0000-4000-8000-000000000011',
      target_movement_id => (
        select id
        from public.stock_movements
        where idempotency_key =
          '32000000-0000-4000-8000-000000000067'
      ),
      target_reason => 'Damage entry was recorded in error',
      target_idempotency_key =>
        '32000000-0000-4000-8000-000000000071'
    )
  $sql$,
  'administrator reverses an outbound movement'
);
select extensions.is(
  (
    select quantity
    from public.product_stock_by_location
    where product_id = '32000000-0000-4000-8000-000000000041'
      and location_type = 'warehouse'
  ),
  '6',
  'reversal removes the original movement effect'
);
select extensions.is(
  (
    select status
    from public.stock_movement_summaries
    where movement_id = (
      select reversal_of_id
      from public.stock_movements
      where idempotency_key =
        '32000000-0000-4000-8000-000000000071'
    )
  ),
  'reversed',
  'history marks the original as reversed'
);

reset role;
select extensions.throws_ok(
  $sql$
    update public.stock_movements
    set notes = 'changed'
    where idempotency_key =
      '32000000-0000-4000-8000-000000000061'
  $sql$,
  '55000',
  'Product stock movements are immutable; create a reversal',
  'existing movement cannot be edited'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '32000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  $sql$
    delete from public.stock_movements
    where idempotency_key =
      '32000000-0000-4000-8000-000000000061'
  $sql$,
  '42501',
  null,
  'authenticated client cannot delete movement history'
);
select extensions.is(
  (
    select count(*)
    from public.stock_movements
    where reversal_of_id is not null
  ),
  1::bigint,
  'reversal is a linked immutable ledger row'
);

select * from extensions.finish();

rollback;
