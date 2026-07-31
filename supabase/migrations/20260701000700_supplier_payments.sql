begin;

alter table public.supplier_purchases
  add constraint supplier_purchases_business_id_id_key
  unique (business_id, id);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null references public.business_days (id),
  supplier_id uuid not null references public.suppliers (id),
  payment_date date not null,
  currency public.transaction_currency not null,
  original_amount_paid numeric(18, 2) not null,
  payment_exchange_rate numeric(18, 8),
  actual_amount_ron numeric(18, 2) not null,
  financial_account_id uuid not null references public.financial_accounts (id),
  currency_gain_loss_ron numeric(18, 2) not null default 0,
  notes text,
  entry_origin text not null,
  allocation_strategy text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.supplier_payments (id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint supplier_payments_business_id_id_key
    unique (business_id, id),
  constraint supplier_payments_idempotency_key
    unique (business_id, idempotency_key),
  constraint supplier_payments_original_amount_positive
    check (original_amount_paid > 0),
  constraint supplier_payments_actual_amount_positive
    check (actual_amount_ron > 0),
  constraint supplier_payments_exchange_rate_positive
    check (
      payment_exchange_rate is null
      or payment_exchange_rate > 0
    ),
  constraint supplier_payments_currency_values_consistent
    check (
      (
        currency = 'RON'
        and payment_exchange_rate is null
        and actual_amount_ron = original_amount_paid
        and currency_gain_loss_ron = 0
      )
      or (
        currency = 'USD'
        and payment_exchange_rate is not null
        and actual_amount_ron = round(
          original_amount_paid * payment_exchange_rate,
          2
        )
      )
    ),
  constraint supplier_payments_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  constraint supplier_payments_origin_valid
    check (entry_origin in ('operational', 'admin_historical')),
  constraint supplier_payments_allocation_strategy_valid
    check (allocation_strategy in ('oldest_first', 'manual')),
  constraint supplier_payments_reversal_consistent
    check (
      (
        reversed_at is null
        and reversed_by is null
        and reversal_reason is null
      )
      or (
        reversed_at is not null
        and reversed_by is not null
        and reversal_reason is not null
        and char_length(btrim(reversal_reason)) between 10 and 500
      )
    ),
  constraint supplier_payments_not_self_reversal
    check (reversal_of_id is null or reversal_of_id <> id),
  constraint supplier_payments_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint supplier_payments_supplier_business_fkey
    foreign key (business_id, supplier_id)
    references public.suppliers (business_id, id),
  constraint supplier_payments_account_business_fkey
    foreign key (business_id, financial_account_id)
    references public.financial_accounts (business_id, id)
);

create table public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  supplier_payment_id uuid not null references public.supplier_payments (id),
  supplier_purchase_id uuid not null references public.supplier_purchases (id),
  allocated_original_amount numeric(18, 2) not null,
  historical_ron_value numeric(18, 2) not null,
  actual_ron_value numeric(18, 2) not null,
  currency_gain_loss_ron numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  constraint supplier_payment_allocations_original_positive
    check (allocated_original_amount > 0),
  constraint supplier_payment_allocations_historical_positive
    check (historical_ron_value > 0),
  constraint supplier_payment_allocations_actual_positive
    check (actual_ron_value > 0),
  constraint supplier_payment_allocations_payment_purchase_key
    unique (supplier_payment_id, supplier_purchase_id),
  constraint supplier_payment_allocations_payment_business_fkey
    foreign key (business_id, supplier_payment_id)
    references public.supplier_payments (business_id, id),
  constraint supplier_payment_allocations_purchase_business_fkey
    foreign key (business_id, supplier_purchase_id)
    references public.supplier_purchases (business_id, id)
);

create index supplier_payments_supplier_currency_date_idx
  on public.supplier_payments (
    supplier_id,
    currency,
    payment_date,
    created_at
  );
create index supplier_payments_account_date_idx
  on public.supplier_payments (
    financial_account_id,
    payment_date,
    created_at
  );
