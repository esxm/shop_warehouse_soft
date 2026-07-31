# Phase 1 Business Rules

This document records the confirmed rules for Phase 1. It is descriptive, not
an implementation of the financial workflows.

## Access and business days

- Roles are `admin` and `employee`.
- Employees work only in the current open business day. They cannot backdate,
  edit closed days, change opening data or historical rates, correct completed
  records directly, or manage users.
- Administrators may manage users and historical days, record opening data, and
  correct records through traceable reversals or adjustments.
- Days open at local 00:00 and close automatically at the next local date
  boundary. Corrections require an administrator reason and preserve history.

## Revenue and receivables

- Daily revenue is cash sales plus bank sales plus credit sales.
- Every sale is immutable and records product quantities, manual RON selling
  prices, weighted historical RON cost, and its cash/bank/credit split.
- Daily credit sales equal the linked non-reversed customer credit purchases.
- Employees cannot edit, delete, or reverse submitted sales. Administrators
  can reverse an incorrect sale only while the same day remains open.
- Administrators record later returns as sale-linked compensating records.
  Refunds use original selling prices; sellable products restore historical
  stock value while damaged products remain outside sellable inventory.
- Cash and bank refunds are account outflows. Unpaid credit may be reduced only
  up to the remaining sale-linked receivable.
- Customer payments are allocated oldest-first by default, cannot overpay a
  purchase, increase the selected cash or bank account, and are not revenue.
- Employees and administrators may manually allocate a customer payment across
  selected outstanding purchases.

## Purchases and payables

- Supplier purchases are separate records in RON or USD and increase inventory
  at the receiving location.
- Credit purchases increase supplier payable without changing cash or bank.
- Payments allocate oldest-first by default and cannot exceed either the
  payment amount or purchase outstanding amount.
- Employees and administrators may manually allocate a supplier payment across
  selected outstanding purchases in the payment currency.
- A USD purchase retains its original amount, historical exchange rate,
  historical RON inventory cost, and remaining USD amount.
- Later USD payments use their own exchange rate. The signed business currency
  result is historical RON value minus actual RON paid: positive is a gain and
  negative is a loss.
- Current USD/RON reference rates affect current payable estimates only, never
  historical inventory cost.

## Cash, bank, and inventory value

- Phase 1 has a RON cash account and a RON bank account.
- Balances are sums of immutable ledger entries, never editable stored totals.
- Product quantities and historical RON value are derived by product and
  location from immutable movements.
- USD receipts use their manually entered historical rate. Multiple receipts
  use moving weighted-average RON unit cost.
- Warehouse-to-shop product transfers preserve weighted unit cost, reduce
  warehouse stock, and increase shop stock without changing total inventory.
- Stocktakes preserve expected and actual value history.
- Damage, missing stock, and theft reduce sellable quantity and historical
  inventory value. Damage is also tracked in a separate damaged-stock ledger.
- Low-stock minimums are configured per product and location and never mutate
  stock. Zero disables an alert.
- Product gross margin uses sale-line historical weighted cost, not current
  replacement cost or a later exchange rate. It excludes operating expenses
  and therefore is not final business profit.
- Product profit reports support day, Monday-to-Sunday week, month, and custom
  periods. Profit percentage is profit divided by historical product cost,
  matching the individual-sale calculation.

## Expenses and business position

- Every expense names a category and the cash or bank account used.
- Paying supplier debt is not an operating expense.
- Net business value is:

```text
warehouse inventory
+ shop inventory
+ cash
+ bank
+ customer receivables
- supplier payables converted to RON
```

Revenue is not added separately because it is already represented by cash,
bank, or receivables.

## Integrity and audit

- PostgreSQL `numeric` and decimal-safe application helpers are required for
  money; raw JavaScript floating-point arithmetic is prohibited.
- Multi-record financial writes must be atomic and idempotent.
- Completed financial records are immutable. Corrections use linked reversals
  or adjustments.
- Important actions record actor, time, action, entity, relevant before/after
  data, and required reasons.
- Server authorization and PostgreSQL Row Level Security both enforce tenant
  isolation and roles.
- The Supabase service-role key must never reach browser code.

## Phase 1 boundaries

Phase 1 includes financial control and inventory-value tracking. It excludes
product quantities, barcodes, automatic stock deduction, fiscal documents,
native mobile applications, offline synchronization, returns, refunds, and
other Phase 1B/2 inventory functions.
