begin;

create type public.daily_sales_status as enum ('draft', 'closed');

create table public.daily_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null references public.business_days (id),
  cash_sales_ron numeric(18, 2) not null,
  bank_sales_ron numeric(18, 2) not null,
  credit_sales_ron numeric(18, 2) not null,
  total_sales_ron numeric(18, 2) not null,
  status public.daily_sales_status not null default 'draft',
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  constraint daily_sales_business_day_key
    unique (business_id, business_day_id),
  constraint daily_sales_business_id_id_key
    unique (business_id, id),
  constraint daily_sales_amounts_nonnegative
    check (
      cash_sales_ron >= 0
      and bank_sales_ron >= 0
      and credit_sales_ron >= 0
    ),
  constraint daily_sales_total_consistent
    check (
      total_sales_ron =
        cash_sales_ron + bank_sales_ron + credit_sales_ron
    ),
  constraint daily_sales_notes_valid
    check (
      notes is null
      or (
        btrim(notes) <> ''
        and char_length(notes) <= 500
      )
    ),
  constraint daily_sales_close_consistent
    check (
      (
        status = 'draft'
        and closed_at is null
        and closed_by is null
      )
      or (
        status = 'closed'
        and closed_at is not null
        and closed_by is not null
      )
    ),
  constraint daily_sales_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id)
);

create table public.daily_sales_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  daily_sales_id uuid not null references public.daily_sales (id),
  business_day_id uuid not null references public.business_days (id),
  close_sequence integer not null,
  cash_sales_ron numeric(18, 2) not null,
  bank_sales_ron numeric(18, 2) not null,
  credit_sales_ron numeric(18, 2) not null,
  total_sales_ron numeric(18, 2) not null,
  closed_by uuid not null references auth.users (id),
  closed_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint daily_sales_closures_business_id_id_key
    unique (business_id, id),
  constraint daily_sales_closures_sequence_key
    unique (daily_sales_id, close_sequence),
  constraint daily_sales_closures_amounts_nonnegative
    check (
      cash_sales_ron >= 0
      and bank_sales_ron >= 0
      and credit_sales_ron >= 0
    ),
  constraint daily_sales_closures_total_consistent
    check (
      total_sales_ron =
        cash_sales_ron + bank_sales_ron + credit_sales_ron
    ),
  constraint daily_sales_closures_reversal_consistent
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
  constraint daily_sales_closures_sales_business_fkey
    foreign key (business_id, daily_sales_id)
    references public.daily_sales (business_id, id),
  constraint daily_sales_closures_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id)
);

alter table public.daily_sales
  add column active_closure_id uuid,
  add constraint daily_sales_active_closure_business_fkey
    foreign key (business_id, active_closure_id)
    references public.daily_sales_closures (business_id, id),
  add constraint daily_sales_active_closure_consistent
    check (
      (status = 'draft' and active_closure_id is null)
      or (status = 'closed' and active_closure_id is not null)
    );

create index daily_sales_business_date_idx
  on public.daily_sales (business_id, created_at desc);
create index daily_sales_closures_sales_idx
  on public.daily_sales_closures (
    daily_sales_id,
    close_sequence desc
  );
create unique index financial_account_entries_daily_sales_source_idx
  on public.financial_account_entries (
    business_id,
    source_entity_id,
    entry_type
  )
  where source_entity_type = 'daily_sales_closure'
    and reversal_of_id is null;

alter table public.daily_sales enable row level security;
alter table public.daily_sales_closures enable row level security;

create policy daily_sales_select_member
on public.daily_sales
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy daily_sales_closures_select_member
on public.daily_sales_closures
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.daily_sales from anon, authenticated;
revoke all on table public.daily_sales_closures from anon, authenticated;
grant select on table public.daily_sales to authenticated;
grant select on table public.daily_sales_closures to authenticated;
grant all on table public.daily_sales to service_role;
grant all on table public.daily_sales_closures to service_role;

