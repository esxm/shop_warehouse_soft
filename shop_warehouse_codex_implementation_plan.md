# Shop & Warehouse Management System

## Incremental Codex Implementation Plan

This document breaks the project into small, testable implementation steps. Give Codex **one prompt at a time**, verify the result, commit the code, and only then continue.

Do not ask Codex to build the entire system in one prompt. This is a financial and inventory system. A partially correct implementation can silently corrupt balances, receivables, payables, or stock.

---

# 1. Project goal

Build a secure, responsive web application for a small shop and warehouse.

The application must work from:

- The shop Windows computer
- A home computer
- A phone browser
- A tablet browser

The first release focuses on financial control and inventory value tracking. Exact product quantities and automatic stock deduction come later.

---

# 2. Fixed technology decisions

Use the following stack unless there is a strong technical reason to change it:

- **Frontend and server:** Next.js with App Router
- **Language:** TypeScript
- **UI:** React and Tailwind CSS
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth
- **Authorization:** server-side permission checks plus PostgreSQL Row Level Security
- **Validation:** Zod
- **Testing:** Vitest for unit and service tests, Playwright for end-to-end tests
- **Hosting:** Vercel for the Next.js application
- **Database migrations:** Supabase SQL migrations
- **Database access:** `@supabase/ssr` and `@supabase/supabase-js`
- **Atomic multi-table operations:** PostgreSQL functions called through Supabase RPC where necessary
- **Base reporting currency:** RON
- **Interface language:** English
- **Offline support:** not included in Phase 1

Do not use Firebase, MongoDB, SQLite, Electron, or microservices for this version.

---

# 3. Confirmed business rules

## 3.1 Users and permissions

There are two roles:

### Employee

The employee can:

- Work inside the current open business day
- Enter cash sales
- Enter bank sales
- Create customer credit purchases
- Record customer payments
- Create supplier purchases
- Record supplier payments
- Enter expenses
- View all Phase 1 reports
- Close the current business day manually

The employee cannot:

- Edit a closed business day
- Backdate transactions
- Delete completed financial transactions
- Change opening balances
- Change old exchange rates
- Correct historical records directly
- Manage users

### Administrator

The administrator can:

- Perform all employee actions
- Create or modify historical business days
- Record opening balances
- Correct mistakes through reversals or adjustment entries
- Reopen a closed business day with a required reason
- Manage users
- View the audit log
- Export business data

---

## 3.2 Business days

- The employee works inside one current open business day.
- The business day is not determined only by the computer clock.
- The employee manually presses **Close Day**.
- After closing, the employee cannot add or modify transactions for that day.
- The administrator can reopen or correct an old day.
- Every reopen or correction requires a reason.
- Original records must remain traceable.

---

## 3.3 Daily revenue

Daily revenue is entered separately as:

- Cash sales
- Bank sales
- Credit sales

Formula:

```text
Total revenue = cash sales + bank sales + credit sales
```

The total credit sales for the business day must equal the total value of individual customer credit purchases recorded for that day.

Customer payments received later are **not new revenue**.

---

## 3.4 Customers who owe the business

- Every credit purchase is stored separately.
- A customer can have several unpaid purchases.
- Every customer payment is stored separately.
- Payments are allocated to the oldest unpaid purchase first by default.
- One payment can fully pay one purchase and partially pay another.
- The administrator can override the automatic allocation.
- A payment cannot allocate more than its total amount.
- A purchase cannot be overpaid.
- Customer payments increase cash or bank depending on the selected destination account.
- Customer payments do not create new revenue.

---

## 3.5 Suppliers the business owes

- There can be multiple suppliers.
- A supplier purchase can be in USD or RON.
- Goods can arrive directly in the warehouse or directly in the shop.
- Every supplier purchase is stored separately.
- One supplier payment can pay one purchase, part of one purchase, or several purchases.
- Supplier payments are allocated to the oldest unpaid purchases first by default.
- The administrator can override the allocation.
- A payment cannot allocate more than its total amount.
- A supplier purchase cannot be overpaid.

### USD rules

For a USD purchase, store:

- Original USD amount
- Purchase exchange rate entered manually
- Historical RON inventory cost
- Remaining USD amount

Formula:

```text
Historical inventory cost in RON =
USD purchase amount × purchase exchange rate
```

When paying later, store:

- USD amount paid
- Payment exchange rate entered manually
- Actual RON amount paid
- Currency gain or loss

Formula:

```text
Actual RON payment =
USD amount paid × payment exchange rate
```

Do not modify the original purchase exchange rate when the payment exchange rate changes.

---

## 3.6 Cash and bank

At minimum, the business has:

- Cash register account in RON
- Bank account in RON

All cash and bank changes must create immutable financial ledger entries.

Examples:

- Cash sale increases cash
- Bank sale increases bank
- Customer payment increases cash or bank
- Supplier payment decreases cash or bank
- Expense decreases cash or bank
- Opening balance creates an opening ledger entry

Do not store the current balance as a manually editable number.

Current balance must be calculated from ledger entries.

---

## 3.7 Inventory value

Phase 1 tracks inventory **value at historical cost**, not exact product quantities.

Locations:

- Warehouse
- Shop

Goods received increase the selected location’s inventory value.

A warehouse-to-shop transfer:

- Decreases warehouse inventory value
- Increases shop inventory value
- Does not change total inventory value

Periodic stocktakes are entered by the administrator.

The application must preserve stocktake history instead of overwriting previous values.

---

## 3.8 Expenses

Expenses are normally entered monthly but may be recorded on any date.

Suggested categories:

- Rent
- Electricity
- Transport
- Salary
- Internet
- Taxes and fees
- Maintenance
- Other

Each expense must specify whether it was paid from cash or bank.

---

## 3.9 Business position

Formula:

```text
Net business value =
Warehouse inventory at historical cost
+ Shop inventory at historical cost
+ Cash
+ Bank
+ Customer receivables
- Supplier payables converted to RON
```

Revenue must not be added separately to this formula because it is already represented by cash, bank, or customer receivables.

Outstanding USD supplier payables should use a manually entered current USD/RON exchange rate for the current estimated RON value.

---

## 3.10 Phase 1 reports

Phase 1 must include:

1. Daily and monthly revenue
2. Customers who owe the business
3. Suppliers the business owes
4. Cash and bank
5. Business position

Both employee and administrator can view these reports.

---

## 3.11 Records are immutable

Do not silently update or delete completed financial records.

Corrections must use one of these approaches:

- Reversal entry plus replacement entry
- Linked adjustment entry
- Reopen business day with an audit reason, while preserving history

Every important action must record:

- User
- Date and time
- Action
- Entity type
- Entity identifier
- Previous value when relevant
- New value when relevant
- Reason when required

---

# 4. Scope boundaries

## Phase 1 includes

