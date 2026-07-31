# Customer credit purchases

Step 8 records every customer credit purchase as a separate immutable row.

## Business-day rules

- Employees can submit only against the single current open business day.
- The purchase date is copied from the database business-day record; it is not
  accepted from the browser.
- Administrators can select a closed historical business day only with a
  10–500 character audit reason.
- New purchases for inactive customers are rejected.

## Financial behavior

A credit purchase increases customer receivables. It does not create cash or
bank ledger entries and is not itself a customer payment.

`customer_credit_purchase_balances` derives the purchase status, allocated
amount, and remaining amount. Step 8 has no payment allocations, so active
purchases begin with zero allocated and their full amount remaining. Step 9
will replace this calculation with purchase amount minus immutable payment
allocations.

No editable remaining-balance column exists.

## Immutability and reversal

Application roles have select-only access to the purchase table. Creation and
reversal use authorization-checked database RPCs.

Completed purchases cannot be edited or deleted. An administrator can reverse
a non-opening purchase with a required reason. The original row remains
visible, is marked reversed, contributes zero to the derived receivable, and
is preserved in the audit log. A corrected replacement is created as a new
purchase.

Opening receivables must use the complete opening-balance reversal workflow so
the opening batch remains atomic.

## Idempotency

The form submits a server-generated request UUID.
`create_customer_credit_purchase_idempotent` serializes that key, stores the
request fingerprint and result in the private command registry, and returns the
original purchase for an identical retry. Reusing the key with changed data is
rejected.
