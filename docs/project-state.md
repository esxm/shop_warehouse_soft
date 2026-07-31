# Project State

## Current milestone

Low-stock and product inventory analysis after Step 37.

## Completed work

- Retained the completed Supabase, authentication, money, date, and permission
  foundations from Steps 0-4.
- Added an administrator-only responsive opening-balance wizard.
- Added immutable opening batch, account-entry, inventory-movement, customer,
  customer-purchase, supplier, and supplier-purchase foundations.
- Added one atomic `create_opening_balance` RPC for all opening effects and
  auditing.
- Added one active batch per business, duplicate-request protection, decimal
  string inputs, strict database validation, and cross-business foreign keys.
- Added calculated account, inventory, customer-receivable, and
  supplier-payable views that return decimal text.
- Added an administrator-only audited reversal workflow with compensating
  account and inventory movements and preserved historical purchases.
- Regenerated TypeScript database bindings from the local schema.
- Replaced manual business-day lifecycle controls with a timezone-aware
  database cron rollover and an idempotent member-triggered fallback.
- Removed Business Days navigation and manual actions; the legacy URL now
  redirects to Daily Sales.
- Added customer list/search, add, details, metadata editing, and
  history-preserving administrator deactivation.
- Added audited customer write RPCs, safe SQL search, practical duplicate
  detection, and business-scoped concurrency protection.
- Added separate immutable customer credit purchases tied to database-managed
  business days.
- Added employee current-open-day enforcement, reasoned administrator
  historical entries, derived purchase balances, purchase history, and audited
  reversal.
- Added idempotent customer payments with automatic oldest-first and manual
  allocation for employees and administrators.
- Added atomic cash/bank ledger inflows, derived allocation-aware receivables,
  payment history, and administrator payment reversal.
- Added supplier list/search, creation, details, contact editing, optional
  default currency, and history-preserving administrator deactivation.
- Added audited supplier write RPCs, safe SQL search, practical duplicate
  detection, and business-scoped concurrency protection.
- Added immutable RON and USD supplier purchases tied to business days, with
  manually entered historical USD/RON rates.
- Added atomic supplier payable creation, warehouse/shop inventory-value
  receipts, and audit events without creating cash or bank outflows.
- Added derived supplier purchase history, payable cards, inventory location
  balances, movement history, and administrator-only compensating reversal.
- Added idempotent RON and USD supplier payments with automatic oldest-first
  and manual allocation for employees and administrators.
- Added per-allocation historical RON value, actual RON value, currency
  gain/loss, atomic cash/bank outflow, and administrator payment reversal.
- Added business-day and business-scoped idempotency metadata to immutable
  financial account entries.
- Added exact-decimal account history and daily inflow/outflow views plus a
  responsive Cash & Bank page with account/date filters.
- Added one automatically created daily sales draft per day with cash, bank,
  derived credit, calculated total, notes, and preserved last-editor identity.
- Added automatic midnight close from the last saved draft, refreshed derived
  credit, numbered closure snapshots, one-time cash/bank inflows, audit
  attribution, and automatic next-day opening.
- Added seeded business expense categories, immutable expenses, idempotent
  cash/bank outflows, audited historical entries, and administrator reversal.
- Added active monthly category totals and a responsive expense entry,
  reporting, history, and correction page.
- Added immutable warehouse-to-shop inventory-value transfers with atomic
  source-balance enforcement, idempotency, and audited historical entries.
- Added administrator transfer reversal, balanced location effects, transfer
  history, and controls to the Inventory Value page.
- Added immutable administrator-only inventory stocktakes that preserve
  expected, actual, and difference values for warehouse and shop.
- Added atomically locked positive and negative inventory adjustments,
  idempotency, audited reversals, replacement workflow, and comparison history.
- Added a responsive server-rendered dashboard with closed daily and monthly
  revenue, derived balances, original-currency payables, inventory values, and
  net business value.
- Added immutable audited USD/RON reference-rate history and clear unavailable
  states when outstanding USD payables cannot be estimated.
- Added role-aware quick actions plus dashboard loading, retryable error, and
  empty states.
- Replaced the reports placeholder with a responsive revenue report containing
  timezone-safe presets, custom date filtering, selected totals, daily rows,
  and monthly aggregation.
- Added an authenticated CSV export that reuses the displayed report's filter
  and exact-decimal aggregation logic.
- Added report loading, retryable error, empty, invalid-range, and conditional
  authenticated end-to-end filtering states.
- Added a responsive customer receivables report with outstanding, customer,
  and overdue summary cards plus customer, status, overdue, and purchase-date
  filters.
- Added exact purchase-minus-active-allocation aggregation with consistency
  checks, reversed-entry exclusion, partial-payment support, and
  multi-purchase allocation support.
- Added a read-only customer drill-down that traces purchases, payments,
  allocations, remaining amounts, identifiers, and reversed history in both
  directions.
- Added an authenticated customer-receivables CSV export that reuses the page
  filters, business-scoped service, and aggregated result.
- Added a responsive supplier payables report with separate RON/USD totals,
  current estimated RON value, supplier/currency/outstanding/due-date filters,
  and grouped supplier-currency balances.
- Added exact original-purchase-minus-active-allocation aggregation, partial
  payment support, and explicit unavailable estimates when USD remains without
  a current manual rate.
- Added a supplier drill-down that traces every purchase, payment, and
  allocation with historical purchase rates, historical inventory cost,
  payment rates, actual RON effects, gain/loss, remaining values, IDs, and
  reversed history.
