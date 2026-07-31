begin;

create or replace function private.capture_daily_sales_last_editor()
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
        and old.status = 'draft'
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

create function private.reopen_current_day_for_automation(
  target_business_id uuid,
  target_business_day_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  technical_actor_id uuid;
  business_day_record public.business_days%rowtype;
  daily_sales_record public.daily_sales%rowtype;
  closure_record public.daily_sales_closures%rowtype;
  original_entry public.financial_account_entries%rowtype;
  reopen_time timestamptz := pg_catalog.clock_timestamp();
  automatic_reason text :=
    'Automatically reopened because manual close occurred before local midnight.';
begin
  select business.created_by
  into technical_actor_id
  from public.businesses as business
  where business.id = target_business_id;

  if technical_actor_id is null then
    raise exception 'Business does not exist'
      using errcode = '22023';
  end if;

  select day.*
  into business_day_record
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if business_day_record.status = 'open' then
    return;
  end if;

  select sale.*
  into daily_sales_record
  from public.daily_sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = target_business_day_id
  for update;

  if found
    and daily_sales_record.status = 'closed'
    and daily_sales_record.active_closure_id is not null
  then
    select closure.*
    into closure_record
    from public.daily_sales_closures as closure
    where closure.id = daily_sales_record.active_closure_id
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
        and entry.source_entity_id = closure_record.id
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
        'Automatic current-day reopen reversal',
        technical_actor_id,
        original_entry.id
      );
    end loop;

    update public.daily_sales_closures
    set
      reversed_at = reopen_time,
      reversed_by = technical_actor_id,
      reversal_reason = automatic_reason
    where id = closure_record.id
      and reversed_at is null;

    update public.daily_sales
    set
      status = 'draft',
      active_closure_id = null,
      closed_at = null,
      closed_by = null,
      updated_by = technical_actor_id,
      updated_at = reopen_time
    where id = daily_sales_record.id
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
      technical_actor_id,
      'daily_sales.automatically_reopened',
      'daily_sales',
      daily_sales_record.id,
      pg_catalog.jsonb_build_object(
        'status', 'closed',
        'closure_id', closure_record.id,
        'close_sequence', closure_record.close_sequence
      ),
      pg_catalog.jsonb_build_object(
        'status', 'draft',
        'automatic', true,
        'last_draft_by', daily_sales_record.last_draft_by,
        'last_draft_at', daily_sales_record.last_draft_at
      ),
      automatic_reason
    );
  end if;

  update public.business_days
  set
    status = 'open',
    closed_at = null,
    closed_by = null,
    reopen_reason = automatic_reason
  where id = target_business_day_id
    and business_id = target_business_id
    and status = 'closed';

  if not found then
    raise exception 'Automatic current-day reopen lost a concurrency race'
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
    technical_actor_id,
    'business_day.automatically_reopened',
    'business_day',
    target_business_day_id,
    pg_catalog.jsonb_build_object(
      'business_date', business_day_record.business_date,
      'status', 'closed',
      'closed_at', business_day_record.closed_at,
      'closed_by', business_day_record.closed_by
    ),
    pg_catalog.jsonb_build_object(
      'business_date', business_day_record.business_date,
      'status', 'open',
      'automatic', true
    ),
    automatic_reason
  );
end;
$$;

revoke all on function private.reopen_current_day_for_automation(uuid, uuid)
  from public;

create or replace function private.ensure_automatic_business_day(
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
  current_day_id uuid;
  current_day_status public.business_day_status;
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
    select day.id, day.status
    into current_day_id, current_day_status
    from public.business_days as day
    where day.business_id = target_business_id
      and day.business_date = current_business_date
    for update;

    if current_day_id is not null and current_day_status = 'closed' then
      perform private.reopen_current_day_for_automation(
        target_business_id,
        current_day_id
      );
      perform private.open_automatic_business_day(
        target_business_id,
        current_business_date
      );
      open_day_id := current_day_id;
    else
      open_day_id := private.open_automatic_business_day(
        target_business_id,
        current_business_date
      );
    end if;
  else
    perform private.open_automatic_business_day(
      target_business_id,
      current_business_date
    );
  end if;

  return open_day_id;
end;
$$;

select private.process_automatic_business_days();

comment on function private.reopen_current_day_for_automation(uuid, uuid) is
  'Preserves and reverses an early manual close so the current day can remain open until local midnight.';

commit;
