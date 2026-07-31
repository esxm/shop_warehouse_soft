begin;

alter table public.supplier_purchases
  add column business_day_id uuid references public.business_days (id),
  add constraint supplier_purchases_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  add constraint supplier_purchases_description_length
    check (description is null or char_length(description) <= 500),
  add constraint supplier_purchases_day_origin_consistent
    check (
      (
        entry_origin = 'opening_balance'
        and opening_batch_id is not null
        and business_day_id is null
        and destination_location_id is null
      )
      or (
        entry_origin in ('operational', 'admin_historical')
        and opening_batch_id is null
        and business_day_id is not null
        and destination_location_id is not null
      )
    );

alter table public.inventory_value_movements
  add column business_day_id uuid references public.business_days (id),
  add constraint inventory_value_movements_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id);

create index supplier_purchases_business_day_idx
  on public.supplier_purchases (business_day_id, created_at);
create index inventory_value_movements_business_day_idx
  on public.inventory_value_movements (business_day_id, created_at);
create unique index inventory_value_movements_one_reversal_idx
  on public.inventory_value_movements (reversal_of_id)
  where reversal_of_id is not null;
create unique index inventory_value_movements_supplier_receipt_key
  on public.inventory_value_movements (source_entity_type, source_entity_id)
  where movement_type = 'supplier_purchase_receipt';

