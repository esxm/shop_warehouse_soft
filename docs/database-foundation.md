# Database Foundation

Step 2 creates the tenant, user, location, account, and audit foundation. The
source of truth is
`supabase/migrations/20260629000100_database_foundation.sql`.

## Tables

| Table                 | Purpose                             | Important constraints                                 |
| --------------------- | ----------------------------------- | ----------------------------------------------------- |
| `businesses`          | Tenant record                       | UUID key, RON base currency, valid bootstrap timezone |
| `profiles`            | Supabase Auth user metadata         | One-to-one with `auth.users`                          |
| `business_members`    | User role inside a business         | Composite unique key, `admin` or `employee`           |
| `inventory_locations` | Phase 1 value locations             | One warehouse and one shop per business               |
| `financial_accounts`  | Phase 1 money accounts              | One RON cash and one RON bank account per business    |
| `audit_logs`          | Immutable action history foundation | Actor, entity, before/after data, reason, timestamp   |

All timestamps use `timestamptz`. All public tables have RLS enabled and explicit
privileges. The `anon` role has no table access.

## Tenant and role enforcement

Membership checks run through `SECURITY DEFINER` helpers in the unexposed
`private` schema. The functions use an empty `search_path`, and their execute
permission is limited to authenticated and service roles. This avoids recursive
RLS on `business_members`.

| Resource           | Employee/member                     | Administrator                              |
| ------------------ | ----------------------------------- | ------------------------------------------ |
| Business           | Read own business                   | Read and update own business               |
| Profiles           | Read active co-members; update self | Same                                       |
| Members            | Read own business                   | Add, update, deactivate, or remove members |
| Locations/accounts | Read own business                   | Add or update                              |
| Audit logs         | No access                           | Read own business                          |

There are no direct client policies for creating businesses or writing audit
logs.

## Initial business bootstrap

After creating and signing in as the first Supabase Auth user, call:

```ts
const supabase = await createServerSupabaseClient();

const { data: businessId, error } = await supabase.rpc(
  "create_business_foundation",
  {
    business_name: "Your Business Name",
    business_timezone: "Europe/Bucharest",
  },
);
```

The security-definer RPC uses the authenticated user's ID and atomically
creates:

- the business in RON;
- the caller's administrator membership;
- one warehouse and one shop;
- one cash-register account and one bank account in RON;
- one audit record.

Invalid names, invalid PostgreSQL timezone names, unauthenticated calls, or any
failed insert roll back the complete operation.

## Local verification

Docker Desktop must be running:

```bash
npm run db:start:test
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
```

`db:start:test` starts only the database container required by migrations,
linting, pgTAP, and type generation. Use `npm run db:start` only when the full
local API, Auth, Studio, Storage, and Realtime stack is needed.

`db:test` runs the pgTAP suite in `supabase/tests`. It verifies table and index
existence, RLS enablement, default bootstrap data, tenant isolation, admin
membership management, employee self-promotion prevention, profile visibility,
and audit-log restrictions.

`db:types` regenerates `lib/db/database.types.ts` from the local schema. Review
and commit type changes with the migration.

Stop the local stack when finished:

```bash
npm run db:stop
```

For a remote project, review migration history and use `supabase db push
--dry-run` before applying the migration. Never edit the remote schema outside
the migration workflow.
