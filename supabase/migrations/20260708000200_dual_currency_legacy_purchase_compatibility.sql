begin;

alter table public.supplier_purchases
  drop constraint supplier_purchases_currency_values_consistent,
  add constraint supplier_purchases_currency_values_consistent
    check (
      (
        record_mode = 'value_only'
        and (
          (
            currency = 'RON'
            and (
              (
                purchase_exchange_rate is null
                and inventory_cost_ron = original_amount
                and inventory_cost_usd is null
              )
              or (
                purchase_exchange_rate is not null
                and inventory_cost_ron = original_amount
                and inventory_cost_usd = round(
                  original_amount / purchase_exchange_rate,
                  2
                )
              )
            )
          )
          or (
            currency = 'USD'
            and purchase_exchange_rate is not null
            and inventory_cost_ron = round(
              original_amount * purchase_exchange_rate,
              2
            )
            and (
              inventory_cost_usd is null
              or inventory_cost_usd = original_amount
            )
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

commit;
