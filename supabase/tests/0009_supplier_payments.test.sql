begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(62);

select extensions.ok(
  to_regclass('public.supplier_payments') is not null,
  'supplier payments table exists'
);
select extensions.ok(
  to_regclass('public.supplier_payment_allocations') is not null,
  'supplier payment allocations table exists'
);
select extensions.ok(
  to_regclass('public.supplier_payment_summaries') is not null,
  'supplier payment summary view exists'
);
select extensions.ok(
  to_regclass('public.supplier_payment_allocation_details') is not null,
  'supplier payment allocation detail view exists'
);
select extensions.ok(
  to_regprocedure(
    'public.create_supplier_payment(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,jsonb,text)'
  ) is not null,
  'atomic supplier payment RPC exists'
);
select extensions.ok(
  to_regprocedure('public.reverse_supplier_payment(uuid,uuid,text)')
    is not null,
  'supplier payment reversal RPC exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.supplier_payments'::regclass
  ),
  'supplier payments has RLS enabled'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.supplier_payment_allocations'::regclass
  ),
  'supplier payment allocations has RLS enabled'
);

create function public.test_reject_supplier_payment_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_entity_type = 'supplier_payment'
    and exists (
      select 1
      from public.supplier_payments as payment
      where payment.id = new.source_entity_id
        and payment.notes = 'Force late rollback'
    )
  then
    raise exception 'Forced late supplier payment failure'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger test_reject_supplier_payment_ledger
before insert on public.financial_account_entries
for each row
execute function public.test_reject_supplier_payment_ledger();

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
    'c0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'supplier-payment-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Supplier Payment Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'supplier-payment-employee@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Supplier Payment Employee"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-supplier-payment-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Supplier Payment Admin"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table supplier_payment_test_ids (
  business_id uuid,
  other_business_id uuid,
  supplier_id uuid,
  first_day_id uuid,
  second_day_id uuid,
  third_day_id uuid,
  payment_day_id uuid,
  warehouse_id uuid,
  cash_account_id uuid,
  bank_account_id uuid,
  first_usd_purchase_id uuid,
  second_usd_purchase_id uuid,
  third_usd_purchase_id uuid,
  ron_purchase_id uuid,
  first_payment_id uuid,
  ron_payment_id uuid,
  manual_payment_id uuid,
  rounding_purchase_id uuid
);

insert into supplier_payment_test_ids (business_id)
values (
  public.create_business_foundation(
    'Supplier Payment Test Business',
    'Europe/Bucharest'
  )
);

select public.add_business_employee(
  (select business_id from supplier_payment_test_ids),
  'c0000000-0000-4000-8000-000000000002'
);

update supplier_payment_test_ids
set
  supplier_id = public.create_supplier(
    business_id,
    'Payable Supplier',
    '+40 700 333 444',
    null,
    'USD'
  ),
  first_day_id = public.create_business_day(
    business_id,
    '2026-01-01'
  ),
  warehouse_id = (
    select id
    from public.inventory_locations
    where business_id = supplier_payment_test_ids.business_id
      and type = 'warehouse'
  ),
  cash_account_id = (
    select id
    from public.financial_accounts
    where business_id = supplier_payment_test_ids.business_id
      and type = 'cash'
  ),
  bank_account_id = (
    select id
    from public.financial_accounts
    where business_id = supplier_payment_test_ids.business_id
      and type = 'bank'
  );

select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);

update supplier_payment_test_ids
set first_usd_purchase_id = public.create_supplier_purchase(
  business_id,
  supplier_id,
  first_day_id,
  'USD',
  '100.00',
  '4.50',
  warehouse_id,
  'Oldest USD purchase'
);

select public.close_business_day(
  (select business_id from supplier_payment_test_ids),
  (select first_day_id from supplier_payment_test_ids)
);

select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
update supplier_payment_test_ids
set second_day_id = public.create_business_day(
  business_id,
    '2026-01-02'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);