- Added an authenticated supplier-payables CSV export that reuses the filtered
  report and clearly labels the current manual USD/RON rate.
- Added a dedicated cash and bank report with separate account sections,
  opening balance, selected inflows/outflows, period-ending balance, current
  balance, and deterministic running balances.
- Added account, date-range, and transaction-type filters while preserving
  actual running balances across hidden transaction types.
- Added transaction rows with date/time, type, description, inflow, outflow,
  running balance, reversal state, recording user, source identifiers, and
  operational source links.
- Added an authenticated cash-and-bank CSV export using the same enriched and
  reconciled report result.
- Added a dedicated business-position report with every inventory, account,
  receivable, and payable component shown separately and an explicit
  no-double-counting formula.
- Added saved-rate suggestions plus manual USD/RON valuation, transparent
  estimated supplier/net labels, and unavailable states when a required rate
  is missing.
- Added administrator-only, audited, immutable daily snapshots and a
  historical net-worth trend that explicitly does not claim exact profit.
- Replaced the audit-log placeholder with an administrator-only, filterable
  event timeline containing users, actions, entities, business-local dates,
  reasons, safe before/after data, stable IDs, and affected-record links.
- Added an immutable audit summary read model plus secret-field redaction,
  bounded JSON display, and update/delete prevention for audit history.
- Unified the six required correction forms and validation rules while
  retaining their transaction-specific atomic reversal RPCs, compensating
  effects, concurrency checks, preserved originals, and audit records.

## Schema changes

Migration:

- `supabase/migrations/20260630000200_opening_balances.sql`
- `supabase/migrations/20260701000100_business_days.sql`
- `supabase/migrations/20260701000200_customer_management.sql`
- `supabase/migrations/20260701000300_customer_credit_purchases.sql`
- `supabase/migrations/20260701000400_customer_payments.sql`
- `supabase/migrations/20260701000500_supplier_management.sql`
- `supabase/migrations/20260701000600_supplier_purchases.sql`
- `supabase/migrations/20260701000700_supplier_payments.sql`
- `supabase/migrations/20260701000800_financial_account_ledger.sql`
- `supabase/migrations/20260701000900_daily_sales.sql`
- `supabase/migrations/20260701001000_expenses.sql`
- `supabase/migrations/20260701001100_inventory_value_transfers.sql`
- `supabase/migrations/20260701001200_inventory_stocktakes.sql`
- `supabase/migrations/20260701001300_dashboard.sql`
- `supabase/migrations/20260702000100_business_position_snapshots.sql`
- `supabase/migrations/20260702000200_audit_log_interface.sql`
- `supabase/migrations/20260702000300_automatic_business_days.sql`
- `supabase/migrations/20260702000400_automatic_current_day_recovery.sql`
- `supabase/migrations/20260702000500_automatic_day_variable_fix.sql`
- `supabase/migrations/20260702000600_manual_payment_allocations_and_currency_result.sql`
- `supabase/migrations/20260702000700_step_25_idempotent_purchases.sql`
- `supabase/migrations/20260702000800_security_hardening.sql`
- `supabase/migrations/20260702000900_security_rate_limit_variable_fix.sql`
- `supabase/migrations/20260702001000_product_master.sql`
- `supabase/migrations/20260702001100_product_stock_ledger.sql`
- `supabase/migrations/20260703000100_supplier_purchase_product_lines.sql`
- `supabase/migrations/20260703000200_product_inventory_transfers.sql`
- `supabase/migrations/20260703000300_product_sales_and_valuation.sql`
- `supabase/migrations/20260703000400_returns_and_inventory_exceptions.sql`
- `supabase/migrations/20260703000500_inventory_analysis.sql`

New enums:

- `transaction_currency`: `RON`, `USD`
- `financial_entry_direction`: `inflow`, `outflow`
- `business_day_status`: `open`, `closed`
- `daily_sales_status`: `draft`, `closed`

New tables:

- `opening_balance_batches`
- `customers`
- `suppliers`
- `financial_account_entries`
- `inventory_value_movements`
- `customer_credit_purchases`
- `supplier_purchases`
- `business_days`
- `customer_payments`
- `customer_payment_allocations`
- `supplier_payments`
- `supplier_payment_allocations`
- `daily_sales`
- `daily_sales_closures`
- `currency_reference_rates`
- `business_position_snapshots`

Extended tables:

- `customer_credit_purchases`: added nullable `business_day_id` for
  compatibility with opening receivables and required it for new operational
  or historical entries.
- `supplier_purchases`: added nullable `business_day_id` for opening-payable
  compatibility and required it for operational or historical purchases.
- `inventory_value_movements`: added nullable `business_day_id` so operational
  inventory effects remain tied to their source day.
- `financial_account_entries`: added nullable `business_day_id` and
  business-scoped nullable `idempotency_key`.
- `daily_sales`: added `last_draft_by` and `last_draft_at` so automatic close
  preserves the responsible employee separately from system lifecycle updates.

New security-invoker views:

- `opening_balance_summaries`
- `financial_account_balances`
- `inventory_location_balances`
- `customer_receivable_balances`
- `supplier_payable_balances`
- `customer_credit_purchase_balances`
- `customer_payment_summaries`
- `customer_payment_allocation_details`
- `supplier_purchase_summaries`
- `inventory_value_movement_summaries`
- `supplier_payment_summaries`
- `supplier_payment_allocation_details`
- `financial_account_entry_summaries`
- `financial_account_daily_totals`
- `business_day_credit_sales`
- `daily_sales_summaries`
- `currency_reference_rate_summaries`
- `business_position_snapshot_summaries`
- `audit_log_summaries`

