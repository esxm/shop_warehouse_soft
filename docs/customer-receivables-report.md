# Customer receivables report

The protected `/reports/receivables` route explains which customers owe the
business and how each balance was derived.

## Accounting source

The report reads `customer_credit_purchase_balances`, an allocation-aware
security-invoker view. For every non-reversed purchase:

```text
remaining receivable = purchase amount − active payment allocations
```

Allocations from reversed payments are excluded by the view. Reversed
purchases are preserved for drill-down history but excluded from report
totals. Application calculations use exact decimal strings and verify that
each source row satisfies the formula before aggregation.

No Step 20 migration is required because the existing views already provide
the necessary exact-decimal, RLS-protected source data.

## Summary and filters

The report shows:

- total outstanding receivables;
- number of customers with an outstanding balance; and
- overdue outstanding amount.

Available filters are customer, outstanding-only, overdue-only, and an
inclusive purchase-date range. A purchase is overdue when it has a remaining
balance and its due date is before the current date in the business timezone.

Customer rows show total active credit purchases, active payment allocations,
remaining balance, and oldest unpaid purchase date.

## Traceability

`/reports/receivables/[customerId]` preserves both directions of the audit
trail:

- every credit purchase, including reversed purchases;
- original, allocated, and remaining amounts per purchase;
- every payment, including reversed payments;
- every allocation from a payment to a purchase; and
- links from payment allocations back to their purchase rows.

The operational customer page remains separate from this read-only report.

## CSV export

`GET /reports/receivables.csv` requires active business membership and accepts
the same filters as the report page. It reuses the same service and aggregation
result, then exports the displayed summary and customer rows with private
no-store cache headers.
