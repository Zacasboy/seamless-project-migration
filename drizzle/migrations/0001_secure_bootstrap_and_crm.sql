drop trigger if exists on_auth_user_created_role on auth.users;
drop function if exists public.handle_new_user_role();

-- one-time owner claim: only succeeds while no admin exists
create or replace function public.claim_owner() returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(4242);
  if exists(select 1 from public.user_roles where role='admin') then return false; end if;
  insert into public.user_roles(user_id,role) values(auth.uid(),'admin');
  return true;
end $$;
revoke all on function public.claim_owner() from public, anon;
grant execute on function public.claim_owner() to authenticated;

create or replace function public.owner_exists() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where role='admin') $$;
grant execute on function public.owner_exists() to anon, authenticated;

create policy "admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant insert, update, delete on public.user_roles to authenticated;

alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists sizes text[] not null default '{}';
alter table public.products add column if not exists cost numeric(10,2);
alter table public.products add column if not exists is_demo boolean not null default false;

alter table public.suppliers add column if not exists api_support text not null default 'Desconhecido';
alter table public.suppliers add column if not exists integration_state text not null default 'Diretório';
alter table public.suppliers add column if not exists last_sync_at timestamptz;
alter table public.suppliers add column if not exists is_demo boolean not null default true;

alter table public.customers add column if not exists consent_marketing boolean not null default false;
alter table public.customers add column if not exists segment_reason text;
alter table public.customers add column if not exists orders_count integer not null default 0;
alter table public.customers add column if not exists total_spent numeric(10,2) not null default 0;
alter table public.customers add column if not exists is_demo boolean not null default false;

alter table public.ad_channels add column if not exists integration_state text not null default 'Não ligado';
alter table public.ad_channels add column if not exists is_demo boolean not null default true;
alter table public.ad_channels add column if not exists campaigns integer not null default 0;
alter table public.ad_channels add column if not exists spend numeric(10,2) not null default 0;
alter table public.ad_channels add column if not exists impressions integer not null default 0;
alter table public.ad_channels add column if not exists clicks integer not null default 0;
alter table public.ad_channels add column if not exists sessions integer not null default 0;
alter table public.ad_channels add column if not exists conversions integer not null default 0;
alter table public.ad_channels add column if not exists revenue numeric(10,2) not null default 0;

create table public.collections (id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, description text not null default '', published boolean not null default true, is_demo boolean not null default false, created_at timestamptz not null default now());
create table public.collection_items (collection_id uuid not null references public.collections(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, primary key(collection_id,product_id));
grant select on public.collections, public.collection_items to anon, authenticated;
grant insert,update,delete on public.collections, public.collection_items to authenticated;
grant all on public.collections, public.collection_items to service_role;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
create policy "read published collections" on public.collections for select using (published or public.has_role(auth.uid(),'admin'));
create policy "admin collections" on public.collections for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read items" on public.collection_items for select using (true);
create policy "admin items" on public.collection_items for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.opportunity_findings (id uuid primary key default gen_random_uuid(), title text not null, source text not null, confidence text not null default 'Baixa', evidence text not null default '', upside text, assumptions text, action text, is_demo boolean not null default true, created_at timestamptz not null default now());
grant select,insert,update,delete on public.opportunity_findings to authenticated; grant all on public.opportunity_findings to service_role;
alter table public.opportunity_findings enable row level security;
create policy "admin opps" on public.opportunity_findings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.saved_outfits (id uuid primary key default gen_random_uuid(), user_id uuid not null, product_ids uuid[] not null, created_at timestamptz not null default now());
grant select,insert,delete on public.saved_outfits to authenticated; grant all on public.saved_outfits to service_role;
alter table public.saved_outfits enable row level security;
create policy "own outfits" on public.saved_outfits for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());