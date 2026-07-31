# Shared Money, Date, and Permission Utilities

Step 4 establishes the application contracts that later financial features must
use.

## Money

`lib/money/money.ts` is the only shared arithmetic boundary for monetary
amounts.

- PostgreSQL stores monetary columns as `numeric`.
- Application and database boundaries carry decimal strings, never JavaScript
  `number` values.
- `MoneyAmount` is a branded canonical string with exactly two decimal places.
- User-entered money accepts `.` or `,` as the decimal separator, rejects
  grouping separators and exponent notation, and permits at most two decimal
  places.
- Exchange rates are positive decimal strings with at most eight decimal
  places.
- USD-to-RON conversion rounds to RON cents using explicit round-half-up.
- Addition and subtraction use a private `decimal.js` clone with 40 digits of
  precision.

Examples:

```ts
const cash = parseMoneyInput("0.10");
const bank = parseMoneyInput("0.20");

addMoney(cash, bank); // "0.30"
formatRON(parseMoneyInput("1234.5")); // "1.234,50 RON"
formatUSD(parseMoneyInput("1234.5")); // "USD 1,234.50"
```

Use `positiveMoneyInputSchema` for external inputs that must be greater than
zero. Signed amounts remain available for ledger effects and reversals.

## Business dates

`lib/date/business-date.ts` derives calendar dates using the business's IANA
timezone, not the server or browser timezone.

- Timestamp strings must include `Z` or an explicit UTC offset.
- Date-only values use strict `YYYY-MM-DD`.
- Invalid calendar dates and unknown timezones are rejected.
- `getTodayInBusinessTimeZone` accepts an injectable clock for deterministic
  tests.
- Business dates compare as branded ISO date strings.

The database remains the source of truth for stored timestamps through
`timestamptz`. Business date fields introduced by later migrations should use
PostgreSQL `date`.

`lib/date/history-date.ts` resolves the shared `history_date` query parameter
against the business timezone. Missing dates default to the current business
date, and invalid dates show an error while safely falling back to today.
`HistoryDateFilter` provides the common selector. Operational services apply
the selected date directly to their database query.

`resolveHistoryPeriod` and `HistoryPeriodFilter` provide an inclusive From/To
range for operational histories. Daily sales, stock movements, inventory
transfers, expenses, returns/losses, supplier histories, customer histories,
and their trace reports all use the range control.

## Compact application layout

The primary header groups related links into Sales, Inventory, Finance, Costs
and corrections, Reports, and Administration menus. Menus open while hovered
or keyboard-focused and close when pointer/focus leaves, so no persistent
click-open overlay remains. `CollapsiblePanel` provides server-rendered
expandable sections for dense operational pages; histories stay bounded and
scroll inside their panel.

## Permissions

`lib/auth/session.ts` is server-only and exports:

- `requireAuthenticatedUser`
- `requireBusinessMember`
- `requireAdmin`
- `requireOpenBusinessDay`

The first three use the verified Supabase user and active membership loaded by
the request-scoped data-access layer.

The `business_days` table is introduced in Step 6. Until then,
`requireOpenBusinessDay` accepts a server-owned loader. It checks that the
loaded record belongs to the current business and has exact status `open`.
Missing, closed, or cross-business records fail with
`OpenBusinessDayRequiredError`.
