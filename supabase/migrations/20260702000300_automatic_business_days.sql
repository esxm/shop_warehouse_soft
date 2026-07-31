begin;

alter table public.daily_sales
  add column last_draft_by uuid references auth.users (id),
  add column last_draft_at timestamptz;

update public.daily_sales as sale
set
  last_draft_by = coalesce(
    (
      select audit.actor_user_id
      from public.audit_logs as audit
      where audit.business_id = sale.business_id
        and audit.entity_type = 'daily_sales'
        and audit.entity_id = sale.id
        and audit.action in (
          'daily_sales.draft_created',
          'daily_sales.draft_updated'
        )
      order by audit.created_at desc, audit.id desc
      limit 1
    ),
    sale.created_by
  ),
  last_draft_at = coalesce(
    (
      select audit.created_at
      from public.audit_logs as audit
      where audit.business_id = sale.business_id
        and audit.entity_type = 'daily_sales'
        and audit.entity_id = sale.id
        and audit.action in (
          'daily_sales.draft_created',
          'daily_sales.draft_updated'
        )
      order by audit.created_at desc, audit.id desc
      limit 1
    ),
    sale.created_at
  );

create function private.capture_daily_sales_last_editor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is not null
    and new.status = 'draft'
    and (
      tg_op = 'INSERT'
      or (
        tg_op = 'UPDATE'
        and new.updated_by = current_user_id
        and new.updated_at is distinct from old.updated_at
      )
    )
  then
    new.last_draft_by := current_user_id;
    new.last_draft_at := pg_catalog.clock_timestamp();
  end if;

  return new;
end;
$$;

revoke all on function private.capture_daily_sales_last_editor()
  from public;

create trigger daily_sales_capture_last_editor
before insert or update on public.daily_sales
for each row
execute function private.capture_daily_sales_last_editor();

