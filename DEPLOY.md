# Publicar na Vercel

A loja corre na Vercel (TanStack Start + Nitro, preset `vercel` detetado automaticamente).
As funções ficam em Londres (`lhr1`), junto à base de dados Supabase (eu-west-2).

## 1. Criar o projeto

1. Em vercel.com › **Add New › Project**, importe o repositório `Zacasboy/seamless-project-migration`.
2. **Production Branch:** `redesign/dark-luxury-no-lovable` (em Settings › Git, se não aparecer no assistente).
3. O framework é lido de `vercel.json` (`tanstack-start`). Instalação com bun (`bun.lock`); comando de build `vite build`.
4. Antes do primeiro deploy, preencha as variáveis abaixo.

## 2. Variáveis de ambiente (Settings › Environment Variables)

| Variável | Onde é usada | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser e servidor | Sim |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser e servidor (chave pública) | Sim |
| `SUPABASE_URL` | Servidor (igual a `VITE_SUPABASE_URL`) | Recomendado |
| `SUPABASE_PUBLISHABLE_KEY` | Servidor (igual à anterior) | Recomendado |
| `SUPABASE_SERVICE_ROLE_KEY` | Só servidor: tarefa automática | Para a sincronização diária |
| `CRON_SECRET` | Só servidor: protege `/api/cron/sync-stock` (32+ caracteres aleatórios) | Para a sincronização diária |
| `VITE_SITE_URL` | URLs canónicos e sitemap, ex. `https://pallessiani.pt` | Quando houver domínio |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 (só com consentimento) | Opcional |
| `VITE_CAMPAIGN_IMAGE_URL` | Fotografia do banner (https) | Opcional |
| `CJ_API_KEY`, `PRINTFUL_TOKEN`, `PRINTFUL_STORE_ID`, `BIGBUY_API_KEY`, `BIGBUY_TAXONOMIES`, `BIGBUY_SANDBOX` | Fornecedores por API | Conforme os fornecedores |
| `VERCEL_CRON_SCHEDULE` | Frequência da tarefa automática (ver 4) | Só no Pro |

Regras:
- Tudo o que começa por `VITE_` vai para o browser. **Nunca** use `VITE_` em chaves secretas.
- `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e as chaves dos fornecedores: marcar como **Sensitive** e só no ambiente **Production**.
- Gerar o `CRON_SECRET` no Terminal: `openssl rand -hex 32`.
- Alterar uma variável `VITE_` exige um novo deploy.

## 3. Manter o site privado durante a preparação

Settings › **Deployment Protection** › **Vercel Authentication**: ativar também para Production.
Só quem tem sessão na conta Vercel vê o site, e os motores de busca não o indexam.
Desligar no lançamento.

## 4. Tarefa automática (stock e verificação dos canais)

Definida em `vite.config.ts` e gerada no build: `GET /api/cron/sync-stock`, com
`Authorization: Bearer <CRON_SECRET>` enviado pela Vercel.

- **Hobby:** uma vez por dia (`0 5 * * *`, entre as 5h00 e as 5h59 UTC). Mais do que isso falha no deploy.
- **Pro:** definir `VERCEL_CRON_SCHEDULE` = `*/15 * * * *` e fazer novo deploy.

Entre execuções, o checkout confirma sempre o stock no fornecedor e o painel tem «Sincronizar stock agora».

## 5. Domínio (amen.pt)

1. Na Vercel: Settings › **Domains** › adicionar `pallessiani.pt` e `www.pallessiani.pt`.
2. A Vercel mostra os registos DNS exatos (A para o domínio raiz, CNAME para `www`). Copie-os para a gestão de DNS da amen.pt.
3. Não altere os registos MX: o email continua na amen.pt.
4. Depois de validado, defina `VITE_SITE_URL` e faça novo deploy.

## 6. Supabase Auth

Em Supabase › Authentication › URL Configuration:
- **Site URL:** o domínio final (ou o endereço `*.vercel.app` enquanto não houver domínio).
- **Redirect URLs:** `https://<domínio>/**` e `https://*-<equipa>.vercel.app/**` para os previews.

## 7. Passar para o Pro

Settings › Billing › Upgrade (necessário quando a loja começar a vender: o Hobby é só para uso pessoal ou não comercial).
Depois: `VERCEL_CRON_SCHEDULE` = `*/15 * * * *` e novo deploy. Projeto, domínio e variáveis ficam iguais.

## Testar o build da Vercel localmente

```bash
NITRO_PRESET=vercel bun run build
cat .vercel/output/config.json   # deve listar o cron
```


## Agentes do painel

Em **Painel → Agentes** há duas camadas:

- **Rotinas automáticas (sem IA, sem custo):** limpam nomes e descrições, arrumam cores e tamanhos, preenchem categoria, género, tipo, meta title/description e texto alternativo, e arquivam coleções vazias e rascunhos antigos. Correm todos os dias (`/api/cron/agents/regras`) e logo a seguir a cada importação. Não traduzem nomes nem descrições (escolha da língua nas definições) e não inventam dados. Só precisam de `SUPABASE_SERVICE_ROLE_KEY`.
- **Agentes de IA** (Catálogo e SEO, Marca, Conteúdo, Concorrência): escrevem, revêem e analisam. Ficam à espera até haver `ANTHROPIC_API_KEY`.

- Variáveis na Vercel (Production, Sensitive): `ANTHROPIC_API_KEY` (console.anthropic.com → API Keys), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Opcional: `ANTHROPIC_MODEL`.
- Base de dados: `supabase/migrations/20261117020000_agents.sql`.
- Agendamento: a Vercel chama `/api/cron/agents/<agente>` uma vez por dia; a frequência escolhida no painel decide se o agente trabalha nesse dia.
- Cada execução dura até ~4 minutos (`maxDuration` 300 s) e faz no máximo 30 alterações. Todas ficam no diário e podem ser desfeitas.
- Pesquisa na web: desligada por omissão. Para ligar, `AGENTS_WEB_SEARCH=on` na Vercel e redeploy (e ativar a pesquisa na web na Console da Anthropic, se pedido). Sem ela, o agente de Concorrência fica parado e os outros trabalham só com os dados da loja.
- Os agentes nunca alteram preços, não criam nem apagam produtos (arquivam) e a mudança de tema é sempre proposta.
