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
- Closing a day is manual. Reopening and corrections require an administrator
  reason and must preserve history.

## Revenue and receivables

- Daily revenue is cash sales plus bank sales plus credit sales.
- Declared credit sales for a day must equal its individual customer credit
  purchases.
- Customer payments are allocated oldest-first by default, cannot overpay a
  purchase, increase the selected cash or bank account, and are not revenue.

## Purchases and payables

- Supplier purchases are separate records in RON or USD and increase inventory
  at the receiving location.
- Credit purchases increase supplier payable without changing cash or bank.
- Payments allocate oldest-first by default and cannot exceed either the
  payment amount or purchase outstanding amount.
- A USD purchase retains its original amount, historical exchange rate,
  historical RON inventory cost, and remaining USD amount.
- Later USD payments use their own exchange rate. Exchange gain or loss is the
  difference between actual RON paid and allocated historical RON value.
- Current USD/RON reference rates affect current payable estimates only, never
  historical inventory cost.

## Cash, bank, and inventory value

- Phase 1 has a RON cash account and a RON bank account.
- Balances are sums of immutable ledger entries, never editable stored totals.
- Phase 1 tracks inventory value at historical cost for warehouse and shop; it
  does not track product quantities.
- Warehouse-to-shop transfers reduce warehouse value and increase shop value by
  the same amount, leaving total inventory unchanged.
- Stocktakes preserve expected and actual value history.

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
