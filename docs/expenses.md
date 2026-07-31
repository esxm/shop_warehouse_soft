# Expenses

Step 15 records operating expenses and their cash or bank effects.

## Recording

Every business receives eight default categories: Rent, Electricity,
Transport, Salary, Internet, Taxes and fees, Maintenance, and Other.

Employees can record expenses only on the current open business day.
Administrators can use a closed historical day when they provide an audit
reason. The database derives the expense date from the selected business day
and accepts only active RON financial accounts.

`create_expense` atomically creates the immutable expense, one account outflow,
and an audit event. Its request identifier makes an identical retry safe and
rejects reuse with changed data.

## Corrections

Expenses cannot be edited or deleted. An administrator reverses a mistake with
a reason. The original expense remains visible, and one linked inflow restores
the exact account amount. A second reversal is rejected.

## Reporting

The expense page shows the latest 100 records and active monthly totals by
category. Reversed expenses remain in history but are excluded from category
totals.