update supplier_payment_test_ids
set
  second_usd_purchase_id = public.create_supplier_purchase(
    business_id,
    supplier_id,
    second_day_id,
    'USD',
    '100.00',
    '4.70',
    warehouse_id,
    'Second USD purchase'
  ),
  ron_purchase_id = public.create_supplier_purchase(
    business_id,
    supplier_id,
    second_day_id,
    'RON',
    '200.00',
    '',
    warehouse_id,
    'RON purchase'
  );

select public.close_business_day(
  (select business_id from supplier_payment_test_ids),
  (select second_day_id from supplier_payment_test_ids)
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
update supplier_payment_test_ids
set third_day_id = public.create_business_day(
  business_id,
  '2026-01-03'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);
update supplier_payment_test_ids
set third_usd_purchase_id = public.create_supplier_purchase(
  business_id,
  supplier_id,
  third_day_id,
  'USD',
  '40.00',
  '4.60',
  warehouse_id,
  'Third USD purchase'
);
select public.close_business_day(
  (select business_id from supplier_payment_test_ids),
  (select third_day_id from supplier_payment_test_ids)
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
update supplier_payment_test_ids
set payment_day_id = public.create_business_day(
  business_id,
  '2026-01-04'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '150.00',
        '5.00',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000001',
        'First USD payment',
        'oldest_first',
        '[]'::jsonb,
        null
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids)
  ),
  'employee can create an oldest-first USD payment'
);

update supplier_payment_test_ids
set first_payment_id = (
  select id
  from public.supplier_payments
  where idempotency_key = 'c1000000-0000-4000-8000-000000000001'
);

select extensions.is(
  (
    select
      currency::text
      || '|'
      || original_amount_paid::text
      || '|'
      || payment_exchange_rate::text
      || '|'
      || actual_amount_ron::text
      || '|'
      || currency_gain_loss_ron::text
    from public.supplier_payments
    where id = (select first_payment_id from supplier_payment_test_ids)
  ),
  'USD|150.00|5.00000000|750.00|-65.00',
  'USD payment stores original, actual, and gain/loss values'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_payment_allocations
    where supplier_payment_id = (
      select first_payment_id from supplier_payment_test_ids
    )
  ),
  2::bigint,
  'one payment allocates across two purchases'
);
select extensions.is(
  (
    select
      allocated_original_amount::text
      || '|'
      || historical_ron_value::text
      || '|'
      || actual_ron_value::text
      || '|'
      || currency_gain_loss_ron::text
    from public.supplier_payment_allocations
    where supplier_payment_id = (
      select first_payment_id from supplier_payment_test_ids
    )
      and supplier_purchase_id = (
        select first_usd_purchase_id from supplier_payment_test_ids
      )
  ),
  '100.00|450.00|500.00|-50.00',
  'oldest USD purchase is paid first at its own historical rate'
);
select extensions.is(
  (
    select
      allocated_original_amount::text
      || '|'
      || historical_ron_value::text
      || '|'
      || actual_ron_value::text
      || '|'
      || currency_gain_loss_ron::text
    from public.supplier_payment_allocations
    where supplier_payment_id = (
      select first_payment_id from supplier_payment_test_ids
    )
      and supplier_purchase_id = (
        select second_usd_purchase_id from supplier_payment_test_ids
      )
  ),
  '50.00|235.00|250.00|-15.00',
  'remaining payment partially pays the next purchase'
);
select extensions.is(
  (
    select
      (
        select derived_status
        from public.supplier_purchase_summaries
        where purchase_id = ids.first_usd_purchase_id
      )
      || '|'
      || (
        select derived_status
        from public.supplier_purchase_summaries
        where purchase_id = ids.second_usd_purchase_id
      )
    from supplier_payment_test_ids as ids
  ),
  'paid|partial',
  'purchase statuses derive paid and partial allocation state'
);
select extensions.is(
  (
    select outstanding_original_amount || '|' || historical_ron_amount
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_payment_test_ids)
      and currency = 'USD'
  ),
  '90.00|419.00',
  'USD payable is reduced by allocations at historical values'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from supplier_payment_test_ids
    )
  ),
  '-750.00',
  'cash decreases by the actual RON paid'
);
select extensions.is(
  (
    select direction::text || '|' || amount_ron::text || '|' || entry_type
    from public.financial_account_entries
    where source_entity_id = (
      select first_payment_id from supplier_payment_test_ids
    )
      and reversal_of_id is null
  ),
  'outflow|750.00|supplier_payment',
  'payment creates exactly one linked account outflow'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier_payment.created'
      and entity_id = (
        select first_payment_id from supplier_payment_test_ids
      )
  ),
  1::bigint,
  'supplier payment is audited'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '150.00',
        '5.00',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000001',
        'First USD payment',
        'oldest_first',
        '[]'::jsonb,
        null
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids)
  ),
  'identical retry returns safely'
);
select extensions.is(
  (select count(*) from public.supplier_payments),
  1::bigint,
  'identical retry does not duplicate payment'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where entry_type = 'supplier_payment'
  ),
  1::bigint,
  'identical retry does not duplicate account outflow'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '10.00',
        '5.00',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000001'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids)
  ),
  '22023',
  'Payment request identifier was reused with different data',
  'idempotency key cannot be reused with changed data'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '91.00',
        '5.00',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000002'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids)
  ),
  '22023',
  'Supplier payment exceeds outstanding payable',
  'overpayment is rejected'
);
select extensions.is(
  (select count(*) from public.supplier_payments),
  1::bigint,
  'overpayment leaves no payment row'
);

