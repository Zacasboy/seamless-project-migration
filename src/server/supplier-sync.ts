// Sincronização de stock com os fornecedores e verificação antes de confirmar encomendas.
// Recebe um cliente Supabase com permissões de escrita (sessão de administrador ou service role).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SupplierVariantRef } from "@/integrations/supabase/types";
import { ADAPTERS, SupplierError, type ProviderKey, type StockResult } from "./suppliers";

type Db = SupabaseClient<Database>;

export type SyncSummary = {
  checked: number;
  outOfStock: number;
  errors: { provider: string; message: string }[];
};

/** Estado do produto a partir das variantes: esgotado só quando nenhuma está disponível. */
export function productStockStatus(variants: SupplierVariantRef[]) {
  if (variants.length === 0) return "unknown" as const;
  if (variants.every((v) => !v.available)) return "out_of_stock" as const;
  const known = variants.filter((v) => v.available && v.stock !== null);
  if (known.length && known.reduce((t, v) => t + (v.stock ?? 0), 0) < 5)
    return "low_stock" as const;
  return "in_stock" as const;
}

/** Junta o stock novo às variantes guardadas (mantém tamanho e cor). */
export function mergeStock(
  saved: SupplierVariantRef[],
  fresh: StockResult["variants"],
): SupplierVariantRef[] {
  const byId = new Map(fresh.map((v) => [v.id, v]));
  if (saved.length === 0)
    return fresh.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: null,
      color: null,
      stock: v.stock,
      available: v.available,
    }));
  return saved.map((v) => {
    const f = byId.get(v.id);
    // Variante que o fornecedor deixou de devolver: deixou de existir.
    return f
      ? { ...v, stock: f.stock, available: f.available }
      : { ...v, stock: 0, available: false };
  });
}

/** Estado da ligação quando o fornecedor deixou de vender o produto. */
export const DISCONTINUED = "discontinued";

export async function syncSupplierStock(db: Db, onlyProductIds?: string[]): Promise<SyncSummary> {
  let q = db
    .from("product_supplier_links")
    .select(
      "id, product_id, external_product_id, external_variants, availability_status, supplier_id, suppliers(provider_key), products(title)",
    )
    .not("external_product_id", "is", null)
    .limit(1000);
  if (onlyProductIds?.length) q = q.in("product_id", onlyProductIds);
  const { data: links, error } = await q;
  if (error) throw new Error(error.message);

  const summary: SyncSummary = { checked: 0, outOfStock: 0, errors: [] };
  const byProvider = new Map<ProviderKey, typeof links>();
  for (const l of links ?? []) {
    const key = (l.suppliers as unknown as { provider_key: string | null } | null)
      ?.provider_key as ProviderKey | null;
    if (!key || !ADAPTERS[key]) continue;
    byProvider.set(key, [...(byProvider.get(key) ?? []), l]);
  }

  for (const [key, list] of byProvider) {
    const adapter = ADAPTERS[key];
    if (!adapter.configured()) {
      summary.errors.push({
        provider: adapter.name,
        message: `Faltam as variáveis ${adapter.env.join(", ")}`,
      });
      continue;
    }
    let results: StockResult[] = [];
    try {
      results = await adapter.fetchStock(list.map((l) => l.external_product_id!));
    } catch (e) {
      const message = e instanceof SupplierError ? e.message : "Erro inesperado";
      summary.errors.push({ provider: adapter.name, message });
      await db
        .from("suppliers")
        .update({ last_sync_error: message.slice(0, 500) })
        .eq("provider_key", key);
      continue;
    }
    const now = new Date().toISOString();
    for (const l of list) {
      const r = results.find((x) => x.externalId === l.external_product_id);
      if (!r) continue;
      const title = (l.products as unknown as { title?: string } | null)?.title ?? l.external_product_id;
      if (r.error) {
        // Só este produto falhou: mantém o stock anterior e segue para os outros.
        summary.errors.push({ provider: adapter.name, message: `${title}: ${r.error}` });
        await db
          .from("product_supplier_links")
          .update({ last_error: r.error.slice(0, 500), last_checked_at: now })
          .eq("id", l.id);
        continue;
      }
      // Deixou de estar à venda: todas as variantes ficam esgotadas.
      const merged = mergeStock((l.external_variants as SupplierVariantRef[]) ?? [], r.gone ? [] : r.variants);
      const status = r.gone ? ("out_of_stock" as const) : productStockStatus(merged);
      if (r.gone && l.availability_status !== DISCONTINUED)
        summary.errors.push({
          provider: adapter.name,
          message: `«${title}» deixou de estar à venda e foi retirado da loja (veja Produtos → Retirados pelo fornecedor)`,
        });
      if (!r.gone && l.availability_status === DISCONTINUED)
        summary.errors.push({
          provider: adapter.name,
          message: `«${title}» voltou a estar à venda no fornecedor; continua fora da loja até o publicar`,
        });
      summary.checked++;
      if (status === "out_of_stock") summary.outOfStock++;
      await db
        .from("product_supplier_links")
        .update({
          external_variants: merged,
          availability_status: r.gone ? DISCONTINUED : status,
          last_checked_at: now,
          last_error: r.gone ? "Deixou de estar à venda no fornecedor (Portugal)." : null,
        })
        .eq("id", l.id);
      // Retirado pelo fornecedor: sai da loja (despublicado) e fica para o administrador decidir.
      await db
        .from("products")
        .update(r.gone ? { stock_status: status, published: false } : { stock_status: status })
        .eq("id", l.product_id);
    }
    await db
      .from("suppliers")
      .update({ last_synced_at: now, last_sync_error: null })
      .eq("provider_key", key);
  }
  return summary;
}