- Authentication
- Roles and permissions
- Opening balances
- Business days
- Daily revenue
- Customers
- Customer credit purchases
- Customer payments
- Suppliers
- Supplier purchases
- Supplier payments
- USD exchange-rate handling
- Cash and bank ledger
- Expenses
- Warehouse and shop inventory values
- Value transfers
- Inventory stocktakes
- Audit log
- Required reports
- Responsive desktop and mobile interface
- Basic export and backup support

## Phase 1 does not include

- Fiscal receipts
- Official invoices
- Native Android or iOS application
- Offline synchronization
- Product barcodes
- Exact product quantities
- Automatic deduction of sold products
- Product returns
- Refunds
- Damaged products
- Theft and missing stock
- Customer loyalty
- Artificial intelligence
- Microservices

---

# 5. How to use the Codex prompts

For every step:

1. Give Codex the global prompt below.
2. Add the specific step prompt.
3. Let Codex inspect the existing repository.
4. Review every migration and important financial formula.
5. Run all tests.
6. Test manually.
7. Commit the step.
8. Continue only after the acceptance criteria pass.

Recommended Git workflow:

```bash
git checkout -b feature/step-name
# Let Codex implement the step.
npm run lint
npm run typecheck
npm test
npm run test:e2e
git add .
git commit -m "Implement step name"
git checkout main
git merge feature/step-name
```

---

# 6. Global prompt to include before every Codex task

Copy this before each individual prompt:

```text
You are working on an existing shop and warehouse management system.

Technology:
- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Zod
- Vitest
- Playwright
- Supabase SQL migrations

Important rules:
1. Inspect the existing repository before changing anything.
2. Implement only the requested step.
3. Do not rewrite unrelated completed features.
4. Do not silently change established business rules.
5. Use strict TypeScript. Do not use `any` unless unavoidable and documented.
6. Validate all external input with Zod.
7. Perform authorization checks on the server.
8. Never expose the Supabase service-role key to the browser.
9. Use PostgreSQL transactions or database RPC functions for multi-table financial operations.
10. Do not directly edit stored balances. Use immutable ledger entries.
11. Completed financial records must not be silently deleted or overwritten.
12. Use decimal-safe database types for money. Never use JavaScript floating-point arithmetic for financial calculations.
13. Store monetary amounts as PostgreSQL `numeric`, and convert through safe decimal helpers.
14. Add database constraints, indexes, RLS policies, and tests.
15. Add loading, empty, success, and error states to the UI.
16. Keep desktop and mobile layouts usable.
17. Add or update documentation after implementation.
18. Update `docs/project-state.md` with:
   - completed work
   - schema changes
   - API or server actions
   - tests added
   - unresolved issues
   - next recommended step
19. Run linting, type checking, unit tests, and relevant end-to-end tests.
20. At the end, report:
   - files changed
   - migrations added
   - security decisions
   - tests run
   - manual verification steps
   - remaining risks

Do not claim the task is complete if tests fail or if required acceptance criteria are missing.
```

---

# 7. Implementation steps

---

## Step 0 — Create the project repository and project-state documentation

### Goal

Create a clean Next.js TypeScript project and establish project conventions before implementing features.

### Codex prompt

```text
Initialize the project foundation for a responsive shop and warehouse management application.

Requirements:
- Use the latest stable Next.js version with App Router and TypeScript.
- Configure Tailwind CSS.
- Configure ESLint and Prettier.
- Configure strict TypeScript.
- Add Vitest and React Testing Library.
- Add Playwright.
- Create environment variable validation.
- Add a clear folder structure:
  - app
  - components
  - lib
  - lib/auth
  - lib/db
  - lib/validation
  - lib/money
  - services
  - supabase/migrations
  - tests
  - docs
- Create `docs/project-state.md`.
- Create `docs/business-rules.md` containing the confirmed Phase 1 business rules.
- Create `docs/architecture.md`.
- Add npm scripts for:
  - dev
  - build
  - lint
  - typecheck
  - test
  - test:e2e
- Add a basic responsive application shell with placeholder navigation.
- Do not implement business features yet.
- Add a README with local setup instructions.
```

### Acceptance criteria

- Application starts locally
- TypeScript strict mode is enabled
- Linting passes
- Unit-test command runs
- Playwright command is configured
- Documentation files exist
- No business logic has been invented

---

## Step 1 — Configure Supabase and environment handling

### Goal

Connect the application to Supabase safely.

### Codex prompt

```text
Configure Supabase for the existing Next.js application.

Requirements:
- Install and configure `@supabase/ssr` and `@supabase/supabase-js`.
- Create separate browser and server Supabase client helpers.
- Configure middleware for authenticated sessions.
- Add typed environment validation for:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
- The service-role key must only be available to server-only modules.
- Add `.env.example`.
- Add a health-check page or server route that verifies the application can reach Supabase without exposing secrets.
- Document how to create the Supabase project and apply migrations.
- Do not create business tables yet.
- Add tests for environment validation.
```

### Acceptance criteria

- Browser client uses only public credentials
- Server-only code cannot be bundled into the browser
- Missing environment variables produce a clear startup error
- Supabase connectivity can be verified
- Secrets are not logged

---

## Step 2 — Create the database foundation

### Goal

Create the organization, profile, role, location, account, and audit foundations.

### Recommended tables

- `businesses`
- `profiles`
- `business_members`
- `inventory_locations`
- `financial_accounts`
- `audit_logs`

### Codex prompt

```text
Create the initial Supabase PostgreSQL schema.

Implement these tables:

1. `businesses`
   - id UUID primary key
   - name
   - base_currency fixed to RON for Phase 1
   - timezone
   - created_at
   - created_by

2. `profiles`
   - id UUID primary key referencing auth.users
   - full_name
   - created_at
   - updated_at

3. `business_members`
   - business_id
   - user_id
   - role enum: admin or employee
   - is_active
   - created_at
   - unique business_id + user_id

4. `inventory_locations`
   - id
   - business_id
   - name
   - type enum: warehouse or shop
   - is_active
   - created_at
   - unique business_id + type for Phase 1

5. `financial_accounts`
   - id
   - business_id
   - name
   - type enum: cash or bank
   - currency fixed to RON
   - is_active
   - created_at
   - unique business_id + type for Phase 1

6. `audit_logs`
   - id
   - business_id
   - actor_user_id
   - action
   - entity_type
   - entity_id nullable
   - previous_data JSONB nullable
   - new_data JSONB nullable
   - reason nullable
   - created_at

Requirements:
- Use UUID primary keys.
- Use timestamptz.
- Add foreign keys and useful indexes.
- Enable RLS on every table.
- Add baseline RLS policies so users can only access businesses they belong to.
- Only admins can manage members.
- Create helper SQL functions for checking membership and role without recursive RLS problems.
- Seed or document creation of one business, one warehouse, one shop, one cash account, and one bank account.
- Add migration tests or SQL verification instructions.
- Generate TypeScript database types.
```

