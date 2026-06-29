# Supabase Setup

## Create the project

1. Create a project in the
   [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **Project Settings > API Keys**.
3. Copy the project URL.
4. Copy the public `anon` key or current publishable key.
5. Copy the server-only `service_role` key or current secret key.
6. Copy `.env.example` to `.env.local` and replace all placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-server-secret"
```

The established environment names retain `ANON_KEY` and `SERVICE_ROLE_KEY` for
project compatibility. Supabase's current publishable and secret keys can be
stored under those names.

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Never prefix it with
`NEXT_PUBLIC_`, expose it in a response, log it, or import the admin client into
a Client Component. Next.js validates all three variables at startup.

## Verify connectivity

Start the application:

```bash
npm run dev
```

Request the application-owned health route:

```bash
curl http://localhost:3000/api/health/supabase
```

Expected healthy response:

```json
{ "service": "supabase", "status": "ok" }
```

The route calls Supabase Auth's `/auth/v1/health` endpoint with the public key.
It returns HTTP 503 and a generic `unavailable` status for timeouts, invalid
keys, paused projects, or network failures. It does not expose the project URL,
key, upstream body, version, or exception.

## Session handling

The browser and server clients use `@supabase/ssr`. Next.js 16 runs
`proxy.ts` for application requests to verify or refresh a present session with
`auth.getClaims()`. Static assets are excluded. The proxy does not authorize
routes; protected routes and role checks are implemented in Step 3.

## Apply migrations

Step 1 adds no database migration. Starting with Step 2, SQL files in
`supabase/migrations` are the source of truth.

Install or invoke the [Supabase CLI](https://supabase.com/docs/guides/local-development):

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Review every migration and the dry-run output before pushing. Apply migrations
in order and coordinate remote pushes so only one person deploys schema changes
at a time.

For a local Supabase stack, install Docker Desktop and run:

```bash
npx supabase init
npx supabase start
npx supabase db reset
```

Do not expose the local stack to an untrusted network.

The repository includes convenience commands:

```bash
npm run db:start
npm run db:start:test
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm run db:stop
```

Use `db:start:test` for database-only schema work. It avoids downloading and
running unrelated local Supabase services.

See [database-foundation.md](./database-foundation.md) for the Step 2 schema,
bootstrap RPC, RLS model, and database test coverage.
