do $migration$
declare
  original_definition text;
  revised_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure(
      'public.create_customer_payment(uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,text)'
    )
  )
  into original_definition;

  if original_definition is null then
    raise exception 'create_customer_payment function was not found';
  end if;

  revised_definition := pg_catalog.replace(
    original_definition,
    E'    if not caller_is_admin then\n'
      || E'      raise exception ''Administrator access is required for manual allocation''\n'
      || E'        using errcode = ''42501'';\n'
      || E'    end if;\n\n',
    ''
  );

  if revised_definition = original_definition then
    raise exception 'create_customer_payment manual-allocation guard was not found';
  end if;

  execute revised_definition;

  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure(
      'public.create_supplier_payment(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,jsonb,text)'
    )
  )
  into original_definition;

  if original_definition is null then
    raise exception 'create_supplier_payment function was not found';
  end if;

  revised_definition := pg_catalog.replace(
    original_definition,
    E'    if not caller_is_admin then\n'
      || E'      raise exception ''Administrator access is required for manual allocation''\n'
      || E'        using errcode = ''42501'';\n'
      || E'    end if;\n\n',
    ''
  );

  if revised_definition = original_definition then
    raise exception 'create_supplier_payment manual-allocation guard was not found';
  end if;

  original_definition := revised_definition;
  revised_definition := pg_catalog.replace(
    original_definition,
    'allocation_gain_loss := allocation_actual - allocation_historical;',
    'allocation_gain_loss := allocation_historical - allocation_actual;'
  );

  if revised_definition = original_definition then
    raise exception 'create_supplier_payment currency-result formula was not found';
  end if;

  original_definition := revised_definition;
  revised_definition := pg_catalog.replace(
    original_definition,
    'currency_gain_loss_ron + actual_rounding_delta',
    'currency_gain_loss_ron - actual_rounding_delta'
  );

  if revised_definition = original_definition then
    raise exception 'create_supplier_payment rounding formula was not found';
  end if;

  execute revised_definition;
end;
$migration$;

update public.supplier_payment_allocations
set currency_gain_loss_ron = -currency_gain_loss_ron
where currency_gain_loss_ron <> 0;

update public.supplier_payments
set currency_gain_loss_ron = -currency_gain_loss_ron
where currency_gain_loss_ron <> 0;

comment on column public.supplier_payment_allocations.currency_gain_loss_ron is
  'Business currency result in RON: historical value minus actual payment value; positive is a gain and negative is a loss.';

comment on column public.supplier_payments.currency_gain_loss_ron is
  'Total business currency result in RON: positive is a gain and negative is a loss.';
