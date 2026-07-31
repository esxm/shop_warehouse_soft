# Product profit report

`/reports/profit` shows product gross profit for:

- today;
- the current Monday-to-Sunday week;
- the current month;
- the previous month; or
- any valid custom from/to date range.

The same selected range is broken down into daily, weekly, and monthly tables
and can be exported as CSV.

## Calculation

For each period:

```text
product profit = net product revenue - historical product cost
profit percentage = product profit / historical product cost x 100
```

Net product revenue includes active returns on their return date. Historical
cost comes from the weighted RON buying cost preserved on immutable sale lines.
It never uses a later exchange rate or current replacement cost.

Sellable returns reverse their historical cost because value returns to
inventory. Damaged returns do not reverse cost, so the damaged item's cost
remains a loss.

## Scope

This is product gross profit, matching the profit-on-cost percentage shown for
individual sales. It does not subtract rent, salaries, taxes, utilities, or
other operating expenses and therefore must not be interpreted as final
accounting net profit.

The page and CSV use the same business-scoped, date-filtered service. CSV
responses require authentication, validate their date range, protect
spreadsheet cells, and disable caching.
