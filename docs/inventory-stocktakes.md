# Inventory Stocktakes

Step 17 records physical inventory-value counts and adjusts the inventory
ledger to the counted values.

## Atomic snapshot and adjustment

Stocktakes are administrator-only and require a reason. The database locks the
warehouse and shop movement streams, calculates both expected values, stores
the submitted actual values and differences, then creates one adjustment for
each nonzero difference in a single transaction.

A positive difference creates a destination movement. A negative difference
creates a source movement. The existing source-balance guard ensures an
adjustment cannot make a location negative.

## History and correction

Expected, actual, difference, reason, and notes are immutable. An
administrator corrects a stocktake by reversing it with a reason and recording
a new stocktake. Reversal creates linked compensating movements and preserves
the original comparison.

The legacy amount-only stocktake command and history remain in the database for
compatibility. They are no longer shown on the Product Inventory page because
product quantities and weighted historical costs are now the authoritative
inventory valuation.