create index supplier_payment_allocations_purchase_idx
  on public.supplier_payment_allocations (
    supplier_purchase_id,
    created_at
  );

alter table public.supplier_payments enable row level security;
alter table public.supplier_payment_allocations enable row level security;

create policy supplier_payments_select_member
on public.supplier_payments
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy supplier_payment_allocations_select_member
on public.supplier_payment_allocations
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.supplier_payments from anon, authenticated;
revoke all on table public.supplier_payment_allocations
  from anon, authenticated;
grant select on table public.supplier_payments to authenticated;
grant select on table public.supplier_payment_allocations to authenticated;
grant all on table public.supplier_payments to service_role;
grant all on table public.supplier_payment_allocations to service_role;

create unique index financial_account_entries_supplier_payment_source_idx
  on public.financial_account_entries (
    business_id,
    source_entity_id,
    entry_type
  )
  where source_entity_type = 'supplier_payment';

create function public.create_supplier_payment(
  target_business_id uuid,
  target_business_day_id uuid,
  target_supplier_id uuid,
  target_currency text,
  target_original_amount_paid text,
  target_payment_exchange_rate text,
  target_financial_account_id uuid,
  target_idempotency_key uuid,
  target_notes text default null,
  target_allocation_strategy text default 'oldest_first',
  target_manual_allocations jsonb default '[]'::jsonb,
  target_audit_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  caller_is_admin boolean;
  normalized_currency text := upper(btrim(target_currency));
  normalized_rate text := nullif(btrim(target_payment_exchange_rate), '');
  normalized_notes text := nullif(btrim(target_notes), '');
  normalized_reason text := nullif(btrim(target_audit_reason), '');
  manual_allocations jsonb := coalesce(
    target_manual_allocations,
    '[]'::jsonb
  );
  parsed_original_amount numeric;
  parsed_payment_rate numeric;
  parsed_actual_amount numeric;
  request_fingerprint text;
  existing_payment_id uuid;
  existing_fingerprint text;
  selected_day_date date;
  selected_day_status public.business_day_status;
  selected_account_active boolean;
  selected_account_currency text;
  supplier_exists boolean;
  total_outstanding numeric;
  payment_remaining numeric;
  allocation_amount numeric;
  allocation_total numeric := 0;
  allocation_historical numeric;
  allocation_actual numeric;
  allocation_gain_loss numeric;
  allocation_item jsonb;
  allocation_purchase_id uuid;
  allocation_purchase_remaining numeric;
  allocation_purchase_rate numeric;
  allocation_purchase_historical_remaining numeric;
  seen_purchase_ids uuid[] := '{}'::uuid[];
  purchase_record record;
  new_payment_id uuid;
  new_entry_origin text;
  recorded_allocations jsonb;
  allocated_actual_total numeric;
  actual_rounding_delta numeric;
  last_allocation_id uuid;
  total_gain_loss numeric;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);

  if normalized_currency is null
    or normalized_currency not in ('RON', 'USD')
  then
    raise exception 'Payment currency must be RON or USD'
      using errcode = '22023';
  end if;

  parsed_original_amount := private.parse_positive_ron_amount(
    target_original_amount_paid,
    'Supplier payment amount'
  );

  if normalized_currency = 'RON' then
    if normalized_rate is not null then
      raise exception 'RON payments must not include an exchange rate'
        using errcode = '22023';
    end if;

    parsed_payment_rate := null;
    parsed_actual_amount := parsed_original_amount;
  else
    parsed_payment_rate := private.parse_positive_exchange_rate(
      normalized_rate,
      'Payment exchange rate'
    );
    parsed_actual_amount := round(
      parsed_original_amount * parsed_payment_rate,
      2
    );
  end if;

  if target_idempotency_key is null then
    raise exception 'Payment request identifier is required'
      using errcode = '22023';
  end if;

  if normalized_notes is not null and char_length(normalized_notes) > 500 then
    raise exception 'Payment notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Audit reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  if target_allocation_strategy is null
    or target_allocation_strategy not in ('oldest_first', 'manual')
  then
    raise exception 'Unknown payment allocation strategy'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(manual_allocations) <> 'array'
    or pg_catalog.jsonb_array_length(manual_allocations) > 200
  then
    raise exception 'Manual allocations must be an array of at most 200 items'
      using errcode = '22023';
  end if;

  if target_allocation_strategy = 'manual' then
    if not caller_is_admin then
      raise exception 'Administrator access is required for manual allocation'
        using errcode = '42501';
    end if;

    if pg_catalog.jsonb_array_length(manual_allocations) = 0 then
      raise exception 'Manual allocation requires at least one purchase'
        using errcode = '22023';
    end if;
  elsif pg_catalog.jsonb_array_length(manual_allocations) <> 0 then
    raise exception 'Oldest-first allocation must not include manual items'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'business_day_id', target_business_day_id,
      'supplier_id', target_supplier_id,
      'currency', normalized_currency,
      'original_amount_paid', parsed_original_amount,
      'payment_exchange_rate', parsed_payment_rate,
      'actual_amount_ron', parsed_actual_amount,
      'financial_account_id', target_financial_account_id,
      'notes', normalized_notes,
      'allocation_strategy', target_allocation_strategy,
      'manual_allocations', manual_allocations,
      'audit_reason', normalized_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9120
    )
  );

  select payment.id, payment.request_fingerprint
  into existing_payment_id, existing_fingerprint
  from public.supplier_payments as payment
  where payment.business_id = target_business_id
    and payment.idempotency_key = target_idempotency_key;

  if existing_payment_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Payment request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_payment_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text
        || ':'
        || target_supplier_id::text
        || ':'
        || normalized_currency,
      9121
    )
  );

  select day.business_date, day.status
  into selected_day_date, selected_day_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for share;

  if selected_day_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if not caller_is_admin and selected_day_status <> 'open' then
    raise exception 'Employee requires the current open business day'
      using errcode = '55000';
  end if;

  if selected_day_status = 'closed' then
    if not caller_is_admin then
      raise exception 'Administrator access is required for historical payments'
        using errcode = '42501';
    end if;

    if normalized_reason is null then
      raise exception 'Historical payments require an audit reason'
        using errcode = '22023';
    end if;

    new_entry_origin := 'admin_historical';
  else
    new_entry_origin := 'operational';
  end if;

  select account.is_active, account.currency
  into selected_account_active, selected_account_currency
  from public.financial_accounts as account
  where account.id = target_financial_account_id
    and account.business_id = target_business_id
  for share;

  if selected_account_active is null then
    raise exception 'Financial account does not exist'
      using errcode = '22023';
  end if;

  if not selected_account_active or selected_account_currency <> 'RON' then
    raise exception 'Supplier payment requires an active RON account'
      using errcode = '55000';
  end if;

  select true
  into supplier_exists
  from public.suppliers as supplier
  where supplier.id = target_supplier_id
    and supplier.business_id = target_business_id
  for share;

  if supplier_exists is null then
    raise exception 'Supplier does not exist'
      using errcode = '22023';
  end if;

  perform purchase.id
  from public.supplier_purchases as purchase
  where purchase.business_id = target_business_id
    and purchase.supplier_id = target_supplier_id
    and purchase.currency::text = normalized_currency
    and purchase.reversed_at is null
  order by purchase.purchase_date, purchase.created_at, purchase.id
  for update;

  select coalesce(
    sum(
      purchase.original_amount
        - coalesce(active_allocations.allocated_original_amount, 0)
    ),
    0
  )
  into total_outstanding
  from public.supplier_purchases as purchase
  left join lateral (
    select sum(allocation.allocated_original_amount)
      as allocated_original_amount
    from public.supplier_payment_allocations as allocation
    inner join public.supplier_payments as payment
      on payment.id = allocation.supplier_payment_id
      and payment.reversed_at is null
    where allocation.supplier_purchase_id = purchase.id
  ) as active_allocations on true
  where purchase.business_id = target_business_id
    and purchase.supplier_id = target_supplier_id
    and purchase.currency::text = normalized_currency
    and purchase.reversed_at is null;

  if parsed_original_amount > total_outstanding then
    raise exception 'Supplier payment exceeds outstanding payable'
      using errcode = '22023';
  end if;

  insert into public.supplier_payments (
    business_id,
    business_day_id,
    supplier_id,
    payment_date,
    currency,
    original_amount_paid,
    payment_exchange_rate,
    actual_amount_ron,
    financial_account_id,
    currency_gain_loss_ron,
    notes,
    entry_origin,
    allocation_strategy,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    target_supplier_id,
    selected_day_date,
    normalized_currency::public.transaction_currency,
    parsed_original_amount,
    parsed_payment_rate,
    parsed_actual_amount,
    target_financial_account_id,
    0,
    normalized_notes,
    new_entry_origin,
    target_allocation_strategy,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  )
  returning id into new_payment_id;

  if target_allocation_strategy = 'manual' then
    for allocation_item in
      select item.value
      from pg_catalog.jsonb_array_elements(manual_allocations)
        as item(value)
    loop
      if pg_catalog.jsonb_typeof(allocation_item) <> 'object'
        or not allocation_item ? 'purchase_id'
        or not allocation_item ? 'amount_original'
        or allocation_item - array['purchase_id', 'amount_original']
          <> '{}'::jsonb
      then
        raise exception 'Each manual allocation has invalid fields'
          using errcode = '22023';
      end if;

      begin
        allocation_purchase_id := (allocation_item ->> 'purchase_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Manual allocation purchase is invalid'
            using errcode = '22023';
      end;

      if allocation_purchase_id = any(seen_purchase_ids) then
        raise exception 'Manual allocation contains a duplicate purchase'
          using errcode = '22023';
      end if;

      seen_purchase_ids := pg_catalog.array_append(
        seen_purchase_ids,
        allocation_purchase_id
      );
      allocation_amount := private.parse_positive_ron_amount(
        allocation_item ->> 'amount_original',
        'Manual allocation amount'
      );

      select
        purchase.original_amount
          - coalesce(active_allocations.allocated_original_amount, 0),
        purchase.purchase_exchange_rate,
        purchase.inventory_cost_ron
          - coalesce(active_allocations.historical_ron_value, 0)
      into
        allocation_purchase_remaining,
        allocation_purchase_rate,
        allocation_purchase_historical_remaining
      from public.supplier_purchases as purchase
      left join lateral (
        select
          sum(allocation.allocated_original_amount)
            as allocated_original_amount,
          sum(allocation.historical_ron_value) as historical_ron_value
        from public.supplier_payment_allocations as allocation
        inner join public.supplier_payments as payment
          on payment.id = allocation.supplier_payment_id
          and payment.reversed_at is null
        where allocation.supplier_purchase_id = purchase.id
      ) as active_allocations on true
      where purchase.id = allocation_purchase_id
        and purchase.business_id = target_business_id
        and purchase.supplier_id = target_supplier_id
        and purchase.currency::text = normalized_currency
        and purchase.reversed_at is null;

      if allocation_purchase_remaining is null then
        raise exception 'Manual allocation purchase is unavailable or has a different currency'
          using errcode = '22023';
      end if;

      if allocation_amount > allocation_purchase_remaining then
        raise exception 'Manual allocation exceeds purchase outstanding balance'
          using errcode = '22023';
      end if;

      allocation_historical := case
        when allocation_amount = allocation_purchase_remaining
          then allocation_purchase_historical_remaining
        when normalized_currency = 'USD'
          then round(allocation_amount * allocation_purchase_rate, 2)
        else allocation_amount
      end;
      allocation_actual := case
        when normalized_currency = 'USD'
          then round(allocation_amount * parsed_payment_rate, 2)
        else allocation_amount
      end;
      allocation_gain_loss := allocation_actual - allocation_historical;

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
        target_business_id,
        new_payment_id,
        allocation_purchase_id,
        allocation_amount,
        allocation_historical,
        allocation_actual,
        allocation_gain_loss
      );

      allocation_total := allocation_total + allocation_amount;
    end loop;

    if allocation_total <> parsed_original_amount then
      raise exception 'Manual allocations must equal the payment amount'
        using errcode = '22023';
    end if;
  else
    payment_remaining := parsed_original_amount;

    for purchase_record in
      select
        purchase.id,
        purchase.purchase_exchange_rate,
        purchase.original_amount
          - coalesce(active_allocations.allocated_original_amount, 0)
          as remaining_original,
        purchase.inventory_cost_ron
          - coalesce(active_allocations.historical_ron_value, 0)
          as remaining_historical
      from public.supplier_purchases as purchase
      left join lateral (
        select
          sum(allocation.allocated_original_amount)
            as allocated_original_amount,
          sum(allocation.historical_ron_value) as historical_ron_value
        from public.supplier_payment_allocations as allocation
        inner join public.supplier_payments as payment
          on payment.id = allocation.supplier_payment_id
          and payment.reversed_at is null
        where allocation.supplier_purchase_id = purchase.id
      ) as active_allocations on true
      where purchase.business_id = target_business_id
        and purchase.supplier_id = target_supplier_id
        and purchase.currency::text = normalized_currency
        and purchase.reversed_at is null
        and purchase.original_amount
          - coalesce(active_allocations.allocated_original_amount, 0) > 0
      order by purchase.purchase_date, purchase.created_at, purchase.id
    loop
      exit when payment_remaining = 0;
      allocation_amount := least(
        payment_remaining,
        purchase_record.remaining_original
      );
      allocation_historical := case
        when allocation_amount = purchase_record.remaining_original
          then purchase_record.remaining_historical
        when normalized_currency = 'USD'
          then round(
            allocation_amount * purchase_record.purchase_exchange_rate,
            2
          )
        else allocation_amount
      end;
      allocation_actual := case
        when normalized_currency = 'USD'
          then round(allocation_amount * parsed_payment_rate, 2)
        else allocation_amount
      end;
      allocation_gain_loss := allocation_actual - allocation_historical;

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
        target_business_id,
        new_payment_id,
        purchase_record.id,
        allocation_amount,
        allocation_historical,
        allocation_actual,
        allocation_gain_loss
      );

      allocation_total := allocation_total + allocation_amount;
      payment_remaining := payment_remaining - allocation_amount;
    end loop;

    if payment_remaining <> 0 then
      raise exception 'Supplier payment could not be fully allocated'
        using errcode = '40001';
    end if;
  end if;

  select
    coalesce(sum(allocation.actual_ron_value), 0),
    (
      array_agg(
        allocation.id
        order by allocation.created_at desc, allocation.id desc
      )
    )[1]
  into allocated_actual_total, last_allocation_id
  from public.supplier_payment_allocations as allocation
  where allocation.supplier_payment_id = new_payment_id;

  actual_rounding_delta := parsed_actual_amount - allocated_actual_total;

  if actual_rounding_delta <> 0 then
    update public.supplier_payment_allocations
    set
      actual_ron_value = actual_ron_value + actual_rounding_delta,
      currency_gain_loss_ron =
        currency_gain_loss_ron + actual_rounding_delta
    where id = last_allocation_id;
  end if;

  select coalesce(sum(allocation.currency_gain_loss_ron), 0)
  into total_gain_loss
  from public.supplier_payment_allocations as allocation
  where allocation.supplier_payment_id = new_payment_id;

  update public.supplier_payments
  set currency_gain_loss_ron = total_gain_loss
  where id = new_payment_id;

  insert into public.financial_account_entries (
    business_id,
    financial_account_id,
    entry_date,
    direction,
    amount_ron,
    entry_type,
    source_entity_type,
    source_entity_id,
    description,
    created_by
  )
  values (
    target_business_id,
    target_financial_account_id,
    selected_day_date,
    'outflow',
    parsed_actual_amount,
    'supplier_payment',
    'supplier_payment',
    new_payment_id,
    'Supplier payable payment',
    current_user_id
  );

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'purchase_id', allocation.supplier_purchase_id,
        'allocated_original_amount',
          allocation.allocated_original_amount,
        'historical_ron_value', allocation.historical_ron_value,
        'actual_ron_value', allocation.actual_ron_value,
        'currency_gain_loss_ron', allocation.currency_gain_loss_ron
      )
      order by purchase.purchase_date, purchase.created_at, purchase.id
    ),
    '[]'::jsonb
  )
  into recorded_allocations
  from public.supplier_payment_allocations as allocation
  inner join public.supplier_purchases as purchase
    on purchase.id = allocation.supplier_purchase_id
  where allocation.supplier_payment_id = new_payment_id;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data,
    reason
  )
  values (
    target_business_id,
    current_user_id,
    'supplier_payment.created',
    'supplier_payment',
    new_payment_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'supplier_id', target_supplier_id,
      'payment_date', selected_day_date,
      'currency', normalized_currency,
      'original_amount_paid', parsed_original_amount,
      'payment_exchange_rate', parsed_payment_rate,
      'actual_amount_ron', parsed_actual_amount,
      'currency_gain_loss_ron', total_gain_loss,
      'financial_account_id', target_financial_account_id,
      'allocation_strategy', target_allocation_strategy,
      'allocations', recorded_allocations,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  return new_payment_id;
end;
$$;

create function public.reverse_supplier_payment(
  target_business_id uuid,
  target_payment_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := btrim(target_reason);
  reversal_time timestamptz := pg_catalog.now();
  payment_to_reverse public.supplier_payments%rowtype;
  original_ledger_entry public.financial_account_entries%rowtype;
  allocation_original_total numeric;
  allocation_actual_total numeric;
  allocation_gain_loss_total numeric;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if normalized_reason is null
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Reversal reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  select payment.*
  into payment_to_reverse
  from public.supplier_payments as payment
  where payment.id = target_payment_id
    and payment.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Supplier payment does not exist'
      using errcode = '22023';
  end if;

  if payment_to_reverse.reversed_at is not null then
    raise exception 'Supplier payment is already reversed'
      using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text
        || ':'
        || payment_to_reverse.supplier_id::text
        || ':'
        || payment_to_reverse.currency::text,
      9121
    )
  );

  select entry.*
  into original_ledger_entry
  from public.financial_account_entries as entry
  where entry.business_id = target_business_id
    and entry.source_entity_type = 'supplier_payment'
    and entry.source_entity_id = target_payment_id
    and entry.entry_type = 'supplier_payment'
  for update;

  if not found then
    raise exception 'Supplier payment ledger entry does not exist'
      using errcode = '55000';
  end if;

  select
    coalesce(sum(allocation.allocated_original_amount), 0),
    coalesce(sum(allocation.actual_ron_value), 0),
    coalesce(sum(allocation.currency_gain_loss_ron), 0)
  into
    allocation_original_total,
    allocation_actual_total,
    allocation_gain_loss_total
  from public.supplier_payment_allocations as allocation
  where allocation.supplier_payment_id = target_payment_id;

  if allocation_original_total <> payment_to_reverse.original_amount_paid
    or allocation_actual_total <> payment_to_reverse.actual_amount_ron
    or allocation_gain_loss_total
      <> payment_to_reverse.currency_gain_loss_ron
  then
    raise exception 'Supplier payment allocations are inconsistent'
      using errcode = '55000';
  end if;

  update public.supplier_payments
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_payment_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Supplier payment reversal lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.financial_account_entries (
    business_id,
    financial_account_id,
    entry_date,
    direction,
    amount_ron,
    entry_type,
    source_entity_type,
    source_entity_id,
    description,
    created_by,
    reversal_of_id
  )
  values (
    target_business_id,
    original_ledger_entry.financial_account_id,
    original_ledger_entry.entry_date,
    'inflow',
    original_ledger_entry.amount_ron,
    'supplier_payment_reversal',
    'supplier_payment',
    target_payment_id,
    'Supplier payment reversal',
    current_user_id,
    original_ledger_entry.id
  );

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_data,
    new_data,
    reason
  )
  values (
    target_business_id,
    current_user_id,
    'supplier_payment.reversed',
    'supplier_payment',
    target_payment_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'original_amount_paid', payment_to_reverse.original_amount_paid,
      'actual_amount_ron', payment_to_reverse.actual_amount_ron,
      'currency_gain_loss_ron',
        payment_to_reverse.currency_gain_loss_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time,
      'allocations_effective', false
    ),
    normalized_reason
  );
