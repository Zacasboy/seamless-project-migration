-- Pallessiani: alinhamento do painel e encomendas seguras.
-- Só ACRESCENTA: não apaga tabelas, colunas, dados, triggers nem políticas existentes.
-- Projeto alvo: pallessiani (fybrptjsdubegufwdsrk). Não aplicar ao city-planner-geo.

begin;

-- 1. Colunas novas usadas pelo painel -----------------------------------------
alter table public.products   add column if not exists cost numeric(10,2) check (cost is null or cost >= 0);
alter table public.products   add column if not exists is_demo boolean not null default false;
alter table public.suppliers  add column if not exists is_demo boolean not null default false;
alter table public.customers  add column if not exists is_demo boolean not null default false;
alter table public.customers  add column if not exists segment_reason text check (segment_reason is null or length(segment_reason) <= 500);
alter table public.collections add column if not exists is_demo boolean not null default false;
alter table public.ad_channels add column if not exists is_demo boolean not null default false;
alter table public.ad_channels add column if not exists spend numeric(12,2) not null default 0 check (spend >= 0);
alter table public.ad_channels add column if not exists impressions integer not null default 0 check (impressions >= 0);
alter table public.ad_channels add column if not exists clicks integer not null default 0 check (clicks >= 0);
alter table public.ad_channels add column if not exists conversions integer not null default 0 check (conversions >= 0);
alter table public.ad_channels add column if not exists revenue numeric(12,2) not null default 0 check (revenue >= 0);

-- Imagens só por https (impede javascript:, data: e caminhos locais). NOT VALID: não verifica linhas antigas.
alter table public.products drop constraint if exists products_image_url_https;
alter table public.products add constraint products_image_url_https
  check (image_url is null or image_url = '' or image_url ~ '^https://[^\s]+$') not valid;

-- 2. Encomendas: dados de entrega e estados ---------------------------------
alter table public.orders add column if not exists shipping jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists notes text check (notes is null or length(notes) <= 1000);
alter table public.orders add column if not exists admin_notes text check (admin_notes is null or length(admin_notes) <= 2000);
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','confirmed','shipped','delivered','cancelled')) not valid;
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Encomenda criada só no servidor da base de dados: preços lidos de products,
-- nunca do browser. Limite: 3 encomendas pendentes por utilizador por hora.
create or replace function public.place_order(_items jsonb, _shipping jsonb, _notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _order uuid;
  _total numeric(12,2) := 0;
  _line jsonb;
  _p record;
  _qty int;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 20 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if jsonb_typeof(_shipping) <> 'object'
     or length(coalesce(_shipping->>'name','')) not between 2 and 120
     or length(coalesce(_shipping->>'address','')) not between 5 and 200
     or coalesce(_shipping->>'postal_code','') !~ '^\d{4}-\d{3}$'
     or length(coalesce(_shipping->>'city','')) not between 2 and 80
     or coalesce(_shipping->>'phone','') !~ '^\+?[0-9 ]{9,16}$' then
    raise exception 'invalid_shipping' using errcode = '22023';
  end if;
  if _notes is not null and length(_notes) > 1000 then raise exception 'invalid_notes' using errcode = '22023'; end if;
  if (select count(*) from public.orders where user_id = _uid and status = 'pending'
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  insert into public.orders (user_id, status, total, currency, shipping, notes)
  values (_uid, 'pending', 0, 'EUR',
          jsonb_build_object(
            'name', left(_shipping->>'name',120), 'phone', left(_shipping->>'phone',16),
            'address', left(_shipping->>'address',200), 'postal_code', _shipping->>'postal_code',
            'city', left(_shipping->>'city',80), 'nif', left(coalesce(_shipping->>'nif',''),9)),
          nullif(trim(_notes),''))
  returning id into _order;

  for _line in select * from jsonb_array_elements(_items) loop
    _qty := (_line->>'quantity')::int;
    if _qty is null or _qty < 1 or _qty > 10 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
    select id, title, price into _p from public.products
      where id = (_line->>'product_id')::uuid and published = true and stock_status <> 'out_of_stock';
    if not found then raise exception 'product_unavailable' using errcode = '22023'; end if;
    insert into public.order_items (order_id, product_id, title, quantity, unit_price, size, color)
    values (_order, _p.id, _p.title, _qty, _p.price, left(_line->>'size',20), left(_line->>'color',30));
    _total := _total + _p.price * _qty;
  end loop;

  update public.orders set total = _total, updated_at = now() where id = _order;
  return _order;
end $$;
revoke all on function public.place_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text) to authenticated;

-- 3. Radar: oportunidades registadas -----------------------------------------
create table if not exists public.opportunity_findings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  source text not null check (length(source) <= 200),
  confidence text not null default 'Média' check (confidence in ('Baixa','Média','Alta')),
  evidence text check (evidence is null or length(evidence) <= 2000),
  upside text check (upside is null or length(upside) <= 200),
  assumptions text check (assumptions is null or length(assumptions) <= 2000),
  action text check (action is null or length(action) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.opportunity_findings enable row level security;
drop policy if exists "admin all" on public.opportunity_findings;
create policy "admin all" on public.opportunity_findings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant select, insert, update, delete on public.opportunity_findings to authenticated;

-- 4. Funções e utilizadores --------------------------------------------------
-- Só diz se já existe administrador. Não promove ninguém.
create or replace function public.owner_exists() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where role = 'admin') $$;
revoke all on function public.owner_exists() from public, anon;
grant execute on function public.owner_exists() to authenticated;

-- Administradores veem e gerem funções; nunca se pode remover o último administrador.
drop policy if exists "admins read roles" on public.user_roles;
create policy "admins read roles" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant insert, delete on public.user_roles to authenticated;

create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    if (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'last_admin' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists user_roles_guard_last_admin on public.user_roles;
create trigger user_roles_guard_last_admin before delete or update on public.user_roles
  for each row execute function public.guard_last_admin();

commit;
