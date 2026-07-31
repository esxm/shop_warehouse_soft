begin;

create function private.require_original_stock_cost()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reversal_of_id is null
    and (new.unit_cost_ron is null or new.unit_cost_ron <= 0)
  then
    raise exception 'Original stock movements require a positive unit cost'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger stock_movements_require_positive_cost
before insert on public.stock_movements
for each row
execute function private.require_original_stock_cost();

create or replace view public.stock_movement_summaries
with (security_invoker = true)
as
select
  movement.id as movement_id,
  movement.business_id,
  movement.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  movement.movement_type,
  movement.source_location_id,
  source_location.name as source_location_name,
  movement.destination_location_id,
  destination_location.name as destination_location_name,
  movement.quantity::text as quantity,
  movement.unit_cost_ron::text as unit_cost_ron,
  movement.business_day_id,
  day.business_date,
  movement.reference_type,
  movement.reference_id,
  movement.notes,
  movement.created_by,
  coalesce(
    profile.full_name,
    pg_catalog.initcap(creator_membership.role::text)
  ) as created_by_name,
  movement.created_at,
  movement.reversal_of_id,
  reversal.id as reversal_movement_id,
  movement.negative_stock_override,
  movement.override_reason,
  case
    when movement.reversal_of_id is not null then 'reversal'
    when reversal.id is not null then 'reversed'
    else 'active'
  end as status
from public.stock_movements as movement
inner join public.products as product
  on product.business_id = movement.business_id
  and product.id = movement.product_id
left join public.inventory_locations as source_location
  on source_location.business_id = movement.business_id
  and source_location.id = movement.source_location_id
left join public.inventory_locations as destination_location
  on destination_location.business_id = movement.business_id
  and destination_location.id = movement.destination_location_id
left join public.business_days as day
  on day.business_id = movement.business_id
  and day.id = movement.business_day_id
left join public.profiles as profile
  on profile.id = movement.created_by
left join public.business_members as creator_membership
  on creator_membership.business_id = movement.business_id
  and creator_membership.user_id = movement.created_by
left join public.stock_movements as reversal
  on reversal.reversal_of_id = movement.id;

create or replace view public.sale_summaries
with (security_invoker = true)
as
select
  sale.id as sale_id,
  sale.business_id,
  sale.business_day_id,
  sale.sale_date,
  sale.sale_number,
  sale.shop_location_id,
  location.name as shop_location_name,
  sale.customer_id,
  customer.name as customer_name,
  sale.cash_amount_ron::text as cash_amount_ron,
  sale.bank_amount_ron::text as bank_amount_ron,
  sale.credit_amount_ron::text as credit_amount_ron,
  sale.total_amount_ron::text as total_amount_ron,
  sale.total_cost_ron::text as total_cost_ron,
  sale.gross_profit_ron::text as gross_profit_ron,
  sale.profit_percent::text as profit_percent,
  sale.notes,
  sale.created_by,
  coalesce(
    profile.full_name,
    pg_catalog.initcap(creator_membership.role::text)
  ) as created_by_name,
  sale.created_at,
  sale.reversed_at,
  sale.reversed_by,
  sale.reversal_reason,
  credit_purchase.id as customer_credit_purchase_id,
  case
    when sale.reversed_at is null then 'active'
    else 'reversed'
  end as status
from public.sales as sale
inner join public.inventory_locations as location
  on location.business_id = sale.business_id
  and location.id = sale.shop_location_id
left join public.customers as customer
  on customer.business_id = sale.business_id
  and customer.id = sale.customer_id
left join public.profiles as profile
  on profile.id = sale.created_by
left join public.business_members as creator_membership
  on creator_membership.business_id = sale.business_id
  and creator_membership.user_id = sale.created_by
left join public.customer_credit_purchases as credit_purchase
  on credit_purchase.business_id = sale.business_id
  and credit_purchase.sale_id = sale.id;

comment on function private.require_original_stock_cost() is
  'Rejects new original stock movements without a positive historical unit cost; reversals remain compatible with legacy rows.';
comment on view public.stock_movement_summaries is
  'Stock movement history with creator name or business role fallback.';
comment on view public.sale_summaries is
  'Individual sale history with creator name or business role fallback.';

commit;
