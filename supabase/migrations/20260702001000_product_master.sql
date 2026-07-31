create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null references auth.users(id),
  constraint product_categories_business_id_id_key
    unique (business_id, id),
  constraint product_categories_name_check
    check (char_length(btrim(name)) between 1 and 120)
);

create unique index product_categories_business_name_key
  on public.product_categories (business_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  internal_code text not null,
  name text not null,
  category_id uuid not null,
  unit text not null default 'piece',
  default_purchase_cost_ron numeric(18, 2),
  default_selling_price_ron numeric(18, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null references auth.users(id),
  constraint products_business_id_id_key unique (business_id, id),
  constraint products_category_business_fkey
    foreign key (business_id, category_id)
    references public.product_categories (business_id, id),
  constraint products_internal_code_check
    check (
      char_length(internal_code) between 1 and 40
      and internal_code ~ '^[A-Z0-9][A-Z0-9._-]*$'
    ),
  constraint products_name_check
    check (char_length(btrim(name)) between 1 and 160),
  constraint products_unit_piece_check check (unit = 'piece'),
  constraint products_purchase_cost_check
    check (
      default_purchase_cost_ron is null
      or default_purchase_cost_ron >= 0
    ),
  constraint products_selling_price_check
    check (
      default_selling_price_ron is null
      or default_selling_price_ron >= 0
    )
);

create unique index products_business_internal_code_key
  on public.products (business_id, internal_code);
create index products_business_active_name_idx
  on public.products (business_id, is_active, name);
create index products_business_category_idx
  on public.products (business_id, category_id, is_active);

create table private.product_code_sequences (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  next_value bigint not null default 1,
  constraint product_code_sequences_next_value_check check (next_value > 0)
);

create table private.product_import_idempotency (
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  imported_count integer not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  constraint product_import_idempotency_pkey
    primary key (business_id, idempotency_key),
  constraint product_import_idempotency_fingerprint_check
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint product_import_idempotency_count_check
    check (imported_count > 0)
);

revoke all on table private.product_code_sequences from public;
revoke all on table private.product_import_idempotency from public;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;

create policy product_categories_select_member
on public.product_categories
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy products_select_member
on public.products
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.product_categories from anon, authenticated;
revoke all on table public.products from anon, authenticated;
grant select on table public.product_categories to authenticated, service_role;
grant select on table public.products to authenticated, service_role;
grant all on table public.product_categories to service_role;
grant all on table public.products to service_role;

create function private.parse_optional_product_money(
  target_value text,
  target_label text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_value text := nullif(
    pg_catalog.replace(pg_catalog.btrim(target_value), ',', '.'),
    ''
  );
  parsed_value numeric;
begin
  if normalized_value is null then
    return null;
  end if;

  if normalized_value !~ '^(0|[1-9][0-9]{0,15})([.][0-9]{1,2})?$' then
    raise exception '% must be a non-negative amount with at most two decimals',
      target_label
      using errcode = '22023';
  end if;

  parsed_value := normalized_value::numeric;

  if parsed_value > 9999999999999999.99 then
    raise exception '% is too large', target_label
      using errcode = '22003';
  end if;

  return round(parsed_value, 2);
end;
$$;

create function private.generate_product_internal_code(
  target_business_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  sequence_value bigint;
  candidate text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':product-code',
      9310
    )
  );

  loop
    insert into private.product_code_sequences (
      business_id,
      next_value
    )
    values (
      target_business_id,
      2
    )
    on conflict (business_id)
    do update set next_value = private.product_code_sequences.next_value + 1
    returning next_value - 1 into sequence_value;

    candidate := 'P' || pg_catalog.lpad(sequence_value::text, 6, '0');

    exit when not exists (
      select 1
      from public.products as product
      where product.business_id = target_business_id
        and product.internal_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke all on function private.parse_optional_product_money(text, text)
  from public;
revoke all on function private.generate_product_internal_code(uuid)
  from public;

create function public.create_product_category(
  target_business_id uuid,
  target_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := pg_catalog.btrim(target_name);
  new_category_id uuid;
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
    raise exception 'Category name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  insert into public.product_categories (
    business_id,
    name,
    created_by,
    updated_by
  )
  values (
    target_business_id,
    normalized_name,
    current_user_id,
    current_user_id
  )
  returning id into new_category_id;

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
    'product_category.created',
    'product_category',
    new_category_id,
    pg_catalog.jsonb_build_object(
      'name', normalized_name,
      'is_active', true
    )
  );

  return new_category_id;
end;
$$;

create function public.update_product_category(
  target_business_id uuid,
  target_category_id uuid,
  target_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := pg_catalog.btrim(target_name);
  previous_category public.product_categories%rowtype;
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
    raise exception 'Category name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  select category.*
  into previous_category
  from public.product_categories as category
  where category.id = target_category_id
    and category.business_id = target_business_id
  for update;

  if not found or not previous_category.is_active then
    raise exception 'Active product category does not exist'
      using errcode = '22023';
  end if;

  update public.product_categories
  set
    name = normalized_name,
    updated_at = statement_timestamp(),
    updated_by = current_user_id
  where id = target_category_id;

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
    'product_category.updated',
    'product_category',
    target_category_id,
    pg_catalog.jsonb_build_object('name', previous_category.name),
    pg_catalog.jsonb_build_object('name', normalized_name)
  );
end;
$$;

create function public.deactivate_product_category(
  target_business_id uuid,
  target_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  previous_category public.product_categories%rowtype;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  select category.*
  into previous_category
  from public.product_categories as category
  where category.id = target_category_id
    and category.business_id = target_business_id
  for update;

  if not found or not previous_category.is_active then
    raise exception 'Active product category does not exist'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.products as product
    where product.business_id = target_business_id
      and product.category_id = target_category_id
      and product.is_active
  ) then
    raise exception 'Category has active products'
      using errcode = '55000';
  end if;

  update public.product_categories
  set
    is_active = false,
    updated_at = statement_timestamp(),
    updated_by = current_user_id
  where id = target_category_id;

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
    'product_category.deactivated',
    'product_category',
    target_category_id,
    pg_catalog.jsonb_build_object('is_active', true),
    pg_catalog.jsonb_build_object('is_active', false)
  );