New public RPCs:

- `create_opening_balance`
- `reverse_opening_balance`
- `create_business_day`
- `close_business_day`
- `reopen_business_day`
- `search_customers`
- `create_customer`
- `update_customer`
- `deactivate_customer`
- `create_customer_credit_purchase`
- `reverse_customer_credit_purchase`
- `create_customer_payment`
- `reverse_customer_payment`
- `search_suppliers`
- `create_supplier`
- `update_supplier`
- `deactivate_supplier`
- `create_supplier_purchase`
- `reverse_supplier_purchase`
- `create_supplier_payment`
- `reverse_supplier_payment`
- `upsert_daily_sales_draft`
- `close_daily_sales`
- `record_usd_ron_reference_rate`
- `save_business_position_snapshot`
- `ensure_current_business_day`

## API routes and server actions

- `/opening-balances` is inside the administrator-only route group.
- `submitOpeningBalances` validates every form value with Zod, rechecks admin
  access, and calls the transaction RPC with decimal strings.
- `reverseOpeningBalances` requires a meaningful reason and explicit
  confirmation before calling the reversal RPC.
- `/business-days` redirects to `/daily-sales`; no manual lifecycle interface
  or server actions remain.
- `/customers` provides business-scoped search and customer creation.
- `/customers/[customerId]` provides details, metadata editing, and
  administrator-only deactivation.
- Customer server actions validate all input with Zod and independently recheck
  member or administrator permissions.
- Customer details now show derived outstanding receivables, separate purchase
  history, current-day purchase entry, administrator historical entry, and
  administrator reversal.
- Customer details now also provide account-targeted payment entry, optional
  manual allocation, preserved allocation/payment history, and
  administrator payment reversal.
- `/suppliers` provides business-scoped search and supplier creation.
- `/suppliers/[supplierId]` provides contact/default-currency editing and
  administrator-only deactivation.
- Supplier details now provide role-aware purchase entry, separate RON/USD
  payable totals, immutable purchase history, and administrator reversal.
- `/inventory-value` now shows derived warehouse/shop totals and immutable
  movement history.
- Supplier details now provide currency-aware payment entry, manual allocation,
  payment/allocation history, signed currency result, and reversal.
- `/cash-and-bank` now provides derived account balances, daily totals,
  immutable transaction history, and account/date filtering.
- `/daily-sales` provides the automatically opened current draft, derived
  credit, calculated totals, last-editor attribution, automatic-close
  explanation, and preserved history.
- `/` now server-renders the current dashboard from derived business-scoped
  views and provides administrator reference-rate entry.
- `/reports` now server-renders closed daily-sales revenue for an inclusive
  business-date range.
- `/reports/revenue.csv` validates membership and exports the same daily,
  monthly, and selected-range values displayed by the report.
- `/reports/receivables` shows business-scoped customer receivable summaries
  and filtered balances.
- `/reports/receivables/[customerId]` provides the traceable purchase,
  payment, and allocation history for one customer.
- `/reports/receivables.csv` exports the same filtered summary and rows shown
  by the customer receivables report.
- `/reports/payables` shows currency-separated supplier payable summaries and
  filtered supplier-currency balances.
- `/reports/payables/[supplierId]` provides traceable historical and current
  economics for one supplier.
- `/reports/payables.csv` exports the same filtered payables summary and rows.
- `/reports/cash-and-bank` shows separate immutable cash and bank ledgers with
  running balances and traceable sources.
- `/reports/cash-and-bank.csv` exports the same account summaries and filtered
  ledger rows.
- `/reports/business-position` shows the current exact-decimal formula,
  selectable USD/RON estimate, administrator snapshot action, and historical
  snapshot trend.
- `/audit-log` is administrator-only and filters immutable events by user,
  action, entity type, and inclusive business-local date range.

## Security and financial decisions

- No editable current-balance or current-inventory columns were added.
- Authenticated users receive select-only table/view privileges; financial
  writes occur only inside authorized RPCs.
- The database independently rechecks administrator membership.
- Monetary RPC parameters are text and are validated before numeric casting.
- Zero core balances are stored on the batch but do not create zero-value
  movements.
- Opening supplier debt does not create inventory inflow because location
  opening values are entered independently.
- USD historical RON value is fixed from the original amount and historical
  rate.
- Composite foreign keys prevent cross-business entity references.
- Reversal preserves original records and writes compensating effects and an
  audit event.
- Authenticated clients have select-only access to business-day rows. Manual
  lifecycle RPC execute grants are revoked.
- A partial unique index enforces one open day per business.
- Cron and on-demand fallback rollover serialize per business with an advisory
  transaction lock and recheck the target day and draft.
- Local midnight boundaries use the business IANA timezone rather than server
  or browser dates.
- Customer tables remain select-only for authenticated clients; create, update,
  and deactivate operations use authorized, audited RPCs.
- Employees and administrators can create and edit customer metadata, while
  only administrators can deactivate.
- Customers cannot be hard-deleted through application roles, and deactivation
  preserves identifiers and related history.
- Same-name customers remain valid; only an active normalized name-and-phone
  match is treated as an obvious duplicate within one business.
- Customer search executes inside a membership-checked SQL function rather than
  constructing raw PostgREST filter syntax.
- Employees cannot submit a credit purchase unless the selected ID matches the
  current open business day on both the server and database.
- Purchase dates are derived from business days, and administrators need an
  audited reason for closed-day historical entries.
