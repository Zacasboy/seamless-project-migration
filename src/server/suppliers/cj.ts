// CJDropshipping — API 2.0 (developers.cjdropshipping.com).
// Autenticação: POST /authentication/getAccessToken com a API Key; o token dura 180 dias.
// Limite: 1 pedido por segundo; os pedidos são postos em fila.
import {
  SupplierError,
  getJson,
  httpsOnly,
  splitVariantName,
  toNumber,
  type StockResult,
  type SupplierAdapter,
  type SupplierProduct,
} from "./types";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const env = (k: string) => process.env[k]?.trim() || "";

type CjResponse<T> = { code: number; result: boolean; message: string; data: T };

let token: { value: string; expires: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

// Garante 1 pedido por segundo para respeitar o limite da CJ.
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await throttled(() =>
    getJson<CjResponse<{ accessToken: string; accessTokenExpiryDate: string }>>(
      "cj",
      `${BASE}/authentication/getAccessToken`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: env("CJ_API_KEY") }),
      },
    ),
  );
  if (!res.result || !res.data?.accessToken)
    throw new SupplierError(`CJ recusou a chave de API: ${res.message}`, "cj");
  const exp = Date.parse(res.data.accessTokenExpiryDate);
  token = {
    value: res.data.accessToken,
    expires: Number.isFinite(exp) ? exp : Date.now() + 24 * 3600_000,
  };
  return token.value;
}

async function cj<T>(path: string): Promise<T> {
  const call = async () =>
    throttled(async () =>
      getJson<CjResponse<T>>("cj", `${BASE}${path}`, {
        headers: { "CJ-Access-Token": await accessToken() },
      }),
    );
  let res = await call();
  if (res.code === 1600001 || res.code === 401) {
    token = null; // token inválido: pede um novo uma vez
    res = await call();
  }
  if (!res.result) throw new SupplierError(`CJ: ${res.message}`, "cj");
  return res.data;
}

type CjInventory = { countryCode: string; totalInventory?: number; totalInventoryNum?: number };
type CjVariant = {
  vid: string;
  variantSku?: string;
  variantKey?: string;
  variantNameEn?: string;
  variantSellPrice?: number | string;
  variantSugSellPrice?: number | string;
  variantImage?: string;
  inventories?: CjInventory[];
};
type CjProduct = {
  pid: string;
  productNameEn?: string;
  productName?: string;
  productSku?: string;
  bigImage?: string;
  productImageSet?: string[] | string;
  description?: string;
  categoryName?: string;
  sellPrice?: number | string;
  variants?: CjVariant[];
};

const sumInventory = (raw: CjInventory[] | CjInventory | undefined | null) => {
  const inv = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return inv.length
    ? inv.reduce((t, i) => t + (toNumber(i.totalInventory ?? i.totalInventoryNum) ?? 0), 0)
    : null;
};

export function mapCjProduct(p: CjProduct): SupplierProduct {
  const set = Array.isArray(p.productImageSet)
    ? p.productImageSet
    : typeof p.productImageSet === "string"
      ? p.productImageSet.split(",")
      : [];
  return {
    provider: "cj",
    externalId: p.pid,
    url: null,
    title: (p.productNameEn || p.productName || "").trim(),
    description: p.description ?? "",
    images: httpsOnly([p.bigImage, ...set]),
    categoryHint: p.categoryName ?? "",
    currency: "USD",
    variants: (p.variants ?? []).map((v) => {
      const stock = sumInventory(v.inventories);
      return {
        id: v.vid,
        sku: v.variantSku ?? null,
        ...splitVariantName(v.variantKey || v.variantNameEn),
        cost: toNumber(v.variantSellPrice ?? p.sellPrice),
        suggestedPrice: toNumber(v.variantSugSellPrice),
        stock,
        available: stock === null ? true : stock > 0,
      };
    }),
  };
}

export const cjAdapter: SupplierAdapter = {
  key: "cj",
  name: "CJDropshipping",
  env: ["CJ_API_KEY"],
  configured: () => !!env("CJ_API_KEY"),
  parseRef(input) {
    const s = input.trim();
    // Link de produto: cjdropshipping.com/product/<nome>-p-<pid>.html
    try {
      const u = new URL(s);
      if (!/(^|\.)cjdropshipping\.com$/i.test(u.hostname)) return null;
      const m = u.pathname.match(/-p-([0-9A-Za-z-]{10,64})\.html$/);
      return m ? m[1]! : (u.searchParams.get("pid") ?? u.searchParams.get("id"));
    } catch {
      // Id ou referência colados diretamente
      return /^[0-9A-Za-z-]{10,64}$/.test(s) ? s : null;
    }
  },
  async fetchProduct(id) {
    const isSku = /^CJ[A-Z0-9]+$/i.test(id);
    const p = await cj<CjProduct>(
      `/product/query?${isSku ? "productSku" : "pid"}=${encodeURIComponent(id)}`,
    );
    if (!p?.pid) throw new SupplierError("Produto não encontrado na CJ", "cj", 404);
    return mapCjProduct(p);
  },
  async fetchStock(ids) {
    const out: StockResult[] = [];
    for (const pid of ids) {
      const d = await cj<{
        variantInventories?: { vid: string; inventory?: CjInventory[] | CjInventory }[];
      }>(`/product/stock/getInventoryByPid?pid=${encodeURIComponent(pid)}`);
      out.push({
        externalId: pid,
        variants: (d.variantInventories ?? []).map((v) => {
          const stock = sumInventory(v.inventory);
          return { id: v.vid, sku: null, stock, available: stock === null || stock > 0 };
        }),
      });
    }
    return out;
  },
};
