# Product inventory analysis

Step 37 provides operational product analysis without introducing editable
stock or inventory-value totals.

## Current inventory and thresholds

`product_inventory_analysis_current` derives every product/location balance
from immutable stock movements and historical unit costs. It exposes:

- current whole-piece quantity;
- moving weighted historical RON cost;
- historical inventory value;
- whether cost history is complete;
- administrator-configured minimum quantity; and
- low-stock status.

Thresholds are location-specific because warehouse and shop requirements can
differ. A threshold of zero disables the alert. Only administrators can set a
threshold, and each change is audited. Thresholds never change stock.

## Date-range sales analysis

`product_sales_daily_analysis` combines active sale lines and active return
lines by product and activity date. It provides:

- sales and return counts;
- sold, returned, and net pieces;
- gross sales and refunds;
- net product revenue;
- preserved historical cost; and
- gross margin amount and percentage.

Sellable returns reverse both revenue and historical cost because their value
returns to inventory. Damaged returns reverse revenue but retain the historical
cost as a loss because they do not return to valued sellable inventory.

The selected-range percentages are recalculated from totals. The report shows
both:

- profit percentage on historical cost: profit divided by historical cost,
  matching Daily Sales and the Profit report; and
- standard gross margin percentage: profit divided by absolute net revenue.

Individual percentages are never averaged. For example, 19.83% profit on cost
is approximately 16.55% gross margin on revenue for the same profit amount.

## Meaning of gross margin estimate

The report uses the historical weighted cost stored on each immutable sale
line. It never substitutes the latest USD/RON rate, current supplier price, or
replacement cost.

It is labeled an estimate because it is product gross margin, not final
business profit. It excludes operating expenses, salaries, taxes, overhead,
and other non-product costs.

## Velocity

Fast-moving products rank active products by highest net sold pieces in the
selected date range. Slow-moving products rank products that still have stock
by lowest net sold pieces, including zero-sale products.

Current quantity is summed across warehouse and shop for velocity display.
Location-specific quantities remain visible in the current inventory table.

## Movement history and export

Movement history uses the immutable stock ledger and includes original,
reversed, and reversal rows for the selected dates.

The CSV export uses the same business-scoped service and validated date range
as the page. It includes:

1. current inventory by product/location;
2. sales and margin by product; and
3. product movement history.

Spreadsheet-formula protection and private no-store response headers are
applied to the export.
