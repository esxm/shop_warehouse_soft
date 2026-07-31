begin;

alter table public.customer_credit_purchases
  add constraint customer_credit_purchases_business_id_id_key
  unique (business_id, id);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null references public.business_days (id),
  customer_id uuid not null references public.customers (id),
  payment_date date not null,
  amount_ron numeric(18, 2) not null,
  financial_account_id uuid not null references public.financial_accounts (id),
  notes text,
  entry_origin text not null,
  allocation_strategy text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.customer_payments (id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint customer_payments_business_id_id_key
    unique (business_id, id),
  constraint customer_payments_idempotency_key
    unique (business_id, idempotency_key),
  constraint customer_payments_amount_positive
    check (amount_ron > 0),
  constraint customer_payments_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  constraint customer_payments_origin_valid
    check (entry_origin in ('operational', 'admin_historical')),
  constraint customer_payments_allocation_strategy_valid
    check (allocation_strategy in ('oldest_first', 'manual')),
  constraint customer_payments_reversal_consistent
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
  constraint customer_payments_not_self_reversal
    check (reversal_of_id is null or reversal_of_id <> id),
  constraint customer_payments_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint customer_payments_customer_business_fkey
    foreign key (business_id, customer_id)
    references public.customers (business_id, id),
  constraint customer_payments_account_business_fkey
    foreign key (business_id, financial_account_id)
    references public.financial_accounts (business_id, id)
);

create table public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  payment_id uuid not null references public.customer_payments (id),
  customer_credit_purchase_id uuid not null
    references public.customer_credit_purchases (id),
  amount_ron numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  constraint customer_payment_allocations_amount_positive
    check (amount_ron > 0),
  constraint customer_payment_allocations_payment_purchase_key
    unique (payment_id, customer_credit_purchase_id),
  constraint customer_payment_allocations_payment_business_fkey
    foreign key (business_id, payment_id)
    references public.customer_payments (business_id, id),
  constraint customer_payment_allocations_purchase_business_fkey
    foreign key (business_id, customer_credit_purchase_id)
    references public.customer_credit_purchases (business_id, id)
);

create index customer_payments_customer_date_idx
  on public.customer_payments (customer_id, payment_date, created_at);
create index customer_payments_account_date_idx
  on public.customer_payments (
    financial_account_id,
    payment_date,
    created_at
  );
create index customer_payment_allocations_purchase_idx
  on public.customer_payment_allocations (
    customer_credit_purchase_id,
    created_at
  );

alter table public.customer_payments enable row level security;
alter table public.customer_payment_allocations enable row level security;

create policy customer_payments_select_member
on public.customer_payments
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy customer_payment_allocations_select_member
on public.customer_payment_allocations
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.customer_payments from anon, authenticated;
revoke all on table public.customer_payment_allocations
  from anon, authenticated;
grant select on table public.customer_payments to authenticated;
grant select on table public.customer_payment_allocations to authenticated;
grant all on table public.customer_payments to service_role;
grant all on table public.customer_payment_allocations to service_role;

create unique index financial_account_entries_one_reversal_idx
  on public.financial_account_entries (reversal_of_id)
  where reversal_of_id is not null;

create unique index financial_account_entries_customer_payment_source_idx
  on public.financial_account_entries (
    business_id,
    source_entity_id,
    entry_type
  )
  where source_entity_type = 'customer_payment';

