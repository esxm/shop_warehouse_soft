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
routes. Protected layouts and every privileged server action load the verified
user and active business membership on the server.

## Authentication and employee invitations

Email/password authentication is enabled through Supabase Auth. Before using
the administrator's **Users** page in a remote project:

1. Set the Supabase Auth **Site URL** to the deployed application URL.
2. Add `<NEXT_PUBLIC_APP_URL>/auth/invite` to the Auth redirect allow list.
3. Configure a production SMTP provider. Supabase's development email service
   is not suitable for production delivery.
4. Ensure `NEXT_PUBLIC_APP_URL` exactly matches the public application origin.

The administrator invite action uses the server-only key to send the Auth
invitation. The authenticated `add_business_employee` RPC independently checks
the administrator role, adds only the `employee` role, and writes the audit
record in the same database transaction. If that operation fails, the newly
invited Auth user is removed as compensation.

For local Supabase, invitation messages are captured by Mailpit at
`http://127.0.0.1:54324`. The local redirect allow list is configured in
`supabase/config.toml`.

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

See [database-foundation.md](./database-foundation.md) for the foundation
schema, initial administrator bootstrap RPC, RLS model, and database test
coverage.

See [dashboard.md](./dashboard.md) for dashboard source views, net-value
formulas, and the USD/RON reference-rate model.
