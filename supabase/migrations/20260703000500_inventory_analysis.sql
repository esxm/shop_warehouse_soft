begin;

create table public.product_stock_thresholds (
  business_id uuid not null references public.businesses (id),
  product_id uuid not null,
  inventory_location_id uuid not null,
  minimum_quantity bigint not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (business_id, product_id, inventory_location_id),
  constraint product_stock_thresholds_product_business_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id),
  constraint product_stock_thresholds_location_business_fkey
    foreign key (business_id, inventory_location_id)
    references public.inventory_locations (business_id, id),
  constraint product_stock_thresholds_quantity_nonnegative
    check (minimum_quantity >= 0)
);

alter table public.product_stock_thresholds enable row level security;

create policy product_stock_thresholds_select_member
on public.product_stock_thresholds
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.product_stock_thresholds
  from anon, authenticated;
grant select on table public.product_stock_thresholds
  to authenticated, service_role;
grant all on table public.product_stock_thresholds to service_role;

create function private.prevent_product_stock_threshold_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Stock thresholds are disabled by setting them to zero'
    using errcode = '55000';
end;
$$;

create trigger product_stock_thresholds_no_delete
before delete on public.product_stock_thresholds
for each row
execute function private.prevent_product_stock_threshold_delete();

create function public.set_product_stock_threshold(
  target_business_id uuid,
  target_product_id uuid,
  target_inventory_location_id uuid,
  target_minimum_quantity text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  parsed_quantity bigint;
  prior_quantity bigint;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if coalesce(target_minimum_quantity, '') !~ '^(0|[1-9][0-9]{0,17})$' then
    raise exception 'Minimum quantity must be a non-negative whole number'
      using errcode = '22023';
  end if;
  parsed_quantity := target_minimum_quantity::bigint;

  if not exists (
    select 1
    from public.products as product
    where product.business_id = target_business_id
      and product.id = target_product_id
  ) then
    raise exception 'Product does not exist'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_locations as location
    where location.business_id = target_business_id
      and location.id = target_inventory_location_id
      and location.is_active
  ) then
    raise exception 'Active inventory location does not exist'
      using errcode = '22023';
  end if;

  select threshold.minimum_quantity
  into prior_quantity
  from public.product_stock_thresholds as threshold
  where threshold.business_id = target_business_id
    and threshold.product_id = target_product_id
    and threshold.inventory_location_id = target_inventory_location_id
  for update;

  insert into public.product_stock_thresholds (
    business_id,
    product_id,
    inventory_location_id,
    minimum_quantity,
    created_by,
    updated_by
  )
  values (
    target_business_id,
    target_product_id,
    target_inventory_location_id,
    parsed_quantity,
    current_user_id,
    current_user_id
  )
  on conflict (business_id, product_id, inventory_location_id)
  do update set
    minimum_quantity = excluded.minimum_quantity,
    updated_by = excluded.updated_by,
    updated_at = statement_timestamp();

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
    'product_stock_threshold.set',
    'product',
    target_product_id,
    case when prior_quantity is null then null
      else pg_catalog.jsonb_build_object(
        'inventory_location_id', target_inventory_location_id,
        'minimum_quantity', prior_quantity
      )
    end,
    pg_catalog.jsonb_build_object(
      'inventory_location_id', target_inventory_location_id,
      'minimum_quantity', parsed_quantity
    )
  );
end;
$$;

create view public.product_inventory_analysis_current
with (security_invoker = true)
as
select
  valuation.business_id,
  valuation.product_id,
  valuation.internal_code,
  valuation.product_name,
  valuation.category_id,
  valuation.category_name,
  valuation.product_is_active,
  valuation.location_id,
  valuation.location_name,
  valuation.location_type,
  valuation.quantity,
  valuation.inventory_value_ron,
  valuation.average_unit_cost_ron,
  valuation.cost_is_complete,
  coalesce(threshold.minimum_quantity, 0)::text as minimum_quantity,
  (
    coalesce(threshold.minimum_quantity, 0) > 0
    and valuation.quantity::bigint <= threshold.minimum_quantity
  ) as is_low_stock
