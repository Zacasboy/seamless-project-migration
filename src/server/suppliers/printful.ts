// Printful — API v1 (api.printful.com). Importa os produtos já criados na tua loja Printful
// (GET /store/products/{id}) e lê a disponibilidade no catálogo (GET /products/{id}).
import {
  SupplierError,
  getJson,
  httpsOnly,
  toNumber,
  type StockResult,
  type SupplierAdapter,
  type SupplierProduct,
} from "./types";

const BASE = "https://api.printful.com";
const env = (k: string) => process.env[k]?.trim() || "";

function headers(): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${env("PRINTFUL_TOKEN")}` };
  if (env("PRINTFUL_STORE_ID")) h["X-PF-Store-Id"] = env("PRINTFUL_STORE_ID");
  return h;
}

async function pf<T>(path: string): Promise<T> {
  const res = await getJson<{ code: number; result: T; error?: { message?: string } }>(
    "printful",
    `${BASE}${path}`,
    { headers: headers() },
  );
  if (res.code !== 200)
    throw new SupplierError(`Printful: ${res.error?.message ?? res.code}`, "printful", res.code);
  return res.result;
}

type SyncVariant = {
  id: number;
  name?: string;
  sku?: string | null;
  retail_price?: string | null;
  currency?: string;
  variant_id?: number;
  product?: { variant_id?: number; product_id?: number; image?: string };
  files?: { type?: string; preview_url?: string; thumbnail_url?: string }[];
  options?: unknown[];
};
type StoreProduct = {
  sync_product: { id: number; name: string; thumbnail_url?: string };
  sync_variants: SyncVariant[];
};
type CatalogVariant = {
  id: number;
  size?: string;
  color?: string;
  price?: string;
  in_stock?: boolean;
  availability_status?: { region: string; status: string }[];
};

// Disponível na Europa: estado "in_stock" para a região EU (ou in_stock geral quando não há regiões).
export function printfulAvailable(v: CatalogVariant | undefined): boolean {
  if (!v) return true;
  const eu = v.availability_status?.find((a) => a.region === "EU");
  return eu ? eu.status === "in_stock" : v.in_stock !== false;
}

export function mapPrintful(
  sp: StoreProduct,
  catalog: Map<number, CatalogVariant>,
): SupplierProduct {
  const vs = sp.sync_variants ?? [];
  const preview = vs.flatMap((v) =>
    (v.files ?? []).filter((f) => f.type === "preview").map((f) => f.preview_url),
  );
  return {
    provider: "printful",
    externalId: String(sp.sync_product.id),
    url: null,
    title: sp.sync_product.name?.trim() ?? "",
    description: "",
    images: httpsOnly([
      ...preview,
      sp.sync_product.thumbnail_url,
      ...vs.map((v) => v.product?.image),
    ]),
    categoryHint: sp.sync_product.name ?? "",
    currency: vs[0]?.currency ?? "EUR",
    variants: vs.map((v) => {
      const cv = catalog.get(v.variant_id ?? v.product?.variant_id ?? -1);
      const available = printfulAvailable(cv);
      return {
        id: String(v.id),
        sku: v.sku ?? null,
        size: cv?.size ?? null,
        color: cv?.color ?? null,
        cost: toNumber(cv?.price),
        suggestedPrice: toNumber(v.retail_price),
        stock: null, // impressão a pedido: não há unidades, só disponibilidade
        available,
      };
    }),
  };
}

async function load(id: string) {
  const sp = await pf<StoreProduct>(`/store/products/${encodeURIComponent(id)}`);
  const productIds = [
    ...new Set(sp.sync_variants.map((v) => v.product?.product_id).filter(Boolean)),
  ] as number[];
  const catalog = new Map<number, CatalogVariant>();
  for (const pid of productIds.slice(0, 5)) {
    const c = await pf<{ variants: CatalogVariant[] }>(`/products/${pid}`);
    for (const v of c.variants ?? []) catalog.set(v.id, v);
  }
  return mapPrintful(sp, catalog);
}

export const printfulAdapter: SupplierAdapter = {
  key: "printful",
  name: "Printful",
  env: ["PRINTFUL_TOKEN", "PRINTFUL_STORE_ID (opcional)"],
  configured: () => !!env("PRINTFUL_TOKEN"),
  parseRef(input) {
    const s = input.trim();
    try {
      const u = new URL(s);
      if (!/(^|\.)printful\.com$/i.test(u.hostname)) return null;
      // Painel: printful.com/dashboard/sync/update?id=123 ou …/store/products/123
      const id = u.searchParams.get("id") ?? u.pathname.match(/\/(\d{4,})(?:\/|$)/)?.[1];
      return id && /^\d+$/.test(id) ? id : null;
    } catch {
      return /^\d{4,}$/.test(s) ? s : null;
    }
  },
  async fetchProduct(id) {
    if (!/^\d+$/.test(id)) throw new SupplierError("Id de produto Printful inválido", "printful");
    return load(id);
  },
  async ping() {
    await pf<unknown>("/store/products?limit=1");
  },
  async fetchStock(ids) {
    const out: StockResult[] = [];
    for (const id of ids) {
      const p = await load(id);
      out.push({
        externalId: id,
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          stock: v.stock,
          available: v.available,
        })),
      });
    }
    return out;
  },
};
