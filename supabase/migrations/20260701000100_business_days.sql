begin;

create type public.business_day_status as enum ('open', 'closed');

create table public.business_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_date date not null,
  status public.business_day_status not null default 'open',
  opened_at timestamptz not null default now(),
  opened_by uuid not null references auth.users (id),
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  reopen_reason text,
  created_at timestamptz not null default now(),
  constraint business_days_business_date_key
    unique (business_id, business_date),
  constraint business_days_business_id_id_key
    unique (business_id, id),
  constraint business_days_lifecycle_consistent
    check (
      (
        status = 'open'
        and closed_at is null
        and closed_by is null
      )
      or (
        status = 'closed'
        and closed_at is not null
        and closed_by is not null
      )
    ),
  constraint business_days_reopen_reason_valid
    check (
      reopen_reason is null
      or char_length(btrim(reopen_reason)) between 10 and 500
    )
);

create unique index business_days_one_open_per_business_idx
  on public.business_days (business_id)
  where status = 'open';

create index business_days_business_date_idx
  on public.business_days (business_id, business_date desc);

alter table public.business_days enable row level security;

create policy business_days_select_member
on public.business_days
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.business_days from anon, authenticated;
grant select on table public.business_days to authenticated;
grant all on table public.business_days to service_role;

create function public.create_business_day(
  target_business_id uuid,
  target_business_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  business_timezone text;
  new_business_day_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 6106)
  );

  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if business_timezone is null then
    raise exception 'Business does not exist'
      using errcode = '22023';
  end if;

  if target_business_date is null
    or target_business_date > (
      pg_catalog.now() at time zone business_timezone
    )::date
  then
    raise exception 'Business date must not be in the future'
      using errcode = '22023';
  end if;

  insert into public.business_days (
    business_id,
    business_date,
    opened_by
  )
  values (
    target_business_id,
    target_business_date,
    current_user_id
  )
  returning id into new_business_day_id;

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
    'business_day.created',
    'business_day',
    new_business_day_id,
    pg_catalog.jsonb_build_object(
      'business_date', target_business_date,
      'status', 'open'
    )
  );

  return new_business_day_id;
end;
$$;

create function public.close_business_day(
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
  current_business_date date;
  current_status public.business_day_status;
  close_time timestamptz := pg_catalog.now();
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

  select day.business_date, day.status
  into current_business_date, current_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for update;

  if current_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if current_status <> 'open' then
    raise exception 'Business day is already closed'
      using errcode = '55000';
  end if;

  update public.business_days
  set
    status = 'closed',
    closed_at = close_time,
    closed_by = current_user_id
  where id = target_business_day_id
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
  values (
    target_business_id,
    current_user_id,
    'business_day.closed',
    'business_day',
    target_business_day_id,
    pg_catalog.jsonb_build_object(
      'business_date', current_business_date,
      'status', 'open'
    ),
    pg_catalog.jsonb_build_object(
      'business_date', current_business_date,
      'status', 'closed',
      'closed_at', close_time
    )
  );
end;
$$;

create function public.reopen_business_day(
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
      'status', 'open'
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.create_business_day(uuid, date)
  from public, anon, authenticated;
revoke all on function public.close_business_day(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.reopen_business_day(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_business_day(uuid, date)
  to authenticated, service_role;
grant execute on function public.close_business_day(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.reopen_business_day(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.create_business_day(uuid, date) is
  'Creates the single current open business day for an administrator.';
comment on function public.close_business_day(uuid, uuid) is
  'Manually closes an open business day for an active member.';
comment on function public.reopen_business_day(uuid, uuid, text) is
  'Reopens a closed business day for an administrator with an audit reason.';

commit;
