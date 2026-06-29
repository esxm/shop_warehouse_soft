# Project State

## Current milestone

Step 1 - Supabase connection and environment handling.

## Completed work

- Initialized Next.js 16 App Router with strict TypeScript and Tailwind CSS.
- Configured ESLint, Prettier, Vitest, React Testing Library, and Playwright.
- Installed `@supabase/ssr` and `@supabase/supabase-js`.
- Added separate browser, request-scoped server, and privileged admin Supabase
  clients.
- Added Next.js 16 `proxy.ts` session refresh using `auth.getClaims()`.
- Added startup validation for public Supabase settings and the server-only
  service-role key.
- Added a redacted, non-cacheable Supabase Auth health route.
- Documented Supabase project creation, key handling, health verification,
  local development, and migration deployment.

## Schema changes

None. Step 1 does not create business tables or database migrations.

## API routes and server actions

- `GET /api/health/supabase` probes the Supabase Auth health endpoint.
  - Returns HTTP 200 with `status: "ok"` when reachable.
  - Returns HTTP 503 with `status: "unavailable"` on failure.
  - Does not return upstream details, versions, URLs, or credentials.
- No server actions.

## Security decisions

- Browser code receives only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The service-role value and privileged client are in modules marked
  `server-only`.
- The admin client disables browser-style session persistence and token
  refresh.
- Session refresh uses `auth.getClaims()`, not an unverified server-side
  `getSession()` result.
- Refreshed auth responses preserve cookies and Supabase's no-cache headers.
- The session proxy is not treated as authorization; server permission checks
  remain required in Step 3.

## Tests added

- Public and server environment validation, including missing-variable startup
  failure and secret-redaction behavior.
- Browser client credential-boundary test.
- Static guards against service-role access from browser modules.
- Session proxy matcher coverage for application and static-asset paths.
- Supabase health success, unavailable, and timeout behavior.
- Desktop and mobile end-to-end coverage for the redacted health response.

## Verification

- `npm run format:check` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes: 7 files and 20 tests.
- `npm run test:e2e` passes: 4 desktop/mobile Chromium tests.
- `npm run build` produces the application, session proxy, and dynamic health
  route successfully.
- The configured service-role test value is absent from `.next/static` browser
  assets.

## Unresolved issues

- Live Supabase connectivity was not tested because production project
  credentials were not provided. The ignored `.env.local` uses safe local
  placeholders; the health route correctly returns a redacted 503 until a local
  stack runs or real credentials are configured.
- The local machine runs Node.js 22.10.0. The installed ESLint dependency
  declares support for Node.js 22.13.0 or newer on the Node 22 line.
- `npm audit` reports two moderate issues in the dependency tree. Do not apply a
  breaking forced upgrade without reviewing the advisories.
- Authentication screens, protected routes, roles, business schema, and RLS are
  intentionally not implemented yet.

## Next recommended step

Step 2 - Create the database foundation for businesses, profiles, memberships,
inventory locations, financial accounts, and audit logs with tenant-isolated
Row Level Security.
