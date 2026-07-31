# Security model

This document describes the Step 26 hardening pass. It is a threat model and
control inventory, not a claim of perfect security.

## Assets and trust boundaries

The primary assets are business financial history, cash and bank balances,
customer and supplier debt, inventory value, employee identities, audit
history, authentication sessions, and the Supabase service-role key.

Untrusted inputs include browser form fields, URL parameters, route parameters,
CSV-bound names and descriptions, authentication callback parameters, and
direct calls to exported Server Actions or Supabase RPCs.

The main trust boundaries are:

1. browser to Next.js;
2. Next.js Server Actions and route handlers to Supabase;
3. authenticated Supabase clients to RLS-protected tables and RPCs; and
4. server-only code to the service-role client, which bypasses RLS.

## Authorization and tenant isolation

- Every protected page and route loads a verified Supabase user and active
  business membership.
- Every Server Action independently calls `requireBusinessMember()` or
  `requireAdmin()`; hiding an admin button is never the authorization control.
- Financial writes use explicit Zod schemas and map accepted fields one by one.
  Raw form objects are not passed to database writes.
- Security-definer RPCs repeat membership, role, business ownership, and
  resource-state checks in PostgreSQL.
- Every public application table has RLS enabled. Anonymous relation access and
  public/anonymous function execution are revoked.
- Employees can read only their own membership and profile. Administrators can
  view users in their business.
- Audit logs and the audit summary view are administrator-only.
- Employee deactivation is an audited administrator RPC. An inactive membership
  immediately fails RLS and application membership checks even if the user's
  authentication token has not yet expired.

## Authentication and sessions

- Server authorization uses `auth.getUser()`, not unverified browser session
  data. The request proxy uses verified claims to refresh cookies.
- Sign-in errors do not distinguish an unknown account from a wrong password.
- A database-backed, atomic email throttle permits five sign-in attempts per
  15-minute window and then blocks for 15 minutes. Supabase Auth provider
  limits remain an additional layer.
- Password-reset requests use a separate three-per-hour email throttle and
  always return the same success text regardless of account existence.
- Password reset uses an allowlisted callback destination; arbitrary `next`
  URLs cannot create an open redirect.
- Password changes require a verified authenticated business member and are
  validated server-side.
- Invitation and reset email delivery depends on production SMTP and correct
  Supabase redirect URL configuration.

## Request and browser protections

- Next.js Server Actions accept only POST and compare `Origin` with
  `Host`/`X-Forwarded-Host`, providing the framework's CSRF protection.
- Same-origin `form-action` and `frame-ancestors 'none'` are enforced by the
  Content Security Policy.
- Response headers include CSP, clickjacking protection, MIME sniffing
  prevention, restricted browser permissions, a strict referrer policy, and
  production HSTS.
- The CSP allows connections only to the application and configured Supabase
  HTTP/WebSocket origins.
- React escapes rendered text and the project contains no
  `dangerouslySetInnerHTML`, runtime `eval`, or string-built SQL.
- CSV exports quote values and prefix untrusted spreadsheet formula markers.
  Valid negative numeric amounts remain numeric.

## Secret and data handling

- The service-role key is read only from `lib/env/server.ts`.
- The privileged Supabase client, authentication throttle service, and all
  data-access services that use server credentials import `server-only`.
- Client code receives only the public Supabase URL and publishable/anonymous
  key. These are intentionally public and rely on RLS.
- Application errors returned to browsers are generic. Raw Supabase errors and
  credentials are not logged.
- CSV routes require active membership, validate filters, and return private
  no-store responses.

## Database integrity controls

Financial commands are PostgreSQL transaction boundaries. Idempotency keys,
request fingerprints, advisory locks, row locks, immutable records, unique
source constraints, and reversal-state checks prevent duplicate or partial
effects. See `docs/idempotency-and-concurrency.md`.

## Remaining risks and operational requirements

- The non-nonce CSP requires `'unsafe-inline'` for Next.js scripts and styles.
  This is weaker than a nonce-based policy. Moving to per-request nonces would
  force dynamic rendering and should be evaluated before public deployment.
- Application throttling is keyed by normalized email, not a trusted client IP.
  Deploy a reverse-proxy or platform WAF rate limit for IP/network abuse and
  ensure forwarded-IP headers cannot be spoofed.
- A compromised application server can use the service-role key to bypass RLS.
  Store it only in protected deployment secrets, rotate it after suspected
  exposure, and never paste it into browser tooling or logs.
- Deactivation blocks business access but does not globally revoke every
  Supabase session. For suspected account compromise, also revoke sessions or
  ban the Auth user from the Supabase administration console.
- Production SMTP, allowed redirect URLs, HTTPS, backups, monitoring, alerting,
  dependency updates, and secret rotation are deployment responsibilities.
- Database and unit tests are not a penetration test. Run dependency scanning,
  external vulnerability scanning, and a manual security review before
  internet exposure and after material authentication or authorization changes.
