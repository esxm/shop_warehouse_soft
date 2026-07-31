# Dashboard

The protected root route renders the business's current financial position on
the server. It reads only business-scoped, derived sources:

- closed `daily_sales_summaries` for today's and current-month revenue;
- `financial_account_balances` for cash and bank;
- `customer_receivable_balances` for outstanding customer credit;
- `supplier_payable_balances` for RON and USD obligations;
- `product_stock_valuation_by_location` for exact product-valued inventory; and
- the newest effective `currency_reference_rate_summaries` row for USD/RON.

All date boundaries use the business's configured IANA timezone. Draft sales
are excluded.

## Formulas

Supplier payables remain visible in their original currencies. Their estimated
RON total is:

```text
RON payables + (USD payables × latest effective manual USD/RON rate)
```

Net business value is:

```text
cash + bank + customer receivables + product-valued inventory
− estimated supplier payables
```

The dashboard does not display the older amount-only warehouse and shop
balances. Their internal ledger remains for transaction compatibility, but
only product quantities valued at weighted historical cost are included in the
dashboard and net business value.

Revenue is not added to net business value because closed cash/bank sales are
already reflected in account ledgers and credit sales are already reflected in
receivables.

If USD payables exist without a current reference rate, the dashboard shows
the original USD amount but withholds the estimated payable total and net
business value. This prevents a stale historical purchase rate from being
presented as a current estimate.

## Reference-rate history

Administrators can record USD/RON reference rates from the dashboard. Rows are
immutable, audited, and selected by effective date and creation time. A
correction is a new row, never an overwrite. Employees may read the effective
rate but cannot record one.

The reference rate is for dashboard estimates only. It does not change the
historical rate on a supplier purchase or the actual rate on a supplier
payment.
