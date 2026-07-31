begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(8);

select extensions.ok(
  to_regclass('public.audit_log_summaries') is not null,
  'audit log summary view exists'
);
select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.audit_logs'::regclass
  ),
  'audit logs retain RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'),
  'browser users cannot insert audit events directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'),
  'browser users cannot update audit history'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'),
  'browser users cannot delete audit history'
);
select extensions.ok(
  to_regprocedure('private.prevent_audit_log_mutation()') is not null,
  'audit immutability trigger function exists'
);
select extensions.has_trigger(
  'public',
  'audit_logs',
  'audit_logs_prevent_mutation',
  'audit history has an immutability trigger'
);
select extensions.ok(
  has_table_privilege(
    'authenticated',
    'public.audit_log_summaries',
    'SELECT'
  ),
  'authenticated role can query the RLS-protected summary'
);

select extensions.finish();

rollback;
