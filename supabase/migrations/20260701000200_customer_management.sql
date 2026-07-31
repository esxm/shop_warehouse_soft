begin;

alter table public.customers
  add constraint customers_phone_length
    check (phone is null or char_length(phone) <= 40),
  add constraint customers_notes_length
    check (notes is null or char_length(notes) <= 1000);

create function private.normalized_customer_phone(input_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    pg_catalog.regexp_replace(
      coalesce(input_phone, ''),
      '[^0-9]',
      '',
      'g'
    ),
    ''
  );
$$;

revoke all on function private.normalized_customer_phone(text) from public;

create function public.search_customers(
  target_business_id uuid,
  target_search_text text default null,
  target_include_inactive boolean default false,
  target_result_limit integer default 100
)
returns table (
  id uuid,
  business_id uuid,
  name text,
  phone text,
  notes text,
  is_active boolean,
  created_at timestamptz,
  created_by uuid,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(btrim(target_search_text), '');
begin
  if not private.is_business_member(target_business_id) then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_search is not null
    and char_length(normalized_search) > 100
  then
    raise exception 'Customer search must not exceed 100 characters'
      using errcode = '22023';
  end if;

  if target_result_limit is null or target_result_limit not between 1 and 200
  then
    raise exception 'Customer search limit must be between 1 and 200'
      using errcode = '22023';
  end if;

  if target_include_inactive is null then
    raise exception 'Inactive-customer filter is required'
      using errcode = '22023';
  end if;

  return query
  select
    customer.id,
    customer.business_id,
    customer.name,
    customer.phone,
    customer.notes,
    customer.is_active,
    customer.created_at,
    customer.created_by,
    customer.updated_at
  from public.customers as customer
  where customer.business_id = target_business_id
    and (target_include_inactive or customer.is_active)
    and (
      normalized_search is null
      or customer.name ilike '%' || normalized_search || '%'
      or customer.phone ilike '%' || normalized_search || '%'
    )
  order by customer.is_active desc, customer.name, customer.created_at
  limit target_result_limit;
end;
$$;

create function public.create_customer(
  target_business_id uuid,
  target_name text,
  target_phone text default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(target_name);
  normalized_phone text := nullif(btrim(target_phone), '');
  normalized_notes text := nullif(btrim(target_notes), '');
  comparable_phone text;
  new_customer_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_name is null
    or char_length(normalized_name) not between 1 and 120
  then
    raise exception 'Customer name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  if normalized_phone is not null
    and (
      char_length(normalized_phone) > 40
      or normalized_phone !~ '^[0-9+(). /-]+$'
      or private.normalized_customer_phone(normalized_phone) is null
    )
  then
    raise exception 'Customer phone is invalid'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 1000
  then
    raise exception 'Customer notes must not exceed 1000 characters'
      using errcode = '22023';
  end if;

  comparable_phone := private.normalized_customer_phone(normalized_phone);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 7107)
  );

  if comparable_phone is not null
    and exists (
      select 1
      from public.customers as customer
      where customer.business_id = target_business_id
        and customer.is_active
        and lower(btrim(customer.name)) = lower(normalized_name)
        and private.normalized_customer_phone(customer.phone)
          = comparable_phone
    )
  then
    raise exception 'An active customer already has this name and phone'
      using errcode = '23505';
  end if;

  insert into public.customers (
    business_id,
    name,
    phone,
    notes,
    created_by
  )
  values (
    target_business_id,
    normalized_name,
    normalized_phone,
    normalized_notes,
    current_user_id
  )
  returning id into new_customer_id;

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
    'customer.created',
    'customer',
    new_customer_id,
    pg_catalog.jsonb_build_object(
      'name', normalized_name,
      'phone', normalized_phone,
      'notes', normalized_notes,
      'is_active', true
    )
  );

  return new_customer_id;
end;
$$;

