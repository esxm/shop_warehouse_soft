begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.member_role as enum ('admin', 'employee');
create type public.inventory_location_type as enum ('warehouse', 'shop');
create type public.financial_account_type as enum ('cash', 'bank');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank
    check (full_name is null or btrim(full_name) <> '')
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'RON',
  timezone text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint businesses_name_not_blank check (btrim(name) <> ''),
  constraint businesses_base_currency_ron check (base_currency = 'RON'),
  constraint businesses_timezone_not_blank check (btrim(timezone) <> '')
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  type public.inventory_location_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint inventory_locations_name_not_blank check (btrim(name) <> ''),
  constraint inventory_locations_business_type_key unique (business_id, type)
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  type public.financial_account_type not null,
  currency text not null default 'RON',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint financial_accounts_name_not_blank check (btrim(name) <> ''),
  constraint financial_accounts_currency_ron check (currency = 'RON'),
  constraint financial_accounts_business_type_key unique (business_id, type)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  actor_user_id uuid not null references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_logs_reason_not_blank
    check (reason is null or btrim(reason) <> '')
);

create index business_members_user_active_idx
  on public.business_members (user_id, is_active, business_id);

create index inventory_locations_business_active_idx
  on public.inventory_locations (business_id, is_active);

create index financial_accounts_business_active_idx
  on public.financial_accounts (business_id, is_active);

create index audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

create index audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);

create index audit_logs_entity_idx
  on public.audit_logs (business_id, entity_type, entity_id)
  where entity_id is not null;

create function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.business_members as membership
      where membership.business_id = target_business_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
    );
$$;

create function private.is_business_admin(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.business_members as membership
      where membership.business_id = target_business_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
        and membership.is_active
    );
$$;

create function private.can_view_profile(target_user_id uuid)
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
          and viewer_membership.is_active
          and target_membership.user_id = target_user_id
          and target_membership.is_active
      )
    );
$$;

revoke all on function private.is_business_member(uuid) from public;
revoke all on function private.is_business_admin(uuid) from public;
revoke all on function private.can_view_profile(uuid) from public;

grant execute on function private.is_business_member(uuid)
  to authenticated, service_role;
grant execute on function private.is_business_admin(uuid)
  to authenticated, service_role;
grant execute on function private.can_view_profile(uuid)
  to authenticated, service_role;

create function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_profile_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_auth_user();

insert into public.profiles (id, full_name)
select
  users.id,
  nullif(
    btrim(coalesce(users.raw_user_meta_data ->> 'full_name', '')),
    ''
  )
from auth.users as users
on conflict (id) do nothing;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.audit_logs enable row level security;

create policy businesses_select_member
on public.businesses
for select
to authenticated
using ((select private.is_business_member(id)));

create policy businesses_update_admin
on public.businesses
for update
to authenticated
using ((select private.is_business_admin(id)))
with check ((select private.is_business_admin(id)));

create policy profiles_select_shared_business
on public.profiles
for select
to authenticated
using ((select private.can_view_profile(id)));

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy business_members_select_member
on public.business_members
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy business_members_insert_admin
on public.business_members
for insert
to authenticated
with check ((select private.is_business_admin(business_id)));

create policy business_members_update_admin
on public.business_members
for update
to authenticated
using ((select private.is_business_admin(business_id)))
with check ((select private.is_business_admin(business_id)));

create policy business_members_delete_admin
on public.business_members
for delete
to authenticated
using ((select private.is_business_admin(business_id)));

create policy inventory_locations_select_member
on public.inventory_locations
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy inventory_locations_insert_admin
on public.inventory_locations
for insert
to authenticated
with check ((select private.is_business_admin(business_id)));

create policy inventory_locations_update_admin
on public.inventory_locations
for update
to authenticated
using ((select private.is_business_admin(business_id)))
with check ((select private.is_business_admin(business_id)));

create policy financial_accounts_select_member
on public.financial_accounts
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy financial_accounts_insert_admin
on public.financial_accounts
for insert
to authenticated
with check ((select private.is_business_admin(business_id)));

create policy financial_accounts_update_admin
on public.financial_accounts
for update
to authenticated
using ((select private.is_business_admin(business_id)))
with check ((select private.is_business_admin(business_id)));

create policy audit_logs_select_admin
on public.audit_logs
for select
to authenticated
using ((select private.is_business_admin(business_id)));

revoke all on table public.businesses from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.business_members from anon, authenticated;
revoke all on table public.inventory_locations from anon, authenticated;
revoke all on table public.financial_accounts from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, update on table public.businesses to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.business_members
  to authenticated;
grant select, insert, update on table public.inventory_locations
  to authenticated;
grant select, insert, update on table public.financial_accounts
  to authenticated;
grant select on table public.audit_logs to authenticated;

grant all on table public.businesses to service_role;
grant all on table public.profiles to service_role;
grant all on table public.business_members to service_role;
grant all on table public.inventory_locations to service_role;
grant all on table public.financial_accounts to service_role;
grant all on table public.audit_logs to service_role;

create function public.create_business_foundation(
  business_name text,
  business_timezone text default 'Europe/Bucharest'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_business_id uuid;
  normalized_name text := btrim(business_name);
begin
  if current_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if normalized_name is null or normalized_name = '' then
    raise exception 'Business name is required'
      using errcode = '22023';
  end if;

  if business_timezone is null
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names
      where name = business_timezone
    )
  then
    raise exception 'Unknown business timezone'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = current_user_id
  )
  then
    raise exception 'Authenticated user does not exist'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name)
  select
    users.id,
    nullif(
      btrim(coalesce(users.raw_user_meta_data ->> 'full_name', '')),
      ''
    )
  from auth.users as users
  where users.id = current_user_id
  on conflict (id) do nothing;

  insert into public.businesses (
    name,
    timezone,
    created_by
  )
  values (
    normalized_name,
    business_timezone,
    current_user_id
  )
  returning id into new_business_id;

  insert into public.business_members (
    business_id,
    user_id,
    role
  )
  values (
    new_business_id,
    current_user_id,
    'admin'
  );

  insert into public.inventory_locations (
    business_id,
    name,
    type
  )
  values
    (new_business_id, 'Warehouse', 'warehouse'),
    (new_business_id, 'Shop', 'shop');

  insert into public.financial_accounts (
    business_id,
    name,
    type
  )
  values
    (new_business_id, 'Cash Register', 'cash'),
    (new_business_id, 'Bank Account', 'bank');

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  )
  values (
    new_business_id,
    current_user_id,
    'business.foundation_created',
    'business',
    new_business_id,
    jsonb_build_object(
      'name', normalized_name,
      'base_currency', 'RON',
      'timezone', business_timezone
    )
  );

  return new_business_id;
end;
$$;

revoke all on function public.create_business_foundation(text, text)
  from public, anon, authenticated;
grant execute on function public.create_business_foundation(text, text)
  to authenticated, service_role;

comment on function public.create_business_foundation(text, text) is
  'Atomically creates a business, its first admin, warehouse, shop, cash account, bank account, and audit record.';

commit;
