# Shop & Warehouse Management System

A responsive financial-control and inventory-value application for a small shop
and warehouse. The project is delivered incrementally. Steps 0-3 provide the
application foundation, Supabase connectivity, tenant database foundation, and
authenticated role-aware access.

## Prerequisites

- Node.js 20.19+, 22.13+, or 24+
- npm 10+
- Git

The Node.js ranges match the current linting toolchain. A Supabase project is
required for live connectivity.

## Local setup

```bash
git clone <repository-url>
cd shop-warehouse-soft
npm install
copy .env.example .env.local
npm run dev
```

Replace every Supabase placeholder in `.env.local` before starting the app.
Missing variables stop startup with a validation error.

Open [http://localhost:3000](http://localhost:3000).

On macOS or Linux, replace the `copy` command with:

```bash
cp .env.example .env.local
```

See [docs/supabase.md](./docs/supabase.md) for project creation, key handling,
connectivity checks, migrations, Auth redirects, and employee invitations.
See [docs/security.md](./docs/security.md) for the threat model, implemented
controls, and remaining deployment risks.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run format:check
```

Install the Playwright browser once before the first end-to-end run:

```bash
npx playwright install chromium
```

## Project structure

```text
app/                    Next.js App Router pages and layouts
components/             Shared React components
lib/auth/               Authentication and authorization helpers
lib/db/                 Database clients and generated types
lib/env/                Browser-safe and server-only environment access
lib/money/              Decimal-safe money utilities
lib/validation/         Shared Zod schemas
services/               Server-side application services
supabase/migrations/    Ordered PostgreSQL migrations
tests/unit/             Vitest and Testing Library tests
tests/e2e/              Playwright tests
docs/                   Architecture, rules, and delivery status
```

## Supabase connectivity

With the development server running:

```bash
curl http://localhost:3000/api/health/supabase
```

The route returns HTTP 200 with `{"service":"supabase","status":"ok"}` when
Supabase Auth is reachable. Failures return HTTP 503 without upstream details
or credentials.

## Delivery rules

Work follows
[`shop_warehouse_codex_implementation_plan.md`](./shop_warehouse_codex_implementation_plan.md).
Only one implementation step should be completed and verified at a time.
