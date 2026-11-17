// Execução de um agente: ciclo de ferramentas com limite de tempo, diário e relatório.
import { AGENTS, type AgentKey } from "@/lib/agents";
import { callClaude, type Block, type Message } from "./claude";
import { AGENT_PROMPTS, COMMON_PROMPT, WEB_SEARCHES } from "./definitions";
import type { Db } from "./journal";
import { MAX_WRITES, runTool, toolDefinitions, type Ctx } from "./tools";

const MAX_TURNS = 24;
// A função da Vercel tem até 300 s; o relatório final precisa de folga.
const TIME_BUDGET_MS = Number(process.env["AGENT_TIME_BUDGET_MS"]) || 210_000;

export type RunResult = { runId: string; status: "done" | "error"; summary: string };

const siteUrl = () =>
  (process.env["VITE_SITE_URL"] || process.env["SITE_URL"] || "https://pallessiani.vercel.app").replace(/\/$/, "");

async function kickoff(db: Db, agent: AgentKey, instructions: string) {
  const { data: prev } = await db
    .from("agent_runs")
    .select("started_at, summary, status")
    .eq("agent", agent)
    .neq("status", "running")
    .order("started_at", { ascending: false })
    .limit(3);
  const { count: pending } = await db
    .from("agent_actions")
    .select("id", { count: "exact", head: true })
    .eq("agent", agent)
    .eq("status", "proposed");
  const { data: undone } = await db
    .from("agent_actions")
    .select("label, reason")
    .eq("agent", agent)
    .in("status", ["undone", "rejected"])
    .order("decided_at", { ascending: false })
    .limit(8);
  const today = new Date().toLocaleDateString("pt-PT", { dateStyle: "full", timeZone: "Europe/Lisbon" });
  return [
    `Hoje é ${today}. Começa a tua execução como ${AGENTS[agent].name}.`,
    instructions.trim() && `Instruções do administrador (prioritárias):\n${instructions.trim()}`,
    prev?.length
      ? `Execuções anteriores:\n${prev.map((r) => `- ${r.started_at.slice(0, 10)} (${r.status}): ${r.summary ?? "sem resumo"}`).join("\n")}`
      : "É a tua primeira execução.",
    pending ? `Tens ${pending} propostas à espera de decisão do administrador: não as repitas.` : "",
    undone?.length
      ? `O administrador desfez ou rejeitou estas alterações tuas; aprende com isso e não as repitas:\n${undone.map((u) => `- ${u.label} (motivo dado: ${u.reason})`).join("\n")}`
      : "",
    `Podes fazer no máximo ${MAX_WRITES} alterações.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function appendToLastUser(messages: Message[], text: string) {
  const last = messages[messages.length - 1];
  if (last?.role !== "user") {
    messages.push({ role: "user", content: text });
    return;
  }
  last.content = Array.isArray(last.content)
    ? [...last.content, { type: "text", text }]
    : `${last.content}\n\n${text}`;
}

export async function runAgent(
  db: Db,
  agent: AgentKey,
  opts: { trigger: "manual" | "cron"; userId?: string | null },
): Promise<RunResult> {
  const { data: settings } = await db.from("agent_settings").select("*").eq("agent", agent).single();
  if (!settings) throw new Error("Definições do agente em falta.");

  // Uma execução de cada vez por agente (as que ficaram presas há mais de 10 min são fechadas).
  const { data: running } = await db
    .from("agent_runs")
    .select("id, started_at")
    .eq("agent", agent)
    .eq("status", "running");
  for (const r of running ?? []) {
    if (Date.now() - Date.parse(r.started_at) < 10 * 60_000)
      throw new Error(`${AGENTS[agent].name} já está a trabalhar. Aguarde que termine.`);
    await db.from("agent_runs").update({ status: "error", error: "Interrompida (tempo esgotado).", finished_at: new Date().toISOString() }).eq("id", r.id);
  }

  const { data: run, error } = await db
    .from("agent_runs")
    .insert({ agent, trigger: opts.trigger, started_by: opts.userId ?? null })
    .select("id")
    .single();
  if (error || !run) throw new Error(`Não foi possível registar a execução: ${error?.message}`);

  const ctx: Ctx = { db, agent, runId: run.id, autonomy: settings.autonomy, writes: 0, siteUrl: siteUrl() };
  const t0 = Date.now();
  const usage = { input_tokens: 0, output_tokens: 0 };
  const sources = new Map<string, string>();

  const tools: unknown[] = toolDefinitions(agent);
  if (WEB_SEARCHES[agent] > 0)
    tools.push({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: WEB_SEARCHES[agent],
      user_location: { type: "approximate", country: "PT", timezone: "Europe/Lisbon" },
    });
  (tools[tools.length - 1] as Record<string, unknown>)["cache_control"] = { type: "ephemeral" };

  const system = [
    { type: "text", text: COMMON_PROMPT },
    { type: "text", text: AGENT_PROMPTS[agent], cache_control: { type: "ephemeral" } },
  ];
  const messages: Message[] = [{ role: "user", content: await kickoff(db, agent, settings.instructions ?? "") }];

  let report = "";
  try {
    let wrapUp = false;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const late = Date.now() - t0 > TIME_BUDGET_MS || turn >= MAX_TURNS - 2 || ctx.writes >= MAX_WRITES;
      if (late && !wrapUp) {
        wrapUp = true;
        appendToLastUser(messages, "Tempo ou limite esgotado. Não chames mais ferramentas: escreve agora o relatório final.");
      }
      const res = await callClaude({
        max_tokens: 8000,
        system,
        tools,
        messages,
        ...(wrapUp ? { tool_choice: { type: "none" } } : {}),
      });
      usage.input_tokens += res.usage?.input_tokens ?? 0;
      usage.output_tokens += res.usage?.output_tokens ?? 0;
      messages.push({ role: "assistant", content: res.content });

      for (const b of res.content) {
        if (b.type === "web_search_tool_result" && Array.isArray((b as { content: unknown }).content))
          for (const r of (b as { content: { url?: string; title?: string }[] }).content)
            if (r.url) sources.set(r.url, r.title ?? r.url);
      }

      if (res.stop_reason === "pause_turn") continue;
      const calls = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
      if (res.stop_reason === "tool_use" && calls.length && !wrapUp) {
        const results = [];
        for (const c of calls) {
          try {
            const out = await runTool(ctx, c.name, c.input);
            results.push({ type: "tool_result", tool_use_id: c.id, content: JSON.stringify(out).slice(0, 24_000) });
          } catch (e) {
            results.push({ type: "tool_result", tool_use_id: c.id, content: (e as Error).message, is_error: true });
          }
        }
        messages.push({ role: "user", content: results });
        await db.from("agent_runs").update({ input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }).eq("id", run.id);
        continue;
      }
      report = res.content
        .filter((b): b is Extract<Block, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (report || wrapUp) break;
      wrapUp = true;
      appendToLastUser(messages, "Escreve agora o relatório final.");
    }
    if (!report) report = "Resumo: a execução terminou sem relatório.";
    const summary = (report.match(/^\s*Resumo:\s*(.+)$/im)?.[1] ?? report.split("\n").find((l) => l.trim()) ?? "").slice(0, 600);
    await db
      .from("agent_runs")
      .update({
        status: "done",
        summary,
        report_md: report.slice(0, 60_000),
        sources: [...sources].slice(0, 80).map(([url, title]) => ({ url, title })),
        ...usage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return { runId: run.id, status: "done", summary };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 1800);
    await db
      .from("agent_runs")
      .update({ status: "error", error: msg, ...usage, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return { runId: run.id, status: "error", summary: msg };
  }
}
