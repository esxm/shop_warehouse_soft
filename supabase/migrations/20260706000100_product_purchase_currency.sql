begin;

alter table public.products
  add column default_purchase_currency public.transaction_currency
  not null default 'RON';

create function public.create_product_with_currency(
  target_business_id uuid,
  target_internal_code text,
  target_name text,
  target_category_id uuid,
  target_default_purchase_cost text,
  target_default_purchase_currency public.transaction_currency,
  target_default_selling_price_ron text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_product_id uuid;
begin
  new_product_id := public.create_product(
    target_business_id,
    target_internal_code,
    target_name,
    target_category_id,
    target_default_purchase_cost,
    target_default_selling_price_ron
  );

  update public.products
  set default_purchase_currency = target_default_purchase_currency
  where id = new_product_id
    and business_id = target_business_id;

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  )
  values (
    target_business_id,
    current_user_id,
    'product.purchase_currency_set',
    'product',
    new_product_id,
    pg_catalog.jsonb_build_object(
      'default_purchase_currency',
      target_default_purchase_currency
    )
  );

  return new_product_id;
end;
$$;

create function public.update_product_with_currency(
  target_business_id uuid,
  target_product_id uuid,
  target_internal_code text,
  target_name text,
  target_category_id uuid,
  target_default_purchase_cost text,
  target_default_purchase_currency public.transaction_currency,
  target_default_selling_price_ron text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  previous_currency public.transaction_currency;
begin
  select product.default_purchase_currency
  into previous_currency
  from public.products as product
  where product.id = target_product_id
    and product.business_id = target_business_id;

  perform public.update_product(
    target_business_id,
    target_product_id,
    target_internal_code,
    target_name,
    target_category_id,
    target_default_purchase_cost,
    target_default_selling_price_ron
  );

  update public.products
  set default_purchase_currency = target_default_purchase_currency
  where id = target_product_id
    and business_id = target_business_id;

  if previous_currency is distinct from target_default_purchase_currency then
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
      'product.purchase_currency_updated',
      'product',
      target_product_id,
      pg_catalog.jsonb_build_object(
        'default_purchase_currency',
        previous_currency
      ),
      pg_catalog.jsonb_build_object(
        'default_purchase_currency',
        target_default_purchase_currency
      )
    );
  end if;
end;
$$;

revoke all on function public.create_product_with_currency(
  uuid, text, text, uuid, text, public.transaction_currency, text
) from public, anon, authenticated;
revoke all on function public.update_product_with_currency(
  uuid, uuid, text, text, uuid, text, public.transaction_currency, text
) from public, anon, authenticated;

grant execute on function public.create_product_with_currency(
  uuid, text, text, uuid, text, public.transaction_currency, text
) to authenticated, service_role;
grant execute on function public.update_product_with_currency(
  uuid, uuid, text, text, uuid, text, public.transaction_currency, text
) to authenticated, service_role;

comment on column public.products.default_purchase_currency is
  'Currency of the optional default purchase cost; actual receipts retain their own transaction currency and exchange rate.';
comment on function public.create_product_with_currency(
  uuid, text, text, uuid, text, public.transaction_currency, text
) is
  'Creates product metadata with an explicit RON or USD default purchase-cost currency.';
comment on function public.update_product_with_currency(
  uuid, uuid, text, text, uuid, text, public.transaction_currency, text
) is
  'Updates product metadata and its explicit default purchase-cost currency.';

commit;