select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '50.00',
        '',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000003'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select bank_account_id from supplier_payment_test_ids)
  ),
  'employee can create a partial RON payment'
);
update supplier_payment_test_ids
set ron_payment_id = (
  select id
  from public.supplier_payments
  where idempotency_key = 'c1000000-0000-4000-8000-000000000003'
);
select extensions.is(
  (
    select
      original_amount_paid::text
      || '|'
      || coalesce(payment_exchange_rate::text, 'null')
      || '|'
      || actual_amount_ron::text
      || '|'
      || currency_gain_loss_ron::text
    from public.supplier_payments
    where id = (select ron_payment_id from supplier_payment_test_ids)
  ),
  '50.00|null|50.00|0.00',
  'RON payment needs no rate and has zero currency gain/loss'
);
select extensions.is(
  (
    select
      allocated_original_amount::text
      || '|'
      || historical_ron_value::text
      || '|'
      || actual_ron_value::text
      || '|'
      || currency_gain_loss_ron::text
    from public.supplier_payment_allocations
    where supplier_payment_id = (
      select ron_payment_id from supplier_payment_test_ids
    )
  ),
  '50.00|50.00|50.00|0.00',
  'RON allocation uses identical original, historical, and actual values'
);
select extensions.is(
  (
    select outstanding_original_amount
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_payment_test_ids)
      and currency = 'RON'
  ),
  '150.00',
  'partial RON payment leaves the remaining payable'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select bank_account_id from supplier_payment_test_ids
    )
  ),
  '-50.00',
  'RON payment reduces bank by its original amount'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '5.00',
        '4.80',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000004',
        null,
        'manual',
        (
          '[{"purchase_id":"%s","amount_original":"2.00"},'
          || '{"purchase_id":"%s","amount_original":"3.00"}]'
        )::jsonb
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids),
    (select third_usd_purchase_id from supplier_payment_test_ids),
    (select third_usd_purchase_id from supplier_payment_test_ids)
  ),
  '22023',
  'Manual allocation contains a duplicate purchase',
  'employee manual allocation reaches normal allocation validation'
);

