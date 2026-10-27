-- Restrict role checks to the caller's own role; anonymous execution is
-- retained because the public product SELECT policy also calls has_role().
-- Anonymous callers have no auth.uid(), so the function returns false and
-- cannot enumerate roles for arbitrary user UUIDs.
-- RLS policies pass auth.uid() as _user_id.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(_user_id = (select auth.uid()), false)
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and ur.role = _role
    );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