export type LineCheck = { product_id: string; size?: string | null };
export type LineProblem = { product_id: string; reason: "unavailable" };

/**
 * Confirma no fornecedor, em tempo real, que cada linha ainda existe e tem stock.
 * Linhas sem ligação a fornecedor passam. Se o fornecedor não responder, devolve
 * `unverified` para a encomenda seguir como "por confirmar" em vez de bloquear a venda.
 */
export async function checkLinesWithSuppliers(
  refs: {
    product_id: string;
    provider_key: string;
    external_product_id: string;
    external_variants: unknown;
  }[],
  lines: LineCheck[],
): Promise<{ problems: LineProblem[]; unverified: string[] }> {
  const problems: LineProblem[] = [];
  const unverified: string[] = [];
  const byProvider = new Map<ProviderKey, typeof refs>();
  for (const r of refs) {
    const k = r.provider_key as ProviderKey;
    if (ADAPTERS[k]?.configured()) byProvider.set(k, [...(byProvider.get(k) ?? []), r]);
    else unverified.push(r.product_id);
  }
  await Promise.all(
    [...byProvider].map(async ([k, list]) => {
      let res: StockResult[];
      try {
        res = await Promise.race([
          ADAPTERS[k].fetchStock([...new Set(list.map((r) => r.external_product_id))]),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
      } catch {
        unverified.push(...list.map((r) => r.product_id));
        return;
      }
      for (const r of list) {
        const stock = res.find((x) => x.externalId === r.external_product_id);
        // Falha pontual deste produto: a encomenda segue como "por confirmar".
        if (stock?.error) {
          unverified.push(r.product_id);
          continue;
        }
        const saved = (r.external_variants as { id: string; size: string | null }[]) ?? [];
        for (const line of lines.filter((l) => l.product_id === r.product_id)) {
          if (!stock) {
            problems.push({ product_id: r.product_id, reason: "unavailable" });
            continue;
          }
          const wanted = line.size
            ? saved
                .filter((v) => (v.size ?? "").toLowerCase() === line.size!.toLowerCase())
                .map((v) => v.id)
            : saved.map((v) => v.id);
          const pool = wanted.length
            ? stock.variants.filter((v) => wanted.includes(v.id))
            : stock.variants;
          if (!pool.some((v) => v.available))
            problems.push({ product_id: r.product_id, reason: "unavailable" });
        }
      }
    }),
  );
  return { problems, unverified };
}
