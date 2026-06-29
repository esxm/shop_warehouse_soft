# Shop & Warehouse Management System

A responsive financial-control and inventory-value application for a small shop
and warehouse. The project is being delivered incrementally; Step 0 contains
only the application and test foundation.

## Prerequisites

- Node.js 20.19+, 22.13+, or 24+
- npm 10+
- Git

The Node.js ranges match the current linting toolchain. No database is needed
until the Supabase connection is introduced in Step 1.

## Local setup

```bash
git clone <repository-url>
cd shop-warehouse-soft
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On macOS or Linux, replace the `copy` command with:

```bash
cp .env.example .env.local
```

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
lib/money/              Decimal-safe money utilities
lib/validation/         Shared Zod schemas
services/               Server-side application services
supabase/migrations/    Ordered PostgreSQL migrations
tests/unit/             Vitest and Testing Library tests
tests/e2e/              Playwright tests
docs/                   Architecture, rules, and delivery status
```

## Delivery rules

Work follows
[`shop_warehouse_codex_implementation_plan.md`](./shop_warehouse_codex_implementation_plan.md).
Only one implementation step should be completed and verified at a time.
