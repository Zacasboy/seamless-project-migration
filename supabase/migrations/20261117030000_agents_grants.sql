-- O painel lê e altera as tabelas dos agentes com a sessão do administrador.
-- Este projeto não dá permissões automáticas a tabelas novas; o RLS (só admins) continua a filtrar.
grant select, insert, update, delete on table
  public.agent_settings, public.agent_runs, public.agent_actions,
  public.marketing_content, public.agent_plans, public.agent_memory
to authenticated;
notify pgrst, 'reload schema';
