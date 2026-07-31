# Supplier Payments

Step 12 records payments against supplier purchases without treating those
payments as expenses or changing inventory value.

## Atomic payment workflow

`create_supplier_payment` performs one PostgreSQL transaction that:

1. validates membership, business day, supplier, currency, payment rate, and
   active RON cash/bank account;
2. locks the supplier's outstanding purchases in the selected currency;
3. allocates the original-currency amount;
4. stores historical RON value, actual RON value, and currency gain/loss for
   every allocation;
5. creates one account-ledger outflow for the actual RON paid; and
6. creates the audit event.

Retries use a business-scoped UUID idempotency key and request fingerprint.
Identical retries return the first payment; reuse with different data fails.

## Currency calculations

RON payments require no exchange rate:

- actual RON = original RON paid;
- historical RON = allocated RON; and
- currency gain/loss = zero.

USD payments require a manually entered payment-day USD/RON rate:

- allocation historical RON = allocated USD × purchase historical rate;
- allocation actual RON = allocated USD × payment-day rate; and
- currency result = historical RON minus actual RON.

The result is shown from the business perspective with an explicit sign:
positive means the business paid less than historical cost (gain), and negative
means it paid more (loss). For example, USD 1,000 purchased at 4.61 RON and
paid at 4.70 RON produces `-90.00 RON`.

The account outflow equals the payment's actual RON value. A final allocation
absorbs any one-cent conversion rounding difference so allocation actual values
sum exactly to that outflow. The final allocation that pays a purchase in full
also absorbs its historical rounding remainder, so paid purchases reach exactly
zero historical payable.

## Allocation and permissions

- Default allocation is oldest outstanding purchase first within the selected
  currency.
- One payment may partially pay one purchase or span several purchases.
- Employees and administrators may manually allocate, but allocations must
  total the payment, remain within purchase balances, and use the same
  currency.
- Employees can pay only on the current open business day.
- Administrators can enter a closed-day payment with an audit reason.
- Inactive suppliers can still have valid historical debt paid.

## Reversal

`reverse_supplier_payment` is administrator-only and requires a reason. It
marks the original payment reversed, excludes its preserved allocations from
payable calculations, and creates one linked account inflow. The original
payment, rates, allocation values, and gain/loss remain visible.

An allocated supplier purchase cannot be reversed until its active payments
are reversed first.
