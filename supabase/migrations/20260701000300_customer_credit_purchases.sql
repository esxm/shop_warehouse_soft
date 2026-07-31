begin;

alter table public.customer_credit_purchases
  add column business_day_id uuid references public.business_days (id),
  add constraint customer_credit_purchases_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  add constraint customer_credit_purchases_description_length
    check (description is null or char_length(description) <= 500),
  add constraint customer_credit_purchases_day_origin_consistent
    check (
      (
        entry_origin = 'opening_balance'
        and opening_batch_id is not null
        and business_day_id is null
      )
      or (
        entry_origin in ('operational', 'admin_historical')
        and opening_batch_id is null
        and business_day_id is not null
      )
    );

create index customer_credit_purchases_business_day_idx
  on public.customer_credit_purchases (business_day_id, created_at);

create function private.parse_positive_ron_amount(
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
    or input_value !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$'
  then
    raise exception '% must be a plain decimal with at most two decimal places',
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

revoke all on function private.parse_positive_ron_amount(text, text)
  from public;

create function public.create_customer_credit_purchase(
  target_business_id uuid,
  target_customer_id uuid,
  target_business_day_id uuid,
  target_amount_ron text,
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
  normalized_description text := nullif(btrim(target_description), '');
  normalized_reason text := nullif(btrim(target_audit_reason), '');
  parsed_amount numeric;
  selected_day_date date;
  selected_day_status public.business_day_status;
  selected_customer_active boolean;
  new_purchase_id uuid;
  new_entry_origin text;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);

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
    target_amount_ron,
    'Credit purchase amount'
  );

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

  select customer.is_active
  into selected_customer_active
  from public.customers as customer
  where customer.id = target_customer_id
    and customer.business_id = target_business_id
  for share;

  if selected_customer_active is null then
    raise exception 'Customer does not exist'
      using errcode = '22023';
  end if;

  if not selected_customer_active then
    raise exception 'Inactive customers cannot receive new credit purchases'
      using errcode = '55000';
  end if;

  insert into public.customer_credit_purchases (
    business_id,
    business_day_id,
    customer_id,
    purchase_date,
    amount_ron,
    description,
    due_date,
    entry_origin,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    target_customer_id,
    selected_day_date,
    parsed_amount,
    normalized_description,
    target_due_date,
    new_entry_origin,
    current_user_id
  )
  returning id into new_purchase_id;

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
    'customer_credit_purchase.created',
    'customer_credit_purchase',
    new_purchase_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'customer_id', target_customer_id,
      'purchase_date', selected_day_date,
      'amount_ron', parsed_amount,
      'description', normalized_description,
      'due_date', target_due_date,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  return new_purchase_id;
end;
$$;

create function public.reverse_customer_credit_purchase(
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
  purchase_to_reverse public.customer_credit_purchases%rowtype;
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
  from public.customer_credit_purchases as purchase
  where purchase.id = target_purchase_id
    and purchase.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Customer credit purchase does not exist'
      using errcode = '22023';
  end if;

  if purchase_to_reverse.entry_origin = 'opening_balance' then
    raise exception 'Opening receivables must use opening-balance reversal'
      using errcode = '55000';
  end if;

  if purchase_to_reverse.reversed_at is not null then
    raise exception 'Customer credit purchase is already reversed'
      using errcode = '55000';
  end if;

  update public.customer_credit_purchases
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_purchase_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Customer credit purchase reversal lost a concurrency race'
      using errcode = '40001';
  end if;

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
    'customer_credit_purchase.reversed',
    'customer_credit_purchase',
    target_purchase_id,
    pg_catalog.jsonb_build_object(
      'status', 'unpaid',
      'amount_ron', purchase_to_reverse.amount_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time
    ),
    normalized_reason
  );
end;
$$;

create view public.customer_credit_purchase_balances
with (security_invoker = true)
as
select
  purchase.id as purchase_id,
  purchase.business_id,
  purchase.business_day_id,
  purchase.customer_id,
  purchase.purchase_date,
  purchase.amount_ron::text as amount_ron,
  '0.00'::text as allocated_ron,
  (
    case
      when purchase.reversed_at is null then purchase.amount_ron
      else 0::numeric
    end
  )::text as remaining_ron,
  case
    when purchase.reversed_at is not null then 'reversed'
    else 'unpaid'
  end as derived_status,
  purchase.description,
  purchase.due_date,
  purchase.entry_origin,
  purchase.created_by,
  purchase.created_at,
  purchase.reversed_at,
  purchase.reversed_by,
  purchase.reversal_reason
from public.customer_credit_purchases as purchase;

revoke all on table public.customer_credit_purchase_balances
  from anon, authenticated;
grant select on table public.customer_credit_purchase_balances
  to authenticated, service_role;

revoke all on function public.create_customer_credit_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.reverse_customer_credit_purchase(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_customer_credit_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  date,
  text
) to authenticated, service_role;
grant execute on function public.reverse_customer_credit_purchase(
  uuid,
  uuid,
  text
) to authenticated, service_role;

comment on function public.create_customer_credit_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  date,
  text
) is
  'Creates one immutable customer credit purchase for an authorized business day.';
comment on function public.reverse_customer_credit_purchase(uuid, uuid, text)
  is 'Reverses a customer credit purchase for an administrator with an audit reason.';
comment on view public.customer_credit_purchase_balances is
  'Derives purchase status and remaining RON without storing an editable balance.';

commit;
