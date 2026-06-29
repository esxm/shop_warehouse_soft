# Architecture

## System shape

The application is a single Next.js App Router deployment written in strict
TypeScript. React and Tailwind CSS provide the interface. Later steps will add
Supabase PostgreSQL and Auth through `@supabase/ssr` and
`@supabase/supabase-js`.

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

No database, authentication, or business transaction code exists in Step 0.

## Boundaries

- `app/` owns routes, layouts, loading/error states, and route composition.
- `components/` owns reusable presentation components.
- `lib/validation/` owns shared Zod schemas.
- `lib/auth/` owns reusable authentication and permission checks.
- `lib/db/` owns Supabase clients and generated database types.
- `lib/money/` owns decimal-safe parsing, arithmetic, and formatting.
- `services/` coordinates authorized business operations.
- `supabase/migrations/` is the source of truth for schema, constraints, RLS,
  and database functions.

React components must not implement financial invariants. Services and database
transactions enforce them, while RLS provides a second authorization boundary.

## Security model

Public browser modules may use only Supabase public credentials. Privileged
credentials stay in server-only modules. Every write will validate input with
Zod, authorize on the server, and remain constrained by RLS. Hiding a navigation
item is not authorization.

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

Every implementation step must pass lint, strict type checking, unit tests,
relevant end-to-end tests, and a production build before it is complete.