end;
$$;

create function private.prevent_allocated_supplier_purchase_reversal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.reversed_at is null
    and new.reversed_at is not null
    and exists (
      select 1
      from public.supplier_payment_allocations as allocation
      inner join public.supplier_payments as payment
        on payment.id = allocation.supplier_payment_id
        and payment.reversed_at is null
      where allocation.supplier_purchase_id = old.id
    )
  then
    raise exception 'Reverse allocated supplier payments before the purchase'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_allocated_supplier_purchase_reversal()
  from public;

create trigger supplier_purchase_prevent_allocated_reversal
before update of reversed_at on public.supplier_purchases
for each row
execute function private.prevent_allocated_supplier_purchase_reversal();

create or replace view public.supplier_purchase_summaries
with (security_invoker = true)
as
select
  purchase.id as purchase_id,
  purchase.business_id,
  purchase.business_day_id,
  purchase.supplier_id,
  supplier.name as supplier_name,
  purchase.purchase_date,
  purchase.currency,
  purchase.original_amount::text as original_amount,
  purchase.purchase_exchange_rate::text as purchase_exchange_rate,
  purchase.inventory_cost_ron::text as inventory_cost_ron,
  purchase.destination_location_id,
  location.name as destination_location_name,
  location.type as destination_location_type,
  purchase.description,
  purchase.due_date,
  purchase.entry_origin,
  purchase.created_by,
  purchase.created_at,
  case
    when purchase.reversed_at is not null then 'reversed'
    when coalesce(active_allocations.allocated_original_amount, 0) = 0
      then 'unpaid'
    when coalesce(active_allocations.allocated_original_amount, 0)
      = purchase.original_amount
      then 'paid'
    else 'partial'
  end as derived_status,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason,
  coalesce(
    active_allocations.allocated_original_amount,
    0
  )::text as allocated_original_amount,
  (
    case
      when purchase.reversed_at is null
        then purchase.original_amount
          - coalesce(active_allocations.allocated_original_amount, 0)
      else 0::numeric
    end
  )::text as remaining_original_amount,
  (
    case
      when purchase.reversed_at is null
        then purchase.inventory_cost_ron
          - coalesce(active_allocations.historical_ron_value, 0)
      else 0::numeric
    end
  )::text as remaining_historical_ron
