-- Expand the commerce schema without storing customer body photos.
-- Supplier API credentials must be kept in server-side secrets, never in these tables.

alter table public.products
  add column if not exists sku text,
  add column if not exists garment_type text,
  add column if not exists size_options text[] not null default '{}',
  add column if not exists color_options text[] not null default '{}',
  add column if not exists image_alt text,
  add column if not exists stock_status text not null default 'unknown',
  add column if not exists currency text not null default 'EUR';

create unique index if not exists products_sku_unique on public.products (sku) where sku is not null;
create index if not exists products_category_gender_idx on public.products (category, gender);
create index if not exists products_published_created_idx on public.products (published, created_at desc);

alter table public.customers
  add column if not exists last_order_at timestamptz,
  add column if not exists lifetime_value numeric(12,2) not null default 0,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_updated_at timestamptz;

alter table public.suppliers
  add column if not exists provider_key text,
  add column if not exists api_connection_status text not null default 'not_configured',
  add column if not exists supported_operations text[] not null default '{}',
  add column if not exists api_docs_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_error text;

create unique index if not exists suppliers_provider_key_unique on public.suppliers (provider_key) where provider_key is not null;

-- Keep supplier-specific URLs and costs private: published product rows are readable by shoppers.
create table if not exists public.product_supplier_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_product_url text,
  supplier_sku text,
  supplier_cost numeric(12,2),
  supplier_currency text not null default 'EUR',
  availability_status text not null default 'unknown',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);
alter table public.product_supplier_links enable row level security;
revoke all on public.product_supplier_links from anon;
grant select, insert, update, delete on public.product_supplier_links to authenticated;
grant all on public.product_supplier_links to service_role;
drop policy if exists "admin manages supplier links" on public.product_supplier_links;
create policy "admin manages supplier links"
  on public.product_supplier_links for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create index if not exists product_supplier_links_product_idx on public.product_supplier_links (product_id);
create index if not exists product_supplier_links_supplier_idx on public.product_supplier_links (supplier_id);

alter table public.ad_channels
  add column if not exists external_account_id text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_status text not null default 'not_configured',
  add column if not exists tracking_id text;

-- Persist only selected product IDs and outfit metadata for authenticated users.
-- Deliberately no photo, photo URL, body measurements, or image blob column.
create table if not exists public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Conjunto guardado',
  product_ids uuid[] not null,
  fit_preference text,
  size_preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_outfits_product_count check (cardinality(product_ids) between 1 and 12)
);
create index if not exists saved_outfits_user_created_idx on public.saved_outfits (user_id, created_at desc);
alter table public.saved_outfits enable row level security;
revoke all on public.saved_outfits from anon;
grant select, insert, update, delete on public.saved_outfits to authenticated;
grant all on public.saved_outfits to service_role;

drop policy if exists "users manage own outfits" on public.saved_outfits;
create policy "users manage own outfits" on public.saved_outfits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Existing policies continue to govern the expanded product/customer/supplier/ad-channel rows.
-- Audit deployed RLS policies before production use.
