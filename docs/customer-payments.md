# Customer payments

Step 9 records customer payments without creating revenue.

## Atomic workflow

`create_customer_payment` performs one PostgreSQL transaction that:

1. verifies active business membership and the selected business day;
2. validates the customer and active RON cash or bank account;
3. locks the customer's active purchases against concurrent allocation;
4. rejects payment above total outstanding receivables;
5. creates one immutable payment;
6. allocates the full amount;
7. creates one account-ledger inflow;
8. writes one audit record.

Employees can use only the current open business day. Employees and
administrators can choose automatic oldest-first or manual allocation.
Administrators can also use a closed historical day with an audit reason.

## Allocation

Automatic allocation orders active purchases by purchase date, creation time,
and identifier. It fully pays the oldest purchase before moving to the next.
Partial allocations and one payment covering several purchases are supported.

Manual allocations must:

- reference active purchases for the same customer and business;
- contain each purchase at most once;
- not exceed each purchase's remaining balance;
- sum exactly to the payment amount.

`customer_credit_purchase_balances` and `customer_receivable_balances` subtract
allocations belonging to non-reversed payments. Remaining balances are derived,
not stored.

## Account and revenue behavior

A payment creates one `customer_payment` inflow in
`financial_account_entries`. The selected cash or bank balance therefore
increases exactly once.

Payments do not create or modify sales/revenue entries. They settle an existing
receivable.

## Idempotency and concurrency

Each form submission carries a UUID request key. The database stores a request
fingerprint under a unique business/key constraint. Retrying identical data
returns the original payment; reusing the key with changed data is rejected.

Customer-scoped advisory locks and purchase row locks prevent concurrent
payments from over-allocating the same purchases.

## Reversal

Only an administrator can reverse a payment, with a required reason. Reversal
marks the original payment as reversed, makes its preserved allocations
mathematically inactive, and creates one linked compensating account outflow.
Receivables and account balances are restored atomically.

A purchase with allocations from an active payment cannot be reversed until
those payments are reversed.
