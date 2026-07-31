# Individual sales and automatic closing

Each business day and its daily aggregate open automatically at the business's
local 00:00. Employees do not manually open days or edit a daily total.

## During the day

Every sale is recorded separately through the product-sale workflow. It
contains immutable product lines, quantities, manual RON selling prices, the
weighted historical RON buying cost, and its cash/bank/customer-credit split.

The database adds each active sale to the current daily aggregate. The last
recorder and timestamp are preserved so history identifies the employee who
made the final sale or correction for the day. Employees cannot edit, delete,
or reverse a submitted sale.

Customer credit creates a linked receivable immediately. Cash and bank remain
in the daily aggregate until automatic close so they are not posted twice.

## Automatic atomic close

At the business's local midnight, the database:

1. locks the business, day, and daily aggregate;
2. retains the sum of active individual sales;
3. revalidates the linked credit receivable total;
4. creates one numbered closure snapshot;
5. creates cash and bank inflows for nonzero amounts;
6. creates no additional account entry for credit sales;
7. marks daily sales and the business day closed;
8. attributes the close and ledger effects to the final recorder, falling back
   to the business creator when the day had no sale;
9. writes automatic-close audit events; and
10. opens the new date and its empty daily aggregate.

Unique source constraints, row locks, and status checks prevent duplicate
closures or ledger effects. All boundaries use the configured IANA timezone,
including daylight-saving transitions.

See `docs/product-sales.md` for weighted cost, profit, inventory, and correction
rules.
