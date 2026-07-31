begin;

alter table public.stock_movements
  add column unit_cost_usd numeric(18, 8);

alter table public.supplier_purchases
  add column inventory_cost_usd numeric(18, 2);

alter table public.supplier_purchase_lines
  add column unit_cost_usd numeric(18, 8),
  add column line_total_usd numeric(18, 2);

alter table public.inventory_transfer_lines
  add column unit_cost_usd numeric(18, 8),
  add column line_total_usd numeric(18, 2);

alter table public.stock_movement_cost_details
  drop constraint stock_movement_cost_details_rate_valid,
  add constraint stock_movement_cost_details_rate_valid
    check (
      (
        cost_source = 'manual_purchase'
        and exchange_rate > 0
      )
      or (
        cost_source = 'source_weighted_average'
        and cost_currency = 'RON'
        and exchange_rate is null
      )
    );

alter table public.supplier_purchases
  drop constraint supplier_purchases_currency_values_consistent,
  add constraint supplier_purchases_currency_values_consistent
    check (
      (
        record_mode = 'value_only'
        and (
          (
            currency = 'RON'
            and purchase_exchange_rate is not null
            and inventory_cost_ron = original_amount
            and inventory_cost_usd = round(
              original_amount / purchase_exchange_rate,
              2
            )
          )
          or (
            currency = 'USD'
            and purchase_exchange_rate is not null
            and inventory_cost_ron = round(
              original_amount * purchase_exchange_rate,
              2
            )
            and inventory_cost_usd = original_amount
          )
        )
      )
      or (
        record_mode = 'product_lines'
        and purchase_exchange_rate is not null
        and inventory_cost_usd is not null
      )
      or (
        entry_origin = 'opening_balance'
        and inventory_cost_usd is null
      )
    );

alter table public.supplier_purchase_lines
  add constraint supplier_purchase_lines_usd_cost_positive
    check (unit_cost_usd is null or unit_cost_usd > 0),
  add constraint supplier_purchase_lines_usd_total_consistent
    check (
      line_total_usd is null
      or (
        line_total_usd = round(quantity * unit_cost_usd, 2)
        and line_total_usd > 0
      )
    );

alter table public.inventory_transfer_lines
  add constraint inventory_transfer_lines_usd_cost_positive
    check (unit_cost_usd is null or unit_cost_usd > 0),
  add constraint inventory_transfer_lines_usd_total_consistent
    check (
      line_total_usd is null
      or (
        line_total_usd = round(quantity * unit_cost_usd, 2)
        and line_total_usd > 0
      )
    );

create or replace function private.get_product_stock_cost_usd_balance(
  target_business_id uuid,
  target_product_id uuid,
  target_location_id uuid
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    sum(
      case
        when movement.destination_location_id = target_location_id
          then movement.quantity * movement.unit_cost_usd
        when movement.source_location_id = target_location_id
          then -movement.quantity * movement.unit_cost_usd
        else 0
      end
    ),
    0
  )
  from public.stock_movements as movement
  where movement.business_id = target_business_id
    and movement.product_id = target_product_id
    and movement.reversal_of_id is null
    and movement.unit_cost_usd is not null
    and (
      movement.source_location_id = target_location_id
      or movement.destination_location_id = target_location_id
    )
    and not exists (
      select 1
      from public.stock_movements as reversal
      where reversal.reversal_of_id = movement.id
    );
$$;

create or replace function private.set_stock_movement_unit_cost_usd()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  configured_usd_cost text;
  source_quantity bigint;
  source_usd_cost_balance numeric;
begin
  if new.reversal_of_id is not null or new.unit_cost_usd is not null then
    return new;
  end if;

  configured_usd_cost := nullif(
    pg_catalog.current_setting('app.stock_unit_cost_usd', true),
    ''
  );

  if configured_usd_cost is not null then
    new.unit_cost_usd := configured_usd_cost::numeric;
  elsif new.reference_type = 'supplier_purchase' then
    select line.unit_cost_usd
    into new.unit_cost_usd
    from public.supplier_purchase_lines as line
    where line.id = new.idempotency_key
      and line.business_id = new.business_id
      and line.product_id = new.product_id;
  elsif new.reference_type = 'inventory_transfer' then
    select line.unit_cost_usd
    into new.unit_cost_usd
    from public.inventory_transfer_lines as line
    where line.id = new.idempotency_key
      and line.business_id = new.business_id
      and line.product_id = new.product_id;
  end if;

  if new.unit_cost_usd is null and new.source_location_id is not null then
    source_quantity := private.get_product_stock_balance(
      new.business_id,
      new.product_id,
      new.source_location_id
    );
    source_usd_cost_balance := private.get_product_stock_cost_usd_balance(
      new.business_id,
      new.product_id,
      new.source_location_id
    );

    if source_quantity > 0 and source_usd_cost_balance > 0 then
      new.unit_cost_usd := round(source_usd_cost_balance / source_quantity, 8);
    end if;
  end if;

  if new.reversal_of_id is null and new.unit_cost_usd is not null
    and new.unit_cost_usd <= 0
  then
    raise exception 'Original stock movements require a positive USD unit cost'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_movements_set_unit_cost_usd
  on public.stock_movements;
