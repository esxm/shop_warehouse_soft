begin;

create function private.mirror_manual_stock_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_reference_type text;
  mirrored_source_location_id uuid;
  mirrored_destination_location_id uuid;
  mirrored_amount numeric(18, 2);
  mirrored_date date;
  mirrored_origin text := 'operational';
begin
  if new.reversal_of_id is null
    and new.reference_type = 'manual_stock_entry'
  then
    mirrored_source_location_id := new.source_location_id;
    mirrored_destination_location_id := new.destination_location_id;
  elsif new.reversal_of_id is not null
    and new.reference_type = 'stock_movement_reversal'
  then
    select original.reference_type
    into original_reference_type
    from public.stock_movements as original
    where original.id = new.reversal_of_id
      and original.business_id = new.business_id;

    if original_reference_type is distinct from 'manual_stock_entry' then
      return new;
    end if;

    mirrored_source_location_id := new.destination_location_id;
    mirrored_destination_location_id := new.source_location_id;
  else
    return new;
  end if;

  if new.unit_cost_ron is null then
    return new;
  end if;

  mirrored_amount := round(new.quantity * new.unit_cost_ron, 2);

  if mirrored_amount <= 0 then
    return new;
  end if;

  select day.business_date,
    case
      when day.status = 'closed' then 'admin_historical'
      else 'operational'
    end
  into mirrored_date, mirrored_origin
  from public.business_days as day
  where day.id = new.business_day_id
    and day.business_id = new.business_id;

  if mirrored_date is null then
    select (now() at time zone business.timezone)::date
    into mirrored_date
    from public.businesses as business
    where business.id = new.business_id;
  end if;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    source_location_id,
    destination_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    notes,
    entry_origin,
    created_by
  )
  values (
    new.business_id,
    new.business_day_id,
    mirrored_date,
    case
      when new.reversal_of_id is null
        then 'manual_product_stock'
      else 'manual_product_stock_reversal'
    end,
    mirrored_source_location_id,
    mirrored_destination_location_id,
    mirrored_amount,
    'manual_stock_movement',
    new.id,
    'Automatic product-valued inventory synchronization',
    mirrored_origin,
    new.created_by
  );

  return new;
end;
$$;

revoke all on function private.mirror_manual_stock_value() from public;

create trigger stock_movements_mirror_manual_value
after insert on public.stock_movements
for each row
execute function private.mirror_manual_stock_value();

with target_values as (
  select
    location.business_id,
    location.id as location_id,
    greatest(
      round(
        coalesce(
          sum(valuation.inventory_value_ron::numeric)
            filter (where valuation.cost_is_complete),
          0
        ),
        2
      ),
      0
    ) as target_value_ron
  from public.inventory_locations as location
  left join public.product_stock_valuation_by_location as valuation
    on valuation.business_id = location.business_id
    and valuation.location_id = location.id
  group by location.business_id, location.id
),
current_values as (
  select
    balance.business_id,
    balance.inventory_location_id as location_id,
    balance.balance_ron::numeric as current_value_ron
  from public.inventory_location_balances as balance
),
reconciliation as (
  select
    target.business_id,
    target.location_id,
    target.target_value_ron
      - coalesce(current.current_value_ron, 0) as difference_ron
  from target_values as target
  left join current_values as current
    on current.business_id = target.business_id
    and current.location_id = target.location_id
),
actors as (
  select distinct on (member.business_id)
    member.business_id,
    member.user_id
  from public.business_members as member
  where member.is_active
  order by
    member.business_id,
    case when member.role = 'admin' then 0 else 1 end,
    member.created_at,
    member.user_id
)
insert into public.inventory_value_movements (
  business_id,
  movement_date,
  movement_type,
  source_location_id,
  destination_location_id,
  amount_ron,
  source_entity_type,
  source_entity_id,
  notes,
  entry_origin,
  created_by
)
select
  reconciliation.business_id,
  (now() at time zone business.timezone)::date,
  'product_value_reconciliation',
  case
    when reconciliation.difference_ron < 0
      then reconciliation.location_id
  end,
  case
    when reconciliation.difference_ron > 0
      then reconciliation.location_id
  end,
  abs(reconciliation.difference_ron),
  'product_value_reconciliation',
  gen_random_uuid(),
  'One-time reconciliation to product-valued inventory',
  'admin_historical',
  actors.user_id
from reconciliation
inner join public.businesses as business
  on business.id = reconciliation.business_id
inner join actors
  on actors.business_id = reconciliation.business_id
where reconciliation.difference_ron <> 0;

comment on function private.mirror_manual_stock_value() is
  'Mirrors future manual product-stock movements into the hidden internal inventory-value ledger used by atomic financial workflows.';

commit;
