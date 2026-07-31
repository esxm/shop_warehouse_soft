# Product-level sales

Step 35 records each sale separately and preserves the exact cost and selling
price used to calculate profit.

## Weighted buying cost

Supplier product receipts store the manually entered USD unit price and
historical USD/RON exchange rate. The resulting RON unit cost is retained to
eight decimal places.

Available stock value is derived from immutable stock movements. The weighted
unit cost is:

```text
remaining historical RON inventory value / remaining pieces
```

For example:

```text
3 pieces x USD 1 x 4.40 RON = 13.20 RON
2 pieces x USD 1 x 4.50 RON =  9.00 RON
5 pieces                        22.20 RON
weighted cost = 22.20 / 5 = 4.44 RON per piece
```

Sales and warehouse-to-shop transfers consume this weighted RON cost. They do
not use the current replacement rate.

## One sale command

`create_product_sale` accepts one to 100 unique product lines. Each line has a
whole-piece quantity and a manually entered RON selling price. The command
atomically:

1. locks the request, business day, and products;
2. verifies an automatically open current day and sufficient shop quantities;
3. derives and preserves each line's weighted buying cost;
4. stores the immutable sale and lines;
5. reduces shop stock and inventory value;
6. creates a linked customer receivable for the credit portion;
7. updates automatic daily cash, bank, credit, revenue, cost, and profit
   totals; and
8. stores the idempotent result.

Cash and bank effects are posted once by the existing automatic day-close
workflow. Credit becomes a customer receivable immediately. This prevents the
same sale from posting cash or bank twice.

## Profit

Every line and sale stores:

- revenue;
- weighted historical buying cost;
- gross profit (`revenue - cost`); and
- profit percentage on cost (`profit / cost x 100`).

`daily_product_sales_summaries` totals active individual sales and calculates
the day's profit percentage from total day profit divided by total day cost.
It does not average individual percentages.

## Immutability and correction

Authenticated clients have select-only access to sales and sale lines.
Employees cannot edit, delete, or reverse a sale after submitting it.

An administrator can reverse an incorrect sale only while its business day is
still open. The original sale remains in history and compensating stock,
inventory value, receivable, and daily-total effects are created. Returns and
closed-day refunds belong to Step 36.

## Inventory valuation

`product_stock_valuation_by_location` reports quantity, historical RON value,
and weighted RON unit cost for each product and location. `/inventory-value`
shows USD as the primary display price and value. Products configured with a
stored USD purchase price use that dollar price; RON-only products are
estimated with the latest manually entered dashboard USD/RON reference rate.
The historical weighted RON cost remains visible at two decimals and is never
rewritten by the current-rate estimate.
