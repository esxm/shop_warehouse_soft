begin;

create index audit_logs_business_action_created_idx
  on public.audit_logs (business_id, action, created_at desc, id desc);

create index audit_logs_business_entity_created_idx
  on public.audit_logs (business_id, entity_type, created_at desc, id desc);

create index audit_logs_business_actor_created_idx
  on public.audit_logs (business_id, actor_user_id, created_at desc, id desc);

create function private.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit logs are immutable'
    using errcode = '55000';
end;
$$;

revoke all on function private.prevent_audit_log_mutation() from public;

create trigger audit_logs_prevent_mutation
before update or delete on public.audit_logs
for each row
execute function private.prevent_audit_log_mutation();

create view public.audit_log_summaries
with (security_invoker = true)
as
select
  audit.id,
  audit.business_id,
  audit.actor_user_id,
  coalesce(profile.full_name, audit.actor_user_id::text) as actor_name,
  audit.action,
  audit.entity_type,
  audit.entity_id,
  audit.previous_data,
  audit.new_data,
  audit.reason,
  audit.created_at,
  (audit.created_at at time zone business.timezone)::date as business_date
from public.audit_logs as audit
inner join public.businesses as business
  on business.id = audit.business_id
left join public.profiles as profile
  on profile.id = audit.actor_user_id;

revoke all on table public.audit_log_summaries from anon, authenticated;
grant select on table public.audit_log_summaries
  to authenticated, service_role;

comment on view public.audit_log_summaries is
  'Administrator-only audit history with actor names and business-local dates.';
comment on function private.prevent_audit_log_mutation() is
  'Prevents audit history from being silently updated or deleted.';

commit;