### Acceptance criteria

- Users cannot read another business’s data
- Employee cannot promote themselves
- Admin can manage membership
- Warehouse, shop, cash, and bank exist
- RLS is enabled everywhere
- Foreign keys and indexes exist

---

## Step 3 — Implement authentication and role-aware navigation

### Goal

Allow secure login and role-aware application access.

### Codex prompt

```text
Implement authentication and role-aware navigation.

Requirements:
- Email and password login using Supabase Auth.
- Logout.
- Protected application routes.
- Redirect unauthenticated users to login.
- Load the current profile, business, and role on the server.
- Show the signed-in user and role in the application shell.
- Create navigation placeholders for:
  - Dashboard
  - Daily Sales
  - Customers
  - Suppliers
  - Cash and Bank
  - Inventory Value
  - Expenses
  - Reports
  - Audit Log
  - Users
- Hide Users and Audit Log from employee navigation.
- Hiding links is not authorization; enforce permissions server-side.
- Add an admin-only user management screen to invite or create employees if practical with Supabase Auth.
- Add tests for protected routes and role checks.
```

### Acceptance criteria

- Unauthenticated users cannot access protected pages
- Employee cannot access admin pages by URL
- Admin and employee see correct navigation
- Session persists after refresh
- Logout works

---

## Step 4 — Build shared money, date, and permission utilities

### Goal

Prevent financial calculation mistakes before financial features are added.

### Codex prompt

```text
Implement shared utilities for money, dates, and permissions.

Requirements:
- Use PostgreSQL numeric for all monetary values.
- Add a safe decimal library such as `decimal.js`.
- Create helpers for:
  - parsing money input
  - formatting RON
  - formatting USD
  - adding and subtracting monetary values safely
  - validating positive monetary amounts
  - converting USD to RON using a supplied exchange rate
- Never calculate money using raw JavaScript floating point.
- Create timezone-safe date helpers using the business timezone.
- Create reusable server permission helpers:
  - requireAuthenticatedUser
  - requireBusinessMember
  - requireAdmin
  - requireOpenBusinessDay
- Add comprehensive unit tests.
```

### Acceptance criteria

- `0.1 + 0.2` style errors cannot affect money
- Invalid or negative input is rejected where inappropriate
- Dates use the configured business timezone
- Permission helpers fail securely

---

## Step 5 — Implement opening balances

### Goal

Allow the administrator to initialize the business without directly editing balances.

### Required opening data

- Cash balance in RON
- Bank balance in RON
- Warehouse inventory value in RON
- Shop inventory value in RON
- Existing customer receivables
- Existing supplier payables in RON or USD

### Codex prompt

```text
Implement administrator-only opening balance setup.

Create schema and logic for:
- opening balance batch
- financial account opening entries
- inventory value opening movements
- opening customer credit purchases
- opening supplier purchases

Requirements:
- Opening balances must be represented by immutable transactions, not editable balance columns.
- The setup wizard must support:
  - opening date
  - cash balance
  - bank balance
  - warehouse inventory value
  - shop inventory value
  - zero or more customer opening receivables
  - zero or more supplier opening payables
- Customer opening receivables must identify the customer and amount.
- Supplier opening payables must identify supplier, currency, amount, and historical exchange rate when USD.
- The entire opening setup must run atomically.
- Prevent accidental second opening setup for the same business.
- Allow correction only through an admin reversal workflow, not direct edits.
- Add audit records.
- Add tests for successful setup, duplicate prevention, invalid amounts, and rollback on partial failure.
```

### Acceptance criteria

- Opening setup creates all required ledgers
- A failure creates no partial opening data
- Employee cannot run setup
- Duplicate opening initialization is blocked
- Opening balances appear in later calculated balances

---

## Step 6 — Implement business days

### Goal

Create the open/close workflow that controls employee transaction dates.

### Codex prompt

```text
Implement business-day management.

Schema:
- business_days
  - id
  - business_id
  - business_date
  - status: open or closed
  - opened_at
  - opened_by
  - closed_at nullable
  - closed_by nullable
  - reopen_reason nullable
  - created_at
- Enforce only one open business day per business.

Features:
- Admin can create the first business day.
- Employee and admin can view the current open business day.
- Employee can only create operational transactions for the current open day.
- Closing is manual.
- Close Day requires a confirmation screen.
- A closed day becomes immutable for employees.
- Admin can reopen a closed day with a mandatory reason.
- Reopening creates an audit entry.
- Avoid relying only on the computer calendar date.
- Add concurrency protection so two close requests cannot both succeed.
- Add tests for open, close, reopen, duplicate open-day prevention, and employee restrictions.
```

### Acceptance criteria

- Only one open day exists
- Employee cannot backdate
- Employee cannot write to closed day
- Admin reopen requires reason
- Concurrent close requests remain consistent

---

## Step 7 — Implement customer management

### Goal

Create customer records before adding receivables.

### Codex prompt

```text
Implement customer management.

Schema:
- customers
  - id
  - business_id
  - name
  - phone nullable
  - notes nullable
  - is_active
  - created_at
  - created_by
  - updated_at

Features:
- Customer list with search.
- Add customer.
- View customer details.
- Edit basic customer information.
- Deactivate instead of delete.
- Prevent duplicate obvious records where practical, but do not block legitimate same-name customers.
- Employees and admins can create and view customers.
- Only admins can deactivate customers.
- Add server-side validation and authorization.
- Add RLS.
- Add tests.
```

### Acceptance criteria

- Customers are business-scoped
- Search works
- Deactivation preserves history
- Employee cannot hard-delete records

---

## Step 8 — Implement customer credit purchases

### Goal

Record every customer credit purchase separately.

### Codex prompt

```text
Implement customer credit purchases.

Schema:
- customer_credit_purchases
  - id
  - business_id
  - business_day_id
  - customer_id
  - purchase_date
  - amount_ron numeric
  - description nullable
  - due_date nullable
  - status derived or maintained safely
  - created_by
  - created_at
  - reversal_of_id nullable
  - reversed_at nullable
  - reversed_by nullable
  - reversal_reason nullable

Requirements:
- Employee can create credit purchases only for the current open business day.
- Admin can create historical entries with an audit reason.
- Amount must be greater than zero.
- Every purchase is immutable after creation.
- Mistakes are corrected through reversal plus replacement.
- Add a customer detail page showing purchases and remaining balances.
- Do not store an unsafe manually editable remaining balance.
- Remaining balance must come from purchase amount minus payment allocations.
- Add a database view or safe query for outstanding balances.
- Add tests for authorization, closed-day restrictions, and balance calculations.
```

### Acceptance criteria

- Every purchase is separate
- Remaining balances are mathematically correct
- Reversal preserves history
- Employee cannot backdate or edit closed records