end;
$$;

create function public.create_product(
  target_business_id uuid,
  target_internal_code text,
  target_name text,
  target_category_id uuid,
  target_default_purchase_cost_ron text default null,
  target_default_selling_price_ron text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := pg_catalog.upper(
    nullif(pg_catalog.btrim(target_internal_code), '')
  );
  normalized_name text := pg_catalog.btrim(target_name);
  purchase_cost numeric;
  selling_price numeric;
  new_product_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_name is null
    or char_length(normalized_name) not between 1 and 160
  then
    raise exception 'Product name must contain 1 to 160 characters'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.product_categories as category
    where category.id = target_category_id
      and category.business_id = target_business_id
      and category.is_active
  ) then
    raise exception 'Active product category does not exist'
      using errcode = '22023';
  end if;

  if normalized_code is null then
    normalized_code := private.generate_product_internal_code(
      target_business_id
    );
  elsif char_length(normalized_code) not between 1 and 40
    or normalized_code !~ '^[A-Z0-9][A-Z0-9._-]*$'
  then
    raise exception 'Internal code contains unsupported characters'
      using errcode = '22023';
  end if;

  purchase_cost := private.parse_optional_product_money(
    target_default_purchase_cost_ron,
    'Default purchase cost'
  );
  selling_price := private.parse_optional_product_money(
    target_default_selling_price_ron,
    'Default selling price'
  );

  insert into public.products (
    business_id,
    internal_code,
    name,
    category_id,
    default_purchase_cost_ron,
    default_selling_price_ron,
    created_by,
    updated_by
  )
  values (
    target_business_id,
    normalized_code,
    normalized_name,
    target_category_id,
    purchase_cost,
    selling_price,
    current_user_id,
    current_user_id
  )
  returning id into new_product_id;

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
    'product.created',
    'product',
    new_product_id,
    pg_catalog.jsonb_build_object(
      'internal_code', normalized_code,
      'name', normalized_name,
      'category_id', target_category_id,
      'unit', 'piece',
      'default_purchase_cost_ron', purchase_cost,
      'default_selling_price_ron', selling_price,
      'is_active', true
    )
  );

  return new_product_id;
end;
$$;

