# Customer management

Step 7 adds business-scoped customer directory management at `/customers`.

## Permissions

- Active employees and administrators can search, view, create, and edit
  customer metadata.
- Only administrators can deactivate customers.
- Authenticated clients cannot insert, update, or delete customer rows
  directly.
- Customer writes use security-definer RPCs that independently verify the
  caller's active business membership.

## Record lifecycle

Customers are never deleted through the application. Deactivation changes
`is_active` to false, retains the original identifier and related history, and
creates an audit record containing the before and after state.

The active-only list is the default. The list can include inactive records for
historical lookup.

## Duplicate handling

Same-name customers are allowed. While creating or editing an active customer,
the database blocks another active record in the same business only when both
the case-insensitive trimmed name and normalized phone digits match. A
business-scoped advisory lock prevents concurrent requests from bypassing this
check.

## Search

`search_customers` performs business-scoped name and phone matching inside
PostgreSQL. The RPC validates membership, search length, inactive filtering,
and result limit before returning at most 100 records to the UI.

Customer purchase and payment history uses an inclusive From/To period. The
current receivable and manual payment-allocation options remain unfiltered, so
viewing an older period cannot hide debt that is still payable.
