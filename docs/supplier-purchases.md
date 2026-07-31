# Supplier purchases

Supplier purchases record goods received without treating the purchase as an
immediate cash or bank payment.

## Product-line transaction

Step 33 uses `create_supplier_purchase_with_lines_idempotent` for new goods
receipts. One PostgreSQL transaction:

1. serializes and checks the server-generated request UUID and fingerprint;
2. validates membership, supplier, business day, destination, currency,
   product lines, exchange rate, and due date;
3. derives the purchase amount from line quantities and original-currency unit
   prices, then inserts the immutable supplier purchase;
4. inserts one reconciled inventory-value inflow at the warehouse or shop;
5. inserts immutable product lines and one product-stock receipt per line;
6. inserts the audit event; and
7. stores the result so an identical retry returns the original purchase.

Reusing a request UUID with changed data is rejected.

RON line cost equals its original-currency cost. USD purchases require a
historical USD/RON rate. Each line stores the rate, eight-decimal unit cost, and
rounded RON line total. The parent inventory value is exactly the sum of those
line totals, including per-line rounding.

No `financial_account_entries` row is created. Supplier payment and cash/bank
outflow remain separate operations.

## Backward compatibility

The older `create_supplier_purchase_idempotent` value-only command remains
available. Existing Phase 1 and opening records stay visible with
`record_mode = value_only` and zero product lines; no product quantities are
invented for historical records.

`supplier_purchase_summaries` keeps its existing reporting columns and appends
record mode and line count. `supplier_purchase_line_summaries` exposes product
code, quantity, original unit price, historical rate, unit cost, and RON line
total.

## Business days and permissions

- Employees can record purchases only against the current open business day.
- Administrators can use a closed day with an audit reason.
- Purchase and movement dates come from the selected business day.
- Inactive suppliers, products, and destinations are rejected.
- Authenticated clients have select-only access to purchases, lines, inventory
  value, and stock movements. Writes use authorized RPCs.

## Derived balances

- `supplier_payable_balances` derives outstanding amounts by original currency
  and preserves historical RON cost.
- `inventory_location_balances` derives warehouse and shop values.
- `product_stock_by_location` includes each received product quantity at the
  selected destination.
- `/suppliers/[supplierId]` shows both itemized purchases and labeled
  historical value-only records.

## Reversal

`reverse_supplier_purchase` is administrator-only and requires a reason. It
reverses every linked product receipt, marks the purchase as reversed, creates
one compensating inventory-value movement, and audits the action.

A reversal that would make product stock negative is rejected unless the
administrator explicitly enables the override. The reason is then retained in
the stock audit. Original purchase and line values are never deleted or
overwritten. Opening supplier payables remain reversible only through the
complete opening-balance workflow.
