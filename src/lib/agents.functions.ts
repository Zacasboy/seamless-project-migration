import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENT_KEYS } from "@/lib/agents";

// Funções do painel para os agentes. As execuções e as decisões sobre alterações correm
// no servidor com a service role, depois de confirmar que quem pede é administrador.

async function assertAdmin(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Só administradores podem usar esta função.");
}

async function adminDb() {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim())
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY no servidor.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as import("@/server/agents/journal").Db;
}

const agentSchema = z.enum(AGENT_KEYS);

export const getAgentsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    await assertAdmin(db, context.userId);
    const { claudeConfigured, agentModel } = await import("@/server/agents/claude");
    const { data: settings, error } = await db.from("agent_settings").select("*");
    if (error) throw new Error("Falta aplicar a atualização da base de dados dos agentes (20261117020000_agents).");
    const { data: runs } = await db
      .from("agent_runs")
      .select("id, agent, status, summary, error, started_at, finished_at, input_tokens, output_tokens, trigger")
      .order("started_at", { ascending: false })
      .limit(40);
    const { data: pending } = await db.from("agent_actions").select("agent").eq("status", "proposed");
    return {
      ready: {
        apiKey: claudeConfigured(),
        serviceRole: !!process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim(),
        model: agentModel(),
      },
      agents: AGENT_KEYS.map((key) => {
        const s = settings?.find((x) => x.agent === key);
        const mine = (runs ?? []).filter((r) => r.agent === key);
        return {
          key,
          settings: s ?? null,
          lastRun: mine[0] ?? null,
          runs: mine.slice(0, 6),
          pending: (pending ?? []).filter((p) => p.agent === key).length,
        };
      }),
    };
  });

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ agent: agentSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { claudeConfigured } = await import("@/server/agents/claude");
    if (!claudeConfigured()) throw new Error("Falta ANTHROPIC_API_KEY no servidor (Vercel → Environment Variables).");
    const { runAgent } = await import("@/server/agents/runtime");
    return runAgent(await adminDb(), data.agent, { trigger: "manual", userId: context.userId });
  });

export const updateAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        agent: agentSchema,
        enabled: z.boolean(),
        autonomy: z.enum(["auto", "propor"]),
        frequency: z.enum(["daily", "weekly", "manual"]),
        instructions: z.string().max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { agent, ...rest } = data;
    const { error } = await context.supabase
      .from("agent_settings")
      .update({ ...rest, updated_at: new Date().toISOString(), updated_by: context.userId })
      .eq("agent", agent);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAgentRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: run, error } = await context.supabase.from("agent_runs").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: actions } = await context.supabase
      .from("agent_actions")
      .select("*")
      .eq("run_id", data.id)
      .order("created_at");
    return { run, actions: actions ?? [] };
  });

export const listAgentActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ status: z.enum(["proposed", "applied", "all"]).default("all"), limit: z.number().int().min(1).max(200).default(60) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase.from("agent_actions").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const decideAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject", "undo"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { approveAction, undoAction } = await import("@/server/agents/journal");
    const { data: a, error } = await db.from("agent_actions").select("*").eq("id", data.id).single();
    if (error || !a) throw new Error("Alteração não encontrada.");
    const decided = { decided_at: new Date().toISOString(), decided_by: context.userId };
    if (data.decision === "reject") {
      if (a.status !== "proposed") throw new Error("Esta alteração já não está pendente.");
      await db.from("agent_actions").update({ status: "rejected", ...decided }).eq("id", a.id);
      return { status: "rejected" };
    }
    if (data.decision === "approve") {
      const r = await approveAction(db, a);
      await db
        .from("agent_actions")
        .update({ status: "applied", entity_id: r.id, before: r.before, after: r.after, ...decided })
        .eq("id", a.id);
      return { status: "applied" };
    }
    await undoAction(db, a);
    await db.from("agent_actions").update({ status: "undone", ...decided }).eq("id", a.id);
    return { status: "undone" };
  });

export const listMarketingContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("marketing_content")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setContentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "approved", "published", "archived"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("marketing_content")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAgentPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("agent_plans")
      .select("*")
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const { data: memory } = await context.supabase.from("agent_memory").select("key, value, updated_at");
    return { plans: data ?? [], memory: memory ?? [] };
  });

export const updatePlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "done", "archived"]).optional(),
        toggleAction: z.number().int().min(0).max(29).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    type PlanRow = Database["public"]["Tables"]["agent_plans"]["Row"];
    const patch: Partial<PlanRow> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.toggleAction !== undefined) {
      const { data: p } = await db.from("agent_plans").select("actions").eq("id", data.id).single();
      const actions = (p?.actions as { feito?: boolean }[] | null) ?? [];
      const a = actions[data.toggleAction];
      if (a) a.feito = !a.feito;
      patch.actions = actions as PlanRow["actions"];
    }
    const { error } = await db.from("agent_plans").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
