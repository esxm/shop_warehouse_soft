# Supplier management

Step 10 adds business-scoped supplier directory management at `/suppliers`.

## Permissions

- Active employees and administrators can search, view, create, and edit
  supplier contact metadata.
- Only administrators can deactivate suppliers.
- Authenticated clients cannot insert, update, or delete supplier rows
  directly.
- Supplier writes use security-definer RPCs that independently verify active
  membership in the target business.

## Metadata

Each supplier supports a name, optional phone, optional notes, and an optional
default transaction currency of RON or USD. The default is a convenience for
future purchase entry; it does not modify historical purchase currencies or
exchange rates.

## Record lifecycle

Suppliers are never deleted through the application. Deactivation changes
`is_active` to false, preserves the supplier identifier and every linked
purchase, and creates an audit record with before and after state.

The supplier list defaults to active records and can include inactive records
for historical lookup.

## Duplicate handling

Same-name suppliers are allowed. The database blocks another active supplier
in the same business only when both the case-insensitive trimmed name and
normalized phone digits match. A business-scoped advisory lock prevents
concurrent create or update requests from bypassing this check.

## Search

`search_suppliers` performs membership-checked name and phone matching inside
PostgreSQL. Search length, inactive filtering, and result limits are validated
before returning results.