---

## Step 9 — Implement customer payments and oldest-first allocation

### Goal

Record customer payments without counting them as new revenue.

### Codex prompt

```text
Implement customer payments and payment allocations.

Schema:
- customer_payments
  - id
  - business_id
  - business_day_id
  - customer_id
  - payment_date
  - amount_ron
  - financial_account_id
  - notes nullable
  - created_by
  - created_at
  - reversal_of_id nullable

- customer_payment_allocations
  - id
  - payment_id
  - customer_credit_purchase_id
  - amount_ron
  - created_at
  - unique payment_id + purchase_id

Requirements:
- Implement a PostgreSQL transaction function that:
  1. validates the user and open business day
  2. validates the account belongs to the business
  3. creates the payment
  4. allocates it to the oldest unpaid customer purchases first
  5. creates the related cash or bank ledger entry
  6. writes the audit entry
- Allow admin manual allocation override.
- Prevent over-allocation.
- Prevent overpayment unless an explicit future customer-credit balance feature is designed. For Phase 1, reject payment above outstanding balance.
- Customer payment must not create revenue.
- Reversal must reverse allocations and the account ledger entry atomically.
- Add unit, database, and end-to-end tests.
```

### Acceptance criteria

- Oldest debt is paid first
- Partial payments work
- One payment can cover multiple purchases
- Account balance increases exactly once
- Revenue does not increase
- Duplicate submissions do not create duplicate payments
- Reversal restores balances

---

## Step 10 — Implement supplier management

### Goal

Create supplier records.

### Codex prompt

```text
Implement supplier management.

Schema:
- suppliers
  - id
  - business_id
  - name
  - phone nullable
  - notes nullable
  - default_currency nullable: USD or RON
  - is_active
  - created_at
  - created_by
  - updated_at

Features:
- Supplier list with search.
- Add supplier.
- View supplier details.
- Edit contact information.
- Deactivate instead of delete.
- Employees and admins can create and view suppliers.
- Only admins can deactivate suppliers.
- Add server validation, RLS, and tests.
```

### Acceptance criteria

- Suppliers are scoped to the business
- Historical purchases survive deactivation
- No hard deletion

---

## Step 11 — Implement supplier purchases and inventory-value receipt

### Goal

Record goods received from suppliers in USD or RON and increase inventory value.

### Codex prompt

```text
Implement supplier purchases.

Schema:
- supplier_purchases
  - id
  - business_id
  - business_day_id
  - supplier_id
  - purchase_date
  - currency: USD or RON
  - original_amount numeric
  - purchase_exchange_rate numeric nullable
  - inventory_cost_ron numeric
  - destination_location_id
  - description nullable
  - due_date nullable
  - created_by
  - created_at
  - reversal_of_id nullable

- inventory_value_movements
  - id
  - business_id
  - business_day_id nullable
  - movement_date
  - movement_type
  - source_location_id nullable
  - destination_location_id nullable
  - amount_ron numeric
  - source_entity_type
  - source_entity_id
  - created_by
  - created_at
  - reversal_of_id nullable

Rules:
- For USD:
  inventory_cost_ron = original_amount × purchase_exchange_rate
- For RON:
  inventory_cost_ron = original_amount
- Purchase exchange rate is entered manually.
- Goods may enter warehouse or shop.
- Creating a supplier purchase must atomically:
  1. create the purchase
  2. create inventory-value inflow
  3. create the audit record
- Do not create a cash or bank outflow unless an immediate payment is explicitly recorded.
- Purchases are immutable; correction uses reversal.
- Add tests for USD conversion, RON purchase, destination location, rollback, and authorization.
```

### Acceptance criteria

- Inventory value increases correctly
- Supplier payable increases
- No cash is reduced unless payment occurs
- USD historical RON cost remains fixed
- Reversal removes the payable and inventory effect safely

---

## Step 12 — Implement supplier payments and allocation

### Goal

Record supplier payments in USD or RON and calculate currency gain or loss.

### Codex prompt

```text
Implement supplier payments and allocations.

Schema:
- supplier_payments
  - id
  - business_id
  - business_day_id
  - supplier_id
  - payment_date
  - currency: USD or RON
  - original_amount_paid numeric
  - payment_exchange_rate numeric nullable
  - actual_amount_ron numeric
  - financial_account_id
  - currency_gain_loss_ron numeric
  - notes nullable
  - created_by
  - created_at
  - reversal_of_id nullable

- supplier_payment_allocations
  - id
  - supplier_payment_id
  - supplier_purchase_id
  - allocated_original_amount numeric
  - historical_ron_value numeric
  - actual_ron_value numeric
  - currency_gain_loss_ron numeric
  - created_at
  - unique supplier_payment_id + supplier_purchase_id

Requirements:
- Payment currency must match allocated purchases.
- Allocate oldest unpaid supplier purchases first by default.
- Allow admin manual override.
- One payment may cover several purchases or part of one purchase.
- For USD allocations:
  - historical_ron_value = allocated USD × purchase exchange rate
  - actual_ron_value = allocated USD × payment exchange rate
  - gain/loss = actual value - historical value
- For RON, exchange rate is not required and gain/loss is zero.
- Perform creation, allocation, account outflow, and audit atomically in PostgreSQL.
- Reject overpayment.
- Reversal restores payable and account balance.
- Add strong tests for partial, multi-purchase, mixed exchange rates, overpayment, duplicate submission, and rollback.
```

### Acceptance criteria

- Oldest purchases are allocated first
- Half-payments work
- One payment can cover multiple purchases
- Cash or bank decreases exactly once
- Currency gain/loss is correct
- Overpayment is blocked
- Reversal works atomically

---

## Step 13 — Implement financial account ledger

### Goal

Make cash and bank balances fully traceable.

### Codex prompt

```text
Implement the immutable financial account ledger.

Schema:
- financial_account_entries
  - id
  - business_id
  - financial_account_id
  - business_day_id nullable
  - entry_date
  - direction: inflow or outflow
  - amount_ron numeric
  - entry_type
  - source_entity_type
  - source_entity_id
  - description nullable
  - created_by
  - created_at
  - reversal_of_id nullable
  - idempotency_key nullable unique within business

Requirements:
- Current account balance is calculated from entries.
- Do not create an editable balance column.
- Add database views or safe queries for:
  - current balance
  - account transaction history
  - daily inflows and outflows
- Only approved business services or database functions may create entries.
- Direct browser inserts must be blocked by RLS.
- Add indexes for account, date, and source.
- Add tests proving that balances are derived correctly and duplicate idempotency keys are rejected.
```

### Acceptance criteria

- Cash and bank balances are derived, not manually stored
- Every movement links to a source
- Duplicate financial effects are blocked
- Browser cannot bypass services to add arbitrary entries

---

