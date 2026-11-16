// Verificação automática dos canais de importação (fornecedores selecionados no painel).
// Corre ao abrir o painel de fornecedores e na tarefa periódica (/api/cron/sync-stock).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assessChannel, channelOf, type ChannelCheck } from "@/lib/channels";
import { ADAPTERS } from "./suppliers";

type Db = SupabaseClient<Database>;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

async function pingWithTimeout(fn: () => Promise<void>, ms = 8000) {
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("tempo esgotado")), ms)),
    ]);
    return { ok: true as const, error: null };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "erro" };
  }
}

export async function runChannelCheck(db: Db, opts: { write: boolean }): Promise<ChannelCheck[]> {
  const [{ data: suppliers, error }, { data: products }, { data: links }] = await Promise.all([
    db.from("suppliers").select("id, name, website").eq("connected", true).order("name"),
    db.from("products").select("supplier, created_at, stock_status").limit(5000),
    db.from("product_supplier_links").select("supplier_id, last_checked_at").limit(5000),
  ]);
  if (error) throw new Error(error.message);

  const out: ChannelCheck[] = [];
  for (const s of suppliers ?? []) {
    const ch = channelOf(s.name);
    const mine = (products ?? []).filter((p) => norm(p.supplier) === norm(s.name));
    const lastImport =
      mine
        .map((p) => p.created_at)
        .sort()
        .at(-1) ?? null;
    const lastStockCheck =
      (links ?? [])
        .filter((l) => l.supplier_id === s.id && l.last_checked_at)
        .map((l) => l.last_checked_at!)
        .sort()
        .at(-1) ?? null;

    let api: Parameters<typeof assessChannel>[0]["api"];
    if (ch.method === "api" && ch.provider) {
      const a = ADAPTERS[ch.provider];
      api = { configured: a.configured(), env: a.env };
      if (api.configured) Object.assign(api, await pingWithTimeout(() => a.ping()));
    }
    const verdict = assessChannel({
      method: ch.method,
      products: mine.length,
      unknownStock: mine.filter((p) => p.stock_status === "unknown").length,
      lastImport,
      lastStockCheck,
      api,
    });
    out.push({
      supplierId: s.id,
      name: s.name,
      website: s.website,
      method: ch.method,
      docsUrl: ch.docsUrl ?? null,
      products: mine.length,
      lastActivity: lastStockCheck ?? lastImport,
      ...verdict,
    });

    if (opts.write) {
      const status =
        ch.method === "api"
          ? !api?.configured
            ? "not_configured"
            : api.ok
              ? "connected"
              : "error"
          : ch.method === "none"
            ? "not_applicable"
            : "csv";
      await db
        .from("suppliers")
        .update({
          api_connection_status: status,
          last_sync_error:
            verdict.state === "fail" || verdict.state === "warn"
              ? verdict.message.slice(0, 500)
              : null,
        })
        .eq("id", s.id);
    }
  }
  return out;
}
