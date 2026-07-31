# Supplier payables report

The protected `/reports/payables` route explains which suppliers are owed
money, preserves the original debt currency, and labels current RON values as
estimates.

## Accounting sources

The report reads `supplier_purchase_summaries`, which subtracts allocations
from active supplier payments. For every non-reversed purchase:

```text
remaining original amount = original purchase amount − active allocations
```

RON and USD amounts are aggregated separately. Reversed purchases and
allocations from reversed payments do not affect active totals.

No Step 21 migration is required. Existing security-invoker views already
provide exact-decimal, allocation-aware, RLS-protected source data.

## Historical and current values

For USD purchases, the original purchase rate and historical inventory cost
never change. Payment allocations preserve:

- the allocated USD amount;
- RON value at the purchase's historical rate;
- actual RON value at the payment rate; and
- currency gain or loss.

Current payable estimates use the latest manually entered USD/RON reference
rate whose effective date is not after the current business date:

```text
estimated remaining RON =
RON remaining + (USD remaining × current reference rate)
```

If USD remains and no effective manual rate exists, original USD debt remains
visible while current RON estimates are shown as unavailable.

## Filters and drill-down

The list supports supplier, currency, outstanding-only, and inclusive due-date
filters. Due-date filters exclude purchases without due dates.

`/reports/payables/[supplierId]` shows every purchase, payment, and allocation,
including reversed history. Purchase rows show historical exchange rate,
historical inventory cost, remaining historical cost, and remaining original
amount. Payment rows show payment rate, actual account effect, gain/loss, and
links to allocated purchases.

## CSV export

`GET /reports/payables.csv` requires active business membership and accepts the
same filters as the page. It exports the displayed summary, current-rate label,
and supplier/currency rows with private no-store cache headers.
