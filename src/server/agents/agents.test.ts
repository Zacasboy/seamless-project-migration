/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { isDue, type AgentKey } from "@/lib/agents";
import { applyOperation, pick, undoAction } from "./journal";
import { MAX_WRITES, runTool, toolDefinitions, type Ctx } from "./tools";

type Tables = Record<string, any[]>;
// Base de dados em memória com a interface mínima usada pelo diário.
function fakeDb(tables: Tables) {
  const keyOf = (t: string) => (t === "agent_memory" || t === "store_settings" ? "key" : "id");
  const q = (t: string) => {
    let rows = tables[t] ?? (tables[t] = []);
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let op: { kind: string; payload?: unknown } = { kind: "select" };
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      not: () => api,
      neq: () => api,
      in: () => api,
      limit: () => api,
      range: () => api,
      gte: () => api,
      or: () => api,
      ilike: () => api,
      order: () => api,
      like: () => api,
      insert: (p: unknown) => ((op = { kind: "insert", payload: p }), api),
      upsert: (p: unknown) => ((op = { kind: "upsert", payload: p }), api),
      update: (p: unknown) => ((op = { kind: "update", payload: p }), api),
      delete: () => ((op = { kind: "delete" }), api),
      single: () => run(true),
      maybeSingle: () => run(true),
      then: (res: (v: unknown) => void) => res(run(false)),
    };
    function run(one: boolean) {
      const match = (r: Record<string, unknown>) => filters.every((f) => f(r));
      if (op.kind === "insert" || op.kind === "upsert") {
        const list = ([] as Record<string, unknown>[]).concat(op.payload as Record<string, unknown>);
        for (const p of list) {
          const row: Record<string, unknown> = { id: p[keyOf(t)] ?? `id-${rows.length + 1}`, started_at: new Date().toISOString(), ...p };
          const i = rows.findIndex((r) => r[keyOf(t)] === row[keyOf(t)]);
          if (i >= 0) rows[i] = { ...rows[i], ...row };
          else rows.push(row);
        }
        return { data: list[0] ? rows.find((r) => r[keyOf(t)] === (list[0]![keyOf(t)] ?? rows.at(-1)![keyOf(t)])) : null, error: null };
      }
      if (op.kind === "update") {
        rows.filter(match).forEach((r) => Object.assign(r, op.payload));
        return { data: null, error: null };
      }
      if (op.kind === "delete") {
        tables[t] = rows = rows.filter((r) => !match(r));
        return { data: null, error: null };
      }
      const found = rows.filter(match).map((r) => ({ ...r }));
      return { data: one ? (found[0] ?? null) : found, error: null };
    }
    return api;
  };
  return { from: q } as never;
}

describe("diário dos agentes", () => {
  it("só escreve colunas permitidas (nunca o preço)", () => {
    expect(pick("products", { title: "A", price: 1, cost: 2 })).toEqual({ title: "A" });
  });

  it("guarda antes/depois e desfaz uma alteração", async () => {
    const tables: Tables = { products: [{ id: "p1", title: "Old", price: 10 }] };
    const db = fakeDb(tables);
    const r = await applyOperation(db, { entity: "products", op: "update", id: "p1", values: { title: "Novo", price: 1 } });
    expect(r.before).toEqual({ title: "Old" });
    expect(r.after).toEqual({ title: "Novo" });
    expect(tables["products"]![0].price).toBe(10);
    await undoAction(db, { id: "a", op: "update", entity: "products", entity_id: "p1", before: r.before, after: r.after, status: "applied" });
    expect(tables["products"]![0].title).toBe("Old");
  });

  it("recusa desfazer se o campo mudou depois", async () => {
    const tables: Tables = { products: [{ id: "p1", title: "Mudado à mão" }] };
    await expect(
      undoAction(fakeDb(tables), { id: "a", op: "update", entity: "products", entity_id: "p1", before: { title: "Old" }, after: { title: "Novo" }, status: "applied" }),
    ).rejects.toThrow(/alterado depois/);
  });

  it("recusa apagar ou criar produtos", async () => {
    const db = fakeDb({ products: [{ id: "p1" }] });
    await expect(applyOperation(db, { entity: "products", op: "delete", id: "p1" })).rejects.toThrow();
    await expect(applyOperation(db, { entity: "products", op: "create", values: { title: "x" } })).rejects.toThrow();
  });
});