from public.supplier_purchases as purchase
inner join public.suppliers as supplier
  on supplier.id = purchase.supplier_id
  and supplier.business_id = purchase.business_id
left join public.inventory_locations as location
  on location.id = purchase.destination_location_id
  and location.business_id = purchase.business_id
left join lateral (
  select
    sum(allocation.allocated_original_amount)
      as allocated_original_amount,
    sum(allocation.historical_ron_value) as historical_ron_value
  from public.supplier_payment_allocations as allocation
  inner join public.supplier_payments as payment
    on payment.id = allocation.supplier_payment_id
    and payment.reversed_at is null
  where allocation.supplier_purchase_id = purchase.id
) as active_allocations on true;

create or replace view public.supplier_payable_balances
with (security_invoker = true)
as
select
  supplier.id as supplier_id,
  supplier.business_id,
  supplier.name,
  purchase.currency,
  coalesce(
    sum(
      purchase.original_amount
        - coalesce(active_allocations.allocated_original_amount, 0)
    ),
    0
  )::text as outstanding_original_amount,
  coalesce(
    sum(
      purchase.inventory_cost_ron
        - coalesce(active_allocations.historical_ron_value, 0)
    ),
    0
  )::text as historical_ron_amount
from public.suppliers as supplier
inner join public.supplier_purchases as purchase
  on purchase.supplier_id = supplier.id
  and purchase.reversed_at is null