## Step 14 — Implement daily sales draft and closing

### Goal

Record daily revenue and create cash/bank inflows only once.

### Codex prompt

```text
Implement daily sales entry and business-day closing.

Schema:
- daily_sales
  - id
  - business_id
  - business_day_id unique
  - cash_sales_ron numeric
  - bank_sales_ron numeric
  - credit_sales_ron numeric
  - total_sales_ron numeric
  - status: draft or closed
  - notes nullable
  - created_by
  - created_at
  - closed_at nullable
  - closed_by nullable

Rules:
- total_sales_ron = cash + bank + credit.
- Credit sales must equal the sum of non-reversed customer credit purchases for that business day.
- Employee can edit the draft while the business day is open.
- Closing must be atomic:
  1. revalidate credit-sales equality
  2. create one cash ledger inflow
  3. create one bank ledger inflow
  4. mark daily sales closed
  5. close the business day
  6. create audit records
- Credit sales do not create account ledger inflows.
- Duplicate close requests must not duplicate cash or bank inflows.
- Closed sales cannot be edited by employee.
- Admin corrections must use reversal and replacement or a documented reopen workflow.
- Add end-to-end tests for daily closing.
```

### Acceptance criteria

- Daily totals calculate correctly
- Credit mismatch blocks closing
- Cash and bank are increased once
- Double-clicking Close Day cannot duplicate money
- Closed day is locked

---

## Step 15 — Implement expenses

### Goal

Record expenses and reduce cash or bank.

### Codex prompt

```text
Implement expense tracking.

Schema:
- expense_categories
- expenses
  - id
  - business_id
  - business_day_id
  - expense_date
  - category_id
  - amount_ron
  - financial_account_id
  - description
  - created_by
  - created_at
  - reversal_of_id nullable

Seed categories:
- Rent
- Electricity
- Transport
- Salary
- Internet
- Taxes and fees
- Maintenance
- Other

Requirements:
- Employee can add expenses only to current open day.
- Admin can add historical expenses with an audit reason.
- Creating an expense must atomically create the financial-account outflow.
- Expense must be immutable.
- Correction uses reversal.
- Add monthly expense summary.
- Add tests for account effects, authorization, reversal, and closed-day rules.
```

### Acceptance criteria

- Expense reduces selected account once
- Category totals are correct
- Historical correction is auditable
- Employee cannot edit closed expenses

---

## Step 16 — Implement inventory-value transfers

### Goal

Move inventory cost value from warehouse to shop without changing total inventory.

### Codex prompt

```text
Implement inventory-value transfers.

Requirements:
- Create a transfer form:
  - date
  - source location
  - destination location
  - amount in RON
  - notes
- For Phase 1, only warehouse-to-shop transfers are needed.
- Amount must be greater than zero.
- Source and destination must differ.
- Transfer cannot exceed the calculated source inventory value unless admin override is explicitly designed. For Phase 1, reject it.
- Use one immutable inventory movement record with source and destination.
- Perform validation and creation atomically.
- Add a transfer history page.
- Add reversal support for admin.
- Add tests proving:
  - warehouse decreases
  - shop increases
  - total inventory does not change
  - insufficient value is rejected
```

### Acceptance criteria

- Transfer is balanced
- No total inventory change
- Source cannot go below zero
- Reversal restores both locations

---

## Step 17 — Implement inventory stocktakes and adjustments

### Goal

Allow the administrator to record actual inventory values while preserving expected values and differences.

### Codex prompt

```text
Implement inventory-value stocktakes.

Schema:
- inventory_stocktakes
  - id
  - business_id
  - stocktake_date
  - warehouse_actual_value_ron
  - shop_actual_value_ron
  - warehouse_expected_value_ron
  - shop_expected_value_ron
  - warehouse_difference_ron
  - shop_difference_ron
  - reason
  - notes nullable
  - created_by
  - created_at

Requirements:
- Admin only.
- Calculate expected values immediately before stocktake.
- Store expected, actual, and difference values.
- Create inventory adjustment movements for each difference.
- Require a reason.
- Entire operation must be atomic.
- Stocktakes are immutable.
- Corrections use reversal plus new stocktake.
- Add stocktake history and comparison UI.
- Add tests for positive and negative adjustments.
```

### Acceptance criteria

- Expected and actual values are preserved
- Adjustments affect inventory ledgers
- Reason is required
- Employee cannot create stocktakes
- History is never overwritten

---

## Step 18 — Implement the dashboard

### Goal

Show the most important current numbers without misleading the user.

### Dashboard cards

- Today’s sales
- Current month sales
- Cash
- Bank
- Customer receivables
- Supplier payables
- Warehouse inventory value
- Shop inventory value
- Net business value

### Codex prompt

```text
Implement the responsive dashboard.

Requirements:
- Server-render current values where practical.
- Cards:
  - today’s total revenue
  - current month revenue
  - cash balance
  - bank balance
  - customer receivables
  - supplier payables in original currencies and estimated RON
  - warehouse inventory value
  - shop inventory value
  - net business value
- For outstanding USD payables, require or use the latest manually entered current USD/RON reference rate.
- Clearly label estimates.
- Do not add cumulative revenue to net business value.
- Add mobile card layout and desktop grid layout.
- Include quick actions:
  - Record daily sales
  - New customer credit purchase
  - Customer payment
  - New supplier purchase
  - Supplier payment
  - Expense
  - Transfer inventory value
- Add loading, error, and empty states.
- Add tests for formulas.
```

### Acceptance criteria

- Dashboard formulas match business rules
- Revenue is not double-counted
- Mobile layout is usable
- Missing current USD rate is explained clearly

---

## Step 19 — Build the daily and monthly revenue report

### Goal

Provide the first required report.

### Codex prompt

```text
Implement the daily and monthly revenue report.

Requirements:
- Date-range filter.
- Presets:
  - today
  - current week
  - current month
  - previous month
- Show:
  - cash sales
  - bank sales
  - credit sales
  - total revenue
- Daily table.
- Monthly aggregation.
- Totals for selected range.
- Optional simple chart using an accessible chart library.
- Use closed daily-sales records as the source of truth.
- Do not count customer payments as sales.
- Add CSV export.
- Add unit tests for aggregation boundaries and timezone handling.
- Add end-to-end tests for filtering.
```

### Acceptance criteria

- Daily and monthly totals are correct
- Customer payments are excluded
- Date filtering is timezone-safe
- CSV matches displayed totals

---

## Step 20 — Build the customer receivables report

### Goal

Show exactly who owes the business and why.

### Codex prompt

