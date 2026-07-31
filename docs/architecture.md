# Architecture

## System shape

The application is a single Next.js App Router deployment written in strict
TypeScript. React and Tailwind CSS provide the interface. Supabase PostgreSQL
and Auth are accessed through `@supabase/ssr` and `@supabase/supabase-js`.

```text
Browser
  |
  | HTTPS
  v
Next.js App Router on Vercel
  |-- Server Components and server-side authorization
  |-- Validated commands and application services
  v
Supabase
  |-- Auth
  |-- PostgreSQL with RLS
  |-- transactional RPC functions for atomic financial writes
```

Supabase Auth provides email/password sessions. Next.js protected layouts load
the verified user, active business membership, profile, business, and role on
the server. Administrator route groups and mutations repeat the administrator
check on the server; navigation visibility is only a presentation concern.

## Boundaries

- `app/` owns routes, layouts, loading/error states, and route composition.
- `components/` owns reusable presentation components.
- `lib/validation/` owns shared Zod schemas.
- `lib/auth/` owns reusable authentication and permission checks.
- `lib/db/` owns Supabase clients and generated database types.
- `lib/env/public.ts` exposes only validated public configuration.
- `lib/env/server.ts` is marked server-only and owns privileged configuration.
- `lib/money/` owns decimal-safe parsing, arithmetic, and formatting.
- `services/` coordinates authorized business operations.
- `supabase/migrations/` is the source of truth for schema, constraints, RLS,
  and database functions.
- `supabase/tests/` contains pgTAP integration tests for constraints, tenant
  isolation, roles, and database invariants.

React components must not implement financial invariants. Services and database
transactions enforce them, while RLS provides a second authorization boundary.

## Security model

Public browser modules use only the project URL and public key. The privileged
client and service-role environment value are isolated behind `server-only`.
Every write validates input with Zod, authorizes on the server, and remains
constrained by RLS or an authorization-checked security-definer RPC. Hiding a
navigation item is not authorization.

Next.js 16 `proxy.ts` creates a request-scoped Supabase server client and calls
`auth.getClaims()` to verify or refresh a present session. The proxy propagates
all refreshed cookies and required no-cache headers. Route authorization does
not rely on the proxy.

The administrator user screen can send an employee invitation through the
server-only Auth admin client. Membership creation goes through
`add_business_employee`, which rechecks the caller's administrator role in
PostgreSQL and atomically writes the membership and audit record. Employees
cannot choose or promote roles through this operation.

Secure response headers, authentication throttles, reset flows, employee
deactivation, CSV protections, the detailed threat model, and explicitly
remaining risks are documented in `docs/security.md`.

Client usage is separated by runtime:

- Browser components use `lib/db/browser.ts`.
- Server Components, actions, and route handlers use `lib/db/server.ts`.
- Explicitly authorized administrative operations may use `lib/db/admin.ts`.
  That client bypasses RLS, so importing it is restricted to server code.

Tenant membership and role checks are database-enforced. Security-definer
helpers live in the unexposed `private` schema to avoid recursive membership
policies. All helpers set an empty search path. The public bootstrap RPC is the
only client-callable path that creates a business; it atomically creates the
first admin, required locations, required accounts, and an audit record.

## Data and money

PostgreSQL `numeric` stores monetary values. Application code passes branded
decimal strings through `lib/money` and never uses JavaScript `number`
arithmetic for money. `decimal.js` performs arithmetic with 40 digits of
precision; currency conversion uses explicit round-half-up to RON cents. Cash,
bank, receivable, payable, and inventory totals are derived from immutable
entries and allocations.

Dashboard formulas live in `lib/dashboard/formulas.ts` and operate only on
branded decimal strings. The dashboard keeps revenue separate from the
balance-sheet-style net value so sales already represented by cash, bank, or
receivables are not counted twice. Current USD payable estimates use immutable
manual reference-rate history; historical purchase and payment rates are never
rewritten.

Revenue-report filters and aggregation live in `lib/reports/revenue.ts`.
The page and authenticated CSV route share those functions and the same
business-scoped service. Only closed daily-sales summaries are queried;
customer-payment ledgers are not report inputs.