left join lateral (
  select
    sum(allocation.allocated_original_amount)
      as allocated_original_amount,
    sum(allocation.historical_ron_value) as historical_ron_value
  from public.supplier_payment_allocations as allocation
  inner join public.supplier_payments as payment
    on payment.id = allocation.supplier_payment_id
    and payment.reversed_at is null
  where allocation.supplier_purchase_id = purchase.id
) as active_allocations on true
group by
  supplier.id,
  supplier.business_id,
  supplier.name,
  purchase.currency
having sum(
  purchase.original_amount
    - coalesce(active_allocations.allocated_original_amount, 0)
) > 0;

create view public.supplier_payment_summaries
with (security_invoker = true)
as
select
  payment.id as payment_id,
  payment.business_id,
  payment.business_day_id,
  payment.supplier_id,
  payment.payment_date,
  payment.currency,
  payment.original_amount_paid::text as original_amount_paid,
  payment.payment_exchange_rate::text as payment_exchange_rate,
  payment.actual_amount_ron::text as actual_amount_ron,
  payment.currency_gain_loss_ron::text as currency_gain_loss_ron,
  payment.financial_account_id,
  account.name as financial_account_name,
  account.type as financial_account_type,
  payment.notes,
  payment.entry_origin,
  payment.allocation_strategy,
  payment.created_by,
  payment.created_at,
  payment.reversed_at,
  payment.reversed_by,
  payment.reversal_reason,
  case
    when payment.reversed_at is null then 'active'
    else 'reversed'
  end as derived_status