create function public.update_customer(
  target_business_id uuid,
  target_customer_id uuid,
  target_name text,
  target_phone text default null,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(target_name);
  normalized_phone text := nullif(btrim(target_phone), '');
  normalized_notes text := nullif(btrim(target_notes), '');
  comparable_phone text;
  previous_customer public.customers%rowtype;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_name is null
    or char_length(normalized_name) not between 1 and 120
  then
    raise exception 'Customer name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  if normalized_phone is not null
    and (
      char_length(normalized_phone) > 40
      or normalized_phone !~ '^[0-9+(). /-]+$'
      or private.normalized_customer_phone(normalized_phone) is null
    )
  then
    raise exception 'Customer phone is invalid'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 1000
  then
    raise exception 'Customer notes must not exceed 1000 characters'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 7107)
  );

  select customer.*
  into previous_customer
  from public.customers as customer
  where customer.id = target_customer_id
    and customer.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Customer does not exist'
      using errcode = '22023';
  end if;

  comparable_phone := private.normalized_customer_phone(normalized_phone);

  if previous_customer.is_active
    and comparable_phone is not null
    and exists (
      select 1
      from public.customers as customer
      where customer.business_id = target_business_id
        and customer.id <> target_customer_id
        and customer.is_active
        and lower(btrim(customer.name)) = lower(normalized_name)
        and private.normalized_customer_phone(customer.phone)
          = comparable_phone
    )
  then
    raise exception 'An active customer already has this name and phone'
      using errcode = '23505';
  end if;

  update public.customers
  set
    name = normalized_name,
    phone = normalized_phone,
    notes = normalized_notes
  where id = target_customer_id
    and business_id = target_business_id;

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
    'customer.updated',
    'customer',
    target_customer_id,
    pg_catalog.jsonb_build_object(
      'name', previous_customer.name,
      'phone', previous_customer.phone,
      'notes', previous_customer.notes,
      'is_active', previous_customer.is_active
    ),
    pg_catalog.jsonb_build_object(
      'name', normalized_name,
      'phone', normalized_phone,
      'notes', normalized_notes,
      'is_active', previous_customer.is_active
    )
  );
end;
$$;

create function public.deactivate_customer(
  target_business_id uuid,
  target_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  previous_customer public.customers%rowtype;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  select customer.*
  into previous_customer
  from public.customers as customer
  where customer.id = target_customer_id
    and customer.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Customer does not exist'
      using errcode = '22023';
  end if;

  if not previous_customer.is_active then
    raise exception 'Customer is already inactive'
      using errcode = '55000';
  end if;

  update public.customers
  set is_active = false
  where id = target_customer_id
    and business_id = target_business_id;

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
    'customer.deactivated',
    'customer',
    target_customer_id,
    pg_catalog.jsonb_build_object(
      'name', previous_customer.name,
      'phone', previous_customer.phone,
      'notes', previous_customer.notes,
      'is_active', true
    ),
    pg_catalog.jsonb_build_object(
      'name', previous_customer.name,
      'phone', previous_customer.phone,
      'notes', previous_customer.notes,
      'is_active', false
    )
  );
end;
$$;

revoke all on function public.search_customers(uuid, text, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.create_customer(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_customer(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.deactivate_customer(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.search_customers(uuid, text, boolean, integer)
  to authenticated, service_role;
grant execute on function public.create_customer(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.update_customer(uuid, uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.deactivate_customer(uuid, uuid)
  to authenticated, service_role;

comment on function public.search_customers(uuid, text, boolean, integer) is
  'Returns business-scoped customers filtered safely by name or phone.';
comment on function public.create_customer(uuid, text, text, text) is
  'Creates an audited customer for an active business member.';
comment on function public.update_customer(uuid, uuid, text, text, text) is
  'Updates audited customer metadata for an active business member.';
comment on function public.deactivate_customer(uuid, uuid) is
  'Deactivates a customer for an administrator without deleting history.';

commit;
