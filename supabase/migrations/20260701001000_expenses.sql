begin;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint expense_categories_business_id_id_key
    unique (business_id, id),
  constraint expense_categories_name_valid
    check (btrim(name) <> '' and char_length(name) <= 100)
);

create unique index expense_categories_business_name_idx
  on public.expense_categories (business_id, lower(btrim(name)));

create function private.seed_default_expense_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.expense_categories (business_id, name)
  select
    new.id,
    category.name
  from (
    values
      ('Rent'),
      ('Electricity'),
      ('Transport'),
      ('Salary'),
      ('Internet'),
      ('Taxes and fees'),
      ('Maintenance'),
      ('Other')
  ) as category(name)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.seed_default_expense_categories()
  from public;

insert into public.expense_categories (business_id, name)
select
  business.id,
  category.name
from public.businesses as business
cross join (
  values
    ('Rent'),
    ('Electricity'),
    ('Transport'),
    ('Salary'),
    ('Internet'),
    ('Taxes and fees'),
    ('Maintenance'),
    ('Other')
) as category(name)
on conflict do nothing;

create trigger businesses_seed_default_expense_categories
after insert on public.businesses
for each row
execute function private.seed_default_expense_categories();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  business_day_id uuid not null references public.business_days (id),
  expense_date date not null,
  category_id uuid not null references public.expense_categories (id),
  amount_ron numeric(18, 2) not null,
  financial_account_id uuid not null references public.financial_accounts (id),
  description text not null,
  entry_origin text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.expenses (id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id),
  reversal_reason text,
  constraint expenses_business_id_id_key
    unique (business_id, id),
  constraint expenses_idempotency_key
    unique (business_id, idempotency_key),
  constraint expenses_amount_positive
    check (amount_ron > 0),
  constraint expenses_description_valid
    check (
      btrim(description) <> ''
      and char_length(description) <= 500
    ),
  constraint expenses_origin_valid
    check (entry_origin in ('operational', 'admin_historical')),
  constraint expenses_reversal_consistent
    check (
      (
        reversed_at is null
        and reversed_by is null
        and reversal_reason is null
      )
      or (
        reversed_at is not null
        and reversed_by is not null
        and reversal_reason is not null
        and char_length(btrim(reversal_reason)) between 10 and 500
      )
    ),
  constraint expenses_not_self_reversal
    check (reversal_of_id is null or reversal_of_id <> id),
  constraint expenses_day_business_fkey
    foreign key (business_id, business_day_id)
    references public.business_days (business_id, id),
  constraint expenses_category_business_fkey
    foreign key (business_id, category_id)
    references public.expense_categories (business_id, id),
  constraint expenses_account_business_fkey
    foreign key (business_id, financial_account_id)
    references public.financial_accounts (business_id, id)
);

create index expenses_business_date_idx
  on public.expenses (business_id, expense_date desc, created_at desc);
create index expenses_category_date_idx
  on public.expenses (category_id, expense_date desc);
create index expenses_account_date_idx
  on public.expenses (financial_account_id, expense_date desc);

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy expense_categories_select_member
on public.expense_categories
for select
to authenticated
using ((select private.is_business_member(business_id)));

create policy expenses_select_member
on public.expenses
for select
to authenticated
using ((select private.is_business_member(business_id)));

revoke all on table public.expense_categories from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;
grant select on table public.expense_categories to authenticated;
grant select on table public.expenses to authenticated;
grant all on table public.expense_categories to service_role;
grant all on table public.expenses to service_role;

create unique index financial_account_entries_expense_source_idx
  on public.financial_account_entries (
    business_id,
    source_entity_id,
    entry_type
  )
  where source_entity_type = 'expense';

create function private.prevent_expense_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Expenses are immutable; use a reversal'
      using errcode = '55000';
  end if;

  if old.reversed_at is not null then
    raise exception 'Reversed expenses are immutable'
      using errcode = '55000';
  end if;

  if (
    to_jsonb(new)
      - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) <> (
    to_jsonb(old)
      - array['reversed_at', 'reversed_by', 'reversal_reason']
  ) then
    raise exception 'Expenses are immutable; use a reversal'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_expense_mutation() from public;

create trigger expenses_prevent_mutation
before update or delete on public.expenses
for each row
execute function private.prevent_expense_mutation();