describe("ferramentas", () => {
  const ctx = (agent: Ctx["agent"], autonomy: Ctx["autonomy"] = "auto", tables: Tables = {}) =>
    ({ db: fakeDb(tables), agent, runId: "r1", autonomy, writes: 0, siteUrl: "https://x" }) as Ctx;

  it("cada agente só vê as suas ferramentas", () => {
    const names = (a: AgentKey) => toolDefinitions(a).map((t) => t.name);
    expect(names("conteudo")).toContain("criar_conteudo");
    expect(names("conteudo")).not.toContain("atualizar_produto");
    expect(names("catalogo")).toContain("atualizar_produto");
    expect(names("marca")).toContain("propor_tema");
    expect(toolDefinitions("catalogo").every((t) => (t.input_schema as { type: string }).type === "object")).toBe(true);
  });

  it("valida os dados e recusa preço", async () => {
    const c = ctx("catalogo", "auto", { products: [{ id: "00000000-0000-4000-8000-000000000001", title: "X" }] });
    await expect(runTool(c, "atualizar_produto", { id: "00000000-0000-4000-8000-000000000001", campos: { price: 1 }, motivo: "baixar preço" })).rejects.toThrow(/Dados inválidos/);
  });

  it("recusa nomes com sexo, tamanho ou fabricante", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const c = ctx("catalogo", "auto", { products: [{ id, title: "X" }], agent_actions: [] });
    await expect(runTool(c, "atualizar_produto", { id, campos: { title: "Men's loafers size 42" }, motivo: "nome melhor" })).rejects.toThrow(/Nome recusado/);
    await expect(runTool(c, "atualizar_produto", { id, campos: { title: "Suede loafers" }, motivo: "nome melhor" })).resolves.toMatchObject({ estado: "aplicado" });
  });

  it("no modo propor guarda proposta sem mudar o produto", async () => {
    const tables: Tables = { products: [{ id: "00000000-0000-4000-8000-000000000001", title: "X" }], agent_actions: [] };
    const c = ctx("catalogo", "propor", tables);
    const r = await runTool(c, "atualizar_produto", { id: "00000000-0000-4000-8000-000000000001", campos: { title: "Mala tiracolo preta" }, motivo: "título em pt-PT" });
    expect(r).toMatchObject({ estado: expect.stringContaining("proposta") });
    expect(tables["products"]![0].title).toBe("X");
    expect(tables["agent_actions"]![0]).toMatchObject({ status: "proposed" });
  });

  it("o tema é sempre proposta, mesmo em modo automático", async () => {
    const tables: Tables = { store_settings: [{ key: "theme", value: "ficha" }], agent_actions: [] };
    await runTool(ctx("marca", "auto", tables), "propor_tema", { tema: "pedra", motivo: "teste de proposta" });
    expect(tables["store_settings"]![0].value).toBe("ficha");
  });

  it("só o dono escreve cada conhecimento", async () => {
    await expect(runTool(ctx("conteudo"), "guardar_conhecimento", { chave: "guia_marca", valor: {}, motivo: "tentativa" })).rejects.toThrow(/Só o agente/);
  });

  it("limita as alterações por execução", async () => {
    const c = ctx("conteudo", "auto", { marketing_content: [], agent_actions: [] });
    c.writes = MAX_WRITES;
    await expect(runTool(c, "criar_conteudo", { conteudo: { kind: "post", channel: "instagram", title: "Título", body: "x".repeat(30), success_probability: 0.4, rationale: "y".repeat(30) }, motivo: "teste limite" })).rejects.toThrow(/Limite/);
  });
});

