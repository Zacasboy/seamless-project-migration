# Drizzle snapshots — estado e procedimento seguro

## Estado atual

As migrações em `drizzle/migrations/*.sql` são SQL escrito manualmente. O ficheiro `drizzle/schema.ts` está intencionalmente vazio e os snapshots `meta/0000_snapshot.json` a `meta/0004_snapshot.json` têm mapas vazios para `tables`, `enums`, `policies` e outros objetos.

Isto significa que os snapshots **não representam o esquema criado pelo SQL**. Não devem ser tratados como prova de que o esquema está sincronizado, nem usados como base para gerar migrações incrementais. A sequência de IDs e `prevId` pode estar formalmente encadeada, mas o conteúdo continua incompleto.

## Decisão de segurança

Não inventar snapshots à mão nem gerar snapshots a partir do `schema.ts` vazio. Isso produziria ficheiros formalmente válidos mas semanticamente falsos, com risco de gerar alterações destrutivas ou duplicadas.

Nenhum comando de migração deve ser executado contra o projeto Supabase de produção nesta fase. A variável `LOVABLE_DB_MIGRATION_URL` deve apontar apenas para uma base de dados descartável durante a reconciliação.

## Procedimento para corrigir

1. Criar uma base PostgreSQL descartável que corresponda à baseline conhecida e aplicar, **apenas nessa base**, os SQL versionados por ordem do journal.
2. Validar o esquema resultante contra `src/integrations/supabase/types.ts` e as políticas/triggers/funções declaradas nos SQL. Confirmar também as extensões e dependências de Supabase Auth que precisam de ser simuladas ou instaladas na base descartável.
3. Reconstruir `drizzle/schema.ts` com as tabelas, enums, colunas, tipos, defaults, índices, chaves estrangeiras e constraints que Drizzle suporta. Documentar separadamente políticas RLS, triggers e funções SQL que não são totalmente representadas pelo schema Drizzle.
4. Escolher explicitamente a estratégia:
   - **SQL manual como fonte de verdade:** manter o fluxo SQL, não usar Drizzle Kit para gerar migrações incrementais até o schema e snapshots estarem reconciliados; ou
   - **Drizzle como fonte de verdade para objetos suportados:** gerar snapshots com a versão fixa de `drizzle-kit` a partir do schema reconstruído, inspecionar os diffs e manter as políticas/funções/triggers em SQL manual.
5. Regenerar snapshots com a mesma versão de Drizzle Kit bloqueada pelo lockfile; não editar IDs, `prevId` ou mapas de snapshots manualmente para aparentar consistência.
6. Comparar os snapshots gerados com o estado da base descartável e executar lint, testes e build. Adicionar testes SQL de RLS no ambiente descartável.
7. Só depois de revisão, preparar um PR de snapshots. Não aplicar migrações a Supabase de produção sem autorização explícita separada.

## Critérios de aceitação

- Cada snapshot não inicial representa o estado do schema suportado pelo Drizzle após a migração correspondente.
- O `_journal.json` tem índices únicos, tags correspondentes a ficheiros existentes e ordem temporal coerente.
- Os `prevId` correspondem ao ID do snapshot anterior e o primeiro snapshot usa o UUID zero como predecessor.
- A geração de diff numa base descartável não tenta recriar tabelas existentes nem eliminar objetos por divergência falsa.
- SQL de segurança (RLS, grants, funções, triggers) foi validado separadamente; snapshots Drizzle, por si só, não provam a segurança dessas regras.

## Limitação atual

Ainda não foi possível regenerar snapshots autênticos: o repositório não contém um `schema.ts` que represente o esquema e não foi disponibilizada uma base descartável introspectável nesta operação. Este documento regista o bloqueio sem fabricar metadados. Nenhuma ligação de produção foi usada.
