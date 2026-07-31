# Cash and bank report

The protected `/reports/cash-and-bank` route provides separate cash and bank
ledger views derived from immutable `financial_account_entries`.

## Balances

For each account the report shows:

- opening balance before the selected start date, or zero when no start date
  is selected;
- selected transaction inflows and outflows;
- period-ending balance after all account movements in the date range; and
- current balance from the complete ledger.

The service independently calculates current balance from entries and
reconciles it with `financial_account_balances`. A mismatch fails the report
instead of displaying inconsistent financial values.

## Deterministic running balance

Entries are ordered by:

1. transaction date;
2. creation timestamp; and
3. entry UUID.

The running balance includes every account movement in that order. A
transaction-type filter may hide unrelated rows and restrict selected
inflow/outflow totals, but it does not remove those movements from the running
balance. Reversals remain visible as compensating inflows or outflows.

## Traceability

Each row includes the entry type, description, source type and identifier,
recording user, and a source link. Customer payments, supplier payments,
expenses, and current daily-sales closures link to anchored operational
records. Opening entries link to opening balances.

## CSV export

`GET /reports/cash-and-bank.csv` requires active business membership and uses
the same filters, source-enriched entries, running-balance calculation, and
reconciliation as the page. The export includes account summaries and every
displayed transaction row with source and user metadata.

No Step 22 migration is required because existing security-invoker ledger
views already expose exact-decimal entries and calculated balances under RLS.