```text
Implement the customer receivables report.

Requirements:
- Summary cards:
  - total outstanding receivables
  - number of customers with outstanding balances
  - overdue amount when due dates exist
- Table:
  - customer
  - total purchases on credit
  - total payments
  - remaining balance
  - oldest unpaid date
- Customer drill-down:
  - every credit purchase
  - every payment
  - allocation details
  - remaining amount per purchase
- Filters:
  - customer
  - outstanding only
  - overdue only
  - date range
- Add CSV export.
- Ensure reversed entries do not affect totals.
- Add tests for partial payments and multi-purchase allocations.
```

### Acceptance criteria

- Totals equal underlying purchase minus allocation data
- Partial payments display correctly
- Reversed entries are excluded
- Drill-down is traceable

---

## Step 21 — Build the supplier payables report

### Goal

Show exactly which suppliers are owed money.

### Codex prompt

```text
Implement the supplier payables report.

Requirements:
- Summary:
  - total RON payables
  - total USD payables
  - estimated total RON equivalent
- Table:
  - supplier
  - currency
  - original purchase total
  - total paid
  - remaining original amount
  - estimated remaining RON value
  - oldest unpaid date
- Drill-down:
  - each purchase
  - historical exchange rate
  - historical inventory cost
  - payment allocations
  - payment exchange rates
  - currency gain or loss
  - remaining amount
- Filters:
  - supplier
  - currency
  - outstanding only
  - due-date range
- Current USD/RON reference rate is entered manually and clearly labelled.
- Add CSV export.
- Add tests for multi-rate USD purchases and payments.
```

### Acceptance criteria

- USD and RON are not mixed incorrectly
- Historical and current values are clearly separated
- Partial payments are correct
- Estimated RON totals use the selected current rate

---

## Step 22 — Build the cash and bank report

### Goal

Provide a complete account ledger and current balance.

### Codex prompt

```text
Implement the cash and bank report.

Requirements:
- Separate cash and bank views.
- Show:
  - opening balance
  - total inflows
  - total outflows
  - calculated current balance
- Transaction table:
  - date
  - type
  - description
  - inflow
  - outflow
  - running balance
  - source link
  - user
- Filters:
  - account
  - date range
  - transaction type
- Running balance must use a deterministic ordering.
- Add CSV export.
- Add tests for running-balance calculations and reversals.
```

### Acceptance criteria

- Account balance equals ledger sum
- Every row links to a source transaction
- Reversals are visible and correctly affect balance
- Running balance is deterministic

---

## Step 23 — Build the business-position report

### Goal

Show current net business value without double-counting revenue.

### Codex prompt

```text
Implement the business-position report.

Formula:
Warehouse inventory
+ Shop inventory
+ Cash
+ Bank
+ Customer receivables
- Supplier payables in estimated RON
= Net business value

Requirements:
- Show every component separately.
- Show the exact calculation.
- For USD supplier debt, allow selecting or entering the current USD/RON rate.
- Label the supplier RON value and net business value as estimated when an exchange-rate estimate is involved.
- Add snapshot capability so admin can save the business position at a date.
- Show historical snapshots as a trend.
- Do not label change in net worth as exact profit.
- Explain that owner contributions, withdrawals, inventory adjustments, and currency changes affect net worth.
- Add tests for the formula and rate changes.
```

### Acceptance criteria

- Revenue is not added separately
- All assets and liabilities appear once
- USD conversion is transparent
- Report does not falsely claim exact profit

---

## Step 24 — Implement audit log and correction workflows

### Goal

Make changes traceable and prevent silent history rewriting.

### Codex prompt

```text
Implement the audit-log interface and correction workflows.

Requirements:
- Admin-only audit log page.
- Filters:
  - user
  - action
  - entity type
  - date range
- Show before and after data safely.
- Add linked navigation to the affected record.
- Implement reusable reversal workflows for:
  - customer credit purchase
  - customer payment
  - supplier purchase
  - supplier payment
  - expense
  - inventory-value transfer
- Require an admin reason.
- Reversals must be atomic.
- Prevent reversing the same record twice.
- Preserve all original records.
- Add strong tests for each reversal type.
```

### Acceptance criteria

- Original transactions remain visible
- Reversal effects are correct
- Reason and admin identity are stored
- Double reversal is blocked

---

## Step 25 — Add idempotency and concurrency protection

### Goal

Prevent double-clicks, retries, and concurrent requests from duplicating financial effects.

### Codex prompt

```text
Review every financial and inventory write operation and add idempotency and concurrency protection.

Cover:
- customer payments
- supplier payments
- supplier purchases
- daily closing
- expenses
- inventory transfers
- stocktakes
- reversals

Requirements:
- Generate client request IDs for important commands.
- Store and enforce idempotency keys in the database.
- Use PostgreSQL transactions.
- Lock or safely recheck affected unpaid purchases during allocations.
- Prevent two concurrent payments from over-allocating the same debt.
- Prevent two concurrent closes from duplicating ledger entries.
- Add concurrency-focused database tests.
- Document the strategy.
```

### Acceptance criteria

- Retried requests return the original result or fail safely
- Concurrent allocations cannot overpay purchases
- Closing twice cannot duplicate revenue inflows

---

## Step 26 — Security hardening

### Goal

Review the system as an internet-accessible financial application.

### Codex prompt

```text
Perform a full security hardening pass.

Review:
- Supabase RLS
- server authorization
- service-role key isolation
- input validation
- mass-assignment risks
- CSRF protections for state-changing requests
- XSS risks
- SQL injection
- authentication session handling
- rate limiting
- login brute-force protection
- sensitive logging
- error-message leakage
- audit-log privacy
- account deactivation
- password-reset flow

Requirements:
- Add missing RLS policies.
- Add security-focused tests.
- Add secure HTTP headers.
- Ensure server-only modules cannot be imported into client components.
- Ensure employees cannot call admin operations directly.
- Add a documented threat model in `docs/security.md`.
- Do not claim perfect security; list remaining risks.
```

### Acceptance criteria

- Authorization is enforced on server and database
- No privileged secret reaches browser code
- RLS tests demonstrate tenant isolation
- Security documentation exists

---

## Step 27 — Responsive mobile usability pass

### Goal

Make the application practical on a phone.

### Codex prompt

```text
Perform a responsive mobile usability pass.

Requirements:
- Test common phone widths.
- Replace wide tables with cards or horizontal scrolling where appropriate.
- Use large touch targets.
- Keep financial totals readable.
- Make quick actions easy to reach.
- Ensure forms use correct mobile input types.
- Add confirmation for destructive or irreversible actions.
- Add accessible labels, focus states, and keyboard support.
- Test using Playwright mobile device profiles.
```

### Acceptance criteria

- Core workflows work on phone
- No essential control is hidden off-screen
- Tables remain usable
- Accessibility checks pass

---

## Step 28 — Export, backup, and recovery basics

### Goal

Avoid total business-data loss.

### Codex prompt

