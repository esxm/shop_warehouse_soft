begin;

alter table public.products
  add column default_purchase_cost_original numeric(18, 2),
  add column default_purchase_exchange_rate numeric(18, 8);

update public.products
set default_purchase_cost_original = default_purchase_cost_ron,
    default_purchase_exchange_rate = null
where default_purchase_cost_ron is not null;

alter table public.products
  add constraint products_default_purchase_original_nonnegative
    check (
      default_purchase_cost_original is null
      or default_purchase_cost_original >= 0
    ),
  add constraint products_default_purchase_exchange_rate_positive
    check (
      default_purchase_exchange_rate is null
      or default_purchase_exchange_rate > 0
    );

create table public.stock_movement_cost_details (
  stock_movement_id uuid primary key
    references public.stock_movements(id),
  business_id uuid not null references public.businesses(id),
  cost_currency public.transaction_currency not null,
  original_unit_cost numeric(18, 2) not null,
  exchange_rate numeric(18, 8),
  cost_source text not null,
  constraint stock_movement_cost_details_business_movement_fkey
    foreign key (business_id, stock_movement_id)
    references public.stock_movements(business_id, id),
  constraint stock_movement_cost_details_original_positive
    check (original_unit_cost > 0),
  constraint stock_movement_cost_details_rate_valid
    check (
      (cost_currency = 'RON' and exchange_rate is null)
      or (cost_currency = 'USD' and exchange_rate > 0)
    ),
  constraint stock_movement_cost_details_source_valid
    check (cost_source in ('manual_purchase', 'source_weighted_average'))
);

alter table public.stock_movement_cost_details enable row level security;

create policy stock_movement_cost_details_select_member
on public.stock_movement_cost_details
for select
to authenticated
using (private.is_business_member(business_id));

revoke all on table public.stock_movement_cost_details
  from anon, authenticated;
grant select on table public.stock_movement_cost_details
  to authenticated, service_role;
grant all on table public.stock_movement_cost_details to service_role;

create function private.prevent_stock_movement_cost_detail_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Stock movement cost details are immutable'
    using errcode = '55000';
end;
$$;

create trigger stock_movement_cost_details_immutable
before update or delete on public.stock_movement_cost_details
for each row
execute function private.prevent_stock_movement_cost_detail_mutation();

revoke all on function private.prevent_stock_movement_cost_detail_mutation()
  from public;