select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '5.00',
        '4.80',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000005',
        null,
        'manual',
        '[{"purchase_id":"%s","amount_original":"5.00"}]'::jsonb
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids),
    (select ron_purchase_id from supplier_payment_test_ids)
  ),
  '22023',
  'Manual allocation purchase is unavailable or has a different currency',
  'manual allocation cannot mix purchase currencies'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '20.00',
        '4.80',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000006',
        'Manual third-purchase payment',
        'manual',
        '[{"purchase_id":"%s","amount_original":"20.00"}]'::jsonb
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids),
    (select third_usd_purchase_id from supplier_payment_test_ids)
  ),
  'administrator can manually allocate to a newer purchase'
);
update supplier_payment_test_ids
set manual_payment_id = (
  select id
  from public.supplier_payments
  where idempotency_key = 'c1000000-0000-4000-8000-000000000006'
);
select extensions.is(
  (
    select
      allocated_original_amount::text
      || '|'
      || historical_ron_value::text
      || '|'
      || actual_ron_value::text
      || '|'
      || currency_gain_loss_ron::text
    from public.supplier_payment_allocations
    where supplier_payment_id = (
      select manual_payment_id from supplier_payment_test_ids
    )
  ),
  '20.00|92.00|96.00|-4.00',
  'manual USD allocation stores historical, actual, and loss values'
);
select extensions.is(
  (
    select outstanding_original_amount || '|' || historical_ron_amount
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_payment_test_ids)
      and currency = 'USD'
  ),
  '70.00|327.00',
  'manual allocation reduces only its selected purchase'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from supplier_payment_test_ids
    )
  ),
  '-846.00',
  'manual payment reduces cash by its actual RON amount once'
);
select extensions.is(
  (
    select
      (
        select derived_status
        from public.supplier_purchase_summaries
        where purchase_id = ids.second_usd_purchase_id
      )
      || '|'
      || (
        select derived_status
        from public.supplier_purchase_summaries
        where purchase_id = ids.third_usd_purchase_id
      )
    from supplier_payment_test_ids as ids
  ),
  'partial|partial',
  'manual override leaves both selected and skipped purchases partial'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'USD',
        '10.00',
        '4.90',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000007',
        'Force late rollback'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids)
  ),
  '55000',
  'Forced late supplier payment failure',
  'late account-entry failure aborts the payment transaction'
);
select extensions.is(
  (select count(*) from public.supplier_payments),
  3::bigint,
  'late failure rolls back the payment row'
);
select extensions.is(
  (select count(*) from public.supplier_payment_allocations),
  4::bigint,
  'late failure rolls back allocations created earlier'
);
select extensions.is(
  (
    select count(*)
    from public.financial_account_entries
    where source_entity_type = 'supplier_payment'
      and reversal_of_id is null
  ),
  3::bigint,
  'late failure leaves no account outflow'
);

select extensions.throws_ok(
  format(
    $sql$
      insert into public.supplier_payments (
        business_id,
        business_day_id,
        supplier_id,
        payment_date,
        currency,
        original_amount_paid,
        actual_amount_ron,
        financial_account_id,
        currency_gain_loss_ron,
        entry_origin,
        allocation_strategy,
        idempotency_key,
        request_fingerprint,
        created_by
      )
      values (
        %L::uuid,
        %L::uuid,
        %L::uuid,
        '2026-01-04',
        'RON',
        1,
        1,
        %L::uuid,
        0,
        'operational',
        'oldest_first',
        gen_random_uuid(),
        'bypass',
        auth.uid()
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select cash_account_id from supplier_payment_test_ids)
  ),
  '42501',
  'permission denied for table supplier_payments',
  'browser role cannot insert supplier payments directly'
);
select extensions.throws_ok(
  $sql$
    insert into public.supplier_payment_allocations (
      business_id,
      supplier_payment_id,
      supplier_purchase_id,
      allocated_original_amount,
      historical_ron_value,
      actual_ron_value,
      currency_gain_loss_ron
    )
    values (
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      1,
      1,
      1,
      0
    )
  $sql$,
  '42501',
  'permission denied for table supplier_payment_allocations',
  'browser role cannot insert supplier allocations directly'
);
select extensions.throws_ok(
  $sql$
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      entry_date,
      direction,
      amount_ron,
      entry_type,
      source_entity_type,
      source_entity_id,
      created_by
    )
    values (
      gen_random_uuid(),
      gen_random_uuid(),
      '2026-01-04',
      'outflow',
      1,
      'supplier_payment',
      'supplier_payment',
      gen_random_uuid(),
      auth.uid()
    )
  $sql$,
  '42501',
  'permission denied for table financial_account_entries',
  'browser role cannot create an arbitrary supplier outflow'
);

