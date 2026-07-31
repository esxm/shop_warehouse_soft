begin;

create table public.business_position_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  snapshot_date date not null,
  warehouse_inventory_ron numeric(18, 2) not null,
  shop_inventory_ron numeric(18, 2) not null,
  cash_ron numeric(18, 2) not null,
  bank_ron numeric(18, 2) not null,
  customer_receivables_ron numeric(18, 2) not null,
  supplier_payables_ron numeric(18, 2) not null,
  supplier_payables_usd numeric(18, 2) not null,
  usd_ron_rate numeric(18, 8),
  estimated_usd_payables_ron numeric(18, 2) not null,
  estimated_supplier_payables_ron numeric(18, 2) not null,
  total_assets_ron numeric(18, 2) not null,
  net_business_value_ron numeric(18, 2) not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default clock_timestamp(),
  constraint business_position_snapshots_business_date_key
    unique (business_id, snapshot_date),
  constraint business_position_snapshots_rate_positive
    check (usd_ron_rate is null or usd_ron_rate > 0),
  constraint business_position_snapshots_rate_required
    check (supplier_payables_usd = 0 or usd_ron_rate is not null),
  constraint business_position_snapshots_usd_estimate_exact
    check (
      estimated_usd_payables_ron
      = round(supplier_payables_usd * coalesce(usd_ron_rate, 0), 2)
    ),
  constraint business_position_snapshots_supplier_total_exact
    check (
      estimated_supplier_payables_ron
      = supplier_payables_ron + estimated_usd_payables_ron
    ),
  constraint business_position_snapshots_assets_exact
    check (
      total_assets_ron
      = warehouse_inventory_ron
        + shop_inventory_ron
        + cash_ron
        + bank_ron
        + customer_receivables_ron
    ),
  constraint business_position_snapshots_net_exact
    check (
      net_business_value_ron
      = total_assets_ron - estimated_supplier_payables_ron
    )
);

create index business_position_snapshots_trend_idx
  on public.business_position_snapshots (
    business_id,
    snapshot_date,
    created_at,
    id
  );

alter table public.business_position_snapshots enable row level security;

create policy business_position_snapshots_select_member
on public.business_position_snapshots
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.business_position_snapshots
  from anon, authenticated;
grant select on table public.business_position_snapshots to authenticated;
grant all on table public.business_position_snapshots to service_role;

create function private.prevent_business_position_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Business-position snapshots are immutable'
    using errcode = '55000';
end;
$$;

revoke all on function private.prevent_business_position_snapshot_mutation()
  from public;

create trigger business_position_snapshots_prevent_mutation
before update or delete on public.business_position_snapshots
for each row
execute function private.prevent_business_position_snapshot_mutation();