create function private.parse_positive_exchange_rate(
  input_value text,
  input_name text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  if input_value is null
    or input_value !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$'
  then
    raise exception '% must be a positive decimal with at most eight decimal places',
      input_name
      using errcode = '22023';
  end if;

  parsed_value := input_value::numeric;

  if parsed_value <= 0 then
    raise exception '% must be greater than zero', input_name
      using errcode = '22023';
  end if;

  return parsed_value;
end;
$$;

revoke all on function private.parse_positive_exchange_rate(text, text)
  from public;

create function public.create_supplier_purchase(
  target_business_id uuid,
  target_supplier_id uuid,
  target_business_day_id uuid,
  target_currency text,
  target_original_amount text,
  target_purchase_exchange_rate text,
  target_destination_location_id uuid,
  target_description text default null,
  target_due_date date default null,
  target_audit_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  caller_is_admin boolean;
  normalized_currency text := upper(btrim(target_currency));
  normalized_rate text := nullif(btrim(target_purchase_exchange_rate), '');
  normalized_description text := nullif(btrim(target_description), '');
  normalized_reason text := nullif(btrim(target_audit_reason), '');
  parsed_amount numeric;
  parsed_rate numeric;
  inventory_cost numeric;
  selected_day_date date;
  selected_day_status public.business_day_status;
  selected_supplier_active boolean;
  selected_location_active boolean;
  selected_location_type public.inventory_location_type;
  new_purchase_id uuid;
  new_movement_id uuid;
  new_entry_origin text;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);

  if normalized_currency is null
    or normalized_currency not in ('RON', 'USD')
  then
    raise exception 'Purchase currency must be RON or USD'
      using errcode = '22023';
  end if;

  if normalized_description is not null
    and char_length(normalized_description) > 500
  then
    raise exception 'Description must not exceed 500 characters'
      using errcode = '22023';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Audit reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  parsed_amount := private.parse_positive_ron_amount(
    target_original_amount,
    'Supplier purchase amount'
  );

  if normalized_currency = 'RON' then
    if normalized_rate is not null then
      raise exception 'RON purchases must not include an exchange rate'
        using errcode = '22023';
    end if;

    parsed_rate := null;
    inventory_cost := parsed_amount;
  else
    parsed_rate := private.parse_positive_exchange_rate(
      normalized_rate,
      'Purchase exchange rate'
    );
    inventory_cost := round(parsed_amount * parsed_rate, 2);
  end if;

  select day.business_date, day.status
  into selected_day_date, selected_day_status
  from public.business_days as day
  where day.id = target_business_day_id
    and day.business_id = target_business_id
  for share;

  if selected_day_status is null then
    raise exception 'Business day does not exist'
      using errcode = '22023';
  end if;

  if not caller_is_admin and selected_day_status <> 'open' then
    raise exception 'Employee requires the current open business day'
      using errcode = '55000';
  end if;

  if selected_day_status = 'closed' then
    if not caller_is_admin then
      raise exception 'Administrator access is required for historical entries'
        using errcode = '42501';
    end if;

    if normalized_reason is null then
      raise exception 'Historical entries require an audit reason'
        using errcode = '22023';
    end if;

    new_entry_origin := 'admin_historical';
  else
    new_entry_origin := 'operational';
  end if;

  if target_due_date is not null
    and target_due_date < selected_day_date
  then
    raise exception 'Due date must not be before the purchase date'
      using errcode = '22023';
  end if;

  select supplier.is_active
  into selected_supplier_active
  from public.suppliers as supplier
  where supplier.id = target_supplier_id
    and supplier.business_id = target_business_id
  for share;

  if selected_supplier_active is null then
    raise exception 'Supplier does not exist'
      using errcode = '22023';
  end if;

  if not selected_supplier_active then
    raise exception 'Inactive suppliers cannot receive new purchases'
      using errcode = '55000';
  end if;

  select location.is_active, location.type
  into selected_location_active, selected_location_type
  from public.inventory_locations as location
  where location.id = target_destination_location_id
    and location.business_id = target_business_id
  for share;

  if selected_location_type is null then
    raise exception 'Destination location does not exist'
      using errcode = '22023';
  end if;

  if not selected_location_active then
    raise exception 'Destination location is inactive'
      using errcode = '55000';
  end if;

  insert into public.supplier_purchases (
    business_id,
    business_day_id,
    supplier_id,
    purchase_date,
    currency,
    original_amount,
    purchase_exchange_rate,
    inventory_cost_ron,
    destination_location_id,
    description,
    due_date,
    entry_origin,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    target_supplier_id,
    selected_day_date,
    normalized_currency::public.transaction_currency,
    parsed_amount,
    parsed_rate,
    inventory_cost,
    target_destination_location_id,
    normalized_description,
    target_due_date,
    new_entry_origin,
    current_user_id
  )
  returning id into new_purchase_id;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    destination_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    selected_day_date,
    'supplier_purchase_receipt',
    target_destination_location_id,
    inventory_cost,
    'supplier_purchase',
    new_purchase_id,
    current_user_id
  )
  returning id into new_movement_id;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data,
    reason
  )
  values (
    target_business_id,
    current_user_id,
    'supplier_purchase.created',
    'supplier_purchase',
    new_purchase_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'supplier_id', target_supplier_id,
      'purchase_date', selected_day_date,
      'currency', normalized_currency,
      'original_amount', parsed_amount,
      'purchase_exchange_rate', parsed_rate,
      'inventory_cost_ron', inventory_cost,
      'destination_location_id', target_destination_location_id,
      'inventory_movement_id', new_movement_id,
      'description', normalized_description,
      'due_date', target_due_date,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  return new_purchase_id;
end;
$$;

create function public.reverse_supplier_purchase(
  target_business_id uuid,
  target_purchase_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := btrim(target_reason);
  reversal_time timestamptz := pg_catalog.now();
  purchase_to_reverse public.supplier_purchases%rowtype;
  movement_to_reverse public.inventory_value_movements%rowtype;
  new_movement_id uuid;
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if normalized_reason is null
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Reversal reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  select purchase.*
  into purchase_to_reverse
  from public.supplier_purchases as purchase
  where purchase.id = target_purchase_id
    and purchase.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Supplier purchase does not exist'
      using errcode = '22023';
  end if;

  if purchase_to_reverse.entry_origin = 'opening_balance' then
    raise exception 'Opening payables must use opening-balance reversal'
      using errcode = '55000';
  end if;

  if purchase_to_reverse.reversed_at is not null then
    raise exception 'Supplier purchase is already reversed'
      using errcode = '55000';
  end if;

  select movement.*
  into movement_to_reverse
  from public.inventory_value_movements as movement
  where movement.business_id = target_business_id
    and movement.source_entity_type = 'supplier_purchase'
    and movement.source_entity_id = target_purchase_id
    and movement.movement_type = 'supplier_purchase_receipt'
  for update;

  if not found then
    raise exception 'Supplier purchase inventory receipt does not exist'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.inventory_value_movements as reversal
    where reversal.reversal_of_id = movement_to_reverse.id
  ) then
    raise exception 'Supplier purchase is already reversed'
      using errcode = '55000';
  end if;

  update public.supplier_purchases
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_purchase_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Supplier purchase reversal lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.inventory_value_movements (
    business_id,
    business_day_id,
    movement_date,
    movement_type,
    source_location_id,
    amount_ron,
    source_entity_type,
    source_entity_id,
    created_by,
    reversal_of_id
  )
  values (
    target_business_id,
    purchase_to_reverse.business_day_id,
    purchase_to_reverse.purchase_date,
    'supplier_purchase_reversal',
    purchase_to_reverse.destination_location_id,
    purchase_to_reverse.inventory_cost_ron,
    'supplier_purchase',
    target_purchase_id,
    current_user_id,
    movement_to_reverse.id
  )
  returning id into new_movement_id;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_data,
    new_data,
    reason
  )
  values (
    target_business_id,
    current_user_id,
    'supplier_purchase.reversed',
    'supplier_purchase',
    target_purchase_id,
    pg_catalog.jsonb_build_object(
      'status', 'unpaid',
      'original_amount', purchase_to_reverse.original_amount,
      'inventory_cost_ron', purchase_to_reverse.inventory_cost_ron,
      'inventory_movement_id', movement_to_reverse.id
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time,
      'reversal_movement_id', new_movement_id
    ),
    normalized_reason
  );