Customer-receivables reporting follows the same shared-result pattern in
`lib/reports/customer-receivables.ts`. The list and CSV use allocation-aware
purchase balances, while the drill-down composes existing purchase, payment,
and allocation services to preserve reversed history without affecting active
totals.

Supplier-payables reporting in `lib/reports/supplier-payables.ts` keeps RON
and USD debt in separate aggregates. Historical purchase/payment economics
remain tied to their recorded rates; only current remaining USD debt uses the
latest effective manual reference rate. Missing rates produce unavailable
estimates instead of silently using historical rates.

Cash and bank reporting in `lib/reports/cash-bank.ts` orders immutable entries
by transaction date, creation timestamp, and UUID. Running balances include
all movements even when a type filter hides rows. The server enriches entries
with shared-business user names and operational source links, then reconciles
the complete ledger calculation with the balance view.

Business-position reporting in `lib/reports/business-position.ts` adds each
inventory, financial-account, and receivable asset once, then subtracts
allocation-aware supplier liabilities. Revenue is deliberately not an input.
Current USD debt uses an explicit report rate and makes the supplier and net
RON values estimates. Administrator snapshots are recomputed in one authorized
database RPC, constrained to the current business date, audited, immutable,
and exposed as exact-decimal text for the historical trend.

Audit history is exposed to administrators through the security-invoker
`audit_log_summaries` view. It adds actor names and a business-timezone date
without weakening the underlying admin-only RLS policy. UI rendering escapes
and bounds JSON while redacting secret-like fields. Audit rows are immutable.
Correction forms share one reason/confirmation policy, while each transaction
keeps its dedicated atomic database reversal so source-specific compensating
effects and locking remain enforced close to the data.

Business calendar dates are derived through `lib/date` using the business's
IANA timezone. Timestamp strings without UTC or an explicit offset are rejected
to prevent local-machine timezone interpretation.

Business-day lifecycle is database-automatic. A minute-level `pg_cron` job
detects each business's local date transition, closes the prior daily-sales
draft at the exact timezone boundary, and opens the new day. Operational page
loads invoke the same advisory-lock-protected function as a fallback. Manual
lifecycle RPC execution is revoked from authenticated users. Individual sales
atomically update the daily aggregate, while the aggregate retains the final
recorder separately from automatic-close metadata.

Sale returns and inventory exceptions are separate administrator-only command
boundaries. They preserve original sale and stock records, write compensating
account, receivable, quantity, and inventory-value effects, and expose
return-adjusted revenue through a derived read model.

Inventory analysis is another derived read layer over immutable stock, sale,
and return ledgers. Location-specific threshold configuration is stored
separately from quantities; date-range aggregation and CSV generation share
one server-only service and exact-decimal report builder.

Reusable server guards live in `lib/auth/session.ts`. The open-business-day
guard accepts a server-owned loader until the `business_days` table is added in
Step 6, then verifies tenant ownership and exact open status.

Opening setup is an administrator-only RPC boundary. Account entries,
inventory movements, customer purchases, supplier purchases, and auditing are
created atomically. Authenticated clients have read-only grants on these
financial foundations; direct inserts, updates, and deletes are blocked.
Calculated balance views use `security_invoker` and return decimal text so
application code does not deserialize PostgreSQL numeric values into
JavaScript numbers.

Opening correction uses a separate audited RPC. It writes compensating account
and inventory movements and marks purchases and the batch as reversed while
preserving every original record.

## Testing strategy

- Vitest covers pure utilities, validation, components, and services.
- React Testing Library covers user-visible component behavior.
- Database integration tests will verify constraints, RLS, transactions, and
  financial invariants after Supabase is introduced.
- Playwright covers critical workflows in a running application.
- The Supabase health route probes the Auth health endpoint with the public key,
  returns only `ok` or `unavailable`, and is never cached.

Every implementation step must pass lint, strict type checking, unit tests,
relevant end-to-end tests, and a production build before it is complete.
