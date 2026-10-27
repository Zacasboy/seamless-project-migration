-- Security regression tests for the schema created by migrations 0000-0003.
-- Run only against a disposable/test database after applying the SQL files in
-- drizzle/migrations in order and installing pgTAP. The current migration files
-- are under drizzle/migrations, not supabase/migrations, so `supabase test db`
-- will not apply this project's schema automatically. No application rows are changed.

begin;

select plan(14);

select has_table('public', 'user_roles', 'user_roles exists');
select has_table('public', 'products', 'products exists');
select has_table('public', 'customers', 'customers exists');
select has_table('public', 'suppliers', 'suppliers exists');
select has_table('public', 'ad_channels', 'ad_channels exists');
select has_table('public', 'page_views', 'page_views exists');
select has_table('public', 'product_supplier_links', 'product_supplier_links exists');
select has_table('public', 'saved_outfits', 'saved_outfits exists');

select ok((select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass), 'RLS enabled on user_roles');
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'RLS enabled on products');
select ok((select relrowsecurity from pg_class where oid = 'public.customers'::regclass), 'RLS enabled on customers');
select ok((select relrowsecurity from pg_class where oid = 'public.suppliers'::regclass), 'RLS enabled on suppliers');
select ok((select relrowsecurity from pg_class where oid = 'public.ad_channels'::regclass), 'RLS enabled on ad_channels');
select ok((select relrowsecurity from pg_class where oid = 'public.page_views'::regclass), 'RLS enabled on page_views');

select * from finish();
rollback;
