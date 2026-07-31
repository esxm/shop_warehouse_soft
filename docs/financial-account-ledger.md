# Financial Account Ledger

Step 13 makes cash and bank balances fully traceable without adding editable
balance fields.

## Ledger model

`financial_account_entries` is the immutable source of truth. Every entry
stores its business and account, optional business day, date, direction,
positive RON amount, source entity, creator, optional reversal link, and
optional business-scoped idempotency key.

Current balances are calculated as inflows minus outflows by
`financial_account_balances`.

## Source metadata

The `financial_account_entries_set_metadata` trigger validates approved
customer- and supplier-payment entries against their source rows. It copies
the business day and idempotency key and rejects mismatched date, account,
amount, or direction.

Reversal entries must exactly compensate the original amount and account, use
the opposite direction, and link the same source. They inherit the original
business day and intentionally have no second idempotency key.

Opening entries remain business-day and idempotency-key null because opening
balances predate the operational day lifecycle.

## Derived views

- `financial_account_balances`: current balance per cash/bank account.
- `financial_account_entry_summaries`: exact-decimal transaction history with
  signed amount and source metadata.
- `financial_account_daily_totals`: daily inflow, outflow, net movement, and
  entry count per account.

The `/cash-and-bank` page renders these views with account and inclusive date
filters. It does not calculate balances in the browser.

## Security and duplication protection

Authenticated clients have select-only access to ledger rows and views.
Approved security-definer transaction RPCs create effects; direct browser
insert, update, and delete are denied.

A partial unique index on `(business_id, idempotency_key)` blocks one request
identifier from producing multiple account effects, even across different
source transaction types. Source and reversal uniqueness indexes provide
additional protection.
