begin;

alter table public.financial_account_entries
  add column business_day_id uuid references public.business_days (id),
  add column idempotency_key uuid,
  add constraint financial_account_entries_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  add constraint financial_account_entries_description_length
    check (description is null or char_length(description) <= 500);

update public.financial_account_entries as entry
set
  business_day_id = payment.business_day_id,
  idempotency_key = payment.idempotency_key
from public.customer_payments as payment
where entry.business_id = payment.business_id
  and entry.source_entity_type = 'customer_payment'
  and entry.source_entity_id = payment.id
  and entry.entry_type = 'customer_payment'
  and entry.reversal_of_id is null;

update public.financial_account_entries as entry
set
  business_day_id = payment.business_day_id,
  idempotency_key = payment.idempotency_key
from public.supplier_payments as payment
where entry.business_id = payment.business_id
  and entry.source_entity_type = 'supplier_payment'
  and entry.source_entity_id = payment.id
  and entry.entry_type = 'supplier_payment'
  and entry.reversal_of_id is null;

update public.financial_account_entries as reversal
set business_day_id = original.business_day_id
from public.financial_account_entries as original
where reversal.reversal_of_id = original.id;

create unique index financial_account_entries_business_idempotency_key
  on public.financial_account_entries (business_id, idempotency_key)
  where idempotency_key is not null;
create index financial_account_entries_business_day_idx
  on public.financial_account_entries (business_day_id, created_at)
  where business_day_id is not null;
create index financial_account_entries_source_idx
  on public.financial_account_entries (
    business_id,
    source_entity_type,
    source_entity_id
  );

create function private.set_financial_account_entry_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_day_id uuid;
  source_idempotency_key uuid;
  source_entry_date date;
  source_account_id uuid;
  source_amount numeric;
  original_entry public.financial_account_entries%rowtype;
begin
  if new.reversal_of_id is not null then
    select entry.*
    into original_entry
    from public.financial_account_entries as entry
    where entry.id = new.reversal_of_id
      and entry.business_id = new.business_id;

    if not found then
      raise exception 'Reversed financial entry does not exist in this business'
        using errcode = '22023';
    end if;

    if new.financial_account_id <> original_entry.financial_account_id
      or new.amount_ron <> original_entry.amount_ron
      or new.source_entity_type <> original_entry.source_entity_type
      or new.source_entity_id <> original_entry.source_entity_id
      or new.direction = original_entry.direction
    then
      raise exception 'Financial reversal must exactly compensate its source entry'
        using errcode = '22023';
    end if;

    new.business_day_id := original_entry.business_day_id;
    new.idempotency_key := null;
    return new;
  end if;

  if new.entry_type = 'customer_payment'
    and new.source_entity_type = 'customer_payment'
  then
    select
      payment.business_day_id,
      payment.idempotency_key,
      payment.payment_date,
      payment.financial_account_id,
      payment.amount_ron
    into
      source_day_id,
      source_idempotency_key,
      source_entry_date,
      source_account_id,
      source_amount
    from public.customer_payments as payment
    where payment.id = new.source_entity_id
      and payment.business_id = new.business_id;

    if not found
      or new.direction <> 'inflow'
      or new.entry_date <> source_entry_date
      or new.financial_account_id <> source_account_id
      or new.amount_ron <> source_amount
    then
      raise exception 'Customer payment ledger entry does not match its source'
        using errcode = '22023';
    end if;

    new.business_day_id := source_day_id;
    new.idempotency_key := source_idempotency_key;
  elsif new.entry_type = 'supplier_payment'
    and new.source_entity_type = 'supplier_payment'
  then
    select
      payment.business_day_id,
      payment.idempotency_key,
      payment.payment_date,
      payment.financial_account_id,
      payment.actual_amount_ron
    into
      source_day_id,
      source_idempotency_key,
      source_entry_date,
      source_account_id,
      source_amount
    from public.supplier_payments as payment
    where payment.id = new.source_entity_id
      and payment.business_id = new.business_id;

    if not found
      or new.direction <> 'outflow'
      or new.entry_date <> source_entry_date
      or new.financial_account_id <> source_account_id
      or new.amount_ron <> source_amount
    then
      raise exception 'Supplier payment ledger entry does not match its source'
        using errcode = '22023';
    end if;

    new.business_day_id := source_day_id;
    new.idempotency_key := source_idempotency_key;
  elsif new.entry_type = 'opening_balance'
    and new.source_entity_type = 'opening_balance_batch'
  then
    new.business_day_id := null;
    new.idempotency_key := null;
  end if;

  return new;
end;
$$;

revoke all on function private.set_financial_account_entry_metadata()
  from public;

create trigger financial_account_entries_set_metadata
before insert on public.financial_account_entries
for each row
execute function private.set_financial_account_entry_metadata();

create view public.financial_account_entry_summaries
with (security_invoker = true)
as
select
  entry.id as entry_id,
  entry.business_id,
  entry.financial_account_id,
  account.name as financial_account_name,
  account.type as financial_account_type,
  entry.business_day_id,
  entry.entry_date,
  entry.direction,
  entry.amount_ron::text as amount_ron,
  (
    case
      when entry.direction = 'inflow' then entry.amount_ron
      else -entry.amount_ron
    end
  )::text as signed_amount_ron,
  entry.entry_type,
  entry.source_entity_type,
  entry.source_entity_id,
  entry.description,
  entry.created_by,
  entry.created_at,
  entry.reversal_of_id,
  entry.idempotency_key
from public.financial_account_entries as entry
inner join public.financial_accounts as account
  on account.id = entry.financial_account_id
  and account.business_id = entry.business_id;

create view public.financial_account_daily_totals
with (security_invoker = true)
as
select
  entry.business_id,
  entry.financial_account_id,
  account.name as financial_account_name,
  account.type as financial_account_type,
  entry.entry_date,
  coalesce(
    sum(entry.amount_ron) filter (where entry.direction = 'inflow'),
    0
  )::text as inflow_ron,
  coalesce(
    sum(entry.amount_ron) filter (where entry.direction = 'outflow'),
    0
  )::text as outflow_ron,
  sum(
    case
      when entry.direction = 'inflow' then entry.amount_ron
      else -entry.amount_ron
    end
  )::text as net_movement_ron,
  count(*)::integer as entry_count
from public.financial_account_entries as entry
inner join public.financial_accounts as account
  on account.id = entry.financial_account_id
  and account.business_id = entry.business_id
group by
  entry.business_id,
  entry.financial_account_id,
  account.name,
  account.type,
  entry.entry_date;

revoke all on table public.financial_account_entry_summaries
  from anon, authenticated;
revoke all on table public.financial_account_daily_totals
  from anon, authenticated;
grant select on table public.financial_account_entry_summaries
  to authenticated, service_role;
grant select on table public.financial_account_daily_totals
  to authenticated, service_role;

comment on view public.financial_account_entry_summaries is
  'Exposes immutable account movements with exact decimal text and source metadata.';
comment on view public.financial_account_daily_totals is
  'Derives daily account inflows, outflows, and net movement from immutable entries.';
comment on function private.set_financial_account_entry_metadata() is
  'Copies and validates business-day and idempotency metadata from approved financial sources.';

commit;