create trigger stock_movements_set_unit_cost_usd
before insert on public.stock_movements
for each row
execute function private.set_stock_movement_unit_cost_usd();

do $patch$
declare
  original_definition text;
  revised_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.create_stock_movement_with_cost(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,text,public.transaction_currency,text,uuid,text,boolean,text)'::regprocedure
  )
  into original_definition;

  revised_definition := pg_catalog.replace(
    original_definition,
    E'  calculated_ron numeric;\n  source_quantity bigint;',
    E'  calculated_ron numeric;\n  calculated_usd numeric;\n  source_quantity bigint;'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'  source_cost_balance numeric;\n  selected_cost_source text;',
    E'  source_cost_balance numeric;\n  source_usd_cost_balance numeric;\n  selected_cost_source text;'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    source_cost_balance := private.get_product_stock_cost_balance(\n      target_business_id,\n      target_product_id,\n      target_source_location_id\n    );\n\n    if source_quantity <= 0 or source_cost_balance <= 0 then',
    E'    source_cost_balance := private.get_product_stock_cost_balance(\n      target_business_id,\n      target_product_id,\n      target_source_location_id\n    );\n    source_usd_cost_balance := private.get_product_stock_cost_usd_balance(\n      target_business_id,\n      target_product_id,\n      target_source_location_id\n    );\n\n    if source_quantity <= 0\n      or source_cost_balance <= 0\n      or source_usd_cost_balance <= 0\n    then'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    calculated_ron := round(source_cost_balance / source_quantity, 8);\n    parsed_original := round(calculated_ron, 2);',
    E'    calculated_ron := round(source_cost_balance / source_quantity, 8);\n    calculated_usd := round(source_usd_cost_balance / source_quantity, 8);\n    parsed_original := round(calculated_ron, 2);'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    if target_unit_cost_currency = ''USD'' then\n      parsed_rate := private.parse_positive_exchange_rate(\n        target_exchange_rate,\n        ''Purchase exchange rate''\n      );\n      calculated_ron := round(parsed_original * parsed_rate, 8);\n    else\n      if nullif(pg_catalog.btrim(target_exchange_rate), '''') is not null then\n        raise exception ''RON purchase price does not use an exchange rate''\n          using errcode = ''22023'';\n      end if;\n      calculated_ron := parsed_original;\n    end if;',
    E'    parsed_rate := private.parse_positive_exchange_rate(\n      nullif(pg_catalog.btrim(target_exchange_rate), ''''),\n      ''Purchase exchange rate''\n    );\n\n    if target_unit_cost_currency = ''USD'' then\n      calculated_usd := parsed_original;\n      calculated_ron := round(parsed_original * parsed_rate, 8);\n    else\n      calculated_ron := parsed_original;\n      calculated_usd := round(parsed_original / parsed_rate, 8);\n    end if;'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'  new_movement_id := public.create_stock_movement(',
    E'  perform pg_catalog.set_config(\n    ''app.stock_unit_cost_usd'',\n    calculated_usd::text,\n    true\n  );\n\n  new_movement_id := public.create_stock_movement('
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'      or existing_detail.exchange_rate is distinct from parsed_rate\n      or existing_detail.cost_source is distinct from selected_cost_source',
    E'      or existing_detail.exchange_rate is distinct from parsed_rate\n      or existing_detail.cost_source is distinct from selected_cost_source\n      or calculated_usd is null'
  );

  if revised_definition = original_definition then
    raise exception 'create_stock_movement_with_cost was not patched';
  end if;

  execute revised_definition;
end;
$patch$;

do $patch$
declare
  original_definition text;
  revised_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.create_supplier_purchase_with_lines_idempotent(uuid,uuid,uuid,text,text,uuid,uuid,jsonb,text,date,text)'::regprocedure
  )
  into original_definition;

  revised_definition := pg_catalog.replace(
    original_definition,
    E'  parsed_unit_cost numeric;\n  parsed_line_total_ron numeric;\n  original_total numeric := 0;\n  inventory_total numeric := 0;',
    E'  parsed_unit_cost numeric;\n  parsed_unit_cost_usd numeric;\n  parsed_line_total_ron numeric;\n  parsed_line_total_usd numeric;\n  original_total numeric := 0;\n  inventory_total numeric := 0;\n  inventory_total_usd numeric := 0;'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'  if normalized_currency = ''RON'' then\n    if normalized_rate is not null then\n      raise exception ''RON purchases must not include an exchange rate''\n        using errcode = ''22023'';\n    end if;\n\n    parsed_rate := null;\n    effective_rate := 1;\n  else\n    parsed_rate := private.parse_positive_exchange_rate(\n      normalized_rate,\n      ''Purchase exchange rate''\n    );\n    effective_rate := parsed_rate;\n  end if;',
    E'  parsed_rate := private.parse_positive_exchange_rate(\n    normalized_rate,\n    ''Purchase exchange rate''\n  );\n\n  if normalized_currency = ''RON'' then\n    effective_rate := 1;\n  else\n    effective_rate := parsed_rate;\n  end if;'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    parsed_unit_cost := round(\n      parsed_unit_price * effective_rate,\n      8\n    );\n    parsed_line_total_ron := round(\n      parsed_quantity * parsed_unit_cost,\n      2\n    );',
    E'    if normalized_currency = ''USD'' then\n      parsed_unit_cost_usd := parsed_unit_price;\n      parsed_unit_cost := round(parsed_unit_price * parsed_rate, 8);\n    else\n      parsed_unit_cost := parsed_unit_price;\n      parsed_unit_cost_usd := round(parsed_unit_price / parsed_rate, 8);\n    end if;\n\n    parsed_line_total_ron := round(\n      parsed_quantity * parsed_unit_cost,\n      2\n    );\n    parsed_line_total_usd := round(\n      parsed_quantity * parsed_unit_cost_usd,\n      2\n    );'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'      or parsed_line_total_ron > 9999999999999999.99',
    E'      or parsed_line_total_ron > 9999999999999999.99\n      or parsed_line_total_usd > 9999999999999999.99'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    inventory_total :=\n      inventory_total + parsed_line_total_ron;\n\n    if original_total > 9999999999999999.99\n      or inventory_total > 9999999999999999.99',
    E'    inventory_total :=\n      inventory_total + parsed_line_total_ron;\n    inventory_total_usd :=\n      inventory_total_usd + parsed_line_total_usd;\n\n    if original_total > 9999999999999999.99\n      or inventory_total > 9999999999999999.99\n      or inventory_total_usd > 9999999999999999.99'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'          ''unit_cost_ron'', parsed_unit_cost,\n          ''line_total_ron'', parsed_line_total_ron',
    E'          ''unit_cost_ron'', parsed_unit_cost,\n          ''unit_cost_usd'', parsed_unit_cost_usd,\n          ''line_total_ron'', parsed_line_total_ron,\n          ''line_total_usd'', parsed_line_total_usd'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    purchase_exchange_rate,\n    inventory_cost_ron,\n    destination_location_id,',
    E'    purchase_exchange_rate,\n    inventory_cost_ron,\n    inventory_cost_usd,\n    destination_location_id,'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    parsed_rate,\n    inventory_total,\n    target_destination_location_id,',
    E'    parsed_rate,\n    inventory_total,\n    inventory_total_usd,\n    target_destination_location_id,'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    unit_price_original_currency,\n    purchase_exchange_rate,\n    unit_cost_ron,\n    line_total_ron',
    E'    unit_price_original_currency,\n    purchase_exchange_rate,\n    unit_cost_ron,\n    unit_cost_usd,\n    line_total_ron,\n    line_total_usd'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    line.unit_price_original_currency,\n    line.purchase_exchange_rate,\n    line.unit_cost_ron,\n    line.line_total_ron',
    E'    line.unit_price_original_currency,\n    line.purchase_exchange_rate,\n    line.unit_cost_ron,\n    line.unit_cost_usd,\n    line.line_total_ron,\n    line.line_total_usd'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'    unit_price_original_currency numeric,\n    purchase_exchange_rate numeric,\n    unit_cost_ron numeric,\n    line_total_ron numeric',
    E'    unit_price_original_currency numeric,\n    purchase_exchange_rate numeric,\n    unit_cost_ron numeric,\n    unit_cost_usd numeric,\n    line_total_ron numeric,\n    line_total_usd numeric'
  );
  revised_definition := pg_catalog.replace(
    revised_definition,
    E'      ''inventory_cost_ron'', inventory_total,\n      ''destination_location_id'', target_destination_location_id,',
    E'      ''inventory_cost_ron'', inventory_total,\n      ''inventory_cost_usd'', inventory_total_usd,\n      ''destination_location_id'', target_destination_location_id,'
  );

  if revised_definition = original_definition then
    raise exception 'create_supplier_purchase_with_lines_idempotent was not patched';
  end if;

  execute revised_definition;
