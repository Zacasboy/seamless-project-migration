# Pallessiani

Loja e painel de gestão em TanStack Start com Supabase (projeto `pallessiani`). Não depende do Lovable.

## Arrancar localmente

1. Instalar dependências com Bun (o projeto usa `bun.lock`; não usar `npm install`):
   ```bash
   bun install
   ```
2. Criar `.env.local` a partir de `.env.example` e preencher a chave publicável do Supabase.
3. Arrancar:
   ```bash
   bun run dev
   ```
   A app abre em http://localhost:8080.

## Verificar

```bash
bun run lint
bun run test
bun run build
node --env-file=.env.local .output/server/index.mjs   # testar a build de produção (porta 3000)
```

## Notas

- Só a chave publicável (`sb_publishable_...`) vai para o browser. `SUPABASE_SERVICE_ROLE_KEY` é opcional e fica só no servidor.
- As imagens de exemplo não foram migradas. Os produtos sem `image_url` mostram um fundo neutro com o nome. Para mostrar fotos, preencher `image_url` no painel com um URL https (por exemplo, do Supabase Storage).
- A build gera um servidor Node por omissão. Para outro destino: `NITRO_PRESET=vercel bun run build`.

## Publicação

Ver [DEPLOY.md](DEPLOY.md) (Vercel, variáveis de ambiente, tarefa automática e domínio).