end;
$$;

create view public.supplier_purchase_summaries
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
    when purchase.reversed_at is null then 'unpaid'
    else 'reversed'
  end as derived_status,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason
from public.supplier_purchases as purchase
inner join public.suppliers as supplier
  on supplier.id = purchase.supplier_id
  and supplier.business_id = purchase.business_id
left join public.inventory_locations as location
  on location.id = purchase.destination_location_id
  and location.business_id = purchase.business_id;

create view public.inventory_value_movement_summaries
with (security_invoker = true)
as
select
  movement.id as movement_id,
  movement.business_id,
  movement.business_day_id,
  movement.movement_date,
  movement.movement_type,
  movement.source_location_id,
  movement.destination_location_id,
  movement.amount_ron::text as amount_ron,
  movement.source_entity_type,
  movement.source_entity_id,
  movement.created_by,
  movement.created_at,
  movement.reversal_of_id
from public.inventory_value_movements as movement;

revoke all on table public.supplier_purchase_summaries
  from anon, authenticated;
grant select on table public.supplier_purchase_summaries
  to authenticated, service_role;
revoke all on table public.inventory_value_movement_summaries
  from anon, authenticated;
grant select on table public.inventory_value_movement_summaries
  to authenticated, service_role;

revoke all on function public.create_supplier_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.reverse_supplier_purchase(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_supplier_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  date,
  text
) to authenticated, service_role;
grant execute on function public.reverse_supplier_purchase(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.create_supplier_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  date,
  text
) is
  'Atomically creates an immutable supplier payable, inventory receipt, and audit event.';
comment on function public.reverse_supplier_purchase(uuid, uuid, text)
  is 'Reverses a supplier payable and its inventory effect for an administrator.';
comment on view public.supplier_purchase_summaries is
  'Shows immutable supplier purchases with destination and derived reversal status.';
comment on view public.inventory_value_movement_summaries is
  'Shows immutable inventory movement amounts as exact decimal text.';

commit;
