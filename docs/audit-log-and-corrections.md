# Audit log and correction workflows

The administrator-only `/audit-log` route shows immutable business audit
events newest first.

## Filters and traceability

Administrators can filter by:

- responsible user;
- exact action;
- exact entity type; and
- inclusive business-local date range.

Every event shows the business date, exact timestamp, actor, action, entity,
administrative reason, before data, after data, and stable identifiers.
Supported entities link back to the affected operational record.

Audit JSON is rendered as escaped text, not HTML. Object keys are sorted,
deep/oversized values are bounded for the interface, and fields whose names
indicate passwords, secrets, tokens, authorization data, or cookies are
redacted.

`audit_log_summaries` derives the business-local date and actor name while
retaining the `audit_logs` administrator RLS policy. A database trigger blocks
updates and deletes, including privileged accidental mutation.

## Corrections

The shared reversal form and validation policy require:

- an administrator session rechecked by the server action;
- a reason of 10 to 500 characters; and
- explicit confirmation that history is preserved.

The following transaction types use this workflow:

- customer credit purchase;
- customer payment;
- supplier purchase;
- supplier payment;
- expense; and
- inventory-value transfer.

Each transaction still uses its dedicated security-definer reversal RPC. The
RPC locks or safely claims the original, rejects a second reversal, writes all
compensating financial/inventory effects and reversal metadata atomically, and
records the administrator identity and reason in the audit log. Original
transaction and allocation rows remain visible.
