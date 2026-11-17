import { createFileRoute } from "@tanstack/react-router";
import { AGENT_KEYS, isDue, type AgentKey } from "@/lib/agents";

// Agendamento diário de cada agente (um pedido por agente, para caber nos 300 s da função).
// A frequência escolhida no painel decide se o agente trabalha hoje.
async function run(request: Request, agent: string) {
  const { cronAuthorized } = await import("@/server/cron-auth");
  if (!cronAuthorized(request)) return new Response("Não autorizado", { status: 401 });
  if (!(AGENT_KEYS as readonly string[]).includes(agent)) return new Response("Agente desconhecido", { status: 404 });
  const { claudeConfigured } = await import("@/server/agents/claude");
  if (!claudeConfigured()) return Response.json({ skipped: "Falta ANTHROPIC_API_KEY" });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as import("@/server/agents/journal").Db;
  const { data: s } = await db.from("agent_settings").select("enabled, frequency").eq("agent", agent).maybeSingle();
  if (!s?.enabled) return Response.json({ skipped: "Agente desligado" });
  const { data: last } = await db
    .from("agent_runs")
    .select("started_at")
    .eq("agent", agent)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!isDue(s.frequency, last?.started_at ?? null)) return Response.json({ skipped: "Ainda não é altura" });
  const { runAgent } = await import("@/server/agents/runtime");
  try {
    return Response.json(await runAgent(db, agent as AgentKey, { trigger: "cron" }));
  } catch (e) {
    console.error("[cron agents]", agent, (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/cron/agents/$agent")({
  server: {
    handlers: {
      GET: ({ request, params }) => run(request, params.agent),
      POST: ({ request, params }) => run(request, params.agent),
    },
  },
});