end;
$patch$;

create or replace function private.validate_supplier_purchase_line_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_purchase record;
  purchase_to_check public.supplier_purchases%rowtype;
  line_count bigint;
  original_total numeric;
  inventory_total numeric;
  inventory_total_usd numeric;
  invalid_rate_count bigint;
begin
  for target_purchase in
    select distinct
      line.business_id,
      line.supplier_purchase_id
    from new_supplier_purchase_lines as line
  loop
    select purchase.*
    into purchase_to_check
    from public.supplier_purchases as purchase
    where purchase.business_id = target_purchase.business_id
      and purchase.id = target_purchase.supplier_purchase_id
    for share;

    if not found
      or purchase_to_check.record_mode <> 'product_lines'
    then
      raise exception 'Product lines require a product-line supplier purchase'
        using errcode = '23514';
    end if;

    select
      count(*),
      sum(line.quantity * line.unit_price_original_currency),
      sum(line.line_total_ron),
      sum(line.line_total_usd),
      count(*) filter (
        where line.purchase_exchange_rate
          <> purchase_to_check.purchase_exchange_rate
      )
    into
      line_count,
      original_total,
      inventory_total,
      inventory_total_usd,
      invalid_rate_count
    from public.supplier_purchase_lines as line
    where line.business_id = target_purchase.business_id
      and line.supplier_purchase_id =
        target_purchase.supplier_purchase_id;

    if line_count = 0
      or original_total <> purchase_to_check.original_amount
      or inventory_total <> purchase_to_check.inventory_cost_ron
      or inventory_total_usd <> purchase_to_check.inventory_cost_usd
      or invalid_rate_count <> 0
    then
      raise exception 'Supplier purchase line totals do not reconcile'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end;
