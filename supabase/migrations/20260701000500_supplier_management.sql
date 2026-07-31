begin;

alter table public.suppliers
  add constraint suppliers_phone_length
    check (phone is null or char_length(phone) <= 40),
  add constraint suppliers_notes_length
    check (notes is null or char_length(notes) <= 1000);

create function private.normalized_supplier_phone(input_phone text)
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

revoke all on function private.normalized_supplier_phone(text) from public;

create function public.search_suppliers(
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
  default_currency public.transaction_currency,
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
    raise exception 'Supplier search must not exceed 100 characters'
      using errcode = '22023';
  end if;

  if target_result_limit is null or target_result_limit not between 1 and 200
  then
    raise exception 'Supplier search limit must be between 1 and 200'
      using errcode = '22023';
  end if;

  if target_include_inactive is null then
    raise exception 'Inactive-supplier filter is required'
      using errcode = '22023';
  end if;

  return query
  select
    supplier.id,
    supplier.business_id,
    supplier.name,
    supplier.phone,
    supplier.notes,
    supplier.default_currency,
    supplier.is_active,
    supplier.created_at,
    supplier.created_by,
    supplier.updated_at
  from public.suppliers as supplier
  where supplier.business_id = target_business_id
    and (target_include_inactive or supplier.is_active)
    and (
      normalized_search is null
      or supplier.name ilike '%' || normalized_search || '%'
      or supplier.phone ilike '%' || normalized_search || '%'
    )
  order by supplier.is_active desc, supplier.name, supplier.created_at
  limit target_result_limit;
end;
$$;

create function public.create_supplier(
  target_business_id uuid,
  target_name text,
  target_phone text default null,
  target_notes text default null,
  target_default_currency text default null
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
  normalized_currency text := nullif(upper(btrim(target_default_currency)), '');
  comparable_phone text;
  new_supplier_id uuid;
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
    raise exception 'Supplier name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  if normalized_phone is not null
    and (
      char_length(normalized_phone) > 40
      or normalized_phone !~ '^[0-9+(). /-]+$'
      or private.normalized_supplier_phone(normalized_phone) is null
    )
  then
    raise exception 'Supplier phone is invalid'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 1000
  then
    raise exception 'Supplier notes must not exceed 1000 characters'
      using errcode = '22023';
  end if;

  if normalized_currency is not null
    and normalized_currency not in ('RON', 'USD')
  then
    raise exception 'Supplier default currency must be RON or USD'
      using errcode = '22023';
  end if;

  comparable_phone := private.normalized_supplier_phone(normalized_phone);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 10110)
  );

  if comparable_phone is not null
    and exists (
      select 1
      from public.suppliers as supplier
      where supplier.business_id = target_business_id
        and supplier.is_active
        and lower(btrim(supplier.name)) = lower(normalized_name)
        and private.normalized_supplier_phone(supplier.phone)
          = comparable_phone
    )
  then
    raise exception 'An active supplier already has this name and phone'
      using errcode = '23505';
  end if;

  insert into public.suppliers (
    business_id,
    name,
    phone,
    notes,
    default_currency,
    created_by
  )
  values (
    target_business_id,
    normalized_name,
    normalized_phone,
    normalized_notes,
    normalized_currency::public.transaction_currency,
    current_user_id
  )
  returning id into new_supplier_id;

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
    'supplier.created',
    'supplier',
    new_supplier_id,
    pg_catalog.jsonb_build_object(
      'name', normalized_name,
      'phone', normalized_phone,
      'notes', normalized_notes,
      'default_currency', normalized_currency,
      'is_active', true
    )
  );

  return new_supplier_id;
end;
$$;