- Purchase rows have no update or delete API; correction marks the original as
  reversed and requires a new replacement row.
- Remaining purchase balance is exposed through a security-invoker view rather
  than stored as an editable value.
- Opening receivables cannot be reversed outside the atomic opening-balance
  reversal workflow.
- Customer payments are one atomic RPC covering authorization, outstanding
  checks, allocations, one account-ledger inflow, and audit.
- Automatic allocation locks and pays purchases oldest-first; administrator
  manual allocations must sum exactly and cannot exceed any purchase balance.
- Payment amount cannot exceed the customer's derived outstanding receivable.
- Payment retries use a UUID idempotency key and stored request fingerprint, so
  identical retries return the original result without duplicating allocations
  or account entries.
- Customer payment entries use `entry_type = customer_payment`; no revenue or
  sale entry is created.
- Payment reversal preserves payment and allocation rows, excludes those
  allocations from derived balances, and creates a linked account outflow.
- Purchases with allocations from active payments cannot be reversed first.
- Supplier rows remain select-only for authenticated clients; create, update,
  and deactivate operations use authorized, audited RPCs.
- Employees and administrators can create and edit supplier metadata, while
  only administrators can deactivate.
- Supplier deactivation preserves identifiers, historical purchases, original
  currencies, and historical exchange rates.
- Same-name suppliers remain valid; only an active normalized name-and-phone
  match is treated as an obvious duplicate within one business.
- Supplier search executes inside a membership-checked SQL function.
- Supplier purchase creation is one atomic RPC covering authorization,
  historical-rate conversion, payable creation, inventory receipt, and audit.
- Employees are restricted to the current open business day; administrators
  need an audit reason for closed-day historical purchases.
- The database derives purchase date from the business day, validates active
  tenant-scoped supplier and destination rows, and calculates inventory cost.
- RON cost equals original amount. USD cost is fixed at creation from the
  manual historical rate and does not depend on a later current rate.
- Supplier purchases never write a financial account entry; payment remains a
  separate transaction.
- Supplier purchase reversal is administrator-only, preserves the original,
  removes it from payables, and writes one linked compensating inventory
  movement.
- Supplier payment creation is one atomic RPC covering authorization,
  currency-matched allocation, actual RON account outflow, gain/loss, and
  audit.
- Automatic allocation locks and pays supplier purchases oldest-first within
  one currency; manual allocations must total the payment and
  cannot exceed any purchase balance.
- USD allocations retain each purchase's historical rate while using the
  payment-day rate for actual cash/bank effect. RON gain/loss is always zero.
- Payment retries use a UUID idempotency key and request fingerprint, preventing
  duplicate allocations and outflows.
- Supplier payment reversal preserves all rows, restores payable calculations,
  and creates one linked account inflow.
- A supplier purchase with active allocations cannot be reversed before its
  payments.
- Financial accounts retain no editable balance column; current cash and bank
  are sums of immutable inflows minus outflows.
- Approved payment effects copy and validate account, amount, date, direction,
  business day, source, and idempotency metadata through a database trigger.
- A partial unique index prevents one idempotency key from creating multiple
  financial effects within a business, including across source types.
- Reversal entries must exactly compensate and link their original entry.
- Account history and daily totals return exact decimal text through
  security-invoker views; browser roles remain select-only.
- Credit sales are derived from non-reversed customer credit purchases,
  validated at draft save, and refreshed by automatic close.
- Automatic daily close uses one transaction for the last saved draft,
  closure snapshot, cash/bank inflows, daily-sales status, business-day status,
  last-editor attribution, and audits.
- Credit sales create revenue but no cash or bank ledger inflow.
- Row locking and closed-state checks make repeated close requests safe without
  duplicate financial effects.
- Manual close and reopen execution is disabled for authenticated users.
- Dashboard revenue uses only closed daily-sales rows. Net business value uses
  current ledger assets less estimated payables and never adds revenue again.
- Outstanding USD payables use the latest effective manually entered USD/RON
  reference rate. Missing rates make estimates unavailable rather than
  substituting a historical purchase rate.
- Reference-rate rows are immutable and select-only for browser roles;
  administrator writes use an audited security-definer RPC.
- Revenue reporting reads only closed `daily_sales_summaries`; it never treats
  customer payments as sales.
- Report presets derive today in the business timezone, while calendar
  arithmetic stays on date-only UTC boundaries.
- CSV generation consumes the same aggregated report object as the page, so
  exported and displayed totals cannot use different formulas.
- Receivable totals use active credit purchases minus allocations from active
  payments. Reversed purchases and reversed-payment allocations never affect
  active totals.
- Receivables list and CSV reads are scoped by active membership and business
  ID; drill-down services independently repeat tenant scoping.
- Existing exact-decimal security-invoker views satisfy Step 20, so no new
  migration or direct financial write path was added.
- Supplier payable aggregation never adds RON and USD directly. Original debt
  remains in its transaction currency; only the explicitly labelled current
  estimate converts remaining USD.
- Historical purchase rates, inventory costs, payment rates, actual RON
  values, and gain/loss remain separate from the current reference rate.
- Existing allocation-aware supplier views satisfy Step 21, so no new
  migration or financial write path was added.
- Cash and bank running balances use transaction date, creation timestamp, and
  entry UUID as deterministic ordering keys.
- Current balances are recalculated from every immutable ledger entry and
  compared with `financial_account_balances`; mismatches fail closed.
- Transaction-type filtering does not remove hidden movements from visible
  running balances, preventing misleading historical balances.
