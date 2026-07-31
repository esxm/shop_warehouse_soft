# Returns, refunds, and inventory exceptions

Step 36 handles customer returns, refunds, damaged products, missing stock, and
theft without editing original sales or stock totals.

## Authorization

All Step 36 commands are administrator-only. Every command requires a reason
of 10 to 500 characters. Server Actions re-authenticate the administrator,
validate untrusted form data, and delegate to atomic PostgreSQL functions.

Employees can view the financial and stock effects through their existing
screens but cannot create or reverse an exception.

## Customer returns

A return must reference an active original sale and one or more of its sale
lines. Each quantity is limited to the number sold minus prior active returns.
The refund value uses the original preserved selling price.

Every returned line is classified as:

- `sellable`: product quantity and historical RON inventory value return to the
  original shop;
- `damaged`: the piece does not enter sellable stock or inventory value and is
  added to the separate damaged-stock ledger.

The complete return refund is split between:

- cash refund;
- bank refund; and
- cancellation of unpaid customer credit.

Cash and bank refunds create immutable account outflows immediately. Credit
reduction creates an immutable adjustment against the sale-linked receivable.
The adjustment cannot exceed unpaid credit after active payments and prior
returns.

Customer payment allocation, purchase balances, customer balances, dashboard
revenue, and the Revenue report all use return-adjusted values. Refunds reduce
revenue on the return date rather than rewriting the original sale date.

## Inventory exceptions

Damage, missing stock, and theft select an exact product, source location, and
whole-piece quantity. The database locks the product, verifies available
sellable stock, derives its current weighted historical RON unit cost, and
atomically creates:

1. a preserved exception record;
2. a stock outflow;
3. an inventory-value outflow; and
4. an audit event.

Damage also adds the quantity to the separate damaged-stock ledger. Missing and
stolen pieces do not.

## Immutability and reversal

Clients have select-only table access. Return lines, credit adjustments,
damaged-stock movements, and their original records cannot be edited or
deleted.

Administrator reversal creates compensating effects:

- refund outflows receive matching account inflows;
- sellable return stock and value are removed again;
- credit adjustments stop reducing receivables;
- damaged quantities are removed from the damaged ledger;
- inventory exceptions restore product quantity and historical value; and
- original records remain visible with reversal reasons.

A return reversal fails atomically if its restored sellable stock has already
been consumed. The administrator must resolve the later stock transaction
first.

## Idempotency and concurrency

Return and inventory-exception forms carry server-generated UUID request keys.
Identical retries return the original record; changed data cannot reuse a key.
Sale-level, customer-level, and product-level advisory locks serialize return
quantities, credit reductions, payments, and stock effects.