create function public.create_expense(
  target_business_id uuid,
  target_business_day_id uuid,
  target_category_id uuid,
  target_amount_ron text,
  target_financial_account_id uuid,
  target_description text,
  target_idempotency_key uuid,
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
  selected_category_active boolean;
  selected_account_active boolean;
  selected_account_currency text;
  new_entry_origin text;
  request_fingerprint text;
  existing_expense_id uuid;
  existing_fingerprint text;
  new_expense_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  caller_is_admin := private.is_business_admin(target_business_id);
  parsed_amount := private.parse_positive_ron_amount(
    target_amount_ron,
    'Expense amount'
  );

  if normalized_description is null
    or char_length(normalized_description) > 500
  then
    raise exception 'Expense description must contain 1 to 500 characters'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null then
    raise exception 'Expense request identifier is required'
      using errcode = '22023';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception 'Audit reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'business_day_id', target_business_day_id,
      'category_id', target_category_id,
      'amount_ron', parsed_amount,
      'financial_account_id', target_financial_account_id,
      'description', normalized_description,
      'audit_reason', normalized_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text || ':' || target_idempotency_key::text,
      9150
    )
  );

  select expense.id, expense.request_fingerprint
  into existing_expense_id, existing_fingerprint
  from public.expenses as expense
  where expense.business_id = target_business_id
    and expense.idempotency_key = target_idempotency_key;

  if existing_expense_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Expense request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_expense_id;
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
      raise exception 'Administrator access is required for historical expenses'
        using errcode = '42501';
    end if;

    if normalized_reason is null then
      raise exception 'Historical expenses require an audit reason'
        using errcode = '22023';
    end if;

    new_entry_origin := 'admin_historical';
  else
    new_entry_origin := 'operational';
  end if;

  select category.is_active
  into selected_category_active
  from public.expense_categories as category
  where category.id = target_category_id
    and category.business_id = target_business_id
  for share;

  if selected_category_active is null then
    raise exception 'Expense category does not exist'
      using errcode = '22023';
  end if;

  if not selected_category_active then
    raise exception 'Expense category is inactive'
      using errcode = '55000';
  end if;

  select account.is_active, account.currency
  into selected_account_active, selected_account_currency
  from public.financial_accounts as account
  where account.id = target_financial_account_id
    and account.business_id = target_business_id
  for share;

  if selected_account_active is null then
    raise exception 'Financial account does not exist'
      using errcode = '22023';
  end if;

  if not selected_account_active or selected_account_currency <> 'RON' then
    raise exception 'Expense requires an active RON account'
      using errcode = '55000';
  end if;

  insert into public.expenses (
    business_id,
    business_day_id,
    expense_date,
    category_id,
    amount_ron,
    financial_account_id,
    description,
    entry_origin,
    idempotency_key,
    request_fingerprint,
    created_by
  )
  values (
    target_business_id,
    target_business_day_id,
    selected_day_date,
    target_category_id,
    parsed_amount,
    target_financial_account_id,
    normalized_description,
    new_entry_origin,
    target_idempotency_key,
    request_fingerprint,
    current_user_id
  )
  returning id into new_expense_id;

  insert into public.financial_account_entries (
    business_id,
    financial_account_id,
    business_day_id,
    entry_date,
    direction,
    amount_ron,
    entry_type,
    source_entity_type,
    source_entity_id,
    description,
    created_by,
    idempotency_key
  )
  values (
    target_business_id,
    target_financial_account_id,
    target_business_day_id,
    selected_day_date,
    'outflow',
    parsed_amount,
    'expense',
    'expense',
    new_expense_id,
    normalized_description,
    current_user_id,
    target_idempotency_key
  );

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
    'expense.created',
    'expense',
    new_expense_id,
    pg_catalog.jsonb_build_object(
      'business_day_id', target_business_day_id,
      'expense_date', selected_day_date,
      'category_id', target_category_id,
      'amount_ron', parsed_amount,
      'financial_account_id', target_financial_account_id,
      'description', normalized_description,
      'entry_origin', new_entry_origin
    ),
    normalized_reason
  );

  return new_expense_id;
end;
$$;

