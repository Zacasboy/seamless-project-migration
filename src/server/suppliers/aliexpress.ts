// AliExpress — Open Platform (openservice.aliexpress.com), app da categoria Drop Shipping.
// Gateway api-sg.aliexpress.com. Assinatura HMAC-SHA256 (sign_method=sha256) sobre os
// parâmetros ordenados (chave+valor); nas interfaces de sistema (/auth/...) o caminho da API
// vem antes dos parâmetros. Produtos: aliexpress.ds.product.get com o token do dono da loja.
import { createHmac } from "node:crypto";
import {
  SupplierError,
  httpsOnly,
  toNumber,
  type StockResult,
  type SupplierAdapter,
  type SupplierProduct,
  type SupplierVariant,
} from "./types";

const GATEWAY = "https://api-sg.aliexpress.com";
const env = (k: string) => process.env[k]?.trim() || "";
const appKey = () => env("ALIEXPRESS_APP_KEY");
const appSecret = () => env("ALIEXPRESS_APP_SECRET");

export const ALIEXPRESS_CALLBACK_PATH = "/api/aliexpress/callback";

/** Tem de ser igual ao Callback URL registado na app (ALIEXPRESS_CALLBACK_URL sobrepõe-se). */
export function aliexpressRedirectUri(origin: string) {
  return env("ALIEXPRESS_CALLBACK_URL") || `${origin}${ALIEXPRESS_CALLBACK_PATH}`;
}

/** Assinatura oficial: HMAC-SHA256(segredo, [caminho] + k1v1k2v2…) em hexadecimal maiúsculo. */
export function signAliExpress(secret: string, params: Record<string, string>, apiPath?: string) {
  const base =
    (apiPath ?? "") +
    Object.keys(params)
      .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== "")
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("");
  return createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase();
}

async function post(url: string, params: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(params).toString(),
      signal: ctrl.signal,
      redirect: "error",
    });
    const text = await res.text();
    if (!res.ok) throw new SupplierError(`A AliExpress respondeu ${res.status}`, "aliexpress", res.status);
    return JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof SupplierError) throw e;
    if ((e as Error).name === "AbortError")
      throw new SupplierError("A AliExpress demorou demasiado a responder", "aliexpress");
    throw new SupplierError("Não foi possível contactar a AliExpress", "aliexpress");
  } finally {
    clearTimeout(t);
  }
}

const common = () => ({ app_key: appKey(), timestamp: String(Date.now()), sign_method: "sha256" });

// ---------- OAuth (interfaces de sistema) ----------