create function public.create_customer_payment(
  target_business_id uuid,
  target_business_day_id uuid,
  target_customer_id uuid,
  target_amount_ron text,
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
  parsed_amount numeric;
  normalized_notes text := nullif(btrim(target_notes), '');
  normalized_reason text := nullif(btrim(target_audit_reason), '');
  manual_allocations jsonb := coalesce(
    target_manual_allocations,
    '[]'::jsonb
  );
  request_fingerprint text;
  existing_payment_id uuid;
  existing_fingerprint text;
  selected_day_date date;
  selected_day_status public.business_day_status;
  selected_account_active boolean;
  selected_account_currency text;
  customer_exists boolean;
  total_outstanding numeric;
  payment_remaining numeric;
  allocation_amount numeric;
  allocation_total numeric := 0;
  allocation_item jsonb;
  allocation_purchase_id uuid;
  allocation_purchase_remaining numeric;
  seen_purchase_ids uuid[] := '{}'::uuid[];
  purchase_record record;
  new_payment_id uuid;
  new_entry_origin text;
  recorded_allocations jsonb;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);
  parsed_amount := private.parse_positive_ron_amount(
    target_amount_ron,
    'Customer payment amount'
  );

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
      'customer_id', target_customer_id,
      'amount_ron', parsed_amount,
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
      9109
    )
  );

  select payment.id, payment.request_fingerprint
  into existing_payment_id, existing_fingerprint
  from public.customer_payments as payment
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
      target_business_id::text || ':' || target_customer_id::text,
      9110
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
    raise exception 'Customer payment requires an active RON account'
      using errcode = '55000';
  end if;

  select true
  into customer_exists
  from public.customers as customer
  where customer.id = target_customer_id
    and customer.business_id = target_business_id
  for share;

  if customer_exists is null then
    raise exception 'Customer does not exist'
      using errcode = '22023';
  end if;

  perform purchase.id
  from public.customer_credit_purchases as purchase
  where purchase.business_id = target_business_id
    and purchase.customer_id = target_customer_id
    and purchase.reversed_at is null
  order by purchase.purchase_date, purchase.created_at, purchase.id
  for update;

  select coalesce(
    sum(
      purchase.amount_ron
      - coalesce(active_allocations.allocated_ron, 0)
    ),
    0
  )
  into total_outstanding
  from public.customer_credit_purchases as purchase
  left join lateral (
    select sum(allocation.amount_ron) as allocated_ron
    from public.customer_payment_allocations as allocation
    inner join public.customer_payments as payment
      on payment.id = allocation.payment_id
      and payment.reversed_at is null
    where allocation.customer_credit_purchase_id = purchase.id
  ) as active_allocations on true
  where purchase.business_id = target_business_id
    and purchase.customer_id = target_customer_id
    and purchase.reversed_at is null;

  if parsed_amount > total_outstanding then
    raise exception 'Customer payment exceeds outstanding receivables'
      using errcode = '22023';
  end if;

  insert into public.customer_payments (
    business_id,
    business_day_id,
    customer_id,
    payment_date,
    amount_ron,
    financial_account_id,
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
    target_customer_id,
    selected_day_date,
    parsed_amount,
    target_financial_account_id,
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
        or not allocation_item ? 'amount_ron'
        or allocation_item - array['purchase_id', 'amount_ron']
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
        allocation_item ->> 'amount_ron',
        'Manual allocation amount'
      );

      select
        purchase.amount_ron
        - coalesce(active_allocations.allocated_ron, 0)
      into allocation_purchase_remaining
      from public.customer_credit_purchases as purchase
      left join lateral (
        select sum(allocation.amount_ron) as allocated_ron
        from public.customer_payment_allocations as allocation
        inner join public.customer_payments as payment
          on payment.id = allocation.payment_id
          and payment.reversed_at is null
        where allocation.customer_credit_purchase_id = purchase.id
      ) as active_allocations on true
      where purchase.id = allocation_purchase_id
        and purchase.business_id = target_business_id
        and purchase.customer_id = target_customer_id
        and purchase.reversed_at is null;

      if allocation_purchase_remaining is null then
        raise exception 'Manual allocation purchase is unavailable'
          using errcode = '22023';
      end if;

      if allocation_amount > allocation_purchase_remaining then
        raise exception 'Manual allocation exceeds purchase outstanding balance'
          using errcode = '22023';
      end if;

      insert into public.customer_payment_allocations (
        business_id,
        payment_id,
        customer_credit_purchase_id,
        amount_ron
      )
      values (
        target_business_id,
        new_payment_id,
        allocation_purchase_id,
        allocation_amount
      );

      allocation_total := allocation_total + allocation_amount;
    end loop;

    if allocation_total <> parsed_amount then
      raise exception 'Manual allocations must equal the payment amount'
        using errcode = '22023';
    end if;
  else
    payment_remaining := parsed_amount;

    for purchase_record in
      select
        purchase.id,
        purchase.amount_ron
          - coalesce(active_allocations.allocated_ron, 0)
          as remaining_ron
      from public.customer_credit_purchases as purchase
      left join lateral (
        select sum(allocation.amount_ron) as allocated_ron
        from public.customer_payment_allocations as allocation
        inner join public.customer_payments as payment
          on payment.id = allocation.payment_id
          and payment.reversed_at is null
        where allocation.customer_credit_purchase_id = purchase.id
      ) as active_allocations on true
      where purchase.business_id = target_business_id
        and purchase.customer_id = target_customer_id
        and purchase.reversed_at is null
        and purchase.amount_ron
          - coalesce(active_allocations.allocated_ron, 0) > 0
      order by purchase.purchase_date, purchase.created_at, purchase.id
    loop
      exit when payment_remaining = 0;
      allocation_amount := least(
        payment_remaining,
        purchase_record.remaining_ron
      );

      insert into public.customer_payment_allocations (
        business_id,
        payment_id,
        customer_credit_purchase_id,
        amount_ron
      )
      values (
        target_business_id,
        new_payment_id,
        purchase_record.id,
        allocation_amount
      );

      payment_remaining := payment_remaining - allocation_amount;
    end loop;

    if payment_remaining <> 0 then
      raise exception 'Customer payment could not be fully allocated'
        using errcode = '40001';
    end if;
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
    created_by
  )
  values (
    target_business_id,
    target_financial_account_id,
    selected_day_date,
    'inflow',
    parsed_amount,
    'customer_payment',
    'customer_payment',
    new_payment_id,
    'Customer receivable payment',
    current_user_id
  );

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'purchase_id', allocation.customer_credit_purchase_id,
        'amount_ron', allocation.amount_ron
      )
      order by purchase.purchase_date, purchase.created_at, purchase.id
    ),
    '[]'::jsonb
  )
  into recorded_allocations
  from public.customer_payment_allocations as allocation
  inner join public.customer_credit_purchases as purchase
    on purchase.id = allocation.customer_credit_purchase_id
  where allocation.payment_id = new_payment_id;

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
    'customer_payment.created',
    'customer_payment',
    new_payment_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'customer_id', target_customer_id,
      'payment_date', selected_day_date,
      'amount_ron', parsed_amount,
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

