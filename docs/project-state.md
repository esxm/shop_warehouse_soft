# Project State

## Current milestone

Step 0 - Project foundation.

## Completed work

- Initialized Next.js 16 App Router with React, TypeScript, and Tailwind CSS.
- Enabled strict TypeScript and configured ESLint plus Prettier.
- Added Zod-based environment parsing with local-safe defaults.
- Added Vitest, React Testing Library, and Playwright configuration.
- Added a responsive application shell with placeholder navigation.
- Established the planned source, migration, test, and documentation folders.

## Schema changes

None. Database work begins after Supabase configuration.

## API routes and server actions

None.

## Tests added

- Unit coverage for environment parsing and malformed configuration.
- Component coverage for the application shell and navigation.
- Playwright smoke coverage for the home page.

## Verification

- `npm run format:check` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes: 2 files and 3 tests.
- `npm run test:e2e` passes in desktop and mobile Chromium profiles.
- `npm run build` produces the static home page successfully.

## Unresolved issues

- The local machine currently runs Node.js 22.10.0. The installed ESLint
  dependency declares support for Node.js 22.13.0 or newer on the Node 22 line.
  Upgrade before relying on this machine for repeatable CI-equivalent checks.
- Supabase connectivity, authentication, schema, RLS, and business workflows
  are intentionally not implemented.
- `npm audit` reports two moderate issues in the generated dependency tree;
  assess them during the security and dependency review without applying a
  breaking forced upgrade blindly.

## Next recommended step

Step 1 - Configure Supabase clients, authenticated-session middleware,
server-only secret handling, connectivity health check, and typed Supabase
environment variables.