- Existing exact-decimal ledger views satisfy Step 22, so no migration or
  financial write path was added.
- Business-position calculations have no revenue input; each balance-sheet
  component appears once and supplier liabilities are subtracted once.
- Browser roles have select-only access to snapshots. The authorized RPC
  recomputes current balances server-side, restricts the date to the current
  business date, enforces one snapshot per date, and writes an audit event.
- Snapshot formula constraints repeat USD conversion, supplier-total,
  asset-total, and net-value invariants; update/delete triggers preserve
  history.
- Historical movement is labelled net-worth change rather than profit because
  contributions, withdrawals, inventory adjustments, and currency valuation
  can affect it.
- Audit data remains protected by administrator RLS. Browser roles cannot
  write audit rows, and a trigger prevents update/delete even through a
  privileged accidental write.
- Audit before/after data is escaped, depth/size bounded, deterministically
  ordered, and redacts secret-like keys before display.
- The six required correction actions independently recheck administrator
  access in both server actions and security-definer RPCs.
- Reversal reasons and confirmations share reusable application validation;
  each RPC still owns source-specific locks, duplicate protection,
  compensation, reversal metadata, and atomic auditing.

## Tests added

- Focused validation tests for canonical money, negative/zero rejection, dates,
  party limits, currency/rate rules, JSON input, and reversal confirmation.
- A wizard interaction test for customer and USD supplier entry.
- Navigation and server-guard regression coverage for the admin route.
- 36 pgTAP Step 5 tests covering successful creation, derived balances,
  duplicate blocking, employee denial, direct-write denial, invalid values,
  late-failure rollback, reversal, auditing, and corrected replacement.
- Focused business-day validation and close-confirmation component tests.
- 26 pgTAP Step 6 tests covering RLS, open, close, reopen, permissions, direct
  write denial, auditing, repeated close behavior, and duplicate-open
  prevention.
- Focused customer validation and form-rendering tests.
- 32 pgTAP Step 7 tests covering tenant isolation, search, create, update,
  duplicate handling, employee permissions, admin deactivation, audit records,
  and hard-delete denial.
- Focused credit-purchase validation and role-aware form tests.
- 36 pgTAP Step 8 tests covering separate purchases, decimal totals, derived
  balances, open/closed-day authorization, historical reasons, immutability,
  opening compatibility, reversal, and audit records.
- Focused customer-payment validation, role-aware form, manual-allocation, and
  reversal-confirmation tests.
- 51 pgTAP Step 9 tests covering FIFO, partial and multi-purchase allocation,
  account balances, no-revenue behavior, idempotency, overpayment rejection,
  manual override, immutable writes, and reversal restoration.
- Focused supplier validation, form rendering, server-authorization, and
  deactivation-confirmation tests.
- 34 pgTAP Step 10 tests covering tenant isolation, search, create, update,
  duplicate handling, default currency, employee permissions, admin
  deactivation, audit records, hard-delete denial, and historical purchase
  preservation.
- Focused supplier-purchase currency/rate validation, role-aware form, and
  reversal-confirmation tests.
- 49 pgTAP Step 11 tests covering RON and USD conversion, warehouse/shop
  destinations, payable and inventory effects, no-cash behavior, rollback,
  closed-day authorization, immutable writes, tenant isolation, and reversal.
- Focused supplier-payment currency/rate validation, role-aware allocation
  form, and reversal-confirmation tests.
- 62 pgTAP Step 12 tests covering partial and multi-purchase allocation, mixed
  historical rates, RON/USD account effects, gain/loss, overpayment,
  idempotency, manual override, rollback, authorization, and reversal.
- Focused account-ledger filter and Cash & Bank page/service tests.
- 41 pgTAP Step 13 tests covering derived cash/bank balances, source metadata,
  exact history, daily totals, cross-source idempotency, direct-write denial,
  reversals, and tenant isolation.
- Focused daily-sales validation, calculated-total, unsaved-change,
  confirmation, business-day routing, and server-guard tests.
- 58 pgTAP Step 14 tests covering credit equality, draft editing, stale-close
  rollback, atomic account effects, duplicate close, direct-write denial,
  reopen/reversal, replacement close, and tenant isolation.
- Focused expense amount, audit-reason, and reversal-confirmation validation
  tests.
- 32 pgTAP Step 15 tests covering seeded categories, account effects,
  idempotency, closed-day authorization, historical auditing, monthly totals,
  immutable writes, and reversal.
- Focused inventory-transfer amount, location, audit-reason, and
  reversal-confirmation validation tests.
- 32 pgTAP Step 16 tests covering balanced location effects, unchanged total
  inventory, source sufficiency, idempotency, permissions, history, and
  reversal.
- Focused stocktake date, actual-value, reason, and reversal-confirmation
  validation tests.
- 40 pgTAP Step 17 tests covering preserved expected/actual values, positive
  and negative adjustments, authorization, idempotency, immutable history,
  reversal, and corrected replacement stocktakes.
- 15 focused dashboard formula, validation, route, and service unit tests.
- 17 pgTAP Step 18 tests covering rate precision, latest-rate selection,
  authorization, direct-write denial, immutability, auditing, and member reads.
- 10 focused Step 19 tests covering exact daily/monthly aggregation, empty
  totals, CSV parity, week/month/year/leap boundaries, business timezone
  rollover, custom validation, closed-sales sourcing, and export protection.
