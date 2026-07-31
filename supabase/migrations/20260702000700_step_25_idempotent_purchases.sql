create table private.financial_command_idempotency (
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  command_name text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  result_entity_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  constraint financial_command_idempotency_pkey
    primary key (business_id, command_name, idempotency_key),
  constraint financial_command_idempotency_command_name
    check (command_name in (
      'create_customer_credit_purchase',
      'create_supplier_purchase'
    )),
  constraint financial_command_idempotency_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{32}$')
);

revoke all on table private.financial_command_idempotency from public;

create function public.create_customer_credit_purchase_idempotent(
  target_business_id uuid,
  target_customer_id uuid,
  target_business_day_id uuid,
  target_amount_ron text,
  target_idempotency_key uuid,
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
  target_command_name constant text := 'create_customer_credit_purchase';
  request_fingerprint text;
  existing_result_id uuid;
  existing_fingerprint text;
  new_purchase_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if target_idempotency_key is null then
    raise exception 'Purchase request identifier is required'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'customer_id', target_customer_id,
      'business_day_id', target_business_day_id,
      'amount_ron', target_amount_ron,
      'description', target_description,
      'due_date', target_due_date,
      'audit_reason', target_audit_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text
        || ':'
        || target_command_name
        || ':'
        || target_idempotency_key::text,
      9250
    )
  );

  select
    command.result_entity_id,
    command.request_fingerprint
  into existing_result_id, existing_fingerprint
  from private.financial_command_idempotency as command
  where command.business_id = target_business_id
    and command.command_name = target_command_name
    and command.idempotency_key = target_idempotency_key;

  if existing_result_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Purchase request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_result_id;
  end if;

  new_purchase_id := public.create_customer_credit_purchase(
    target_business_id,
    target_customer_id,
    target_business_day_id,
    target_amount_ron,
    target_description,
    target_due_date,
    target_audit_reason
  );

  insert into private.financial_command_idempotency (
    business_id,
    command_name,
    idempotency_key,
    request_fingerprint,
    result_entity_id,
    created_by
  )
  values (
    target_business_id,
    target_command_name,
    target_idempotency_key,
    request_fingerprint,
    new_purchase_id,
    current_user_id
  );

  return new_purchase_id;
end;
$$;

create function public.create_supplier_purchase_idempotent(
  target_business_id uuid,
  target_supplier_id uuid,
  target_business_day_id uuid,
  target_currency text,
  target_original_amount text,
  target_purchase_exchange_rate text,
  target_destination_location_id uuid,
  target_idempotency_key uuid,
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
  target_command_name constant text := 'create_supplier_purchase';
  request_fingerprint text;
  existing_result_id uuid;
  existing_fingerprint text;
  new_purchase_id uuid;
begin
  if current_user_id is null
    or not private.is_business_member(target_business_id)
  then
    raise exception 'Active business membership is required'
      using errcode = '42501';
  end if;

  if target_idempotency_key is null then
    raise exception 'Purchase request identifier is required'
      using errcode = '22023';
  end if;

  request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'business_id', target_business_id,
      'supplier_id', target_supplier_id,
      'business_day_id', target_business_day_id,
      'currency', target_currency,
      'original_amount', target_original_amount,
      'purchase_exchange_rate', target_purchase_exchange_rate,
      'destination_location_id', target_destination_location_id,
      'description', target_description,
      'due_date', target_due_date,
      'audit_reason', target_audit_reason
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_business_id::text
        || ':'
        || target_command_name
        || ':'
        || target_idempotency_key::text,
      9250
    )
  );

  select
    command.result_entity_id,
    command.request_fingerprint
  into existing_result_id, existing_fingerprint
  from private.financial_command_idempotency as command
  where command.business_id = target_business_id
    and command.command_name = target_command_name
    and command.idempotency_key = target_idempotency_key;

  if existing_result_id is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Purchase request identifier was reused with different data'
        using errcode = '22023';
    end if;

    return existing_result_id;
  end if;

  new_purchase_id := public.create_supplier_purchase(
    target_business_id,
    target_supplier_id,
    target_business_day_id,
    target_currency,
    target_original_amount,
    target_purchase_exchange_rate,
    target_destination_location_id,
    target_description,
    target_due_date,
    target_audit_reason
  );

  insert into private.financial_command_idempotency (
    business_id,
    command_name,
    idempotency_key,
    request_fingerprint,
    result_entity_id,
    created_by
  )
  values (
    target_business_id,
    target_command_name,
    target_idempotency_key,
    request_fingerprint,
    new_purchase_id,
    current_user_id
  );

  return new_purchase_id;
end;
$$;

revoke all on function public.create_customer_credit_purchase(
  uuid,
  uuid,
  uuid,
  text,
  text,
  date,
  text
) from public, anon, authenticated;
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

revoke all on function public.create_customer_credit_purchase_idempotent(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.create_supplier_purchase_idempotent(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) from public, anon, authenticated;

grant execute on function public.create_customer_credit_purchase_idempotent(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  date,
  text
) to authenticated, service_role;
grant execute on function public.create_supplier_purchase_idempotent(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) to authenticated, service_role;

comment on table private.financial_command_idempotency is
  'Internal request fingerprints and results for retry-safe financial commands.';
comment on function public.create_customer_credit_purchase_idempotent(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  date,
  text
) is
  'Serializes customer credit-purchase retries and returns the original result for an identical request.';
comment on function public.create_supplier_purchase_idempotent(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) is
  'Serializes supplier-purchase retries and returns the original payable/inventory result for an identical request.';
