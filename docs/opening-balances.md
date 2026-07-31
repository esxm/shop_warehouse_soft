# Opening Balances

Step 5 initializes a business through immutable transactions instead of
editable balance fields.

## Schema

The migration `20260630000200_opening_balances.sql` adds:

- `opening_balance_batches`
- `customers`
- `suppliers`
- `financial_account_entries`
- `inventory_value_movements`
- `customer_credit_purchases`
- `supplier_purchases`

Customer, supplier, ledger, and purchase foundations are created now because
opening receivables and payables must be real records that later reports and
allocations can reuse. Their normal operational writes remain blocked until the
corresponding later steps.

All monetary columns use constrained PostgreSQL `numeric`. RPC inputs use
decimal strings, preventing JSON and JavaScript floating-point conversion.
Composite foreign keys prevent an account, location, customer, supplier, or
opening batch from being linked across businesses.

## Atomic creation

`create_opening_balance` requires an active administrator and creates in one
PostgreSQL transaction:

1. one active opening batch;
2. cash and bank inflow entries for positive values;
3. warehouse and shop inventory inflows for positive values;
4. one customer and credit purchase per opening receivable;
5. one supplier and purchase per opening payable;
6. one audit record.

Zero core values remain recorded on the batch but do not create meaningless
zero-value ledger movements.

RON supplier payables store no exchange rate. USD payables require the
historical purchase rate and store the fixed historical RON value using
round-half-up to cents.

Opening supplier payables do not create additional inventory movements.
Opening inventory is entered separately by location; creating both effects
would double count inventory.

A partial failure rolls back every record. A partial unique index permits only
one active opening batch per business.

## Calculated balances

Security-invoker views expose calculated values as decimal text:

- `financial_account_balances`
- `inventory_location_balances`
- `customer_receivable_balances`
- `supplier_payable_balances`
- `opening_balance_summaries`

The views use underlying RLS and do not create editable current-balance
columns.

## Corrections

Completed records cannot be updated or deleted directly.
`reverse_opening_balance` requires:

- an active administrator;
- the active batch identifier;
- a reason of at least 10 characters.

The RPC locks the batch, creates compensating account and inventory movements,
marks opening customer and supplier purchases as reversed, marks the batch as
reversed, and creates an audit record atomically. The original records remain.
After reversal, the administrator can create one corrected replacement batch.

## Application workflow

The administrator-only `/opening-balances` wizard collects:

- opening date;
- cash and bank values;
- warehouse and shop inventory values;
- zero or more customer receivables;
- zero or more RON or USD supplier payables.

The completed screen shows the active summary and a separately confirmed
reversal form.

Do not submit the remote opening wizard with estimated or example values.
Review Ahmad Shop's real balances and historical USD rates first.