create function private.close_daily_sales_core(
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

revoke all on function private.close_daily_sales_core(
  uuid,
  uuid,
  uuid,
  boolean,
  timestamptz
) from public;

create or replace function public.close_daily_sales(
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
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  return private.close_daily_sales_core(
    target_business_id,
    target_daily_sales_id,
    current_user_id,
    false,
    pg_catalog.clock_timestamp()
  );
end;
$$;

create function private.open_automatic_business_day(
  target_business_id uuid,
  target_business_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  technical_actor_id uuid;
  business_timezone text;
  opened_time timestamptz;
  business_day_id uuid;
  business_day_status public.business_day_status;
  daily_sales_id uuid;
  derived_credit numeric;
begin
  select business.created_by, business.timezone
  into technical_actor_id, business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if technical_actor_id is null or business_timezone is null then
    raise exception 'Business does not exist'
      using errcode = '22023';
  end if;

  opened_time :=
    target_business_date::timestamp at time zone business_timezone;

  select day.id, day.status
  into business_day_id, business_day_status
  from public.business_days as day
  where day.business_id = target_business_id
    and day.business_date = target_business_date
  for update;

  if business_day_id is null then
    insert into public.business_days (
      business_id,
      business_date,
      status,
      opened_at,
      opened_by
    )
    values (
      target_business_id,
      target_business_date,
      'open',
      opened_time,
      technical_actor_id
    )
    returning id into business_day_id;

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
      technical_actor_id,
      'business_day.automatically_opened',
      'business_day',
      business_day_id,
      pg_catalog.jsonb_build_object(
        'business_date', target_business_date,
        'status', 'open',
        'automatic', true,
        'opened_at', opened_time
      )
    );
  elsif business_day_status <> 'open' then
    raise exception 'The current business date is already closed'
      using errcode = '55000';
  end if;

  select sale.id
  into daily_sales_id
  from public.daily_sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = business_day_id
  for update;

  if daily_sales_id is null then
    select coalesce(sum(purchase.amount_ron), 0)
    into derived_credit
    from public.customer_credit_purchases as purchase
    where purchase.business_id = target_business_id
      and purchase.business_day_id = business_day_id
      and purchase.reversed_at is null;

    insert into public.daily_sales (
      business_id,
      business_day_id,
      cash_sales_ron,
      bank_sales_ron,
      credit_sales_ron,
      total_sales_ron,
      status,
      notes,
      created_by,
      created_at,
      updated_by,
      updated_at
    )
    values (
      target_business_id,
      business_day_id,
      0,
      0,
      derived_credit,
      derived_credit,
      'draft',
      null,
      technical_actor_id,
      opened_time,
      technical_actor_id,
      opened_time
    )
    returning id into daily_sales_id;

    update public.daily_sales
    set
      last_draft_by = null,
      last_draft_at = null
    where id = daily_sales_id;

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
      technical_actor_id,
      'daily_sales.automatically_opened',
      'daily_sales',
      daily_sales_id,
      pg_catalog.jsonb_build_object(
        'business_day_id', business_day_id,
        'business_date', target_business_date,
        'status', 'draft',
        'automatic', true,
        'cash_sales_ron', 0,
        'bank_sales_ron', 0,
        'credit_sales_ron', derived_credit,
        'total_sales_ron', derived_credit
      )
    );
  end if;

  return business_day_id;
end;
$$;

revoke all on function private.open_automatic_business_day(uuid, date)
  from public;

create function private.ensure_automatic_business_day(
  target_business_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_timezone text;
  current_business_date date;
  open_day_id uuid;
  open_day_date date;
  daily_sales_id uuid;
  close_actor_id uuid;
  close_boundary timestamptz;
begin
  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if business_timezone is null then
    raise exception 'Business does not exist'
      using errcode = '22023';
  end if;

  current_business_date :=
    (pg_catalog.clock_timestamp() at time zone business_timezone)::date;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select day.id, day.business_date
  into open_day_id, open_day_date
  from public.business_days as day
  where day.business_id = target_business_id
    and day.status = 'open'
  for update;

  if open_day_id is not null and open_day_date > current_business_date then
    raise exception 'Open business date is ahead of the business timezone'
      using errcode = '55000';
  end if;

  if open_day_id is not null and open_day_date < current_business_date then
    select sale.id
    into daily_sales_id
    from public.daily_sales as sale
    where sale.business_id = target_business_id
      and sale.business_day_id = open_day_id;

    if daily_sales_id is null then
      perform private.open_automatic_business_day(
        target_business_id,
        open_day_date
      );

      select sale.id
      into daily_sales_id
      from public.daily_sales as sale
      where sale.business_id = target_business_id
        and sale.business_day_id = open_day_id;
    end if;

    select coalesce(sale.last_draft_by, sale.created_by)
    into close_actor_id
    from public.daily_sales as sale
    where sale.id = daily_sales_id;

    close_boundary :=
      (open_day_date + 1)::timestamp at time zone business_timezone;

    perform private.close_daily_sales_core(
      target_business_id,
      daily_sales_id,
      close_actor_id,
      true,
      close_boundary
    );

    open_day_id := null;
  end if;

  if open_day_id is null then
    open_day_id := private.open_automatic_business_day(
      target_business_id,
      current_business_date
    );
  else
    perform private.open_automatic_business_day(
      target_business_id,
      current_business_date
    );
  end if;

  return open_day_id;
end;
$$;

revoke all on function private.ensure_automatic_business_day(uuid)
  from public;

create function public.ensure_current_business_day(
  target_business_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  return private.ensure_automatic_business_day(target_business_id);
end;
$$;

revoke all on function public.ensure_current_business_day(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_current_business_day(uuid)
  to authenticated, service_role;

create function private.process_automatic_business_days()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_record record;
begin
  for business_record in
    select business.id
    from public.businesses as business
    order by business.id
  loop
    begin
      perform private.ensure_automatic_business_day(business_record.id);
    exception
      when others then
        raise warning 'Automatic business-day rollover failed for business %: %',
          business_record.id,
          sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function private.process_automatic_business_days()
  from public;

create or replace view public.daily_sales_summaries
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
  coalesce(closure.close_sequence, 0) as close_sequence,
  sale.last_draft_by,
  profile.full_name as last_draft_by_name,
  sale.last_draft_at
from public.daily_sales as sale
inner join public.business_days as day
  on day.id = sale.business_day_id
  and day.business_id = sale.business_id
left join public.profiles as profile
  on profile.id = sale.last_draft_by
left join public.daily_sales_closures as closure
  on closure.id = sale.active_closure_id
  and closure.business_id = sale.business_id;

revoke execute on function public.create_business_day(uuid, date)
  from authenticated;
revoke execute on function public.close_business_day(uuid, uuid)
  from authenticated;
revoke execute on function public.reopen_business_day(uuid, uuid, text)
  from authenticated;
revoke execute on function public.close_daily_sales(uuid, uuid)
  from authenticated;

create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  select job.jobid
  into existing_job_id
  from cron.job as job
  where job.jobname = 'automatic-business-day-rollover';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'automatic-business-day-rollover',
    '* * * * *',
    'select private.process_automatic_business_days();'
  );
end;
$$;

select private.process_automatic_business_days();

comment on function public.ensure_current_business_day(uuid) is
  'Idempotently rolls the business into its timezone-current day and ensures an automatic daily-sales draft.';
comment on function private.process_automatic_business_days() is
  'Cron entry point that independently rolls every business at its local date boundary.';
comment on column public.daily_sales.last_draft_by is
  'The last authenticated employee or administrator who saved cash, bank, or notes before automatic close.';
comment on column public.daily_sales.last_draft_at is
  'Timestamp of the last authenticated daily-sales draft save.';

commit;
