// BigBuy — API REST (api.bigbuy.eu), autenticação "Authorization: Bearer <API_KEY>".
// Usa os pedidos em massa por taxonomia descritos no guia oficial da API:
// products, productsinformation, productsimages, productsvariations, variations, attributes
// e o stock por prazo de envio. BIGBUY_TAXONOMIES limita às categorias da loja (ids separados por vírgula).
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

const env = (k: string) => process.env[k]?.trim() || "";
const base = () =>
  env("BIGBUY_SANDBOX") === "1" ? "https://api.sandbox.bigbuy.eu" : "https://api.bigbuy.eu";
const taxonomies = () =>
  env("BIGBUY_TAXONOMIES")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d+$/.test(t));

const cache = new Map<string, { at: number; data: unknown }>();
async function bb<T>(path: string, ttlMs = 10 * 60_000): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await getJson<T>("bigbuy", `${base()}${path}`, {
    headers: { Authorization: `Bearer ${env("BIGBUY_API_KEY")}` },
    timeoutMs: 30_000,
  });
  cache.set(path, { at: Date.now(), data });
  return data;
}

type BbProduct = {
  id: number;
  sku: string;
  wholesalePrice?: number;
  retailPrice?: number;
  inShopsPrice?: number;
  taxonomy?: number;
};
type BbInfo = { id: number; sku: string; name?: string; description?: string; url?: string };
type BbImages = { id: number; images?: { url: string; isCover?: boolean | string }[] };
type BbVariation = {
  id: number;
  product: number;
  sku: string;
  wholesalePrice?: number;
  retailPrice?: number;
  inShopsPrice?: number;
};
type BbVariationAttrs = { id: number; attributes?: { id: number }[] };
type BbAttribute = { id: number; name: string; attributeGroup?: number };
type BbStock = { id?: number; sku: string; stocks?: { quantity: number }[] };

const qty = (s: BbStock | undefined) =>
  s?.stocks ? s.stocks.reduce((t, x) => t + (toNumber(x.quantity) ?? 0), 0) : null;

async function findInTaxonomies(sku: string) {
  const list = taxonomies();
  if (list.length === 0)
    throw new SupplierError("Defina BIGBUY_TAXONOMIES com as categorias BigBuy da loja", "bigbuy");
  for (const t of list) {
    const products = await bb<BbProduct[]>(`/rest/catalog/products.json?parentTaxonomy=${t}`);
    const p = products.find((x) => x.sku === sku || String(x.id) === sku);
    if (p) return { p, taxonomy: t };
  }
  throw new SupplierError(
    `Referência ${sku} não encontrada nas categorias BigBuy configuradas`,
    "bigbuy",
    404,
  );
}

export const bigbuyAdapter: SupplierAdapter = {
  key: "bigbuy",
  name: "BigBuy",
  env: ["BIGBUY_API_KEY", "BIGBUY_TAXONOMIES", "BIGBUY_SANDBOX (opcional)"],
  configured: () => !!env("BIGBUY_API_KEY") && taxonomies().length > 0,
  parseRef(input) {
    const s = input.trim();
    try {
      const u = new URL(s);
      if (!/(^|\.)bigbuy\.eu$/i.test(u.hostname)) return null;
      return u.pathname.match(/\b([A-Z]\d{7})\b/)?.[1] ?? null;
    } catch {
      return /^[A-Z]?\d{5,10}$/.test(s) ? s : null;
    }
  },
  async fetchProduct(ref) {
    const { p, taxonomy: t } = await findInTaxonomies(ref);
    const [info, images, variations, varAttrs, attrs, stock, varStock] = await Promise.all([
      bb<BbInfo[]>(`/rest/catalog/productsinformation.json?isoCode=pt&parentTaxonomy=${t}`),
      bb<BbImages[]>(`/rest/catalog/productsimages.json?parentTaxonomy=${t}`),
      bb<BbVariation[]>(`/rest/catalog/productsvariations.json?parentTaxonomy=${t}`),
      bb<BbVariationAttrs[]>(`/rest/catalog/variations.json?parentTaxonomy=${t}`),
      bb<BbAttribute[]>(`/rest/catalog/attributes.json?isoCode=pt&parentTaxonomy=${t}`),
      bb<BbStock[]>(`/rest/catalog/productsstockbyhandlingdays.json?parentTaxonomy=${t}`, 60_000),
      bb<BbStock[]>(
        `/rest/catalog/productsvariationsstockbyhandlingdays.json?parentTaxonomy=${t}`,
        60_000,
      ),
    ]);
    const inf = info.find((i) => i.id === p.id);
    const img = images.find((i) => i.id === p.id)?.images ?? [];
    const cover = img.filter((i) => i.isCover === true || i.isCover === "TRUE");
    const attrName = new Map(attrs.map((a) => [a.id, a.name]));
    const vars = variations.filter((v) => v.product === p.id);
    const product: SupplierProduct = {
      provider: "bigbuy",
      externalId: p.sku,
      url: inf?.url && /^https:/.test(inf.url) ? inf.url : null,
      title: inf?.name?.trim() ?? p.sku,
      description: inf?.description ?? "",
      images: httpsOnly([...cover.map((i) => i.url), ...img.map((i) => i.url)]),
      categoryHint: inf?.name ?? "",
      currency: "EUR",
      variants: vars.length
        ? vars.map((v) => {
            const names = (varAttrs.find((a) => a.id === v.id)?.attributes ?? [])
              .map((a) => attrName.get(a.id))
              .filter(Boolean)
              .join(" / ");
            const st = qty(varStock.find((s) => s.id === v.id || s.sku === v.sku));
            return {
              id: String(v.id),
              sku: v.sku,
              ...splitVariantName(names),
              cost: toNumber(v.wholesalePrice),
              suggestedPrice: toNumber(v.inShopsPrice ?? v.retailPrice),
              stock: st,
              available: st === null || st > 0,
            };
          })
        : [
            (() => {
              const st = qty(stock.find((s) => s.sku === p.sku));
              return {
                id: String(p.id),
                sku: p.sku,
                size: null,
                color: null,
                cost: toNumber(p.wholesalePrice),
                suggestedPrice: toNumber(p.inShopsPrice ?? p.retailPrice),
                stock: st,
                available: st === null || st > 0,
              };
            })(),
          ],
    };
    return product;
  },
  async ping() {
    const t = taxonomies()[0];
    if (!t) throw new SupplierError("Defina BIGBUY_TAXONOMIES", "bigbuy");
    await bb<unknown>(`/rest/catalog/products.json?parentTaxonomy=${t}`);
  },
  async fetchStock(refs) {
    const out: StockResult[] = [];
    for (const ref of refs) {
      const p = await this.fetchProduct(ref);
      out.push({
        externalId: ref,
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