select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_supplier_purchase(
        %L::uuid,
        %L::uuid,
        'Allocated purchase cannot reverse yet'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select third_usd_purchase_id from supplier_payment_test_ids)
  ),
  '55000',
  'Reverse allocated supplier payments before the purchase',
  'purchase with an active allocation cannot reverse first'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_supplier_payment(
        %L::uuid,
        %L::uuid,
        'Employee cannot reverse this payment'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select first_payment_id from supplier_payment_test_ids)
  ),
  '42501',
  'Administrator access is required',
  'employee cannot reverse a supplier payment'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
select extensions.lives_ok(
  format(
    $sql$
      select public.reverse_supplier_payment(
        %L::uuid,
        %L::uuid,
        'Wrong payment amount was entered'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select first_payment_id from supplier_payment_test_ids)
  ),
  'administrator can reverse supplier payment atomically'
);
select extensions.ok(
  (
    select reversed_at is not null
      and reversed_by = 'c0000000-0000-4000-8000-000000000001'::uuid
    from public.supplier_payments
    where id = (select first_payment_id from supplier_payment_test_ids)
  ),
  'reversal marks original supplier payment without deleting it'
);
select extensions.is(
  (
    select direction::text || '|' || amount_ron::text
    from public.financial_account_entries
    where source_entity_id = (
      select first_payment_id from supplier_payment_test_ids
    )
      and reversal_of_id is not null
  ),
  'inflow|750.00',
  'reversal creates one linked compensating account inflow'
);
select extensions.is(
  (
    select balance_ron
    from public.financial_account_balances
    where financial_account_id = (
      select cash_account_id from supplier_payment_test_ids
    )
  ),
  '-96.00',
  'reversal restores the first payment account effect'
);
select extensions.is(
  (
    select outstanding_original_amount || '|' || historical_ron_amount
    from public.supplier_payable_balances
    where supplier_id = (select supplier_id from supplier_payment_test_ids)
      and currency = 'USD'
  ),
  '220.00|1012.00',
  'reversal restores allocations to supplier payable'
);
select extensions.is(
  (
    select count(*)
    from public.supplier_payment_allocations
    where supplier_payment_id = (
      select first_payment_id from supplier_payment_test_ids
    )
  ),
  2::bigint,
  'reversal preserves original allocation rows'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where action = 'supplier_payment.reversed'
      and entity_id = (
        select first_payment_id from supplier_payment_test_ids
      )
      and reason = 'Wrong payment amount was entered'
  ),
  1::bigint,
  'supplier payment reversal is audited with reason'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.reverse_supplier_payment(
        %L::uuid,
        %L::uuid,
        'Trying to reverse payment twice'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select first_payment_id from supplier_payment_test_ids)
  ),
  '55000',
  'Supplier payment is already reversed',
  'supplier payment cannot reverse twice'
);

select public.close_business_day(
  (select business_id from supplier_payment_test_ids),
  (select payment_day_id from supplier_payment_test_ids)
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000002',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000008'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select bank_account_id from supplier_payment_test_ids)
  ),
  '55000',
  'Employee requires the current open business day',
  'employee cannot record payment on a closed day'
);
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000001',
  true
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000009'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select bank_account_id from supplier_payment_test_ids)
  ),
  '22023',
  'Historical payments require an audit reason',
  'administrator historical payment requires audit reason'
);
select extensions.lives_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000010',
        'Late supplier payment',
        'oldest_first',
        '[]'::jsonb,
        'Payment entered after day closing'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select bank_account_id from supplier_payment_test_ids)
  ),
  'administrator can record audited historical supplier payment'
);
select extensions.is(
  (
    select payment.entry_origin || '|' || audit.reason
    from public.supplier_payments as payment
    inner join public.audit_logs as audit
      on audit.entity_id = payment.id
      and audit.action = 'supplier_payment.created'
    where payment.idempotency_key =
      'c1000000-0000-4000-8000-000000000010'
  ),
  'admin_historical|Payment entered after day closing',
  'historical payment origin and audit reason are preserved'
);

