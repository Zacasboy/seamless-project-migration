// Contrato comum dos fornecedores ligados por API.
// Só corre no servidor: as chaves vêm de variáveis de ambiente e nunca chegam ao browser.

export type ProviderKey = "cj" | "printful" | "bigbuy" | "brandsgateway" | "aliexpress";

export type SupplierVariant = {
  id: string; // id da variante no fornecedor
  sku: string | null;
  size: string | null;
  color: string | null;
  cost: number | null; // preço de compra, na moeda do fornecedor
  suggestedPrice: number | null; // preço de venda sugerido pelo fornecedor, se existir
  stock: number | null; // unidades; null = desconhecido
  available: boolean;
};

export type SupplierProduct = {
  provider: ProviderKey;
  externalId: string;
  url: string | null;
  title: string;
  description: string;
  images: string[]; // só https
  categoryHint: string;
  currency: string;
  variants: SupplierVariant[];
  /** Ficha técnica do fornecedor (ex.: "Upper Material": "Suede"). */
  specs?: { name: string; value: string }[];
};

export type StockResult = {
  externalId: string;
  variants: Pick<SupplierVariant, "id" | "sku" | "stock" | "available">[];
  /** O fornecedor diz que o produto deixou de estar à venda (para Portugal): fica esgotado. */
  gone?: boolean;
  /** Falha só deste produto: o stock guardado mantém-se e os outros produtos sincronizam na mesma. */
  error?: string;
};

export interface SupplierAdapter {
  key: ProviderKey;
  name: string;
  /** Variáveis de ambiente necessárias, para mostrar no painel. */
  env: string[];
  configured(): boolean;
  /** Extrai o id do produto de um link ou de uma referência colada. Nunca faz pedidos ao link. */
  parseRef(input: string): string | null;
  fetchProduct(externalId: string): Promise<SupplierProduct>;
  fetchStock(externalIds: string[]): Promise<StockResult[]>;
  /** Pedido leve para confirmar que as credenciais funcionam. */
  ping(): Promise<void>;
}

export class SupplierError extends Error {
  constructor(
    message: string,
    public provider: ProviderKey,
    public status?: number,
  ) {
    super(message);
  }
}

export const httpsOnly = (urls: (string | null | undefined)[]) => [
  ...new Set(
    urls.filter((u): u is string => !!u && /^https:\/\/\S+$/i.test(u.trim())).map((u) => u.trim()),
  ),
];

export const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const SIZE =
  /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|one size|única|unica|\d{2}(\.5)?|\d{2}-\d{2})$/i;

/** Separa "Black-XL" / "XL / Black" / "Preto 38" em cor e tamanho. */
export function splitVariantName(name: string | null | undefined): {
  size: string | null;
  color: string | null;
} {
  if (!name) return { size: null, color: null };
  const parts = name
    .split(/\s*[-/|,]\s*|\s+(?=\d{2}\b)/)
    .map((p) => p.trim())
    .filter(Boolean);
  const size = parts.find((p) => SIZE.test(p)) ?? null;
  const color = parts.filter((p) => p !== size).join(" ") || null;
  return { size, color };
}

/** Pedido JSON com tempo limite; erros do fornecedor ficam com mensagem legível. */
export async function getJson<T>(
  provider: ProviderKey,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: "error" });
    const text = await res.text();
    if (!res.ok)
      throw new SupplierError(`O fornecedor respondeu ${res.status}`, provider, res.status);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new SupplierError("Resposta do fornecedor em formato inesperado", provider);
    }
  } catch (e) {
    if (e instanceof SupplierError) throw e;
    if ((e as Error).name === "AbortError")
      throw new SupplierError("O fornecedor demorou demasiado a responder", provider);
    throw new SupplierError("Não foi possível contactar o fornecedor", provider);
  } finally {
    clearTimeout(t);
  }
}