create function public.reverse_customer_payment(
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
  payment_to_reverse public.customer_payments%rowtype;
  original_ledger_entry public.financial_account_entries%rowtype;
  allocation_total numeric;
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
  from public.customer_payments as payment
  where payment.id = target_payment_id
    and payment.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Customer payment does not exist'
      using errcode = '22023';
  end if;

  if payment_to_reverse.reversed_at is not null then
    raise exception 'Customer payment is already reversed'
      using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || payment_to_reverse.customer_id::text,
      9110
    )
  );

  select entry.*
  into original_ledger_entry
  from public.financial_account_entries as entry
  where entry.business_id = target_business_id
    and entry.source_entity_type = 'customer_payment'
    and entry.source_entity_id = target_payment_id
    and entry.entry_type = 'customer_payment'
  for update;

  if not found then
    raise exception 'Customer payment ledger entry does not exist'
      using errcode = '55000';
  end if;

  select coalesce(sum(allocation.amount_ron), 0)
  into allocation_total
  from public.customer_payment_allocations as allocation
  where allocation.payment_id = target_payment_id;

  if allocation_total <> payment_to_reverse.amount_ron then
    raise exception 'Customer payment allocations are inconsistent'
      using errcode = '55000';
  end if;

  update public.customer_payments
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_payment_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Customer payment reversal lost a concurrency race'
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
    'outflow',
    original_ledger_entry.amount_ron,
    'customer_payment_reversal',
    'customer_payment',
    target_payment_id,
    'Customer payment reversal',
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
    'customer_payment.reversed',
    'customer_payment',
    target_payment_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'amount_ron', payment_to_reverse.amount_ron,
      'allocated_ron', allocation_total
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

create function private.prevent_allocated_purchase_reversal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.reversed_at is null
    and new.reversed_at is not null
    and exists (
      select 1
      from public.customer_payment_allocations as allocation
      inner join public.customer_payments as payment
        on payment.id = allocation.payment_id
        and payment.reversed_at is null
      where allocation.customer_credit_purchase_id = old.id
    )
  then
    raise exception 'Reverse allocated customer payments before the purchase'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_allocated_purchase_reversal()
  from public;

create trigger customer_credit_purchase_prevent_allocated_reversal
before update of reversed_at on public.customer_credit_purchases
for each row
execute function private.prevent_allocated_purchase_reversal();

