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

Step 1 configures connectivity and cookie-based session refresh. Authentication
screens, authorization, database schema, and business transactions are added in
later steps.

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

React components must not implement financial invariants. Services and database
transactions enforce them, while RLS provides a second authorization boundary.

## Security model

Public browser modules use only the project URL and public key. The privileged
client and service-role environment value are isolated behind `server-only`.
Every future write will validate input with Zod, authorize on the server, and
remain constrained by RLS. Hiding a navigation item is not authorization.

Next.js 16 `proxy.ts` creates a request-scoped Supabase server client and calls
`auth.getClaims()` to verify or refresh a present session. The proxy propagates
all refreshed cookies and required no-cache headers. Route authorization does
not rely on the proxy and will be implemented server-side in Step 3.

Client usage is separated by runtime:

- Browser components use `lib/db/browser.ts`.
- Server Components, actions, and route handlers use `lib/db/server.ts`.
- Explicitly authorized administrative operations may use `lib/db/admin.ts`.
  That client bypasses RLS, so importing it is restricted to server code.

## Data and money

PostgreSQL `numeric` will store monetary values. Application code will pass
decimal strings through dedicated helpers rather than use JavaScript `number`
arithmetic. Cash, bank, receivable, payable, and inventory totals will be
derived from immutable entries and allocations.

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