describe("agendamento", () => {
  it("respeita a frequência", () => {
    const now = new Date("2026-11-17T10:00:00Z");
    expect(isDue("manual", null, now)).toBe(false);
    expect(isDue("daily", null, now)).toBe(true);
    expect(isDue("daily", "2026-11-16T09:00:00Z", now)).toBe(true);
    expect(isDue("daily", "2026-11-17T06:00:00Z", now)).toBe(false);
    expect(isDue("weekly", "2026-11-12T06:00:00Z", now)).toBe(false);
    expect(isDue("weekly", "2026-11-10T06:00:00Z", now)).toBe(true);
  });
});

describe("execução de um agente", () => {
  it("chama ferramentas, regista a alteração e guarda o relatório", async () => {
    const pid = "00000000-0000-4000-8000-000000000001";
    const tables: Tables = {
      agent_settings: [{ id: "catalogo", agent: "catalogo", enabled: true, autonomy: "auto", frequency: "daily", instructions: "" }],
      agent_runs: [],
      agent_actions: [],
      products: [{ id: pid, title: "NEW Women Bag 2025", price: 20 }],
    };
    const replies = [
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "atualizar_produto", input: { id: pid, campos: { title: "Mala tiracolo preta" }, motivo: "título do fornecedor em inglês" } }],
        usage: { input_tokens: 100, output_tokens: 20 },
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Resumo: corrigi 1 título.\n\n## Feito" }], usage: { input_tokens: 50, output_tokens: 10 } },
    ];
    const bodies: any[] = [];
    process.env["ANTHROPIC_API_KEY"] = "test";
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(replies.shift()), { status: 200 });
    });
    const { runAgent } = await import("./runtime");
    const r = await runAgent(fakeDb(tables), "catalogo", { trigger: "manual" });
    vi.unstubAllGlobals();
    expect(r).toMatchObject({ status: "done", summary: "corrigi 1 título." });
    expect(tables["products"]![0].title).toBe("Mala tiracolo preta");
    expect(tables["products"]![0].price).toBe(20);
    expect(tables["agent_actions"]![0]).toMatchObject({ status: "applied", entity: "products" });
    expect(tables["agent_runs"]![0]).toMatchObject({ status: "done", input_tokens: 150 });
    expect(bodies[0].tools.some((t: any) => t.type === "web_search_20250305")).toBe(false); // desligada por omissão
    expect(bodies[1].messages.at(-1).content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
  });
});

describe("pesquisa na web", () => {
  it("fica desligada por omissão e o agente de concorrência não arranca", async () => {
    delete process.env["AGENTS_WEB_SEARCH"];
    const { runAgent } = await import("./runtime");
    await expect(runAgent(fakeDb({}), "concorrencia", { trigger: "manual" })).rejects.toThrow(/pesquisa na web/);
  });

  it("liga com AGENTS_WEB_SEARCH=on", async () => {
    process.env["AGENTS_WEB_SEARCH"] = "on";
    process.env["ANTHROPIC_API_KEY"] = "test";
    const bodies: any[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "Resumo: ok" }], usage: { input_tokens: 1, output_tokens: 1 } }));
    });
    const { runAgent } = await import("./runtime");
    const tables: Tables = { agent_settings: [{ id: "concorrencia", agent: "concorrencia", enabled: true, autonomy: "auto", frequency: "weekly", instructions: "" }], agent_runs: [], agent_actions: [] };
    const r = await runAgent(fakeDb(tables), "concorrencia", { trigger: "manual" });
    vi.unstubAllGlobals();
    delete process.env["AGENTS_WEB_SEARCH"];
    expect(r.status).toBe("done");
    expect(bodies[0].tools.find((t: any) => t.type === "web_search_20250305")).toMatchObject({ max_uses: 12 });
  });
});

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