from public.supplier_payments as payment
inner join public.financial_accounts as account
  on account.id = payment.financial_account_id;

create view public.supplier_payment_allocation_details
with (security_invoker = true)
as
select
  allocation.id as allocation_id,
  allocation.business_id,
  allocation.supplier_payment_id as payment_id,
  payment.supplier_id,
  allocation.supplier_purchase_id as purchase_id,
  purchase.purchase_date,
  payment.currency,
  allocation.allocated_original_amount::text
    as allocated_original_amount,
  allocation.historical_ron_value::text as historical_ron_value,
  allocation.actual_ron_value::text as actual_ron_value,
  allocation.currency_gain_loss_ron::text as currency_gain_loss_ron,
  allocation.created_at,
  payment.reversed_at as payment_reversed_at
from public.supplier_payment_allocations as allocation
inner join public.supplier_payments as payment
  on payment.id = allocation.supplier_payment_id
inner join public.supplier_purchases as purchase
  on purchase.id = allocation.supplier_purchase_id;

revoke all on table public.supplier_payment_summaries
  from anon, authenticated;
revoke all on table public.supplier_payment_allocation_details
  from anon, authenticated;
grant select on table public.supplier_payment_summaries
  to authenticated, service_role;
grant select on table public.supplier_payment_allocation_details
  to authenticated, service_role;

revoke all on function public.create_supplier_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function public.reverse_supplier_payment(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_supplier_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function public.reverse_supplier_payment(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.create_supplier_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Atomically allocates an idempotent supplier payment, records RON outflow, and calculates currency gain or loss.';
comment on function public.reverse_supplier_payment(uuid, uuid, text) is
  'Atomically restores supplier payable allocations and account balance for an administrator.';
comment on view public.supplier_payment_summaries is
  'Exposes immutable supplier payment history with exact decimal text.';
comment on view public.supplier_payment_allocation_details is
  'Exposes historical and actual RON values for each supplier payment allocation.';

commit;