- Added a conditional authenticated Playwright test for custom date filtering.
- 14 focused Step 20 tests cover partial and multi-purchase allocations,
  reversal exclusion, outstanding/overdue/customer/date filters, inconsistent
  source rejection, CSV parity, business scoping, query pushdown, list UI,
  drill-down traceability, and export protection.
- 13 focused Step 21 tests cover currency separation, current-rate estimates,
  missing-rate handling, mixed historical/payment rates, partial allocations,
  reversal exclusion, filter validation, due-date query scope, CSV parity,
  list UI, drill-down traceability, and export protection.
- 12 focused Step 22 tests cover deterministic ordering, opening/current/
  running balances, reversals, type-filter behavior, CSV metadata, filter
  validation, tenant scoping, source/user enrichment, reconciliation, report
  UI, and export protection.
- 9 focused Step 23 tests cover exact component aggregation, revenue exclusion
  by construction, USD rate changes, missing-rate behavior, deterministic
  trend changes, tenant-scoped sources, snapshot RPC use, page language, and
  layered administrator protection.
- 16 pgTAP Step 23 checks cover snapshot schema, RLS, direct-write denial,
  authorized creation, exact formula storage, auditing, daily uniqueness,
  immutability, member reads, employee denial, and backdate denial.
- 19 focused Step 24 tests cover filter validation, safe JSON redaction,
  administrator routing, query pushdown, source links, shared correction UI
  and validation, and all six reversal authorization/locking/duplicate/
  compensation/audit contracts.
- 8 pgTAP Step 24 checks cover the audit summary, retained RLS, direct-write
  denial, read grants, and immutable audit-history trigger.
- 7 focused automatic-lifecycle tests cover timezone cron, on-demand fallback,
  last-editor attribution, manual-control removal, early-close recovery, and
  unambiguous database helper identifiers.
- 20 pgTAP automatic-lifecycle checks cover cron registration, revoked manual
  execution, last-draft close values, editor attribution, one-time account
  effects, current-day opening, untouched drafts, auditing, and idempotency.

## Verification

- The last clean local `supabase db reset`, before Step 23, applied the first
  sixteen migrations.
- The focused Step 18 SQL file passes 17 tests.
- The last pre-Step-23 full pgTAP suite passed 586 tests across 15 files.
- 15 focused Step 18 unit tests pass.
- The full unit suite passes 212 tests across 42 files.
- Playwright passes all 4 desktop and mobile checks.
- The Next.js production build completes successfully.
- TypeScript and targeted lint pass.
- Prettier reports no formatting differences.
- Step 19 focused tests pass: 10 tests across 2 files.
- Step 19 TypeScript and targeted lint pass.
- Per request, Step 19 Playwright, full suites, database checks, and production
  build were not run.
- Step 20 focused tests, TypeScript, targeted lint, and formatting pass.
- Per request, Step 20 Playwright, full suites, database checks, and production
  build were not run.
- Step 21 focused tests, TypeScript, targeted lint, and formatting pass.
- Per request, Step 21 Playwright, full suites, database checks, and production
  build were not run.
- Step 22 focused tests, TypeScript, targeted lint, and formatting pass.
- Per request, Step 22 Playwright, full suites, database checks, and production
  build were not run.
- Step 23 focused tests pass: 9 tests across 3 files.
- Step 23 TypeScript, targeted lint, and formatting pass.
- Per request, Step 23 Playwright, full suites, database checks, and production
  build were not run.
- Step 24 focused tests pass: 19 new tests across 3 files.
- All 44 affected reversal-validation regression tests pass across 6 files.
- Step 24 TypeScript, targeted lint, and formatting pass.
- Per request, Step 24 Playwright, full suites, database checks, and production
  build were not run.
- Automatic-lifecycle focused verification passes: 37 tests across 9 affected
  files, TypeScript, targeted lint, and formatting.
- All 21 local migrations are recorded on the linked Supabase project.
- Remote verification shows business date `2026-07-02` open with its daily
  sales record in draft state.
- Per request, the long local database suite, Playwright, full unit suite, and
  production build were not run.
- Step 25 audit confirms request-key/fingerprint protection for customer and
  supplier payments, expenses, transfers, and stocktakes; allocation row locks
  and daily-close serialization were already present.
- Added server-generated request IDs and transaction-scoped idempotency
  wrappers for customer credit purchases and supplier purchases, closing the
  remaining duplicate-create gap.
- Added `docs/idempotency-and-concurrency.md` and focused structural regression
  coverage for command keys, advisory locks, allocation locks, reversal locks,
  and daily-close uniqueness.
- Step 26 adds secure response headers, database-backed sign-in and
  password-reset throttling, an allowlisted password-reset callback, audited
  employee access deactivation/reactivation, spreadsheet-formula-safe CSV
  output, and tighter membership/profile privacy.
- Public tables are RLS-enabled, anonymous relation/function access is revoked,
  and the security threat model plus remaining operational risks are recorded
  in `docs/security.md`.
- Step 26 focused verification passes: 67 database assertions across the
  foundation and security files, 42 affected unit assertions, TypeScript, and
  targeted lint.
- All 25 local migrations are recorded on the linked Supabase project.
- Per request, the full database suite, full unit suite, Playwright, and
  production build were not run for Step 26.
- Step 27 completes the responsive mobile usability pass with a phone-specific
  primary menu, larger touch targets, full-width mobile form actions,
  consistent focus-visible styling, iOS-safe form input sizing, and
  touch-friendly horizontal table scrolling.
