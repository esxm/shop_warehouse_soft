begin;

create or replace function private.close_daily_sales_core(
  target_business_id uuid,
  target_daily_sales_id uuid,
  target_actor_user_id uuid,
  target_automatic boolean,
  target_close_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  close_time timestamptz := coalesce(
    target_close_time,
    pg_catalog.clock_timestamp()
  );
  sale_to_close public.daily_sales%rowtype;
  selected_day_date date;
  selected_day_status public.business_day_status;
  derived_credit numeric;
  cash_account_id uuid;
  bank_account_id uuid;
  next_close_sequence integer;
  new_closure_id uuid;
begin
  if target_actor_user_id is null
    or not exists (
      select 1
      from auth.users
      where id = target_actor_user_id
    )
  then
    raise exception 'A valid close actor is required'
      using errcode = '22023';
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

  if target_automatic then
    update public.daily_sales
    set
      credit_sales_ron = derived_credit,
      total_sales_ron =
        cash_sales_ron + bank_sales_ron + derived_credit
    where id = sale_to_close.id
      and status = 'draft';

    sale_to_close.credit_sales_ron := derived_credit;
    sale_to_close.total_sales_ron :=
      sale_to_close.cash_sales_ron
      + sale_to_close.bank_sales_ron
      + derived_credit;
  elsif sale_to_close.credit_sales_ron <> derived_credit then
    raise exception 'Credit sales changed; update the draft before closing'
      using errcode = '22023';
  end if;

  if sale_to_close.cash_sales_ron > 0 then
    select account.id
    into cash_account_id
    from public.financial_accounts as account
    where account.business_id = target_business_id
      and account.type = 'cash'
      and account.currency = 'RON'
      and account.is_active
    for share;

    if cash_account_id is null then
      raise exception 'An active RON cash account is required'
        using errcode = '55000';
    end if;
  end if;

  if sale_to_close.bank_sales_ron > 0 then
    select account.id
    into bank_account_id
    from public.financial_accounts as account
    where account.business_id = target_business_id
      and account.type = 'bank'
      and account.currency = 'RON'
      and account.is_active
    for share;

    if bank_account_id is null then
      raise exception 'An active RON bank account is required'
        using errcode = '55000';
    end if;
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
    target_actor_user_id,
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
      target_actor_user_id
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
      target_actor_user_id
    );
  end if;

  update public.daily_sales
  set
    status = 'closed',
    active_closure_id = new_closure_id,
    closed_at = close_time,
    closed_by = target_actor_user_id,
    updated_by = target_actor_user_id,
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
    closed_by = target_actor_user_id
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
      target_actor_user_id,
      case
        when target_automatic then 'daily_sales.automatically_closed'
        else 'daily_sales.closed'
      end,
      'daily_sales',
      sale_to_close.id,
      pg_catalog.jsonb_build_object(
        'status', 'draft',
        'last_draft_by', sale_to_close.last_draft_by,
        'last_draft_at', sale_to_close.last_draft_at
      ),
      pg_catalog.jsonb_build_object(
        'status', 'closed',
        'automatic', target_automatic,
        'closure_id', new_closure_id,
        'close_sequence', next_close_sequence,
        'cash_sales_ron', sale_to_close.cash_sales_ron,
        'bank_sales_ron', sale_to_close.bank_sales_ron,
        'credit_sales_ron', sale_to_close.credit_sales_ron,
        'total_sales_ron', sale_to_close.total_sales_ron,
        'closed_at', close_time,
        'last_draft_by', sale_to_close.last_draft_by,
        'last_draft_at', sale_to_close.last_draft_at
      )
    ),
    (
      target_business_id,
      target_actor_user_id,
      case
        when target_automatic then 'business_day.automatically_closed'
        else 'business_day.closed'
      end,
      'business_day',
      sale_to_close.business_day_id,
      pg_catalog.jsonb_build_object(
        'business_date', selected_day_date,
        'status', 'open'
      ),
      pg_catalog.jsonb_build_object(
        'business_date', selected_day_date,
        'status', 'closed',
        'automatic', target_automatic,
        'closed_at', close_time,
        'daily_sales_id', sale_to_close.id,
        'last_draft_by', sale_to_close.last_draft_by
      )
    );

  return sale_to_close.id;
end;
$$;

comment on function private.close_daily_sales_core(
  uuid,
  uuid,
  uuid,
  boolean,
  timestamptz
) is
  'Closes a daily sales draft; positive cash or bank totals require active accounts, while zero-total automatic closes do not.';

commit;
