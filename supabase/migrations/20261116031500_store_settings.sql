-- Definições públicas da loja (por agora: o tema visual).
-- Leitura pública só das chaves listadas; escrita só por administradores.
create table if not exists public.store_settings (
  key text primary key check (key in ('theme')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.store_settings enable row level security;

drop policy if exists "public read" on public.store_settings;
create policy "public read" on public.store_settings for select to anon, authenticated using (true);
drop policy if exists "admin write" on public.store_settings;
create policy "admin write" on public.store_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.store_settings drop constraint if exists store_settings_theme_value;
alter table public.store_settings add constraint store_settings_theme_value
  check (key <> 'theme' or value in ('"ficha"'::jsonb, '"pedra"'::jsonb, '"pedra-ficha"'::jsonb));

grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

insert into public.store_settings (key, value) values ('theme', '"ficha"'::jsonb)
on conflict (key) do nothing;