- Step 31 adds the Phase 1B product master: business-scoped categories,
  unique/manual/generated internal codes, piece-only products, optional default
  RON costs/prices, search, editing, audited deactivation, and atomic CSV
  import with validation preview and idempotency.
- Steps 28 and 30 remain intentionally skipped at the user's direction;
  Step 29 is covered by the explicit release gate.
- Step 31 focused verification passes: 33 product database assertions, 25
  security/RLS assertions against the new tables, 18 focused unit/navigation
  assertions, TypeScript, and targeted lint.
- All 26 local migrations are recorded on the linked Supabase project.
- Per request, the full database suite, full unit suite, Playwright, and
  production build were not run for Step 31.
- Step 32 adds the immutable product quantity ledger, exact derived balances
  for every product/location pair, serialized and idempotent movement commands,
  linked reversals, employee negative-stock rejection, and documented
  administrator overrides with audit events.
- The `/stock` interface records opening quantities, transfers, returns,
  damage, and count adjustments against the automatic current business day.
  Supplier receipts and sales remain reserved for their linked Steps 33 and 35
  workflows.
- Step 32 focused verification passes: 28 database assertions, 16 focused
  unit/page assertions, TypeScript, targeted lint, and formatting.
- All 27 local migrations are recorded on the linked Supabase project.
- Per request, the full database suite, full unit suite, Playwright, and
  production build were not run for Step 32.
- Step 33 upgrades new supplier goods receipts to immutable product lines with
  exact piece quantities, original-currency unit prices, historical exchange
  rates, eight-decimal RON unit costs, and reconciled RON line totals.
- One idempotent PostgreSQL command now creates the supplier payable,
  inventory-value inflow, product lines, and one product-stock receipt per line
  at either the warehouse or shop. Existing Phase 1 value-only purchases remain
  visible and report zero product lines.
- Supplier purchase reversal now reverses linked product quantities as well as
  payable and inventory value. Negative stock is rejected unless an
  administrator explicitly enables the reasoned audit override.
- Step 33 focused verification passes: 36 new database assertions, 19 focused
  validation/UI/service assertions, TypeScript, and targeted lint.
- All 28 local migrations are recorded on the linked Supabase project.
- Per request, the full database suite, full unit suite, Playwright, and
  production build were not run for Step 33.
- Step 34 upgrades warehouse-to-shop transfers to immutable multi-product
  lines. Each command validates exact warehouse quantities under stable
  product locks, derives the moving weighted-average historical unit cost, and
  moves matching product quantity and inventory value atomically.
- Transfer history now shows product, quantity, preserved eight-decimal unit
  cost, and RON line value. Existing Phase 1 amount-only transfers remain
  visible as historical value-only records.
- Reversal restores every product and the inventory value in one transaction.
  Insufficient shop quantity is rejected unless an administrator explicitly
  enables the reasoned negative-stock override.
- Step 34 focused verification passes: 37 database assertions, 12 focused
  validation/service/page assertions, TypeScript, and targeted lint.
- All 29 local migrations are recorded on the linked Supabase project.
- Per request, the full database suite, full unit suite, Playwright, and
  production build were not run for Step 34.
- Step 35 adds immutable individual product sales with one to 100 unique
  product lines, manual RON selling prices, exact cash/bank/customer-credit
  splits, and linked customer receivables.
- Each sale preserves the shop's eight-decimal moving weighted-average RON
  buying cost, atomically reduces product quantity and inventory value, and
  calculates line, sale, and daily gross profit amounts and percentages on
  cost.
- Employees cannot edit, delete, or reverse submitted sales. Administrators
  can reverse an incorrect sale only while its automatic business day is open;
  closed-day returns and refunds remain Step 36.
- `/inventory-value` now shows quantity, weighted unit cost, historical RON
  value, and a current USD equivalent using the latest manually entered
  USD/RON reference rate without rewriting historical cost.
- Step 35 focused verification passes: 44 database assertions, 10 focused
  validation/page assertions, TypeScript, targeted lint, and a clean local
  migration rebuild.
- All 30 local migrations are recorded on the linked Supabase project.
- Per request, the full database suite, full unit suite, Playwright, and
  production build were not run for Step 35.
- Step 36 adds administrator-only, sale-linked customer returns with original
  selling prices, cash/bank refunds, unpaid-credit reduction, and per-line
  sellable or damaged disposition.
- Sellable returns restore original weighted historical quantity and value.
  Damaged returns remain outside sellable inventory and enter a separate
  damaged-stock ledger.
- Damage, missing-stock, and theft commands atomically reduce exact product
  quantity and weighted historical value with required reasons and audit
  events.
- Return adjustments are integrated into customer balances, manual and
  oldest-first payment allocation, dashboard revenue, and Revenue reporting.
  Revenue is reduced on the return date without rewriting the original sale.
- Returns and inventory exceptions are immutable and idempotent. Administrator
  reversals create compensating money, receivable, stock, value, and
  damaged-stock effects while retaining original history.
- Step 36 focused verification passes: 44 database assertions and 15 focused
  validation/interface assertions. The full suite, Playwright, and production
  build were not run per request.
- All 31 local migrations are recorded on the linked Supabase project.
- Step 37 adds audited, administrator-configured low-stock minimums per product
  and location. Zero disables an alert without deleting threshold history.
- `/reports/inventory` now provides current quantity and historical value by
  product/location, low-stock alerts, date-filtered movements, product sales
  and returns, fast/slow ranking, and CSV export.
- Product gross margin is recomputed from preserved historical sale costs and
  active return disposition. The interface explains that it excludes expenses,
  taxes, and overhead and never uses current replacement cost.
