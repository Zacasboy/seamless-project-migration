-- Função de trigger: não deve ser chamável pela API (aviso do Security Advisor).
revoke all on function public.guard_last_admin() from public, anon, authenticated;