create function private.parse_nonnegative_ron_amount(
  input_value text,
  input_name text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  if input_value is null
    or input_value !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$'
  then
    raise exception '% must be a plain nonnegative decimal with at most two decimal places',
      input_name
      using errcode = '22023';
  end if;

  parsed_value := input_value::numeric;

  if parsed_value < 0 then
    raise exception '% must be zero or greater', input_name
      using errcode = '22023';
  end if;

  return parsed_value;
end;
$$;

revoke all on function private.parse_nonnegative_ron_amount(text, text)
  from public;

create function public.upsert_daily_sales_draft(
  target_business_id uuid,
  target_business_day_id uuid,
  target_cash_sales_ron text,
  target_bank_sales_ron text,
  target_credit_sales_ron text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_notes text := nullif(btrim(target_notes), '');
  parsed_cash numeric;
  parsed_bank numeric;
  parsed_credit numeric;
  derived_credit numeric;
  selected_day_status public.business_day_status;
  existing_sale public.daily_sales%rowtype;
  new_sale_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_notes is not null and char_length(normalized_notes) > 500 then
    raise exception 'Daily sales notes must not exceed 500 characters'
      using errcode = '22023';
  end if;

  parsed_cash := private.parse_nonnegative_ron_amount(
    target_cash_sales_ron,
    'Cash sales'
  );
  parsed_bank := private.parse_nonnegative_ron_amount(
    target_bank_sales_ron,
    'Bank sales'
  );
  parsed_credit := private.parse_nonnegative_ron_amount(
    target_credit_sales_ron,
    'Credit sales'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select day.status
  into selected_day_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for update;

  if selected_day_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if selected_day_status <> 'open' then
    raise exception 'Daily sales draft requires an open business day'
      using errcode = '55000';
  end if;

  select coalesce(sum(purchase.amount_ron), 0)
  into derived_credit
  from public.customer_credit_purchases as purchase
  where purchase.business_id = target_business_id
    and purchase.business_day_id = target_business_day_id
    and purchase.reversed_at is null;

  if parsed_credit <> derived_credit then
    raise exception 'Credit sales must equal customer credit purchases'
      using errcode = '22023';
  end if;

  select sale.*
  into existing_sale
  from public.daily_sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = target_business_day_id
  for update;

  if found and existing_sale.status <> 'draft' then
    raise exception 'Closed daily sales cannot be edited'
      using errcode = '55000';
  end if;

  if found then
    update public.daily_sales
    set
      cash_sales_ron = parsed_cash,
      bank_sales_ron = parsed_bank,
      credit_sales_ron = parsed_credit,
      total_sales_ron = parsed_cash + parsed_bank + parsed_credit,
      notes = normalized_notes,
      updated_by = current_user_id,
      updated_at = pg_catalog.now()
    where id = existing_sale.id
      and status = 'draft'
    returning id into new_sale_id;

    insert into public.audit_logs (
      business_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      previous_data,
      new_data
    )
    values (
      target_business_id,
      current_user_id,
      'daily_sales.draft_updated',
      'daily_sales',
      new_sale_id,
      pg_catalog.jsonb_build_object(
        'cash_sales_ron', existing_sale.cash_sales_ron,
        'bank_sales_ron', existing_sale.bank_sales_ron,
        'credit_sales_ron', existing_sale.credit_sales_ron,
        'total_sales_ron', existing_sale.total_sales_ron,
        'notes', existing_sale.notes
      ),
      pg_catalog.jsonb_build_object(
        'cash_sales_ron', parsed_cash,
        'bank_sales_ron', parsed_bank,
        'credit_sales_ron', parsed_credit,
        'total_sales_ron', parsed_cash + parsed_bank + parsed_credit,
        'notes', normalized_notes
      )
    );
  else
    insert into public.daily_sales (
      business_id,
      business_day_id,
      cash_sales_ron,
      bank_sales_ron,
      credit_sales_ron,
      total_sales_ron,
      notes,
      created_by,
      updated_by
    )
    values (
      target_business_id,
      target_business_day_id,
      parsed_cash,
      parsed_bank,
      parsed_credit,
      parsed_cash + parsed_bank + parsed_credit,
      normalized_notes,
      current_user_id,
      current_user_id
    )
    returning id into new_sale_id;

    insert into public.audit_logs (
      business_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      new_data
    )
    values (
      target_business_id,
      current_user_id,
      'daily_sales.draft_created',
      'daily_sales',
      new_sale_id,
      pg_catalog.jsonb_build_object(
        'business_day_id', target_business_day_id,
        'cash_sales_ron', parsed_cash,
        'bank_sales_ron', parsed_bank,
        'credit_sales_ron', parsed_credit,
        'total_sales_ron', parsed_cash + parsed_bank + parsed_credit,
        'notes', normalized_notes
      )
    );
  end if;

  return new_sale_id;
end;
$$;

create function public.close_daily_sales(
  target_business_id uuid,
  target_daily_sales_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  close_time timestamptz := pg_catalog.now();
  sale_to_close public.daily_sales%rowtype;
  selected_day_date date;
  selected_day_status public.business_day_status;
  derived_credit numeric;
  cash_account_id uuid;
  bank_account_id uuid;
  next_close_sequence integer;
  new_closure_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select sale.*
  into sale_to_close
  from public.daily_sales as sale
  where sale.id = target_daily_sales_id
    and sale.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Daily sales draft does not exist'
      using errcode = '22023';
  end if;

  select day.business_date, day.status
  into selected_day_date, selected_day_status
  from public.business_days as day
  where day.id = sale_to_close.business_day_id
    and day.business_id = target_business_id
  for update;

  if selected_day_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if sale_to_close.status = 'closed' then
    if selected_day_status <> 'closed' then
      raise exception 'Daily sales and business day statuses are inconsistent'
        using errcode = '55000';
    end if;

    return sale_to_close.id;
  end if;

  if selected_day_status <> 'open' then
    raise exception 'Daily sales can close only with an open business day'
      using errcode = '55000';
  end if;

  select coalesce(sum(purchase.amount_ron), 0)
  into derived_credit
  from public.customer_credit_purchases as purchase
  where purchase.business_id = target_business_id
    and purchase.business_day_id = sale_to_close.business_day_id
    and purchase.reversed_at is null;

  if sale_to_close.credit_sales_ron <> derived_credit then
    raise exception 'Credit sales changed; update the draft before closing'
      using errcode = '22023';
  end if;

  select account.id
  into cash_account_id
  from public.financial_accounts as account
  where account.business_id = target_business_id
    and account.type = 'cash'
    and account.currency = 'RON'
    and account.is_active
  for share;

  select account.id
  into bank_account_id
  from public.financial_accounts as account
  where account.business_id = target_business_id
    and account.type = 'bank'
    and account.currency = 'RON'
    and account.is_active
  for share;

  if cash_account_id is null or bank_account_id is null then
    raise exception 'Active RON cash and bank accounts are required'
      using errcode = '55000';
  end if;

  select coalesce(max(closure.close_sequence), 0) + 1
  into next_close_sequence
  from public.daily_sales_closures as closure
  where closure.daily_sales_id = sale_to_close.id;

  insert into public.daily_sales_closures (
    business_id,
    daily_sales_id,
    business_day_id,
    close_sequence,
    cash_sales_ron,
    bank_sales_ron,
    credit_sales_ron,
    total_sales_ron,
    closed_by,
    closed_at
  )
  values (
    target_business_id,
    sale_to_close.id,
    sale_to_close.business_day_id,
    next_close_sequence,
    sale_to_close.cash_sales_ron,
    sale_to_close.bank_sales_ron,
    sale_to_close.credit_sales_ron,
    sale_to_close.total_sales_ron,
    current_user_id,
    close_time
  )
  returning id into new_closure_id;

  if sale_to_close.cash_sales_ron > 0 then
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      business_day_id,
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
      cash_account_id,
      sale_to_close.business_day_id,
      selected_day_date,
      'inflow',
      sale_to_close.cash_sales_ron,
      'daily_sales_cash',
      'daily_sales_closure',
      new_closure_id,
      'Daily cash sales',
      current_user_id
    );
  end if;

  if sale_to_close.bank_sales_ron > 0 then
    insert into public.financial_account_entries (
      business_id,
      financial_account_id,
      business_day_id,
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
      bank_account_id,
      sale_to_close.business_day_id,
      selected_day_date,
      'inflow',
      sale_to_close.bank_sales_ron,
      'daily_sales_bank',
      'daily_sales_closure',
      new_closure_id,
      'Daily bank sales',
      current_user_id
    );
  end if;

  update public.daily_sales
  set
    status = 'closed',
    active_closure_id = new_closure_id,
    closed_at = close_time,
    closed_by = current_user_id,
    updated_by = current_user_id,
    updated_at = close_time
  where id = sale_to_close.id
    and status = 'draft';

  if not found then
    raise exception 'Daily sales close lost a concurrency race'
      using errcode = '40001';
  end if;

  update public.business_days
  set
    status = 'closed',
    closed_at = close_time,
    closed_by = current_user_id
  where id = sale_to_close.business_day_id
    and business_id = target_business_id
    and status = 'open';

  if not found then
    raise exception 'Business day close lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_data,
    new_data
  )
  values
    (
      target_business_id,
      current_user_id,
      'daily_sales.closed',
      'daily_sales',
      sale_to_close.id,
      pg_catalog.jsonb_build_object('status', 'draft'),
      pg_catalog.jsonb_build_object(
        'status', 'closed',
        'closure_id', new_closure_id,
        'close_sequence', next_close_sequence,
        'cash_sales_ron', sale_to_close.cash_sales_ron,
        'bank_sales_ron', sale_to_close.bank_sales_ron,
        'credit_sales_ron', sale_to_close.credit_sales_ron,
        'total_sales_ron', sale_to_close.total_sales_ron,
        'closed_at', close_time
      )
    ),
    (
      target_business_id,
      current_user_id,
      'business_day.closed',
      'business_day',
      sale_to_close.business_day_id,
      pg_catalog.jsonb_build_object(
        'business_date', selected_day_date,
        'status', 'open'
      ),
      pg_catalog.jsonb_build_object(
        'business_date', selected_day_date,
        'status', 'closed',
        'closed_at', close_time,
        'daily_sales_id', sale_to_close.id
      )
    );

  return sale_to_close.id;
end;
$$;

create or replace function public.close_business_day(
  target_business_id uuid,
  target_business_day_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_status public.business_day_status;
  existing_daily_sales_id uuid;
  derived_credit numeric;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select day.status
  into current_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id;

  if current_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if current_status <> 'open' then
    raise exception 'Business day is already closed'
      using errcode = '55000';
  end if;

  select sale.id
  into existing_daily_sales_id
  from public.daily_sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = target_business_day_id;

  if existing_daily_sales_id is null then
    select coalesce(sum(purchase.amount_ron), 0)
    into derived_credit
    from public.customer_credit_purchases as purchase
    where purchase.business_id = target_business_id
      and purchase.business_day_id = target_business_day_id
      and purchase.reversed_at is null;

    existing_daily_sales_id := public.upsert_daily_sales_draft(
      target_business_id,
      target_business_day_id,
      '0.00',
      '0.00',
      derived_credit::text,
      null
    );
  end if;

  perform public.close_daily_sales(
    target_business_id,
    existing_daily_sales_id
  );
end;
$$;

create or replace function public.reopen_business_day(
  target_business_id uuid,
  target_business_day_id uuid,
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
  current_business_date date;
  current_status public.business_day_status;
  previous_closed_at timestamptz;
  previous_closed_by uuid;
  sale_to_reopen public.daily_sales%rowtype;
  closure_to_reverse public.daily_sales_closures%rowtype;
  original_entry public.financial_account_entries%rowtype;
  reopen_time timestamptz := pg_catalog.now();
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
    raise exception 'Reopen reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select
    day.business_date,
    day.status,
    day.closed_at,
    day.closed_by
  into
    current_business_date,
    current_status,
    previous_closed_at,
    previous_closed_by
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for update;

  if current_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if current_status <> 'closed' then
    raise exception 'Only a closed business day can be reopened'
      using errcode = '55000';
  end if;

  select sale.*
  into sale_to_reopen
  from public.daily_sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = target_business_day_id
    and sale.status = 'closed'
  for update;

  if found then
    select closure.*
    into closure_to_reverse
    from public.daily_sales_closures as closure
    where closure.id = sale_to_reopen.active_closure_id
      and closure.business_id = target_business_id
      and closure.reversed_at is null
    for update;

    if not found then
      raise exception 'Active daily sales closure does not exist'
        using errcode = '55000';
    end if;

    for original_entry in
      select entry.*
      from public.financial_account_entries as entry
      where entry.business_id = target_business_id
        and entry.source_entity_type = 'daily_sales_closure'
        and entry.source_entity_id = closure_to_reverse.id
        and entry.reversal_of_id is null
      order by entry.created_at, entry.id
      for update
    loop
      insert into public.financial_account_entries (
        business_id,
        financial_account_id,
        business_day_id,
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
        original_entry.financial_account_id,
        original_entry.business_day_id,
        original_entry.entry_date,
        case
          when original_entry.direction = 'inflow'
            then 'outflow'::public.financial_entry_direction
          else 'inflow'::public.financial_entry_direction
        end,
        original_entry.amount_ron,
        original_entry.entry_type || '_reversal',
        original_entry.source_entity_type,
        original_entry.source_entity_id,
        'Daily sales reopen reversal',
        current_user_id,
        original_entry.id
      );
    end loop;

    update public.daily_sales_closures
    set
      reversed_at = reopen_time,
      reversed_by = current_user_id,
      reversal_reason = normalized_reason
    where id = closure_to_reverse.id
      and reversed_at is null;

    update public.daily_sales
    set
      status = 'draft',
      active_closure_id = null,
      closed_at = null,
      closed_by = null,
      updated_by = current_user_id,
      updated_at = reopen_time
    where id = sale_to_reopen.id
      and status = 'closed';

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
      'daily_sales.reopened',
      'daily_sales',
      sale_to_reopen.id,
      pg_catalog.jsonb_build_object(
        'status', 'closed',
        'closure_id', closure_to_reverse.id,
        'close_sequence', closure_to_reverse.close_sequence
      ),
      pg_catalog.jsonb_build_object('status', 'draft'),
      normalized_reason
    );
  end if;

  update public.business_days
  set
    status = 'open',
    closed_at = null,
    closed_by = null,
    reopen_reason = normalized_reason
  where id = target_business_day_id
    and business_id = target_business_id
    and status = 'closed';

  if not found then
    raise exception 'Business day reopen lost a concurrency race'
      using errcode = '40001';
  end if;

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
    'business_day.reopened',
    'business_day',
    target_business_day_id,
    pg_catalog.jsonb_build_object(
      'business_date', current_business_date,
      'status', 'closed',
      'closed_at', previous_closed_at,
      'closed_by', previous_closed_by
    ),
    pg_catalog.jsonb_build_object(
      'business_date', current_business_date,
      'status', 'open',
      'daily_sales_id', sale_to_reopen.id
    ),
    normalized_reason
  );
end;
$$;

create view public.business_day_credit_sales
with (security_invoker = true)
as
select
  day.id as business_day_id,
  day.business_id,
  day.business_date,
  coalesce(
    sum(purchase.amount_ron) filter (
      where purchase.reversed_at is null
    ),
    0
  )::text as credit_sales_ron
from public.business_days as day
left join public.customer_credit_purchases as purchase
  on purchase.business_day_id = day.id
  and purchase.business_id = day.business_id
group by day.id, day.business_id, day.business_date;

create view public.daily_sales_summaries
with (security_invoker = true)
as
select
  sale.id as daily_sales_id,
  sale.business_id,
  sale.business_day_id,
  day.business_date,
  sale.cash_sales_ron::text as cash_sales_ron,
  sale.bank_sales_ron::text as bank_sales_ron,
  sale.credit_sales_ron::text as credit_sales_ron,
  sale.total_sales_ron::text as total_sales_ron,
  sale.status,
  sale.notes,
  sale.created_by,
  sale.created_at,
  sale.updated_by,
  sale.updated_at,
  sale.closed_at,
  sale.closed_by,
  sale.active_closure_id,
  coalesce(closure.close_sequence, 0) as close_sequence
from public.daily_sales as sale
inner join public.business_days as day
  on day.id = sale.business_day_id
  and day.business_id = sale.business_id
left join public.daily_sales_closures as closure
  on closure.id = sale.active_closure_id
  and closure.business_id = sale.business_id;

revoke all on table public.business_day_credit_sales
  from anon, authenticated;
revoke all on table public.daily_sales_summaries
  from anon, authenticated;
grant select on table public.business_day_credit_sales
  to authenticated, service_role;
grant select on table public.daily_sales_summaries
  to authenticated, service_role;

revoke all on function public.upsert_daily_sales_draft(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.close_daily_sales(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.upsert_daily_sales_draft(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) to authenticated, service_role;
grant execute on function public.close_daily_sales(uuid, uuid)
  to authenticated, service_role;

comment on function public.upsert_daily_sales_draft(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) is
  'Creates or updates one open-day sales draft after validating derived credit sales.';
comment on function public.close_daily_sales(uuid, uuid) is
  'Atomically closes daily sales and its business day with cash/bank ledger inflows and audits.';
comment on function public.close_business_day(uuid, uuid) is
  'Compatibility wrapper that atomically closes through a daily sales record.';
comment on function public.reopen_business_day(uuid, uuid, text) is
  'Reopens a day and reverses its active daily sales closure for an administrator.';

commit;