create function public.create_product_with_cost_currency(
  target_business_id uuid,
  target_internal_code text,
  target_name text,
  target_category_id uuid,
  target_default_purchase_cost text,
  target_default_purchase_currency public.transaction_currency,
  target_default_purchase_exchange_rate text,
  target_default_selling_price_ron text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed_original numeric;
  parsed_rate numeric;
  calculated_ron numeric;
  new_product_id uuid;
begin
  parsed_original := private.parse_optional_product_money(
    target_default_purchase_cost,
    'Default purchase cost'
  );

  if parsed_original is null then
    if nullif(pg_catalog.btrim(target_default_purchase_exchange_rate), '')
      is not null
    then
      raise exception 'Exchange rate requires a default purchase cost'
        using errcode = '22023';
    end if;
    calculated_ron := null;
  elsif target_default_purchase_currency = 'USD' then
    parsed_rate := private.parse_positive_exchange_rate(
      target_default_purchase_exchange_rate,
      'Default purchase exchange rate'
    );
    calculated_ron := round(parsed_original * parsed_rate, 2);
  else
    if nullif(pg_catalog.btrim(target_default_purchase_exchange_rate), '')
      is not null
    then
      raise exception 'RON purchase cost does not use an exchange rate'
        using errcode = '22023';
    end if;
    calculated_ron := parsed_original;
  end if;

  new_product_id := public.create_product(
    target_business_id,
    target_internal_code,
    target_name,
    target_category_id,
    calculated_ron::text,
    target_default_selling_price_ron
  );

  update public.products
  set default_purchase_currency = target_default_purchase_currency,
      default_purchase_cost_original = parsed_original,
      default_purchase_exchange_rate = parsed_rate
  where id = new_product_id
    and business_id = target_business_id;

  return new_product_id;
end;
$$;

create function public.update_product_with_cost_currency(
  target_business_id uuid,
  target_product_id uuid,
  target_internal_code text,
  target_name text,
  target_category_id uuid,
  target_default_purchase_cost text,
  target_default_purchase_currency public.transaction_currency,
  target_default_purchase_exchange_rate text,
  target_default_selling_price_ron text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed_original numeric;
  parsed_rate numeric;
  calculated_ron numeric;
begin
  parsed_original := private.parse_optional_product_money(
    target_default_purchase_cost,
    'Default purchase cost'
  );

  if parsed_original is null then
    if nullif(pg_catalog.btrim(target_default_purchase_exchange_rate), '')
      is not null
    then
      raise exception 'Exchange rate requires a default purchase cost'
        using errcode = '22023';
    end if;
    calculated_ron := null;
  elsif target_default_purchase_currency = 'USD' then
    parsed_rate := private.parse_positive_exchange_rate(
      target_default_purchase_exchange_rate,
      'Default purchase exchange rate'
    );
    calculated_ron := round(parsed_original * parsed_rate, 2);
  else
    if nullif(pg_catalog.btrim(target_default_purchase_exchange_rate), '')
      is not null
    then
      raise exception 'RON purchase cost does not use an exchange rate'
        using errcode = '22023';
    end if;
    calculated_ron := parsed_original;
  end if;

  perform public.update_product(
    target_business_id,
    target_product_id,
    target_internal_code,
    target_name,
    target_category_id,
    calculated_ron::text,
    target_default_selling_price_ron
  );

  update public.products
  set default_purchase_currency = target_default_purchase_currency,
      default_purchase_cost_original = parsed_original,
      default_purchase_exchange_rate = parsed_rate
  where id = target_product_id
    and business_id = target_business_id;
end;
$$;

create function public.create_stock_movement_with_cost(
  target_business_id uuid,
  target_product_id uuid,
  target_movement_type text,
  target_quantity text,
  target_reference_type text,
  target_reference_id uuid,
  target_idempotency_key uuid,
  target_source_location_id uuid default null,
  target_destination_location_id uuid default null,
  target_unit_cost text default null,
  target_unit_cost_currency public.transaction_currency default 'RON',
  target_exchange_rate text default null,
  target_business_day_id uuid default null,
  target_notes text default null,
  target_allow_negative boolean default false,
  target_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed_original numeric;
  parsed_rate numeric;
  calculated_ron numeric;
  source_quantity bigint;
  source_cost_balance numeric;
  selected_cost_source text;
  new_movement_id uuid;
  existing_detail public.stock_movement_cost_details%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_product_id::text,
      9321
    )
  );

  if target_source_location_id is not null then
    if nullif(pg_catalog.btrim(target_unit_cost), '') is not null
      or nullif(pg_catalog.btrim(target_exchange_rate), '') is not null
    then
      raise exception 'Source movements use the source weighted average cost'
        using errcode = '22023';
    end if;

    source_quantity := private.get_product_stock_balance(
      target_business_id,
      target_product_id,
      target_source_location_id
    );

    if private.has_uncosted_product_stock_activity(
      target_business_id,
      target_product_id,
      target_source_location_id
    ) then
      raise exception 'Source weighted average cost is unavailable'
        using errcode = '55000';
    end if;

    source_cost_balance := private.get_product_stock_cost_balance(
      target_business_id,
      target_product_id,
      target_source_location_id
    );

    if source_quantity <= 0 or source_cost_balance <= 0 then
      raise exception 'Source weighted average cost is unavailable'
        using errcode = '55000';
    end if;

    calculated_ron := round(source_cost_balance / source_quantity, 8);
    parsed_original := round(calculated_ron, 2);
    target_unit_cost_currency := 'RON';
    selected_cost_source := 'source_weighted_average';
  else
    parsed_original := private.parse_optional_stock_unit_cost(target_unit_cost);

    if parsed_original is null or parsed_original <= 0 then
      raise exception 'Inbound stock requires a positive purchase price'
        using errcode = '22023';
    end if;

    if target_unit_cost_currency = 'USD' then
      parsed_rate := private.parse_positive_exchange_rate(
        target_exchange_rate,
        'Purchase exchange rate'
      );
      calculated_ron := round(parsed_original * parsed_rate, 8);
    else
      if nullif(pg_catalog.btrim(target_exchange_rate), '') is not null then
        raise exception 'RON purchase price does not use an exchange rate'
          using errcode = '22023';
      end if;
      calculated_ron := parsed_original;
    end if;
    selected_cost_source := 'manual_purchase';
  end if;

  new_movement_id := public.create_stock_movement(
    target_business_id,
    target_product_id,
    target_movement_type,
    target_quantity,
    target_reference_type,
    target_reference_id,
    target_idempotency_key,
    target_source_location_id,
    target_destination_location_id,
    calculated_ron::text,
    target_business_day_id,
    target_notes,
    target_allow_negative,
    target_override_reason
  );

  select detail.*
  into existing_detail
  from public.stock_movement_cost_details as detail
  where detail.stock_movement_id = new_movement_id;

  if existing_detail.stock_movement_id is not null then
    if existing_detail.cost_currency is distinct from target_unit_cost_currency
      or existing_detail.original_unit_cost is distinct from parsed_original
      or existing_detail.exchange_rate is distinct from parsed_rate
      or existing_detail.cost_source is distinct from selected_cost_source
    then
      raise exception 'Stock movement request identifier was reused with different cost data'
        using errcode = '22023';
    end if;
    return new_movement_id;
  end if;

  insert into public.stock_movement_cost_details (
    stock_movement_id,
    business_id,
    cost_currency,
    original_unit_cost,
    exchange_rate,
    cost_source
  )
  values (
    new_movement_id,
    target_business_id,
    target_unit_cost_currency,
    parsed_original,
    parsed_rate,
    selected_cost_source
  );

  return new_movement_id;
end;
$$;

revoke all on function public.create_product_with_cost_currency(
  uuid, text, text, uuid, text, public.transaction_currency, text, text
) from public, anon, authenticated;
revoke all on function public.update_product_with_cost_currency(
  uuid, uuid, text, text, uuid, text, public.transaction_currency, text, text
) from public, anon, authenticated;
revoke all on function public.create_stock_movement_with_cost(
  uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text,
  public.transaction_currency, text, uuid, text, boolean, text
) from public, anon, authenticated;

grant execute on function public.create_product_with_cost_currency(
  uuid, text, text, uuid, text, public.transaction_currency, text, text
) to authenticated, service_role;
grant execute on function public.update_product_with_cost_currency(
  uuid, uuid, text, text, uuid, text, public.transaction_currency, text, text
) to authenticated, service_role;
grant execute on function public.create_stock_movement_with_cost(
  uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text,
  public.transaction_currency, text, uuid, text, boolean, text
) to authenticated, service_role;

comment on table public.stock_movement_cost_details is
  'Immutable original-currency cost metadata for manually recorded stock movements.';
comment on function public.create_stock_movement_with_cost(
  uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text,
  public.transaction_currency, text, uuid, text, boolean, text
) is
  'Records inbound stock from RON/USD purchase data and derives source movement cost from the source weighted average.';

commit;
