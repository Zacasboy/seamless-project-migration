-- Restrict role-check execution to authenticated application sessions and service_role.
-- The function only answers questions about the caller's own role; callers cannot
-- enumerate roles for arbitrary user UUIDs. RLS policies pass auth.uid() as _user_id.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    _user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and ur.role = _role
    );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
