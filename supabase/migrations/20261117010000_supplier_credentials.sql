-- Autorizações OAuth dos fornecedores (AliExpress). Os tokens chegam já cifrados (AES-256-GCM)
-- pelo servidor. RLS ligado e sem políticas: só a service role (servidor) lê e escreve.
-- Só cria a tabela e marca a AliExpress como fornecedor com API; não apaga dados.

create table if not exists public.supplier_credentials (
  provider text primary key check (provider in ('aliexpress')),
  access_token text not null check (length(access_token) <= 4000),
  refresh_token text check (refresh_token is null or length(refresh_token) <= 4000),
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  account text check (account is null or length(account) <= 200),
  updated_at timestamptz not null default now()
);

alter table public.supplier_credentials enable row level security;
revoke all on table public.supplier_credentials from anon, authenticated;

update public.suppliers set provider_key = 'aliexpress'
  where provider_key is null and name = 'AliExpress';
