-- Security hardening: never grant admin privileges automatically at signup.
-- Every new Supabase Auth user receives only the ordinary "user" role.
-- Promote a trusted administrator explicitly through the Supabase SQL Editor
-- after verifying the intended auth.users.id. Do not expose service-role credentials
-- or allow clients to write to public.user_roles.

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Recreate the trigger explicitly so the intended safe handler is attached.
drop trigger if exists on_auth_user_created_role on auth.users;

create trigger on_auth_user_created_role
after insert on auth.users
for each row
execute function public.handle_new_user_role();

-- IMPORTANT:
-- This migration intentionally does not demote existing administrators, because
-- doing so automatically could lock the legitimate store owner out. Audit existing
-- admin rows before/after deployment and remove any untrusted admin role manually.
--
-- Audit:
--   select ur.user_id, u.email, ur.role
--   from public.user_roles ur
--   left join auth.users u on u.id = ur.user_id
--   where ur.role = 'admin';
--
-- After verifying the intended owner, promote that exact UUID manually if needed:
--   insert into public.user_roles (user_id, role)
--   values ('<verified-auth-user-uuid>'::uuid, 'admin')
--   on conflict (user_id, role) do nothing;
--
-- Remove an untrusted admin only after confirming it is not the intended owner:
--   delete from public.user_roles
--   where user_id = '<verified-auth-user-uuid>'::uuid and role = 'admin';
