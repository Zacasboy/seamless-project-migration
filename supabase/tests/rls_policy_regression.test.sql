-- RLS authorization policy regression tests for migrations 0000-0003.
-- Run only against a disposable/test database after applying the SQL files in
-- drizzle/migrations in order and installing pgTAP. The current migration files
-- are under drizzle/migrations, not supabase/migrations, so `supabase test db`
-- will not apply this project's schema automatically. These tests inspect catalog
-- metadata; no application rows are modified.

begin;

select plan(14);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass),
  'RLS enabled on user_roles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.products'::regclass),
  'RLS enabled on products'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  'RLS enabled on customers'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.suppliers'::regclass),
  'RLS enabled on suppliers'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ad_channels'::regclass),
  'RLS enabled on ad_channels'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.page_views'::regclass),
  'RLS enabled on page_views'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.product_supplier_links'::regclass),
  'RLS enabled on product_supplier_links'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.saved_outfits'::regclass),
  'RLS enabled on saved_outfits'
);

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'products'
    and policyname = 'public read published' and cmd = 'SELECT'
), 'public product SELECT policy exists');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'products'
    and policyname = 'admin write' and cmd = 'ALL'
), 'product write policy is role-gated');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'customers'
    and policyname = 'admin all' and cmd = 'ALL'
), 'customer access policy is admin-gated');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'product_supplier_links'
    and policyname = 'admin manages supplier links' and cmd = 'ALL'
), 'supplier-link access policy is admin-gated');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'saved_outfits'
    and policyname = 'users manage own outfits' and cmd = 'ALL'
    and qual like '%user_id = auth.uid()%'
    and with_check like '%user_id = auth.uid()%'
), 'saved outfits policy checks ownership for reads and writes');
select ok(
  has_function_privilege('anon', 'public.has_role(uuid, public.app_role)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.has_role(uuid, public.app_role)', 'EXECUTE'),
  'has_role executable by anon and authenticated as required by product RLS'
);

select * from finish();
rollback;