create function public.reverse_expense(
  target_business_id uuid,
  target_expense_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_reason text := nullif(btrim(target_reason), '');
  reversal_time timestamptz := pg_catalog.now();
  expense_to_reverse public.expenses%rowtype;
  original_ledger_entry public.financial_account_entries%rowtype;
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

  select expense.*
  into expense_to_reverse
  from public.expenses as expense
  where expense.id = target_expense_id
    and expense.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Expense does not exist'
      using errcode = '22023';
  end if;

  if expense_to_reverse.reversed_at is not null then
    raise exception 'Expense is already reversed'
      using errcode = '55000';
  end if;

  select entry.*
  into original_ledger_entry
  from public.financial_account_entries as entry
  where entry.business_id = target_business_id
    and entry.source_entity_type = 'expense'
    and entry.source_entity_id = target_expense_id
    and entry.entry_type = 'expense'
  for update;

  if not found then
    raise exception 'Expense ledger entry does not exist'
      using errcode = '55000';
  end if;

  update public.expenses
  set
    reversed_at = reversal_time,
    reversed_by = current_user_id,
    reversal_reason = normalized_reason
  where id = target_expense_id
    and business_id = target_business_id
    and reversed_at is null;

  if not found then
    raise exception 'Expense reversal lost a concurrency race'
      using errcode = '40001';
  end if;

  insert into public.financial_account_entries (
    business_id,
    financial_account_id,
    entry_date,
    direction,
    amount_ron,
    entry_type,
    source_entity_type,
    source_entity_id,
    description,
    created_by,
    reversal_of_id
  )
  values (
    target_business_id,
    original_ledger_entry.financial_account_id,
    original_ledger_entry.entry_date,
    'inflow',
    original_ledger_entry.amount_ron,
    'expense_reversal',
    'expense',
    target_expense_id,
    'Expense reversal: ' || expense_to_reverse.description,
    current_user_id,
    original_ledger_entry.id
  );

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
    'expense.reversed',
    'expense',
    target_expense_id,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'amount_ron', expense_to_reverse.amount_ron
    ),
    pg_catalog.jsonb_build_object(
      'status', 'reversed',
      'reversed_at', reversal_time
    ),
    normalized_reason
  );
end;
$$;

revoke all on function public.create_expense(
  uuid, uuid, uuid, text, uuid, text, uuid, text
) from public;
revoke all on function public.reverse_expense(uuid, uuid, text)
  from public;
grant execute on function public.create_expense(
  uuid, uuid, uuid, text, uuid, text, uuid, text
) to authenticated, service_role;
grant execute on function public.reverse_expense(uuid, uuid, text)
  to authenticated, service_role;

create view public.expense_summaries
with (security_invoker = true)
as
select
  expense.id as expense_id,
  expense.business_id,
  expense.business_day_id,
  expense.expense_date,
  expense.category_id,
  category.name as category_name,
  expense.amount_ron::text as amount_ron,
  expense.financial_account_id,
  account.name as financial_account_name,
  account.type as financial_account_type,
  expense.description,
  expense.entry_origin,
  expense.created_by,
  expense.created_at,
  expense.reversed_at,
  expense.reversed_by,
  expense.reversal_reason,
  case
    when expense.reversed_at is null then 'active'
    else 'reversed'
  end as status
from public.expenses as expense
inner join public.expense_categories as category
  on category.id = expense.category_id
  and category.business_id = expense.business_id
inner join public.financial_accounts as account
  on account.id = expense.financial_account_id
  and account.business_id = expense.business_id;

create view public.monthly_expense_summaries
with (security_invoker = true)
as
select
  expense.business_id,
  date_trunc('month', expense.expense_date)::date as month_start,
  expense.category_id,
  category.name as category_name,
  count(*)::integer as expense_count,
  sum(expense.amount_ron)::text as total_ron
from public.expenses as expense
inner join public.expense_categories as category
  on category.id = expense.category_id
  and category.business_id = expense.business_id
where expense.reversed_at is null
group by
  expense.business_id,
  date_trunc('month', expense.expense_date)::date,
  expense.category_id,
  category.name;

revoke all on table public.expense_summaries from anon, authenticated;
revoke all on table public.monthly_expense_summaries
  from anon, authenticated;
grant select on table public.expense_summaries
  to authenticated, service_role;
grant select on table public.monthly_expense_summaries
  to authenticated, service_role;

comment on table public.expenses is
  'Immutable expense records; corrections are administrator reversals.';
comment on view public.monthly_expense_summaries is
  'Active expense totals grouped by month and expense category.';

commit;
