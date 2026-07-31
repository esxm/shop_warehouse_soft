# Revenue report

The protected `/reports` route shows revenue from closed daily-sales records.
Draft daily sales and customer payments are excluded. The server query is
scoped to the active business and uses the date stored on each business day.

## Filters

The report supports a custom inclusive date range and these presets:

- today;
- current week, from Monday through the current business date;
- current month, from the first day through the current business date; and
- the complete previous calendar month.

The current date is calculated in the business's configured IANA timezone.
Date-only arithmetic uses UTC calendar operations, so browser or server local
timezones do not move a boundary.

## Aggregation

Daily and monthly rows show:

- cash sales;
- bank sales;
- credit sales; and
- total revenue.

All calculations use exact decimal strings and the shared money utilities.
Monthly rows group the displayed daily rows by `YYYY-MM`. Selected-range cards
and table totals use the same source rows.

## CSV export

`GET /reports/revenue.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` requires an active
business membership. It applies the same filter parser, service query, and
aggregation functions as the page. The export contains daily rows, monthly
rows, and selected-range totals, and is returned with private no-store cache
headers.

Authenticated Playwright filtering coverage can be enabled with
`E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`.