$$;

create or replace view public.product_stock_valuation_by_location
with (security_invoker = true)
as
select
  product.business_id,
  product.id as product_id,
  product.internal_code,
  product.name as product_name,
  product.category_id,
  category.name as category_name,
  product.is_active as product_is_active,
  location.id as location_id,
  location.name as location_name,
  location.type as location_type,
  coalesce(stock.quantity, 0)::text as quantity,
  coalesce(stock.inventory_value_ron, 0)::text as inventory_value_ron,
  case
    when coalesce(stock.quantity, 0) > 0
      and coalesce(stock.uncosted_count, 0) = 0
      then round(stock.inventory_value_ron / stock.quantity, 8)::text
    else null
  end as average_unit_cost_ron,
  coalesce(stock.uncosted_count, 0) = 0 as cost_is_complete,
  coalesce(stock.inventory_value_usd, 0)::text as inventory_value_usd,
  case
    when coalesce(stock.quantity, 0) > 0
      and coalesce(stock.uncosted_count, 0) = 0
      then round(stock.inventory_value_usd / stock.quantity, 8)::text
    else null
  end as average_unit_cost_usd
from public.products as product
inner join public.product_categories as category
  on category.business_id = product.business_id
  and category.id = product.category_id
inner join public.inventory_locations as location
  on location.business_id = product.business_id
left join lateral (
  select
    coalesce(sum(
      case
        when movement.destination_location_id = location.id
          then movement.quantity
        when movement.source_location_id = location.id
          then -movement.quantity
        else 0
      end
    ), 0) as quantity,
    coalesce(sum(
      case
        when movement.destination_location_id = location.id
          then movement.quantity * movement.unit_cost_ron
        when movement.source_location_id = location.id
          then -movement.quantity * movement.unit_cost_ron
        else 0
      end
    ) filter (where movement.unit_cost_ron is not null), 0)
      as inventory_value_ron,
    coalesce(sum(
      case
        when movement.destination_location_id = location.id
          then movement.quantity * movement.unit_cost_usd
        when movement.source_location_id = location.id
          then -movement.quantity * movement.unit_cost_usd
        else 0
      end
    ) filter (where movement.unit_cost_usd is not null), 0)
      as inventory_value_usd,
    count(*) filter (
      where movement.unit_cost_ron is null
        or movement.unit_cost_usd is null
    ) as uncosted_count
  from public.stock_movements as movement
  where movement.business_id = product.business_id
    and movement.product_id = product.id
    and movement.reversal_of_id is null
    and (
      movement.source_location_id = location.id
      or movement.destination_location_id = location.id
    )
    and not exists (
      select 1
      from public.stock_movements as reversal
      where reversal.reversal_of_id = movement.id
    )
) as stock on true;

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
  end as status,
  movement.unit_cost_usd::text as unit_cost_usd
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

