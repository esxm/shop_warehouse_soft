begin;

create or replace function private.open_automatic_business_day(
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
  selected_day_id uuid;
  selected_day_status public.business_day_status;
  selected_sales_id uuid;
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
  into selected_day_id, selected_day_status
  from public.business_days as day
  where day.business_id = target_business_id
    and day.business_date = target_business_date
  for update;

  if selected_day_id is null then
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
    returning id into selected_day_id;

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
      selected_day_id,
      pg_catalog.jsonb_build_object(
        'business_date', target_business_date,
        'status', 'open',
        'automatic', true,
        'opened_at', opened_time
      )
    );
  elsif selected_day_status <> 'open' then
    raise exception 'The current business date is already closed'
      using errcode = '55000';
  end if;

  select sale.id
  into selected_sales_id
  from public.daily_sales as sale
  where sale.business_id = target_business_id
    and sale.business_day_id = selected_day_id
  for update;

  if selected_sales_id is null then
    select coalesce(sum(purchase.amount_ron), 0)
    into derived_credit
    from public.customer_credit_purchases as purchase
    where purchase.business_id = target_business_id
      and purchase.business_day_id = selected_day_id
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
      selected_day_id,
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
    returning id into selected_sales_id;

    update public.daily_sales
    set
      last_draft_by = null,
      last_draft_at = null
    where id = selected_sales_id;

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
      selected_sales_id,
      pg_catalog.jsonb_build_object(
        'business_day_id', selected_day_id,
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

  return selected_day_id;
end;
$$;

select private.process_automatic_business_days();

comment on function private.open_automatic_business_day(uuid, date) is
  'Idempotently creates the timezone-current business day and untouched daily-sales draft.';

commit;
