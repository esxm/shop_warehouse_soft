begin;

create function public.add_business_employee(
  target_business_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null
    or not private.is_business_admin(target_business_id)
  then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = target_user_id
  )
  then
    raise exception 'Target user does not exist'
      using errcode = '23503';
  end if;

  insert into public.business_members (
    business_id,
    user_id,
    role,
    is_active
  )
  values (
    target_business_id,
    target_user_id,
    'employee',
    true
  );

  insert into public.audit_logs (
    business_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  )
  values (
    target_business_id,
    current_user_id,
    'business_member.employee_added',
    'business_member',
    target_user_id,
    jsonb_build_object(
      'user_id', target_user_id,
      'role', 'employee',
      'is_active', true
    )
  );
end;
$$;

revoke all on function public.add_business_employee(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.add_business_employee(uuid, uuid)
  to authenticated, service_role;

comment on function public.add_business_employee(uuid, uuid) is
  'Allows an authenticated business administrator to add an employee and records the action atomically.';

commit;