from public.product_stock_valuation_by_location as valuation
left join public.product_stock_thresholds as threshold
  on threshold.business_id = valuation.business_id
  and threshold.product_id = valuation.product_id
  and threshold.inventory_location_id = valuation.location_id;

create view public.product_sales_daily_analysis
with (security_invoker = true)
as
with product_events as (
  select
    sale.business_id,
    sale.sale_date as activity_date,
    line.product_id,
    sale.id as source_id,
    'sale'::text as event_type,
    line.quantity as sold_quantity,
    0::bigint as returned_quantity,
    line.line_total_ron as gross_sales_ron,
    0::numeric as refunds_ron,
    line.line_total_ron as net_revenue_ron,
    line.line_cost_ron as historical_cost_ron
  from public.sales as sale
  inner join public.sale_lines as line
    on line.business_id = sale.business_id
    and line.sale_id = sale.id
  where sale.reversed_at is null

  union all

  select
    return_record.business_id,
    return_record.return_date as activity_date,
    line.product_id,
    return_record.id as source_id,
    'return'::text as event_type,
    0::bigint as sold_quantity,
    line.quantity as returned_quantity,
    0::numeric as gross_sales_ron,
    line.line_refund_ron as refunds_ron,
    -line.line_refund_ron as net_revenue_ron,
    case when line.disposition = 'sellable'
      then -line.line_cost_ron
      else 0::numeric
    end as historical_cost_ron
  from public.sale_returns as return_record
  inner join public.sale_return_lines as line
    on line.business_id = return_record.business_id
    and line.sale_return_id = return_record.id
  where return_record.reversed_at is null
)
select
  event.business_id,
  event.activity_date,
  event.product_id,
  product.internal_code,
  product.name as product_name,
  product.category_id,
  category.name as category_name,
  count(distinct event.source_id) filter (
    where event.event_type = 'sale'
  )::integer as sale_count,
  count(distinct event.source_id) filter (
    where event.event_type = 'return'
  )::integer as return_count,
  sum(event.sold_quantity)::text as sold_quantity,
  sum(event.returned_quantity)::text as returned_quantity,
  (
    sum(event.sold_quantity) - sum(event.returned_quantity)
  )::text as net_quantity,
  sum(event.gross_sales_ron)::text as gross_sales_ron,
  sum(event.refunds_ron)::text as refunds_ron,
  sum(event.net_revenue_ron)::text as net_revenue_ron,
  sum(event.historical_cost_ron)::text as historical_cost_ron,
  (
    sum(event.net_revenue_ron) - sum(event.historical_cost_ron)
  )::text as gross_margin_ron,
  case
    when sum(event.net_revenue_ron) = 0 then '0.0000'
    else round(
      (
        sum(event.net_revenue_ron) - sum(event.historical_cost_ron)
      ) / abs(sum(event.net_revenue_ron)) * 100,
      4
    )::text
  end as gross_margin_percent
from product_events as event
inner join public.products as product
  on product.business_id = event.business_id
  and product.id = event.product_id
inner join public.product_categories as category
  on category.business_id = product.business_id
  and category.id = product.category_id
group by
  event.business_id,
  event.activity_date,
  event.product_id,
  product.internal_code,
  product.name,
  product.category_id,
  category.name;

revoke all on table public.product_inventory_analysis_current
  from anon, authenticated;
revoke all on table public.product_sales_daily_analysis
  from anon, authenticated;
grant select on table public.product_inventory_analysis_current
  to authenticated, service_role;
grant select on table public.product_sales_daily_analysis
  to authenticated, service_role;

revoke all on function public.set_product_stock_threshold(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.set_product_stock_threshold(
  uuid, uuid, uuid, text
) to authenticated, service_role;

comment on table public.product_stock_thresholds is
  'Administrator-configured low-stock minimum quantity per product and location; zero disables the alert.';
comment on view public.product_inventory_analysis_current is
  'Current quantity, weighted historical cost, inventory value, and low-stock status by product and location.';
comment on view public.product_sales_daily_analysis is
  'Daily product sales, returns, net revenue, preserved historical cost, and gross-margin estimate.';
comment on function public.set_product_stock_threshold(
  uuid, uuid, uuid, text
) is
  'Administrator-only low-stock threshold upsert with audit history.';

commit;