- Step 37 focused verification passes: 23 database assertions, 11 focused
  aggregation/interface assertions, and TypeScript. Full suites, Playwright,
  and production build were not run per request.
- All 32 local migrations are recorded on the linked Supabase project.
- Added `/reports/profit` with today/week/month/previous-month presets, custom
  date ranges, selected-period totals, daily/weekly/monthly breakdowns, and
  authenticated CSV export.
- Product profit uses net sale revenue after returns minus preserved historical
  buying cost. Percentage is calculated on cost, matching individual sales;
  the page explicitly distinguishes product gross profit from final net profit.
- Focused profit verification passes: 11 aggregation/interface assertions,
  TypeScript, and targeted lint. No database migration was required.
- Product stock now requires a positive RON unit cost for every new original
  movement, both in validation and at the database boundary. Zero or missing
  cost can no longer enter and distort weighted inventory cost.
- Sale and stock movement histories display the creator's profile name when it
  exists and otherwise use the creator's business role. The current signed-in
  user's display identity is also used as an interface fallback.
- Product Stock now supports product/code/category search and location
  filtering. The Product Inventory page now contains only product-valued
  balances and product transfers; the legacy amount-only inventory and
  stocktake interface is no longer displayed.
- Focused verification passes: 9 database assertions and 30 focused
  validation/interface assertions. Full suites, Playwright, and production
  build were not run.
- All 33 local migrations are recorded on the linked Supabase project.
- The dashboard now removes the separate legacy warehouse/shop amount-only
  inventory cards and derives one Product-valued inventory total from exact
  product quantities and complete weighted historical costs. Net business
  value uses that same product-valued total.
- Inventory Analysis now shows both profit percentage on historical cost,
  matching Daily Sales and Profit reporting, and standard gross margin
  percentage on net revenue. Both are formatted to two decimal places and are
  labeled with their denominator.
- Focused dashboard and inventory-analysis verification passes: 20 assertions,
  TypeScript, and targeted lint. No database migration was required.
- Product management and Product Stock are now combined under one
  `Products & Stock` navigation item. Stock appears first; product search,
  creation, category management, and CSV import appear below. The old product
  list route redirects to the combined page.
- Stock movement history now loads one selected business date, defaults to the
  current business date, caps the query at 250 rows, and scrolls inside its own
  panel. Other major operational history lists also use bounded internal
  scrolling.
- Focused combined-page verification passes: 21 assertions, TypeScript, and
  targeted lint. No database migration was required.
- Migration `20260704000100_reconcile_product_inventory_value.sql` reconciles
  the hidden internal warehouse/shop value ledger to exact product-valued
  inventory and mirrors future manual costed stock movements automatically.
  This removes the stale-value condition that rejected otherwise valid product
  sales.
- Remote verification confirms zero difference between internal and
  product-valued totals for both shop and warehouse. Focused verification
  passes: 10 database assertions, 23 interface/validation assertions,
  TypeScript, and targeted lint.
- All 34 local migrations are recorded on the linked Supabase project.

## Product currency and compact histories

- Migration `20260706000100_product_purchase_currency.sql` adds the explicit
  RON/USD currency for a product's optional default purchase cost and
  currency-aware create/update RPCs.
- Customer purchase and payment histories now accept inclusive From/To dates.
- The header uses grouped menus, and dense operational sections use reusable
  expandable panels.
- All 35 local migrations are recorded on the linked Supabase project.

## Currency-aware stock entry and period histories

- Migrations `20260706000200_cost_currency_and_automatic_stock_cost.sql` and
  `20260706000300_weighted_stock_cost_precision.sql` preserve original
  RON/USD purchase data and derive source movements from weighted-average cost.
- Product defaults and inbound manual stock entries convert USD with the
  entered historical RON rate.
- All operational history controls now use inclusive From/To periods.
- Header groups open on hover/focus and close automatically.
- All 37 local migrations are recorded on the linked Supabase project.
- A shared business-timezone history-date selector now filters individual
  sales, daily profit history, expenses, product transfers, returns, inventory
  exceptions, customer purchases/payments, supplier purchases/payments, and
  receivable/payable trace histories at the database query.
- Stock retains its selected-date movement filter. Cash/Bank and Audit Log now
  default their existing from/to filters to today, while analytical reports
  retain their existing preset and custom date ranges.
- Focused history-date verification passes: 39 assertions, TypeScript, and
  targeted lint. No database migration was required.
- Step 29 adds an explicit Phase 1 release gate with a 15-invariant Vitest
  map, a pgTAP database invariant file, authenticated desktop/mobile
  Playwright critical-route checks, and `docs/release-checklist.md`.

## Manual actions required

- Do not submit Ahmad Shop's remote opening wizard until the real opening date,
  balances, receivables, supplier currencies, and historical USD rates have
  been verified.

## Unresolved issues

- Ahmad Shop's real opening values have not been submitted; this is
  intentionally deferred until the figures are reconciled.
- Production SMTP is not configured; real employee invitation emails remain
  unavailable.
- Business days are introduced in Step 6, so opening records intentionally
  have no business-day link.
- Operational tables introduced in later steps must reference the open
  business day and derive their transaction date from it.
- The local machine runs Node.js 22.10.0, below the declared Node 22.13 minimum.
- `npm audit` reports two moderate dependency issues; no forced breaking update
  was applied.

## Next recommended step

After Step 37 confirmation, return to skipped Steps 27 through 30 or choose the
next Phase 2 scope.