export function authorizeUrl(redirectUri: string, state: string) {
  const u = new URL(`${GATEWAY}/oauth/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("force_auth", "true");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("client_id", appKey());
  u.searchParams.set("state", state);
  return u.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expire_time?: number | string; // ms
  refresh_token_valid_time?: number | string; // ms
  account?: string;
  code?: string;
  message?: string;
};

async function systemCall(apiPath: string, extra: Record<string, string>): Promise<TokenResponse> {
  const params: Record<string, string> = { ...common(), ...extra };
  params["sign"] = signAliExpress(appSecret(), params, apiPath);
  const r = (await post(`${GATEWAY}/rest${apiPath}`, params)) as TokenResponse;
  if (!r.access_token) {
    throw new SupplierError(`AliExpress recusou a autorização: ${r.message ?? r.code ?? "sem token"}`, "aliexpress");
  }
  return r;
}

const ms = (v: unknown) => {
  const n = toNumber(v);
  return n ? new Date(n).toISOString() : null;
};

function toCredential(r: TokenResponse) {
  return {
    accessToken: r.access_token!,
    refreshToken: r.refresh_token ?? null,
    expiresAt: ms(r.expire_time),
    refreshExpiresAt: ms(r.refresh_token_valid_time),
    account: r.account ?? null,
  };
}

export async function exchangeCode(code: string) {
  const cred = toCredential(await systemCall("/auth/token/create", { code }));
  cached = null;
  return cred;
}

async function refresh(refreshToken: string) {
  return toCredential(await systemCall("/auth/token/refresh", { refresh_token: refreshToken }));
}

// Token em memória por instância; a fonte de verdade é a tabela cifrada.
let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 3600_000) return cached.token;
  const { loadCredential, saveCredential } = await import("../supplier-credentials");
  let cred = await loadCredential("aliexpress", appSecret());
  if (!cred) throw new SupplierError("Falta ligar a conta AliExpress no painel (botão «Ligar AliExpress»).", "aliexpress");
  const exp = cred.expiresAt ? Date.parse(cred.expiresAt) : Infinity;
  if (exp < Date.now() + 24 * 3600_000 && cred.refreshToken) {
    cred = await refresh(cred.refreshToken);
    await saveCredential("aliexpress", appSecret(), cred);
  } else if (exp < Date.now()) {
    throw new SupplierError("A autorização da AliExpress expirou. Volte a ligar a conta no painel.", "aliexpress");
  }
  cached = { token: cred.accessToken, expires: cred.expiresAt ? Date.parse(cred.expiresAt) : Date.now() + 86400_000 };
  return cached.token;
}

// ---------- Interfaces de negócio ----------

async function businessCall(method: string, extra: Record<string, string>) {
  const params: Record<string, string> = { ...common(), method, access_token: await accessToken(), ...extra };
  params["sign"] = signAliExpress(appSecret(), params);
  const r = await post(`${GATEWAY}/sync`, params);
  const errorResponse = r["error_response"] as { msg?: string; sub_msg?: string; code?: string } | undefined;
  if (errorResponse) {
    if (/token/i.test(`${errorResponse.code} ${errorResponse.msg}`)) cached = null;
    throw new SupplierError(`AliExpress: ${errorResponse.sub_msg ?? errorResponse.msg ?? errorResponse.code}`, "aliexpress");
  }
  const key = `${method.replace(/\./g, "_")}_response`;
  const body = (r[key] ?? r) as { result?: unknown; rsp_code?: number | string; rsp_msg?: string };
  if (body.rsp_code !== undefined && String(body.rsp_code) !== "200")
    throw new SupplierError(`AliExpress: ${body.rsp_msg ?? body.rsp_code}`, "aliexpress");
  return body.result;
}

// As listas da AliExpress podem vir embrulhadas: { ae_item_sku_info_d_t_o: [...] }.
function list<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    const inner = Object.values(v as Record<string, unknown>).find(Array.isArray);
    if (inner) return inner as T[];
  }
  return [];
}

type AeSkuProp = {
  sku_property_name?: string;
  sku_property_value?: string;
  property_value_definition_name?: string;
};
type AeSku = {
  id?: string | number;
  sku_id?: string | number;
  sku_attr?: string;
  sku_price?: string | number;
  offer_sale_price?: string | number;
  sku_available_stock?: number | string;
  ipm_sku_stock?: number | string;
  currency_code?: string;
  ae_sku_property_dtos?: unknown;
};
type AeProp = { attr_name?: string; attr_value?: string };
type AeResult = {
  ae_item_properties?: unknown;
  ae_item_base_info_dto?: { subject?: string; detail?: string; product_id?: number | string; currency_code?: string; product_status_type?: string };
  ae_multimedia_info_dto?: { image_urls?: string };
  ae_item_sku_info_dtos?: unknown;
};

const SIZE_NAME = /size|tamanho|talla|taille|größe/i;
const COLOR_NAME = /colou?r|cor\b|farbe|couleur/i;

export function mapAliExpressProduct(productId: string, r: AeResult): SupplierProduct {
  const base = r.ae_item_base_info_dto ?? {};
  const images = httpsOnly((r.ae_multimedia_info_dto?.image_urls ?? "").split(/[;,]/).map((s) => s.trim()));
  const online = !base.product_status_type || base.product_status_type === "onSelling";
  const variants: SupplierVariant[] = list<AeSku>(r.ae_item_sku_info_dtos).map((s, i) => {
    const props = list<AeSkuProp>(s.ae_sku_property_dtos);
    const val = (p: AeSkuProp) => (p.property_value_definition_name || p.sku_property_value || "").trim() || null;
    const size = props.find((p) => SIZE_NAME.test(p.sku_property_name ?? ""));
    const color = props.find((p) => COLOR_NAME.test(p.sku_property_name ?? "")) ?? props.find((p) => p !== size);
    const stock = toNumber(s.sku_available_stock ?? s.ipm_sku_stock);
    return {
      id: String(s.sku_id ?? s.id ?? s.sku_attr ?? i),
      sku: s.sku_attr ?? null,
      size: size ? val(size) : null,
      color: color ? val(color) : null,
      cost: toNumber(s.offer_sale_price ?? s.sku_price),
      suggestedPrice: null,
      stock,
      available: online && (stock === null || stock > 0),
    };
  });
  return {
    provider: "aliexpress",
    externalId: productId,
    url: `https://www.aliexpress.com/item/${productId}.html`,
    title: (base.subject ?? "").trim(),
    description: base.detail ?? "",
    images,
    categoryHint: base.subject ?? "",
    currency: list<AeSku>(r.ae_item_sku_info_dtos)[0]?.currency_code ?? base.currency_code ?? "EUR",
    variants,
    specs: list<AeProp>(r.ae_item_properties)
      .map((x) => ({ name: (x.attr_name ?? "").trim(), value: (x.attr_value ?? "").trim() }))
      .filter((x) => x.name && x.value && x.name.length <= 60 && x.value.length <= 120)
      .slice(0, 30),
  };
}

async function getProduct(id: string) {
  const result = (await businessCall("aliexpress.ds.product.get", {
    product_id: id,
    ship_to_country: "PT",
    target_currency: "EUR",
    target_language: "pt",
  })) as AeResult | undefined;
  if (!result?.ae_item_base_info_dto) throw new SupplierError("Produto não encontrado na AliExpress", "aliexpress", 404);
  return mapAliExpressProduct(id, result);
}

export const aliexpressAdapter: SupplierAdapter = {
  key: "aliexpress",
  name: "AliExpress",
  env: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET", "SUPABASE_SERVICE_ROLE_KEY"],
  configured: () => !!appKey() && !!appSecret() && !!env("SUPABASE_SERVICE_ROLE_KEY"),
  parseRef(input) {
    const s = input.trim();
    try {
      const u = new URL(s);
      if (!/(^|\.)aliexpress\.(com|us|ru)$/i.test(u.hostname)) return null;
      return u.pathname.match(/\/item\/(?:[^/]*?\D)?(\d{9,20})\.html/)?.[1] ?? null;
    } catch {
      return /^\d{9,20}$/.test(s) ? s : null;
    }
  },
  fetchProduct: getProduct,
  async fetchStock(ids) {
    const out: StockResult[] = [];
    for (const id of ids) {
      const p = await getProduct(id);
      out.push({ externalId: id, variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, stock: v.stock, available: v.available })) });
    }
    return out;
  },
  async ping() {
    await accessToken();
  },
};

/** Só para testes. */
export function __resetAliExpressForTests() {
  cached = null;
}