```text
Implement Phase 1 export and backup protections.

Requirements:
- Admin-only CSV export for:
  - customers
  - suppliers
  - customer receivables
  - supplier payables
  - daily sales
  - financial account ledger
  - expenses
  - inventory-value history
- Document Supabase managed backup limitations.
- Add instructions for scheduled PostgreSQL dumps outside the application.
- Add an admin data-export page.
- Do not implement an unsafe in-app raw database restore unless it can be done securely and tested.
- Add export tests.
```

### Acceptance criteria

- Major data can be exported
- Exports preserve identifiers and dates
- Backup strategy is documented
- Restore limitations are stated honestly

---

## Step 29 — Testing and release gate

### Goal

Do not deploy until financial invariants are proven.

### Codex prompt

```text
Create the Phase 1 release test suite and release checklist.

Required invariant tests:
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

Requirements:
- Add unit tests.
- Add database integration tests.
- Add Playwright end-to-end tests for the critical workflows.
- Create `docs/release-checklist.md`.
- Fix failures found during this step.
```

### Acceptance criteria

- All invariant tests pass
- Critical end-to-end paths pass
- Release checklist is complete
- Known limitations are documented

---

## Step 30 — Deploy Phase 1

### Goal

Deploy securely and verify production behavior.

### Codex prompt

```text
Prepare and deploy the Phase 1 application.

Requirements:
- Configure production Supabase project.
- Apply migrations in order.
- Configure Vercel environment variables.
- Verify service-role key remains server-only.
- Configure production domain and HTTPS.
- Create initial admin account safely.
- Create the business, warehouse, shop, cash, and bank records.
- Run opening-balance setup.
- Add production health checks.
- Add error monitoring without logging sensitive financial data.
- Run the release checklist in production.
- Document deployment and rollback steps in `docs/deployment.md`.
```

### Acceptance criteria

- Application works from shop PC, home, and phone
- HTTPS is active
- Admin and employee permissions work
- Production reports match test data
- Deployment and rollback are documented

---

# 8. Phase 1B — Product-level inventory

Do not begin this phase until Phase 1 is stable and used consistently.

---

## Step 31 — Create the product master list

### Goal

Start tracking exact products and quantities.

### Product examples

- Bathroom set
- Bath mat
- Table covering
- Self-adhesive film
- Linoleum PVC

Even without manufacturer barcodes, every product should receive an internal code.

### Codex prompt

```text
Implement the product master list for Phase 1B.

Schema:
- product_categories
- products
  - id
  - business_id
  - internal_code
  - name
  - category_id
  - unit fixed to piece for current business
  - default_purchase_cost_ron nullable
  - default_selling_price_ron nullable
  - is_active
  - created_at
  - created_by

Requirements:
- Internal code must be unique per business.
- Allow manual code entry and optional generated codes.
- Products are sold by piece.
- No barcode requirement yet.
- Product list, search, categories, add, edit metadata, deactivate.
- Do not allow deletion when transactions exist.
- Add CSV import with validation and preview.
- Add tests.
```

---

## Step 32 — Implement product stock ledger

### Goal

Track exact quantities by location.

### Codex prompt

```text
Implement an immutable product stock-movement ledger.

Schema:
- stock_movements
  - id
  - business_id
  - product_id
  - movement_type
  - source_location_id nullable
  - destination_location_id nullable
  - quantity
  - unit_cost_ron nullable
  - business_day_id nullable
  - reference_type
  - reference_id
  - notes nullable
  - created_by
  - created_at
  - reversal_of_id nullable
  - idempotency_key

Movement types:
- opening
- supplier_receipt
- transfer
- sale
- return
- damage
- adjustment

Requirements:
- Quantities are never directly edited.
- Current stock is derived from movements.
- Use transactions and concurrency protection.
- Reject negative stock for normal users.
- Admin override must require a reason and create an audit record.
- Add stock-by-location views and tests.
```

---

## Step 33 — Upgrade supplier purchases to product lines

### Goal

Receive actual products and quantities.

### Codex prompt

```text
Extend supplier purchases to support product line items.

Add:
- supplier_purchase_lines
  - supplier_purchase_id
  - product_id
  - quantity
  - unit_price_original_currency
  - purchase_exchange_rate
  - unit_cost_ron
  - line_total_ron

Requirements:
- Purchase total must equal the sum of lines.
- Receiving creates product stock movements.
- Inventory value must reconcile with product-line historical cost.
- Support warehouse or shop destination.
- Preserve Phase 1 historical value-only records.
- Add migration and backward-compatible reporting.
- Add tests.
```

---

## Step 34 — Upgrade transfers to product quantities

### Goal

Move exact products from warehouse to shop.

### Codex prompt

```text
Implement product-level warehouse-to-shop transfers.

Features:
- Select one or more products.
- Enter quantity for each.
- Validate warehouse availability.
- Submit atomically.
- Decrease warehouse stock.
- Increase shop stock.
- Preserve unit cost.
- Add transfer history and reversal.
- Prevent duplicate submission.
- Add tests for insufficient stock and concurrency.
```

---

# 9. Phase 2 — Product-level sales and advanced inventory

---

## Step 35 — Implement product-level sales

### Goal

Record what was sold and automatically reduce shop stock.

### Codex prompt

```text
Implement product-level sales.

Schema:
- sales
- sale_lines

Requirements:
- Select products manually.
- Enter quantity and selling price for each line.
- Support different prices for different customers.
- Calculate total sale amount.
- Payment split:
  - cash
  - bank
  - customer credit
- Product quantities must decrease from shop stock atomically.
- Reject insufficient stock.
- Create revenue, account, or receivable effects exactly once.
- Link customer credit lines to the customer’s receivable.
- Add idempotency and concurrency protection.
- Add tests for mixed payment methods, customer-specific prices, and stock deduction.
```

---

## Step 36 — Add returns, refunds, damage, and missing stock

### Goal

Handle exceptions without destroying auditability.

### Codex prompt

```text
Implement Phase 2 returns and inventory exceptions.

Features:
- Customer return
- Refund to cash or bank
- Credit cancellation or reduction
- Return to sellable stock
- Return to damaged stock
- Damaged product movement
- Missing or stolen stock adjustment
- Admin reason and audit trail

Requirements:
- Link returns to original sales where possible.
- Never directly edit sale totals or stock quantities.
- Use reversal or compensating movements.
- Add authorization rules and comprehensive tests.
```

---

## Step 37 — Add low-stock and inventory analysis

### Goal

Use product-level data for operational decisions.

### Codex prompt

```text
Implement product inventory analysis.

Features:
- Current stock by product and location
- Low-stock thresholds
- Product movement history
- Fast-moving and slow-moving products
- Inventory value by product and location
- Sales by product
- Gross margin estimate using historical cost
- Date-range filters
- CSV export

Requirements:
- Explain when margins are estimates.
- Do not use current replacement cost as historical cost.
- Add tests for aggregation.
```

---

# 10. Mandatory database invariants