update supplier_payment_test_ids
set rounding_purchase_id = public.create_supplier_purchase(
  business_id,
  supplier_id,
  payment_day_id,
  'USD',
  '0.03',
  '4.33333333',
  warehouse_id,
  'Historical rounding purchase',
  null,
  'Rounding purchase entered after closing'
);
select public.create_supplier_payment(
  business_id,
  payment_day_id,
  supplier_id,
  'USD',
  '0.01',
  '4.50',
  bank_account_id,
  'c1000000-0000-4000-8000-000000000012',
  'First rounding payment',
  'manual',
  jsonb_build_array(
    jsonb_build_object(
      'purchase_id',
      rounding_purchase_id,
      'amount_original',
      '0.01'
    )
  ),
  'First rounding payment after closing'
)
from supplier_payment_test_ids;
select public.create_supplier_payment(
  business_id,
  payment_day_id,
  supplier_id,
  'USD',
  '0.01',
  '4.50',
  bank_account_id,
  'c1000000-0000-4000-8000-000000000013',
  'Second rounding payment',
  'manual',
  jsonb_build_array(
    jsonb_build_object(
      'purchase_id',
      rounding_purchase_id,
      'amount_original',
      '0.01'
    )
  ),
  'Second rounding payment after closing'
)
from supplier_payment_test_ids;
select public.create_supplier_payment(
  business_id,
  payment_day_id,
  supplier_id,
  'USD',
  '0.01',
  '4.50',
  bank_account_id,
  'c1000000-0000-4000-8000-000000000014',
  'Final rounding payment',
  'manual',
  jsonb_build_array(
    jsonb_build_object(
      'purchase_id',
      rounding_purchase_id,
      'amount_original',
      '0.01'
    )
  ),
  'Final rounding payment after closing'
)
from supplier_payment_test_ids;
select extensions.is(
  (
    select
      allocation.allocated_original_amount::text
      || '|'
      || allocation.historical_ron_value::text
      || '|'
      || allocation.actual_ron_value::text
      || '|'
      || allocation.currency_gain_loss_ron::text
    from public.supplier_payment_allocations as allocation
    inner join public.supplier_payments as payment
      on payment.id = allocation.supplier_payment_id
    where payment.idempotency_key =
      'c1000000-0000-4000-8000-000000000014'
  ),
  '0.01|0.05|0.05|0.00',
  'final allocation absorbs historical purchase rounding remainder'
);
select extensions.is(
  (
    select derived_status || '|' || remaining_historical_ron
    from public.supplier_purchase_summaries
    where purchase_id = (
      select rounding_purchase_id from supplier_payment_test_ids
    )
  ),
  'paid|0.00',
  'fully paid purchase has exactly zero historical payable'
);

select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-4000-8000-000000000003',
  true
);
update supplier_payment_test_ids
set other_business_id = public.create_business_foundation(
  'Other Supplier Payment Business',
  'Europe/Bucharest'
);
select extensions.is(
  (select count(*) from public.supplier_payments),
  0::bigint,
  'RLS hides supplier payments from another business'
);
select extensions.is(
  (select count(*) from public.supplier_payment_allocations),
  0::bigint,
  'RLS hides supplier allocations from another business'
);
select extensions.throws_ok(
  format(
    $sql$
      select public.create_supplier_payment(
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'RON',
        '10.00',
        '',
        %L::uuid,
        'c1000000-0000-4000-8000-000000000011'
      )
    $sql$,
    (select business_id from supplier_payment_test_ids),
    (select payment_day_id from supplier_payment_test_ids),
    (select supplier_id from supplier_payment_test_ids),
    (select bank_account_id from supplier_payment_test_ids)
  ),
  '42501',
  'Active business membership is required',
  'another business administrator cannot create payment in this tenant'
);

select extensions.finish();
rollback;
