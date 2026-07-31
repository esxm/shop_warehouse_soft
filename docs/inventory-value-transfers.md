# Product inventory transfers

Step 34 moves exact product quantities and their historical cost from warehouse
to shop without changing total business inventory.

## Atomic product transfer

`create_inventory_product_transfer` accepts 1–100 unique product lines. One
PostgreSQL transaction:

1. validates membership, business day, active warehouse/shop, products, and
   whole-piece quantities;
2. fingerprints the normalized request and serializes retries;
3. locks each business/product pair in stable order;
4. checks the current derived warehouse quantity;
5. derives the product's moving weighted-average warehouse unit cost;
6. creates one reconciled inventory-value transfer;
7. stores immutable transfer lines and one stock movement per product; and
8. writes the audit event.

Concurrent outgoing commands use the same product advisory lock, so they cannot
both consume the same warehouse pieces. An identical retry returns the original
transfer; changed data cannot reuse the request identifier.

Products with any active warehouse stock activity missing a unit cost are
rejected. The system does not invent a transfer value. Opening and adjustment
quantities must therefore include historical unit cost before they can be
transferred.

## Cost preservation

Each transfer line stores:

- exact whole-piece quantity;
- eight-decimal weighted historical unit cost; and
- rounded RON line value.

The value movement equals the exact sum of line values. The stock movement uses
the same unit cost at both locations, preserving cost while warehouse quantity
decreases and shop quantity increases.

## Backward compatibility

The older `create_inventory_value_transfer` amount-only command remains
available. Existing transfers remain visible with zero product lines and are
labeled as legacy amount-only records. `inventory_transfer_summaries`
retains its previous columns and appends product-line count.

## Reversal

Administrators reverse a transfer with a reason. The database reverses every
linked product movement and then the inventory-value movement in one
transaction. If shop quantity or value is insufficient, the entire reversal
fails.

Negative shop quantity requires an explicit administrator override. The reason
and resulting stock override remain in the audit history.

## Reporting

- `inventory_transfer_line_summaries` exposes product, quantity, preserved unit
  cost, and line value.
- `/inventory-value` is the Product Inventory page. It shows product-valued
  balances with USD as the primary display currency, itemized product transfer
  history, and reversal controls. A product configured with a USD purchase
  price shows that stored dollar price; a RON-only product shows an estimated
  dollar price using the latest reference rate. Weighted RON cost remains
  visible and is rounded to two decimals in the interface.
- `/stock` immediately reflects warehouse and shop quantities.
