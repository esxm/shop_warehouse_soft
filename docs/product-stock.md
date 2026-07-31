# Product stock ledger

Step 32 adds exact piece quantities per inventory location.

## Ledger rules

- `stock_movements` is append-only. Authenticated clients receive `SELECT`
  only; updates and deletes are also blocked by a database trigger.
- Opening stock, receipts, and returns add quantity to a destination. Sales and
  damage remove quantity from a source. Transfers apply both effects.
  Adjustments explicitly use one direction.
- `product_stock_by_location` derives every current balance from active
  original movements. It includes a zero row for every product and active
  location.
- Reversal rows link through `reversal_of_id`. A reversed original stops
  contributing to the derived balance; both records remain in history.
- Products with any nonzero location balance cannot be deactivated.
- Every new original movement requires a positive RON unit cost. Inbound manual
  movements accept a purchase price in RON or USD; USD requires the historical
  RON-per-USD rate and preserves the original price and rate.
- Transfers, damage, and count-out adjustments derive their unit cost from the
  product's current weighted average at the source location. A manually typed
  source cost cannot replace the warehouse or shop cost.

## Concurrency and retries

Every command has a business-scoped UUID idempotency key and an MD5 request
fingerprint. The database locks the key before checking for a retry. It then
locks the business/product pair before calculating the source balance and
writing the movement. Concurrent outgoing movements therefore cannot both
spend the same pieces.

An identical retry returns the first movement. Reusing the key with changed
data fails.

## Negative stock and corrections

Employee movements that would make the source negative are rejected.
Administrators can explicitly allow the result only with a 10–500 character
reason. The movement stores the override flag and reason, and the database
writes a dedicated audit event with balances before and after.

Reversals are administrator-only and always require a reason. If removing the
original destination effect would make stock negative, a separate override is
required.

The `/stock` page uses the automatically managed current business day. It
provides opening quantities (administrators), transfers, customer returns,
damage/loss, and count adjustments. Supplier receipts and product sales are
intentionally reserved for their linked workflows in Steps 33 and 35.

Stock by location can be filtered by product code, name, category, and
location. Movement history displays the creator's profile name when available
and otherwise displays their business role.

Manual entry defaults to a transfer and supports either direction between
active locations, including shop to warehouse. Changing the movement type
resets the location controls so a browser-restored source cannot be submitted
as part of an inbound-only opening, return, or adjustment.

Movement history loads the selected inclusive From/To period, defaults both
ends to today, and renders inside a bounded scroll panel. Product management is
combined below the stock sections. Other major operational history lists also
use bounded internal scrolling so they do not expand the entire page.

Manual costed stock movements are mirrored automatically into the hidden
internal inventory-value ledger used by atomic purchases, transfers, sales,
and reversals. Migration `20260704000100` reconciles existing internal
location balances to product-valued inventory so stale amount-only balances
cannot block a valid product sale.