create or replace view public.customer_credit_purchase_balances
with (security_invoker = true)
as
select
  purchase.id as purchase_id,
  purchase.business_id,
  purchase.business_day_id,
  purchase.customer_id,
  purchase.purchase_date,
  purchase.amount_ron::text as amount_ron,
  coalesce(active_allocations.allocated_ron, 0)::text as allocated_ron,
  (
    case
      when purchase.reversed_at is null
        then purchase.amount_ron
          - coalesce(active_allocations.allocated_ron, 0)
      else 0::numeric
    end
  )::text as remaining_ron,
  case
    when purchase.reversed_at is not null then 'reversed'
    when coalesce(active_allocations.allocated_ron, 0) = 0 then 'unpaid'
    when coalesce(active_allocations.allocated_ron, 0) = purchase.amount_ron
      then 'paid'
    else 'partial'
  end as derived_status,
  purchase.description,
  purchase.due_date,
  purchase.entry_origin,
  purchase.created_by,
  purchase.created_at,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason
from public.customer_credit_purchases as purchase
left join lateral (
  select sum(allocation.amount_ron) as allocated_ron
  from public.customer_payment_allocations as allocation
  inner join public.customer_payments as payment
    on payment.id = allocation.payment_id
    and payment.reversed_at is null
  where allocation.customer_credit_purchase_id = purchase.id
) as active_allocations on true;

create or replace view public.customer_receivable_balances
with (security_invoker = true)
as
select
  customer.id as customer_id,
  customer.business_id,
  customer.name,
  coalesce(
    sum(
      case
        when purchase.reversed_at is null
          then purchase.amount_ron
            - coalesce(active_allocations.allocated_ron, 0)
        else 0::numeric
      end
    ),
    0
  )::text as outstanding_ron
from public.customers as customer
left join public.customer_credit_purchases as purchase
  on purchase.customer_id = customer.id
left join lateral (
  select sum(allocation.amount_ron) as allocated_ron
  from public.customer_payment_allocations as allocation
  inner join public.customer_payments as payment
    on payment.id = allocation.payment_id
    and payment.reversed_at is null
  where allocation.customer_credit_purchase_id = purchase.id
) as active_allocations on true
group by customer.id, customer.business_id, customer.name;

create view public.customer_payment_summaries
with (security_invoker = true)
as
select
  payment.id as payment_id,
  payment.business_id,
  payment.business_day_id,
  payment.customer_id,
  payment.payment_date,
  payment.amount_ron::text as amount_ron,
  coalesce(sum(allocation.amount_ron), 0)::text as allocated_ron,
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
from public.customer_payments as payment
inner join public.financial_accounts as account
  on account.id = payment.financial_account_id
left join public.customer_payment_allocations as allocation
  on allocation.payment_id = payment.id
group by
  payment.id,
  payment.business_id,
  payment.business_day_id,
  payment.customer_id,
  payment.payment_date,
  payment.amount_ron,
  payment.financial_account_id,
  account.name,
  account.type,
  payment.notes,
  payment.entry_origin,
  payment.allocation_strategy,
  payment.created_by,
  payment.created_at,
  payment.reversed_at,
  payment.reversed_by,
  payment.reversal_reason;

create view public.customer_payment_allocation_details
with (security_invoker = true)
as
select
  allocation.id as allocation_id,
  allocation.business_id,
  allocation.payment_id,
  payment.customer_id,
  allocation.customer_credit_purchase_id as purchase_id,
  purchase.purchase_date,
  allocation.amount_ron::text as amount_ron,
  allocation.created_at,
  payment.reversed_at as payment_reversed_at
from public.customer_payment_allocations as allocation
inner join public.customer_payments as payment
  on payment.id = allocation.payment_id
inner join public.customer_credit_purchases as purchase
  on purchase.id = allocation.customer_credit_purchase_id;

revoke all on table public.customer_payment_summaries
  from anon, authenticated;
revoke all on table public.customer_payment_allocation_details
  from anon, authenticated;
grant select on table public.customer_payment_summaries
  to authenticated, service_role;
grant select on table public.customer_payment_allocation_details
  to authenticated, service_role;

revoke all on function public.create_customer_payment(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function public.reverse_customer_payment(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_customer_payment(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function public.reverse_customer_payment(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.create_customer_payment(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Atomically records and allocates an idempotent customer payment with one account-ledger inflow.';
comment on function public.reverse_customer_payment(uuid, uuid, text) is
  'Atomically reverses customer-payment allocations and account effect for an administrator.';
comment on view public.customer_payment_summaries is
  'Exposes immutable customer payment history with account and allocation totals.';
comment on view public.customer_payment_allocation_details is
  'Exposes preserved payment allocation lines with decimal amounts as text.';

commit;