create function public.update_product(
  target_business_id uuid,
  target_product_id uuid,
  target_internal_code text,
  target_name text,
  target_category_id uuid,
  target_default_purchase_cost_ron text default null,
  target_default_selling_price_ron text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := pg_catalog.upper(
    nullif(pg_catalog.btrim(target_internal_code), '')
  );
  normalized_name text := pg_catalog.btrim(target_name);
  purchase_cost numeric;
  selling_price numeric;
  previous_product public.products%rowtype;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_code is null
    or char_length(normalized_code) not between 1 and 40
    or normalized_code !~ '^[A-Z0-9][A-Z0-9._-]*$'
  then
    raise exception 'Internal code contains unsupported characters'
      using errcode = '22023';
  end if;

  if normalized_name is null
    or char_length(normalized_name) not between 1 and 160
  then
    raise exception 'Product name must contain 1 to 160 characters'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.product_categories as category
    where category.id = target_category_id
      and category.business_id = target_business_id
      and category.is_active
  ) then
    raise exception 'Active product category does not exist'
      using errcode = '22023';
  end if;

  purchase_cost := private.parse_optional_product_money(
    target_default_purchase_cost_ron,
    'Default purchase cost'
  );
  selling_price := private.parse_optional_product_money(
    target_default_selling_price_ron,
    'Default selling price'
  );

  select product.*
  into previous_product
  from public.products as product
  where product.id = target_product_id
    and product.business_id = target_business_id
  for update;

  if not found or not previous_product.is_active then
    raise exception 'Active product does not exist'
      using errcode = '22023';
  end if;

  update public.products
  set
    internal_code = normalized_code,
    name = normalized_name,
    category_id = target_category_id,
    default_purchase_cost_ron = purchase_cost,
    default_selling_price_ron = selling_price,
    updated_at = statement_timestamp(),
    updated_by = current_user_id
  where id = target_product_id;

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
    'product.updated',
    'product',
    target_product_id,
    pg_catalog.jsonb_build_object(
      'internal_code', previous_product.internal_code,
      'name', previous_product.name,
      'category_id', previous_product.category_id,
      'default_purchase_cost_ron',
        previous_product.default_purchase_cost_ron,
      'default_selling_price_ron',
        previous_product.default_selling_price_ron
    ),
    pg_catalog.jsonb_build_object(
      'internal_code', normalized_code,
      'name', normalized_name,
      'category_id', target_category_id,
      'default_purchase_cost_ron', purchase_cost,
      'default_selling_price_ron', selling_price
    )
  );
end;
$$;

create function public.deactivate_product(
  target_business_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  previous_product public.products%rowtype;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  select product.*
  into previous_product
  from public.products as product
  where product.id = target_product_id
    and product.business_id = target_business_id
  for update;

  if not found or not previous_product.is_active then
    raise exception 'Active product does not exist'
      using errcode = '55000';
  end if;

  update public.products
  set
    is_active = false,
    updated_at = statement_timestamp(),
    updated_by = current_user_id
  where id = target_product_id;

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
    'product.deactivated',
    'product',
    target_product_id,
    pg_catalog.jsonb_build_object('is_active', true),
    pg_catalog.jsonb_build_object('is_active', false)
  );
end;
$$;

