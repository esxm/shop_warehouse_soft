begin;

create table public.currency_reference_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18, 8) not null,
  effective_date date not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default clock_timestamp(),
  constraint currency_reference_rates_pair_supported
    check (base_currency = 'USD' and quote_currency = 'RON'),
  constraint currency_reference_rates_rate_positive
    check (rate > 0),
  constraint currency_reference_rates_distinct_pair
    check (base_currency <> quote_currency)
);

create index currency_reference_rates_latest_idx
  on public.currency_reference_rates (
    business_id,
    base_currency,
    quote_currency,
    effective_date desc,
    created_at desc
  );

alter table public.currency_reference_rates enable row level security;

create policy currency_reference_rates_select_member
on public.currency_reference_rates
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.currency_reference_rates from anon, authenticated;
grant select on table public.currency_reference_rates to authenticated;
grant all on table public.currency_reference_rates to service_role;

create function private.prevent_currency_reference_rate_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Currency reference rates are immutable'
    using errcode = '55000';
end;
$$;

revoke all on function private.prevent_currency_reference_rate_mutation()
  from public;

create trigger currency_reference_rates_prevent_mutation
before update or delete on public.currency_reference_rates
for each row
execute function private.prevent_currency_reference_rate_mutation();

create function public.record_usd_ron_reference_rate(
  target_business_id uuid,
  target_rate text,
  target_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_rate text := nullif(btrim(target_rate), '');
  parsed_rate numeric;
  new_rate_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if target_effective_date is null then
    raise exception 'Reference rate date is required'
      using errcode = '22023';
  end if;

  if normalized_rate is null
    or normalized_rate !~ '^(0|[1-9][0-9]{0,5})([.][0-9]{1,8})?$'
  then
    raise exception 'USD/RON reference rate is invalid'
      using errcode = '22023';
  end if;

  parsed_rate := normalized_rate::numeric;

  if parsed_rate <= 0 then
    raise exception 'USD/RON reference rate must be greater than zero'
      using errcode = '22023';
  end if;

  insert into public.currency_reference_rates (
    business_id,
    base_currency,
    quote_currency,
    rate,
    effective_date,
    created_by
  )
  values (
    target_business_id,
    'USD',
    'RON',
    parsed_rate,
    target_effective_date,
    current_user_id
  )
  returning id into new_rate_id;

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
    'currency_reference_rate.recorded',
    'currency_reference_rate',
    new_rate_id,
    pg_catalog.jsonb_build_object(
      'base_currency', 'USD',
      'quote_currency', 'RON',
      'rate', parsed_rate,
      'effective_date', target_effective_date
    )
  );

  return new_rate_id;
end;
$$;

revoke all on function public.record_usd_ron_reference_rate(
  uuid,
  text,
  date
) from public, anon, authenticated;
grant execute on function public.record_usd_ron_reference_rate(
  uuid,
  text,
  date
) to authenticated, service_role;

create view public.currency_reference_rate_summaries
with (security_invoker = true)
as
select
  reference_rate.id,
  reference_rate.business_id,
  reference_rate.base_currency,
  reference_rate.quote_currency,
  reference_rate.rate::text as rate,
  reference_rate.effective_date,
  reference_rate.created_by,
  reference_rate.created_at
from public.currency_reference_rates as reference_rate;

revoke all on table public.currency_reference_rate_summaries
  from anon, authenticated;
grant select on table public.currency_reference_rate_summaries
  to authenticated, service_role;

comment on table public.currency_reference_rates is
  'Immutable manually entered exchange-rate history used for current estimates.';
comment on function public.record_usd_ron_reference_rate(uuid, text, date) is
  'Records an immutable audited USD/RON reference rate for an administrator.';

commit;
