# Project State

## Current milestone

Step 2 - Database foundation.

## Completed work

- Initialized the Supabase CLI project and migration workflow.
- Added the `businesses`, `profiles`, `business_members`,
  `inventory_locations`, `financial_accounts`, and `audit_logs` tables.
- Added UUID keys, foreign keys, validation constraints, required unique
  constraints, and lookup indexes.
- Added fixed PostgreSQL enums for member roles, location types, and account
  types.
- Enabled RLS on every public table with explicit authenticated-role grants.
- Added non-recursive membership, administrator, and shared-profile helpers in
  the unexposed `private` schema.
- Added automatic profile creation for new Supabase Auth users.
- Added an atomic `create_business_foundation` RPC that creates the first
  administrator, warehouse, shop, cash account, bank account, and audit record.
- Generated and integrated TypeScript database types into every Supabase
  client.
- Added database-only local startup, reset, lint, pgTAP, and type-generation
  commands.

## Schema changes

Migration:

- `supabase/migrations/20260629000100_database_foundation.sql`

Public tables:

- `businesses`
- `profiles`
- `business_members`
- `inventory_locations`
- `financial_accounts`
- `audit_logs`

Public function:

- `create_business_foundation(business_name, business_timezone)`

Private RLS helpers:

- `private.is_business_member`
- `private.is_business_admin`
- `private.can_view_profile`

## API routes and server actions

- `GET /api/health/supabase` remains the Supabase connectivity probe.
- No new Next.js server actions.
- The database bootstrap operation is exposed through a typed Supabase RPC.

## Security decisions

- The `anon` role receives no foundation-table privileges.
- Every exposed public table has RLS enabled.
- Members can read data only for active memberships in their own businesses.
- Only active administrators can create or modify memberships.
- Employees cannot promote themselves or read audit logs.
- RLS helpers are `SECURITY DEFINER`, use an empty search path, and live outside
  exposed API schemas to avoid recursive membership policies.
- Direct authenticated business creation and audit-log writes are denied. The
  bootstrap RPC performs those related writes atomically.
- The service-role key remains isolated in server-only modules.

## Tests added

- 42 pgTAP database tests covering schema objects, enums, foreign keys, indexes,
  RLS, bootstrap defaults, tenant isolation, profile visibility, membership
  management, employee self-promotion prevention, and audit restrictions.
- Static migration regression tests for required tables, RLS, private helpers,
  anonymous grants, uniqueness, and bootstrap records.
- Type-level/runtime tests for generated table and enum types.

## Verification

- Clean local `supabase db reset` applies the migration and seed file.
- `supabase db lint --local --level warning` reports no schema errors.
- `supabase test db` passes: 1 SQL file and 42 tests.
- `npm run db:types` regenerates formatted types from the local schema.
- `npm run format:check` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run test:e2e` passes in desktop and mobile Chromium profiles.
- `npm run build` succeeds.

## Unresolved issues

- The migration has not been applied to a remote Supabase project because
  remote project credentials and linking were not provided.
- The local machine runs Node.js 22.10.0. The installed ESLint dependency
  declares support for Node.js 22.13.0 or newer on the Node 22 line.
- `npm audit` reports two moderate dependency issues. Do not apply a breaking
  forced upgrade without reviewing the advisories.
- Login screens, protected application routes, role-aware navigation, and user
  management are intentionally deferred to Step 3.

## Next recommended step

Step 3 - Implement authentication, protected routes, server-loaded profile and
business context, role-aware navigation, and administrator-only user
management.