create function public.update_supplier(
  target_business_id uuid,
  target_supplier_id uuid,
  target_name text,
  target_phone text default null,
  target_notes text default null,
  target_default_currency text default null
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
  normalized_currency text := nullif(upper(btrim(target_default_currency)), '');
  comparable_phone text;
  previous_supplier public.suppliers%rowtype;
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
    raise exception 'Supplier name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  if normalized_phone is not null
    and (
      char_length(normalized_phone) > 40
      or normalized_phone !~ '^[0-9+(). /-]+$'
      or private.normalized_supplier_phone(normalized_phone) is null
    )
  then
    raise exception 'Supplier phone is invalid'
      using errcode = '22023';
  end if;

  if normalized_notes is not null
    and char_length(normalized_notes) > 1000
  then
    raise exception 'Supplier notes must not exceed 1000 characters'
      using errcode = '22023';
  end if;

  if normalized_currency is not null
    and normalized_currency not in ('RON', 'USD')
  then
    raise exception 'Supplier default currency must be RON or USD'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_business_id::text, 10110)
  );

  select supplier.*
  into previous_supplier
  from public.suppliers as supplier
  where supplier.id = target_supplier_id
    and supplier.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Supplier does not exist'
      using errcode = '22023';
  end if;

  comparable_phone := private.normalized_supplier_phone(normalized_phone);

  if previous_supplier.is_active
    and comparable_phone is not null
    and exists (
      select 1
      from public.suppliers as supplier
      where supplier.business_id = target_business_id
        and supplier.id <> target_supplier_id
        and supplier.is_active
        and lower(btrim(supplier.name)) = lower(normalized_name)
        and private.normalized_supplier_phone(supplier.phone)
          = comparable_phone
    )
  then
    raise exception 'An active supplier already has this name and phone'
      using errcode = '23505';
  end if;

  update public.suppliers
  set
    name = normalized_name,
    phone = normalized_phone,
    notes = normalized_notes,
    default_currency = normalized_currency::public.transaction_currency
  where id = target_supplier_id
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
    'supplier.updated',
    'supplier',
    target_supplier_id,
    pg_catalog.jsonb_build_object(
      'name', previous_supplier.name,
      'phone', previous_supplier.phone,
      'notes', previous_supplier.notes,
      'default_currency', previous_supplier.default_currency,
      'is_active', previous_supplier.is_active
    ),
    pg_catalog.jsonb_build_object(
      'name', normalized_name,
      'phone', normalized_phone,
      'notes', normalized_notes,
      'default_currency', normalized_currency,
      'is_active', previous_supplier.is_active
    )
  );
end;
$$;

create function public.deactivate_supplier(
  target_business_id uuid,
  target_supplier_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  previous_supplier public.suppliers%rowtype;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  select supplier.*
  into previous_supplier
  from public.suppliers as supplier
  where supplier.id = target_supplier_id
    and supplier.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Supplier does not exist'
      using errcode = '22023';
  end if;

  if not previous_supplier.is_active then
    raise exception 'Supplier is already inactive'
      using errcode = '55000';
  end if;

  update public.suppliers
  set is_active = false
  where id = target_supplier_id
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
    'supplier.deactivated',
    'supplier',
    target_supplier_id,
    pg_catalog.jsonb_build_object(
      'name', previous_supplier.name,
      'phone', previous_supplier.phone,
      'notes', previous_supplier.notes,
      'default_currency', previous_supplier.default_currency,
      'is_active', true
    ),
    pg_catalog.jsonb_build_object(
      'name', previous_supplier.name,
      'phone', previous_supplier.phone,
      'notes', previous_supplier.notes,
      'default_currency', previous_supplier.default_currency,
      'is_active', false
    )
  );
end;
$$;

revoke all on function public.search_suppliers(uuid, text, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.create_supplier(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_supplier(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.deactivate_supplier(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.search_suppliers(uuid, text, boolean, integer)
  to authenticated, service_role;
grant execute on function public.create_supplier(uuid, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.update_supplier(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) to authenticated, service_role;
grant execute on function public.deactivate_supplier(uuid, uuid)
  to authenticated, service_role;

comment on function public.search_suppliers(uuid, text, boolean, integer) is
  'Returns business-scoped suppliers filtered safely by name or phone.';
comment on function public.create_supplier(uuid, text, text, text, text) is
  'Creates an audited supplier for an active business member.';
comment on function public.update_supplier(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) is 'Updates audited supplier metadata for an active business member.';
comment on function public.deactivate_supplier(uuid, uuid) is
  'Deactivates a supplier for an administrator without deleting history.';

commit;
