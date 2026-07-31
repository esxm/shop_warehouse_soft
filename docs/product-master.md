# Product master

Step 31 begins Phase 1B by adding exact product metadata. It does not yet track
quantities or change the Phase 1 inventory-value ledger.

## Data model

`product_categories` and `products` are business-scoped, RLS-protected tables.
Each product has:

- a business-unique internal code;
- a name and active category;
- unit fixed by the database to `piece`;
- optional default purchase cost with an explicit RON or USD currency; USD
  costs require the historical RON-per-USD exchange rate and preserve both the
  original price and calculated RON cost;
- optional default selling price in RON;
- active/inactive state; and
- immutable creation identity/time plus audited metadata updates.

Codes are normalized to uppercase and accept letters, numbers, dots,
underscores, and hyphens. Blank codes are generated under a business-scoped
advisory lock as `P000001`, `P000002`, and so on. A manual code cannot collide
with either another manual code or a generated code in the same business.
Different businesses may reuse the same code.

## Permissions and history

Active employees and administrators can list, search, create, and edit product
and category metadata. Only administrators can deactivate products or
categories. A category cannot be deactivated while it contains active
products.

The browser has select-only table access. All writes use authorization-checked
security-definer RPCs and create audit events. The application exposes no
product or category deletion operation. Deactivation preserves identifiers for
future stock and transaction history.

## CSV import

The Products section at the bottom of `/stock` provides a downloadable
template and local validation preview. The old `/products` list redirects to
this combined Products & Stock page. The required headers are:

```text
internal_code,name,category,default_purchase_cost_ron,default_selling_price_ron
```

Categories must exist before import. `internal_code` and both prices may be
blank. The preview checks:

- exact headers and valid CSV quoting;
- maximum file size of 1 MB and at most 500 rows;
- product/code/price validation;
- category resolution without case sensitivity; and
- duplicate manual codes inside the file.

Only an error-free preview can be submitted. PostgreSQL imports the complete
batch in one transaction. A failed row rolls back the entire batch. A
server-generated request UUID and stored fingerprint make identical retries
safe and reject changed data under a reused key.

## Combined interface

Current quantities, movement entry, and date-filtered movement history appear
first on `/stock`. Product search, creation, categories, and CSV import appear
below them. The major areas are collapsed into expandable panels so their
controls are visible without a long initial page. Long product and category
lists scroll inside bounded panels.