create function public.search_products(
  target_business_id uuid,
  target_search_text text default null,
  target_category_id uuid default null,
  target_include_inactive boolean default false,
  target_result_limit integer default 200
)
returns table (
  id uuid,
  business_id uuid,
  internal_code text,
  name text,
  category_id uuid,
  category_name text,
  unit text,
  default_purchase_cost_ron text,
  default_selling_price_ron text,
  is_active boolean,
  created_at timestamptz,
  created_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(pg_catalog.btrim(target_search_text), '');
begin
  if not private.is_business_member(target_business_id) then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if normalized_search is not null
    and char_length(normalized_search) > 100
  then
    raise exception 'Product search must not exceed 100 characters'
      using errcode = '22023';
  end if;

  if target_result_limit is null or target_result_limit not between 1 and 500
  then
    raise exception 'Product result limit must be between 1 and 500'
      using errcode = '22023';
  end if;

  return query
  select
    product.id,
    product.business_id,
    product.internal_code,
    product.name,
    category.id,
    category.name,
    product.unit,
    product.default_purchase_cost_ron::text,
    product.default_selling_price_ron::text,
    product.is_active,
    product.created_at,
    product.created_by,
    product.updated_at
  from public.products as product
  inner join public.product_categories as category
    on category.id = product.category_id
    and category.business_id = product.business_id
  where product.business_id = target_business_id
    and (target_include_inactive or product.is_active)
    and (
      target_category_id is null
      or product.category_id = target_category_id
    )
    and (
      normalized_search is null
      or product.internal_code ilike '%' || normalized_search || '%'
      or product.name ilike '%' || normalized_search || '%'
      or category.name ilike '%' || normalized_search || '%'
    )
  order by product.is_active desc, product.name, product.internal_code
  limit target_result_limit;
end;
$$;

create function public.import_products(
  target_business_id uuid,
  target_idempotency_key uuid,
  target_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_fingerprint text;
  existing_fingerprint text;
  existing_count integer;
  imported_count integer := 0;
  row_item jsonb;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if target_idempotency_key is null then
    raise exception 'Product import request identifier is required'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(target_rows) <> 'array'
    or pg_catalog.jsonb_array_length(target_rows) not between 1 and 500
  then
    raise exception 'Product import must contain 1 to 500 rows'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'rows', target_rows
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text
        || ':product-import:'
        || target_idempotency_key::text,
      9311
    )
  );

  select
    import.request_fingerprint,
    import.imported_count
  into existing_fingerprint, existing_count
  from private.product_import_idempotency as import
  where import.business_id = target_business_id
    and import.idempotency_key = target_idempotency_key;

  if found then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Product import request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_count;
  end if;

  for row_item in
    select item.value
    from pg_catalog.jsonb_array_elements(target_rows) as item(value)
  loop
    if pg_catalog.jsonb_typeof(row_item) <> 'object'
      or not row_item ? 'name'
      or not row_item ? 'category_id'
      or row_item - array[
        'internal_code',
        'name',
        'category_id',
        'default_purchase_cost_ron',
        'default_selling_price_ron'
      ] <> '{}'::jsonb
    then
      raise exception 'Product import row has invalid fields'
        using errcode = '22023';
    end if;

    perform public.create_product(
      target_business_id,
      coalesce(row_item ->> 'internal_code', ''),
      row_item ->> 'name',
      (row_item ->> 'category_id')::uuid,
      coalesce(row_item ->> 'default_purchase_cost_ron', ''),
      coalesce(row_item ->> 'default_selling_price_ron', '')
    );

    imported_count := imported_count + 1;
  end loop;

  insert into private.product_import_idempotency (
    business_id,
    idempotency_key,
    request_fingerprint,
    imported_count,
    created_by
  )
  values (
    target_business_id,
    target_idempotency_key,
    request_fingerprint,
    imported_count,
    current_user_id
  );

  return imported_count;
end;
$$;

revoke all on function public.create_product_category(uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_product_category(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.deactivate_product_category(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_product(
  uuid,
  text,
  text,
  uuid,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.update_product(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.deactivate_product(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.search_products(
  uuid,
  text,
  uuid,
  boolean,
  integer
) from public, anon, authenticated;
revoke all on function public.import_products(uuid, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.create_product_category(uuid, text)
  to authenticated, service_role;
grant execute on function public.update_product_category(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.deactivate_product_category(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.create_product(
  uuid,
  text,
  text,
  uuid,
  text,
  text
) to authenticated, service_role;
grant execute on function public.update_product(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text
) to authenticated, service_role;
grant execute on function public.deactivate_product(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.search_products(
  uuid,
  text,
  uuid,
  boolean,
  integer
) to authenticated, service_role;
grant execute on function public.import_products(uuid, uuid, jsonb)
  to authenticated, service_role;

comment on table public.product_categories is
  'Business-scoped product categories for the Phase 1B product master.';
comment on table public.products is
  'Business-scoped product metadata; quantities remain out of scope until the stock ledger.';
comment on function private.generate_product_internal_code(uuid) is
  'Generates serialized business-scoped P000001-style internal product codes.';
comment on function public.import_products(uuid, uuid, jsonb) is
  'Atomically imports one validated, idempotent batch of product metadata.';