create or replace view public.supplier_purchase_line_summaries
with (security_invoker = true)
as
select
  line.id as line_id,
  line.business_id,
  line.supplier_purchase_id,
  line.product_id,
  product.internal_code as product_code,
  product.name as product_name,
  line.line_number,
  line.quantity::text as quantity,
  line.unit_price_original_currency::text
    as unit_price_original_currency,
  line.purchase_exchange_rate::text as purchase_exchange_rate,
  line.unit_cost_ron::text as unit_cost_ron,
  line.line_total_ron::text as line_total_ron,
  line.unit_cost_usd::text as unit_cost_usd,
  line.line_total_usd::text as line_total_usd
from public.supplier_purchase_lines as line
inner join public.products as product
  on product.business_id = line.business_id
  and product.id = line.product_id;

create or replace view public.supplier_purchase_summaries
with (security_invoker = true)
as
select
  purchase.id as purchase_id,
  purchase.business_id,
  purchase.business_day_id,
  purchase.supplier_id,
  supplier.name as supplier_name,
  purchase.purchase_date,
  purchase.currency,
  purchase.original_amount::text as original_amount,
  purchase.purchase_exchange_rate::text as purchase_exchange_rate,
  purchase.inventory_cost_ron::text as inventory_cost_ron,
  purchase.destination_location_id,
  location.name as destination_location_name,
  location.type as destination_location_type,
  purchase.description,
  purchase.due_date,
  purchase.entry_origin,
  purchase.created_by,
  purchase.created_at,
  case
    when purchase.reversed_at is not null then 'reversed'
    when coalesce(active_allocations.allocated_original_amount, 0) = 0
      then 'unpaid'
    when coalesce(active_allocations.allocated_original_amount, 0)
      = purchase.original_amount
      then 'paid'
    else 'partial'
  end as derived_status,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason,
  coalesce(
    active_allocations.allocated_original_amount,
    0
  )::text as allocated_original_amount,
  (
    case
      when purchase.reversed_at is null
        then purchase.original_amount
          - coalesce(active_allocations.allocated_original_amount, 0)
      else 0::numeric
    end
  )::text as remaining_original_amount,
  (
    case
      when purchase.reversed_at is null
        then purchase.inventory_cost_ron
          - coalesce(active_allocations.historical_ron_value, 0)
      else 0::numeric
    end
  )::text as remaining_historical_ron,
  purchase.record_mode,
  coalesce(product_lines.line_count, 0)::integer as product_line_count,
  purchase.inventory_cost_usd::text as inventory_cost_usd
from public.supplier_purchases as purchase
inner join public.suppliers as supplier
  on supplier.id = purchase.supplier_id
  and supplier.business_id = purchase.business_id
left join public.inventory_locations as location
  on location.id = purchase.destination_location_id
  and location.business_id = purchase.business_id
left join lateral (
  select count(*) as line_count
  from public.supplier_purchase_lines as line
  where line.business_id = purchase.business_id
    and line.supplier_purchase_id = purchase.id
) as product_lines on true
left join lateral (
  select
    sum(allocation.allocated_original_amount)
      as allocated_original_amount,
    sum(allocation.historical_ron_value) as historical_ron_value
  from public.supplier_payment_allocations as allocation
  inner join public.supplier_payments as payment
    on payment.id = allocation.supplier_payment_id
    and payment.reversed_at is null
  where allocation.supplier_purchase_id = purchase.id
) as active_allocations on true;

revoke all on function private.get_product_stock_cost_usd_balance(
  uuid, uuid, uuid
) from public;
revoke all on function private.set_stock_movement_unit_cost_usd()
  from public;

comment on column public.stock_movements.unit_cost_usd is
  'Historical USD unit cost preserved alongside unit_cost_ron.';
comment on column public.supplier_purchases.inventory_cost_usd is
  'Historical total inventory cost in USD, derived from the recorded USD/RON rate.';
comment on view public.product_stock_valuation_by_location is
  'Derived quantity, weighted average unit cost, and historical RON/USD inventory value per product and location.';

commit;