create function public.save_business_position_snapshot(
  target_business_id uuid,
  target_snapshot_date date,
  target_usd_ron_rate text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  business_timezone text;
  current_business_date date;
  normalized_rate text := nullif(btrim(target_usd_ron_rate), '');
  parsed_rate numeric;
  warehouse_total numeric(18, 2);
  shop_total numeric(18, 2);
  cash_total numeric(18, 2);
  bank_total numeric(18, 2);
  receivable_total numeric(18, 2);
  payable_ron_total numeric(18, 2);
  payable_usd_total numeric(18, 2);
  estimated_usd_total numeric(18, 2);
  estimated_payable_total numeric(18, 2);
  asset_total numeric(18, 2);
  net_total numeric(18, 2);
  new_snapshot_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

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

  if target_snapshot_date is null
    or target_snapshot_date <> current_business_date
  then
    raise exception 'Snapshot date must be the current business date'
      using errcode = '22023';
  end if;

  if normalized_rate is not null then
    if normalized_rate
      !~ '^(0|[1-9][0-9]{0,5})([.][0-9]{1,8})?$'
    then
      raise exception 'USD/RON snapshot rate is invalid'
        using errcode = '22023';
    end if;

    parsed_rate := normalized_rate::numeric;

    if parsed_rate <= 0 then
      raise exception 'USD/RON snapshot rate must be greater than zero'
        using errcode = '22023';
    end if;
  end if;

  select
    coalesce(
      sum(balance.balance_ron::numeric)
        filter (where balance.type = 'warehouse'),
      0
    ),
    coalesce(
      sum(balance.balance_ron::numeric)
        filter (where balance.type = 'shop'),
      0
    )
  into warehouse_total, shop_total
  from public.inventory_location_balances as balance
  where balance.business_id = target_business_id;

  select
    coalesce(
      sum(balance.balance_ron::numeric)
        filter (where balance.type = 'cash'),
      0
    ),
    coalesce(
      sum(balance.balance_ron::numeric)
        filter (where balance.type = 'bank'),
      0
    )
  into cash_total, bank_total
  from public.financial_account_balances as balance
  where balance.business_id = target_business_id;

  select coalesce(sum(balance.outstanding_ron::numeric), 0)
  into receivable_total
  from public.customer_receivable_balances as balance
  where balance.business_id = target_business_id;

  select
    coalesce(
      sum(balance.outstanding_original_amount::numeric)
        filter (where balance.currency = 'RON'),
      0
    ),
    coalesce(
      sum(balance.outstanding_original_amount::numeric)
        filter (where balance.currency = 'USD'),
      0
    )
  into payable_ron_total, payable_usd_total
  from public.supplier_payable_balances as balance
  where balance.business_id = target_business_id;

  if payable_usd_total <> 0 and parsed_rate is null then
    raise exception 'USD/RON snapshot rate is required for USD payables'
      using errcode = '22023';
  end if;

  estimated_usd_total := round(
    payable_usd_total * coalesce(parsed_rate, 0),
    2
  );
  estimated_payable_total := payable_ron_total + estimated_usd_total;
  asset_total :=
    warehouse_total
    + shop_total
    + cash_total
    + bank_total
    + receivable_total;
  net_total := asset_total - estimated_payable_total;

  insert into public.business_position_snapshots (
    business_id,
    snapshot_date,
    warehouse_inventory_ron,
    shop_inventory_ron,
    cash_ron,
    bank_ron,
    customer_receivables_ron,
    supplier_payables_ron,
    supplier_payables_usd,
    usd_ron_rate,
    estimated_usd_payables_ron,
    estimated_supplier_payables_ron,
    total_assets_ron,
    net_business_value_ron,
    created_by
  )
  values (
    target_business_id,
    target_snapshot_date,
    warehouse_total,
    shop_total,
    cash_total,
    bank_total,
    receivable_total,
    payable_ron_total,
    payable_usd_total,
    parsed_rate,
    estimated_usd_total,
    estimated_payable_total,
    asset_total,
    net_total,
    current_user_id
  )
  returning id into new_snapshot_id;

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
    'business_position_snapshot.saved',
    'business_position_snapshot',
    new_snapshot_id,
    pg_catalog.jsonb_build_object(
      'snapshot_date', target_snapshot_date,
      'warehouse_inventory_ron', warehouse_total,
      'shop_inventory_ron', shop_total,
      'cash_ron', cash_total,
      'bank_ron', bank_total,
      'customer_receivables_ron', receivable_total,
      'supplier_payables_ron', payable_ron_total,
      'supplier_payables_usd', payable_usd_total,
      'usd_ron_rate', parsed_rate,
      'estimated_supplier_payables_ron', estimated_payable_total,
      'net_business_value_ron', net_total
    )
  );

  return new_snapshot_id;
exception
  when unique_violation then
    raise exception 'A business-position snapshot already exists for this date'
      using errcode = '23505';
end;
$$;

revoke all on function public.save_business_position_snapshot(
  uuid,
  date,
  text
) from public, anon, authenticated;
grant execute on function public.save_business_position_snapshot(
  uuid,
  date,
  text
) to authenticated, service_role;

create view public.business_position_snapshot_summaries
with (security_invoker = true)
as
select
  snapshot.id,
  snapshot.business_id,
  snapshot.snapshot_date,
  snapshot.warehouse_inventory_ron::text as warehouse_inventory_ron,
  snapshot.shop_inventory_ron::text as shop_inventory_ron,
  snapshot.cash_ron::text as cash_ron,
  snapshot.bank_ron::text as bank_ron,
  snapshot.customer_receivables_ron::text as customer_receivables_ron,
  snapshot.supplier_payables_ron::text as supplier_payables_ron,
  snapshot.supplier_payables_usd::text as supplier_payables_usd,
  snapshot.usd_ron_rate::text as usd_ron_rate,
  snapshot.estimated_usd_payables_ron::text
    as estimated_usd_payables_ron,
  snapshot.estimated_supplier_payables_ron::text
    as estimated_supplier_payables_ron,
  snapshot.total_assets_ron::text as total_assets_ron,
  snapshot.net_business_value_ron::text as net_business_value_ron,
  snapshot.created_by,
  snapshot.created_at
from public.business_position_snapshots as snapshot;

revoke all on table public.business_position_snapshot_summaries
  from anon, authenticated;
grant select on table public.business_position_snapshot_summaries
  to authenticated, service_role;

comment on table public.business_position_snapshots is
  'Immutable daily business-position snapshots; changes are net-worth movement, not exact profit.';
comment on function public.save_business_position_snapshot(uuid, date, text) is
  'Recomputes live balances and atomically saves one audited snapshot for the current business date.';

commit;
