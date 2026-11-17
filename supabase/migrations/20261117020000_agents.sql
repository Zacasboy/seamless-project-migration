-- Agentes do painel: rotinas automáticas sem IA ("regras") e agentes de IA
-- (catálogo/SEO, marca, conteúdo e concorrência).
-- Cada alteração feita por um agente fica no diário (agent_actions) com o valor anterior,
-- para poder ser desfeita no painel. Só cria tabelas novas; não apaga nem altera dados.

create table if not exists public.agent_settings (
  agent text primary key check (agent in ('regras','catalogo','marca','conteudo','concorrencia')),
  enabled boolean not null default true,
  autonomy text not null default 'auto' check (autonomy in ('auto','propor')),
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','manual')),
  instructions text not null default '' check (length(instructions) <= 4000),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.agent_settings (agent, frequency) values
  ('regras','daily'), ('catalogo','daily'), ('marca','weekly'), ('conteudo','weekly'), ('concorrencia','weekly')
on conflict (agent) do nothing;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null references public.agent_settings(agent),
  trigger text not null check (trigger in ('manual','cron','import')),
  status text not null default 'running' check (status in ('running','done','error')),
  summary text check (summary is null or length(summary) <= 1000),
  report_md text check (report_md is null or length(report_md) <= 60000),
  error text check (error is null or length(error) <= 2000),
  sources jsonb not null default '[]'::jsonb,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_agent_idx on public.agent_runs (agent, started_at desc);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.agent_runs(id) on delete set null,
  agent text not null,
  op text not null check (op in ('create','update','delete')),
  entity text not null check (entity in ('products','collections','marketing_content','agent_plans','agent_memory','store_settings')),
  entity_id text,
  label text check (label is null or length(label) <= 300),
  before jsonb,
  after jsonb,
  reason text check (reason is null or length(reason) <= 1000),
  status text not null check (status in ('applied','proposed','undone','rejected','failed')),
  error text check (error is null or length(error) <= 1000),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index if not exists agent_actions_run_idx on public.agent_actions (run_id);
create index if not exists agent_actions_status_idx on public.agent_actions (status, created_at desc);

-- Publicações e anúncios propostos pelo agente de conteúdo.
create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('post','ad','email','blog')),
  channel text not null check (channel in ('instagram','facebook','tiktok','pinterest','meta_ads','google_ads','email','blog')),
  title text not null check (length(title) between 1 and 200),
  body text not null default '' check (length(body) <= 6000),
  hashtags text[] not null default '{}',
  cta text check (cta is null or length(cta) <= 120),
  audience text check (audience is null or length(audience) <= 600),
  product_ids uuid[] not null default '{}',
  budget_eur numeric check (budget_eur is null or budget_eur between 0 and 100000),
  expected_ctr numeric check (expected_ctr is null or expected_ctr between 0 and 1),
  expected_cvr numeric check (expected_cvr is null or expected_cvr between 0 and 1),
  success_probability numeric check (success_probability is null or success_probability between 0 and 1),
  rationale text check (rationale is null or length(rationale) <= 2000),
  status text not null default 'draft' check (status in ('draft','approved','published','archived')),
  scheduled_for timestamptz,
  agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Planos de ação (concorrência, marca, SEO).
create table if not exists public.agent_plans (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  kind text not null check (kind in ('concorrencia','marca','seo','conteudo')),
  title text not null check (length(title) between 1 and 200),
  body_md text not null default '' check (length(body_md) <= 30000),
  actions jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','in_progress','done','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conhecimento partilhado entre agentes (guia da marca, concorrentes, palavras-chave).
create table if not exists public.agent_memory (
  key text primary key check (key in ('guia_marca','concorrentes','palavras_chave')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_agent text
);

-- Só administradores, pelo painel. Os agentes correm no servidor com a service role.
do $$
declare t text;
begin
  foreach t in array array['agent_settings','agent_runs','agent_actions','marketing_content','agent_plans','agent_memory'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t || '_admin', t);
  end loop;
end $$;
