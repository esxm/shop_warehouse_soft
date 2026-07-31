# Business-position report

The protected `/reports/business-position` route shows the current net
business value from exact-decimal balance views.

## Formula

```text
Warehouse inventory
+ Shop inventory
+ Cash
+ Bank
+ Customer receivables
- Supplier payables in estimated RON
= Net business value
```

Revenue is intentionally not an input. Revenue effects already reach cash,
bank, customer receivables, inventory, or supplier liabilities, so adding
revenue would count value twice.

RON and USD supplier debt remain separate. Outstanding USD debt is converted
only with the current USD/RON rate selected or entered on the report. Both the
combined supplier RON value and net business value are labelled estimated when
USD conversion is involved. If USD debt exists without a rate, those estimates
remain unavailable.

## Snapshots

Administrators can save one snapshot for the current business date. The
`save_business_position_snapshot` RPC:

- independently rechecks administrator membership;
- derives the current date in the business timezone;
- recomputes every component from database balance views;
- requires a rate while USD debt is outstanding;
- calculates and stores the exact component totals atomically; and
- writes an audit event.

The browser cannot insert, update, or delete snapshot rows directly. Saved
snapshots are immutable and database constraints repeat the assets, supplier
estimate, and net-value formulas.

Historical snapshots are displayed as a trend with change from the preceding
snapshot. That change is explicitly not exact profit: owner contributions,
owner withdrawals, inventory adjustments, and currency-rate changes can all
change net business value.
