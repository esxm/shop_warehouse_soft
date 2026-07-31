create table private.auth_rate_limits (
  scope text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint auth_rate_limits_pkey primary key (scope, identifier_hash),
  constraint auth_rate_limits_scope_check
    check (scope in ('login_email', 'password_reset_email')),
  constraint auth_rate_limits_identifier_hash_check
    check (identifier_hash ~ '^[0-9a-f]{32}$'),
  constraint auth_rate_limits_attempt_count_check
    check (attempt_count > 0)
);

revoke all on table private.auth_rate_limits from public;

create function public.consume_auth_rate_limit(
  target_scope text,
  target_identifier text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_identifier text := pg_catalog.lower(
    pg_catalog.btrim(target_identifier)
  );
  target_identifier_hash text;
  request_time timestamptz := pg_catalog.clock_timestamp();
  window_duration interval;
  block_duration interval;
  maximum_attempts integer;
  existing_limit private.auth_rate_limits%rowtype;
  next_attempt_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service-role access is required'
      using errcode = '42501';
  end if;

  if target_scope = 'login_email' then
    window_duration := interval '15 minutes';
    block_duration := interval '15 minutes';
    maximum_attempts := 5;
  elsif target_scope = 'password_reset_email' then
    window_duration := interval '1 hour';
    block_duration := interval '1 hour';
    maximum_attempts := 3;
  else
    raise exception 'Unknown authentication rate-limit scope'
      using errcode = '22023';
  end if;

  if normalized_identifier is null
    or normalized_identifier = ''
    or pg_catalog.char_length(normalized_identifier) > 320
  then
    raise exception 'Authentication rate-limit identifier is invalid'
      using errcode = '22023';
  end if;

  target_identifier_hash := pg_catalog.md5(
    target_scope || ':' || normalized_identifier
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_scope || ':' || target_identifier_hash,
      9260
    )
  );

  select rate_limit.*
  into existing_limit
  from private.auth_rate_limits as rate_limit
  where rate_limit.scope = target_scope
    and rate_limit.identifier_hash = target_identifier_hash
  for update;

  if found
    and existing_limit.blocked_until is not null
    and existing_limit.blocked_until > request_time
  then
    return pg_catalog.greatest(
      1,
      pg_catalog.ceil(
        extract(
          epoch from (existing_limit.blocked_until - request_time)
        )
      )::integer
    );
  end if;

  if not found
    or existing_limit.window_started_at
      <= request_time - window_duration
  then
    insert into private.auth_rate_limits (
      scope,
      identifier_hash,
      window_started_at,
      attempt_count,
      blocked_until,
      updated_at
    )
    values (
      target_scope,
      target_identifier_hash,
      request_time,
      1,
      null,
      request_time
    )
    on conflict (scope, identifier_hash)
    do update set
      window_started_at = excluded.window_started_at,
      attempt_count = excluded.attempt_count,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at;

    return 0;
  end if;

  next_attempt_count := existing_limit.attempt_count + 1;

  update private.auth_rate_limits
  set
    attempt_count = next_attempt_count,
    blocked_until = case
      when next_attempt_count > maximum_attempts
        then request_time + block_duration
      else null
    end,
    updated_at = request_time
  where scope = target_scope
    and identifier_hash = target_identifier_hash;

  if next_attempt_count > maximum_attempts then
    return extract(epoch from block_duration)::integer;
  end if;

  return 0;
end;
$$;

create function public.clear_auth_rate_limit(
  target_scope text,
  target_identifier text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_identifier text := pg_catalog.lower(
    pg_catalog.btrim(target_identifier)
  );
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service-role access is required'
      using errcode = '42501';
  end if;

  if target_scope not in ('login_email', 'password_reset_email')
    or normalized_identifier is null
    or normalized_identifier = ''
    or pg_catalog.char_length(normalized_identifier) > 320
  then
    raise exception 'Authentication rate-limit identifier is invalid'
      using errcode = '22023';
  end if;

  delete from private.auth_rate_limits
  where scope = target_scope
    and identifier_hash = pg_catalog.md5(
      target_scope || ':' || normalized_identifier
    );
end;
$$;

create function public.set_business_employee_active(
  target_business_id uuid,
  target_user_id uuid,
  target_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_membership public.business_members%rowtype;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if target_active is null then
    raise exception 'Employee access state is required'
      using errcode = '22023';
  end if;

  select membership.*
  into target_membership
  from public.business_members as membership
  where membership.business_id = target_business_id
    and membership.user_id = target_user_id
  for update;

  if not found then
    raise exception 'Business employee does not exist'
      using errcode = '22023';
  end if;

  if target_membership.role <> 'employee' then
    raise exception 'Administrator access cannot be changed here'
      using errcode = '42501';
  end if;

  if target_membership.is_active = target_active then
    return;
  end if;

  update public.business_members
  set is_active = target_active
  where business_id = target_business_id
    and user_id = target_user_id;

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
    case
      when target_active then 'business_member.employee_reactivated'
      else 'business_member.employee_deactivated'
    end,
    'business_member',
    target_user_id,
    pg_catalog.jsonb_build_object(
      'role', target_membership.role,
      'is_active', target_membership.is_active
    ),
    pg_catalog.jsonb_build_object(
      'role', target_membership.role,
      'is_active', target_active
    )
  );
end;
$$;

create or replace function private.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      target_user_id = (select auth.uid())
      or exists (
        select 1
        from public.business_members as viewer_membership
        inner join public.business_members as target_membership
          on target_membership.business_id = viewer_membership.business_id
        where viewer_membership.user_id = (select auth.uid())
          and viewer_membership.role = 'admin'
          and viewer_membership.is_active
          and target_membership.user_id = target_user_id
      )
    );
$$;

drop policy if exists business_members_select_member
  on public.business_members;
create policy business_members_select_self_or_admin
on public.business_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_business_admin(business_id))
);

do $migration$
declare
  target_table record;
begin
  for target_table in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_catalog.pg_class as relation
    inner join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  loop
    execute pg_catalog.format(
      'alter table %I.%I enable row level security',
      target_table.schema_name,
      target_table.table_name
    );
  end loop;
end;
$migration$;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;

alter default privileges in schema public
  revoke all privileges on tables from anon;
alter default privileges in schema public
  revoke all privileges on sequences from anon;
alter default privileges in schema public
  revoke execute on functions from public, anon;

revoke all on function public.consume_auth_rate_limit(text, text)
  from public, anon, authenticated;
revoke all on function public.clear_auth_rate_limit(text, text)
  from public, anon, authenticated;
revoke all on function public.set_business_employee_active(
  uuid,
  uuid,
  boolean
) from public, anon, authenticated;

grant execute on function public.consume_auth_rate_limit(text, text)
  to service_role;
grant execute on function public.clear_auth_rate_limit(text, text)
  to service_role;
grant execute on function public.set_business_employee_active(
  uuid,
  uuid,
  boolean
) to authenticated, service_role;

comment on table private.auth_rate_limits is
  'Hashed fixed-window counters for application-level authentication throttling.';
comment on function public.consume_auth_rate_limit(text, text) is
  'Service-role-only atomic authentication throttle; returns retry delay seconds or zero.';
comment on function public.clear_auth_rate_limit(text, text) is
  'Service-role-only removal of a successful authentication throttle counter.';
comment on function public.set_business_employee_active(uuid, uuid, boolean) is
  'Allows a business administrator to deactivate or reactivate employee membership with an audit event.';