Codex must preserve these invariants throughout the project:

```text
1. Money is never calculated using JavaScript floating-point arithmetic.

2. Cash and bank balances are derived from immutable ledger entries.

3. Customer receivable =
   customer credit purchases
   - customer payment allocations
   - reversals.

4. Supplier payable in original currency =
   supplier purchases
   - supplier payment allocations
   - reversals.

5. Customer payments do not create revenue.

6. Supplier debt payments are not operating expenses.

7. Supplier goods received on credit:
   increase inventory
   and increase supplier payable.

8. Warehouse-to-shop transfer:
   decreases warehouse
   increases shop
   leaves total inventory unchanged.

9. Daily closing:
   creates cash and bank sales inflows once only.

10. Credit sales declared for a business day =
    individual customer credit purchases for that day.

11. Historical purchase exchange rates are immutable.

12. Current USD/RON reference rate affects only current estimates,
    not historical inventory cost.

13. Employee cannot write to closed business days.

14. Completed financial records are corrected through reversals,
    not silent updates or deletes.

15. Every important change is auditable.

16. Users can only access their own business.

17. No browser code receives the Supabase service-role key.

18. Multi-table financial operations are atomic.

19. Duplicate requests cannot duplicate financial effects.

20. Net business value does not add revenue separately.
```

---

# 11. Recommended main navigation

## Desktop

- Dashboard
- Daily Sales
- Customers
- Suppliers
- Cash and Bank
- Inventory Value
- Expenses
- Reports
- Audit Log
- Users
- Settings

## Mobile

Use a compact bottom navigation or drawer:

- Dashboard
- Sales
- Customers
- Suppliers
- More

Quick-action buttons should be available from the dashboard.

---

# 12. Recommended Phase 1 database overview

```text
auth.users
  |
profiles
  |
business_members ---- businesses
                         |
                         |---- business_days
                         |---- inventory_locations
                         |---- financial_accounts
                         |---- customers
                         |       |---- customer_credit_purchases
                         |       |---- customer_payments
                         |               |---- customer_payment_allocations
                         |
                         |---- suppliers
                         |       |---- supplier_purchases
                         |       |---- supplier_payments
                         |               |---- supplier_payment_allocations
                         |
                         |---- daily_sales
                         |---- expenses
                         |---- financial_account_entries
                         |---- inventory_value_movements
                         |---- inventory_stocktakes
                         |---- audit_logs
```

---

# 13. Manual verification scenarios

Before trusting the application, manually test these scenarios.

## Scenario A — Customer credit sale and payment

1. Create customer Ahmed.
2. Add credit purchase for 500 RON.
3. Add second credit purchase for 300 RON.
4. Verify receivable is 800 RON.
5. Record 600 RON cash payment.
6. Verify:
   - first purchase is fully paid
   - second purchase has 200 RON remaining
   - cash increased by 600 RON
   - revenue did not increase from the payment

## Scenario B — USD supplier purchase and payment

1. Create supplier A.
2. Receive goods worth 1,000 USD at 4.60 RON/USD into warehouse.
3. Verify:
   - supplier payable is 1,000 USD
   - warehouse inventory increased by 4,600 RON
   - cash and bank did not change
4. Pay 400 USD at 4.80 from bank.
5. Verify:
   - payable becomes 600 USD
   - bank decreases by 1,920 RON
   - historical allocated value is 1,840 RON
   - currency loss is 80 RON

## Scenario C — Daily close

1. Add customer credit purchases totaling 300 RON.
2. Enter:
   - cash sales 1,000
   - bank sales 500
   - credit sales 300
3. Close the day.
4. Verify:
   - total revenue is 1,800
   - cash increases by 1,000
   - bank increases by 500
   - receivables already contain the 300 credit purchases
5. Press Close Day again.
6. Verify no duplicate money is created.

## Scenario D — Inventory transfer

1. Warehouse value is 10,000 RON.
2. Shop value is 2,000 RON.
3. Transfer 1,500 RON warehouse to shop.
4. Verify:
   - warehouse becomes 8,500
   - shop becomes 3,500
   - total remains 12,000

## Scenario E — Business position

Use:

```text
Warehouse: 25,000
Shop: 1,000
Cash: 17,000
Bank: 15,000
Customer receivables: 2,000
Supplier payables: 7,000
```

Expected:

```text
25,000 + 1,000 + 17,000 + 15,000 + 2,000 - 7,000
= 53,000 RON
```

Revenue must not be added again.

---

# 14. Common implementation mistakes to reject

Reject Codex changes that do any of the following:

- Add editable `current_balance` fields
- Add editable `current_stock` fields
- Use JavaScript `number` for money calculations
- Directly delete financial records
- Update old exchange rates
- Count customer payments as revenue
- Count supplier debt repayment as expense
- Add revenue to net business value
- Trust hidden navigation links as authorization
- Put the service-role key in client code
- Perform related writes without a transaction
- Allow credit payment allocations above outstanding balances
- Allow supplier allocations above outstanding purchases
- Let employees backdate transactions
- Let employees write into closed business days
- Build offline mode without a conflict-resolution design
- Start Phase 2 before Phase 1 is stable

---

# 15. Definition of Phase 1 done

Phase 1 is complete only when:

- Admin and employee can sign in securely
- Opening balances can be entered safely
- Business days can be opened and closed
- Daily cash, bank, and credit sales work
- Every customer credit purchase is tracked
- Customer payments allocate oldest first
- Every supplier purchase is tracked in USD or RON
- Supplier payments allocate oldest first
- Currency gain or loss is calculated
- Cash and bank balances come from ledgers
- Expenses reduce the correct account
- Warehouse and shop inventory values are tracked
- Inventory-value transfers work
- Stocktakes preserve expected and actual values
- All five required reports are correct
- Audit and reversal workflows work
- RLS prevents cross-business access
- Employee restrictions are enforced
- Important writes are idempotent and atomic
- The application works on shop computer, home computer, and phone
- All critical tests pass
- Data export and backup instructions exist

---

# 16. Suggested implementation order summary

```text
0. Project foundation
1. Supabase connection
2. Database foundation
3. Authentication and roles
4. Money/date/permission utilities
5. Opening balances
6. Business days
7. Customers
8. Customer credit purchases
9. Customer payments
10. Suppliers
11. Supplier purchases
12. Supplier payments
13. Financial account ledger
14. Daily sales and closing
15. Expenses
16. Inventory-value transfers
17. Stocktakes
18. Dashboard
19. Revenue report
20. Customer receivables report
21. Supplier payables report
22. Cash and bank report
23. Business-position report
24. Audit and corrections
25. Idempotency and concurrency
26. Security hardening
27. Mobile usability
28. Export and backup
29. Release testing
30. Deployment
31+. Product-level inventory and sales
```

Build one step, test it, commit it, and only then move forward.
