# Phase 1 Release Checklist

Run this gate before deploying a business database or application build.

## Required Commands

1. `npm.cmd run lint`
2. `npm.cmd run typecheck`
3. `npm.cmd test -- --maxWorkers=1 --run tests/unit/release-gate-invariants.test.ts tests/unit/revenue-report-page.test.ts tests/unit/profit-report-page.test.ts tests/unit/cash-bank-report.test.ts tests/unit/customer-receivables-report.test.ts tests/unit/supplier-payables-report.test.ts tests/unit/dashboard-formulas.test.ts`
4. `npx.cmd supabase test db --local supabase/tests/0029_release_gate_invariants.test.sql`
5. `npm.cmd run test:e2e -- --project=chromium tests/e2e/release-gate.spec.ts`
6. `npm.cmd run test:e2e -- --project=mobile-chromium tests/e2e/release-gate.spec.ts`
7. `npm.cmd run build`

Authenticated Playwright tests require `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` for a seeded administrator.

## Financial Invariants

1. Customer payment never increases revenue.
2. Supplier payment never reduces profit as an expense.
3. Supplier purchase increases payable and inventory, not cash outflow unless paid.
4. Warehouse-to-shop transfer does not change total inventory.
5. Cash and bank balances equal ledger sums.
6. Customer outstanding equals purchases minus allocations.
7. Supplier outstanding equals purchases minus allocations.
8. Daily close cannot duplicate cash or bank inflows.
9. Reversal restores financial effects.
10. Employee cannot edit closed days.
11. Employee cannot perform admin operations.
12. Cross-business data access is blocked.
13. USD historical inventory cost does not change when current rate changes.
14. Current supplier payable estimate changes when current USD/RON rate changes.
15. Net business value does not add revenue separately.

## Data Safety

- Confirm every local migration is applied to the target Supabase project.
- Export critical CSV reports before release: revenue, receivables, payables,
  cash and bank, inventory, and profit.
- Confirm Supabase managed backups are enabled for production.
- Do not restore raw database dumps through the application UI.

## Known Limitations

- Step 28 export and scheduled-backup administration is still not implemented
  as a full admin page.
- Authenticated Playwright release checks skip unless administrator credentials
  are provided in environment variables.
- Step 30 production deployment and rollback documentation remain pending.
