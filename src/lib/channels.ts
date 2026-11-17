// Como cada fornecedor do diretório pode alimentar a loja.
// "api": ligação por link/API já disponível no painel (stock verificado automaticamente).
// "api-possible": tem API para revendedores, ainda sem ligação feita aqui.
// "csv": sem API para sites próprios; importar por CSV e confirmar stock antes de aceitar a encomenda.
// "stock": compra por grosso; a loja vende stock próprio carregado por CSV.
// "none": não serve como fonte de produtos.

export type ChannelMethod = "api" | "api-possible" | "csv" | "stock" | "none";

export type Channel = {
  method: ChannelMethod;
  provider?: "cj" | "printful" | "bigbuy" | "brandsgateway" | "aliexpress";
  /** Página onde se obtém a chave de API ou a documentação oficial (verificada). */
  docsUrl?: string;
  note: string;
};

export const CHANNELS: Record<string, Channel> = {
  CJDropshipping: {
    method: "api",
    provider: "cj",
    docsUrl: "https://developers.cjdropshipping.com/en/api/api2/api/auth.html",
    note: "Link do produto. Precisa de CJ_API_KEY no servidor.",
  },
  Printful: {
    method: "api",
    provider: "printful",
    docsUrl: "https://developers.printful.com/docs/",
    note: "Produtos da sua loja Printful. Precisa de PRINTFUL_TOKEN.",
  },
  Bigbuy: {
    method: "api",
    provider: "bigbuy",
    docsUrl: "https://www.bigbuy.eu/pt/api_bigbuy.html",
    note: "Referência BigBuy. Precisa de BIGBUY_API_KEY e BIGBUY_TAXONOMIES (plano com API).",
  },
  BrandsGateway: {
    method: "api",
    provider: "brandsgateway",
    docsUrl:
      "https://helpdesk.brandsgateway.com/en/article/do-you-have-a-solution-for-custom-built-websites-e5balp",
    note: "API entregue com conta de revendedor. Até lá, CSV.",
  },
  Printify: {
    method: "api-possible",
    docsUrl: "https://developers.printify.com/",
    note: "API aberta com token pessoal. Ligação por fazer.",
  },
  AliExpress: {
    method: "api",
    provider: "aliexpress",
    docsUrl: "https://openservice.aliexpress.com/",
    note: "Link do produto. Precisa de ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET e ligar a conta no painel.",
  },
  DSers: { method: "csv", note: "Camada sobre a AliExpress. Preferir a API da AliExpress." },
  Wholesale2B: {
    method: "api-possible",
    docsUrl: "https://t1.wholesale2b.com/dropship-api-plan.html",
    note: "Plano Dropship API. Ligação por fazer.",
  },
  Doba: { method: "api-possible", note: "Token de API na conta Doba. Ligação por fazer." },
  "Inventory Source": {
    method: "api-possible",
    docsUrl: "https://www.inventorysource.com/our-api-is-here/",
    note: "Retailer API mediante pedido. Ligação por fazer.",
  },
  Spocket: { method: "csv", note: "Só app Shopify/Wix/WooCommerce. CSV e confirmação manual." },
  Zendrop: { method: "csv", note: "Só app de lojas. CSV e confirmação manual." },
  Modalyst: { method: "csv", note: "Só app de lojas. CSV e confirmação manual." },
  Trendsi: { method: "csv", note: "Só app Shopify. CSV e confirmação manual." },
  Syncee: { method: "csv", note: "Só apps de lojas. CSV e confirmação manual." },
  "Shein Wholesale": { method: "stock", note: "Grosso: stock próprio carregado por CSV." },
  Alibaba: { method: "stock", note: "Fábricas, por grosso: stock próprio carregado por CSV." },
  Faire: {
    method: "stock",
    note: "A API é para marcas. Compra por grosso, stock próprio por CSV.",
  },
  Banggood: { method: "none", note: "API só para parceiros aprovados; indisponível." },
  SaleHoo: { method: "none", note: "Diretório de fornecedores, sem produtos para importar." },
  Amazon: { method: "none", note: "A API é para vender na Amazon, não para comprar." },
};

export const METHOD_LABEL: Record<ChannelMethod, string> = {
  api: "Link / API",
  "api-possible": "API por ligar",
  csv: "CSV",
  stock: "Stock próprio (CSV)",
  none: "Não importa",
};

export const channelOf = (name: string): Channel =>
  CHANNELS[name] ?? { method: "csv", note: "Sem ligação conhecida: importar por CSV." };

// Tempo máximo entre verificações antes de o canal ser assinalado.
export const STALE_API_HOURS = 6;
export const STALE_CSV_DAYS = 7;

export type ChannelState = "ok" | "warn" | "fail" | "info";
export type ChannelCheck = {
  supplierId: string;
  name: string;
  website: string | null;
  method: ChannelMethod;
  docsUrl: string | null;
  state: ChannelState;
  message: string;
  products: number;
  lastActivity: string | null;
};

/**
 * Avalia um canal a partir de factos já recolhidos (sem rede), para poder ser testado.
 * `api` é o resultado do teste à API quando o canal é por link/API.
 */
export function assessChannel(input: {
  method: ChannelMethod;
  products: number;
  unknownStock: number;
  lastImport: string | null;
  lastStockCheck: string | null;
  api?: { configured: boolean; ok?: boolean; error?: string | null; env: string[] } | undefined;
  now?: number;
}): { state: ChannelState; message: string } {
  const now = input.now ?? Date.now();
  const hoursSince = (iso: string | null) => (iso ? (now - Date.parse(iso)) / 3600_000 : Infinity);

  if (input.method === "none")
    return {
      state: "fail",
      message: "Este fornecedor não serve para importar produtos. Retire-o dos importadores.",
    };

  if (input.method === "api") {
    const a = input.api;
    if (!a?.configured)
      return {
        state: "warn",
        message: `Por ligar: defina ${a?.env.join(", ") ?? "a chave"} no servidor.`,
      };
    if (a.ok === false)
      return { state: "fail", message: `A API não respondeu: ${a.error ?? "erro desconhecido"}.` };
    if (input.products === 0)
      return { state: "info", message: "Ligado. Ainda sem produtos importados." };
    if (hoursSince(input.lastStockCheck) > STALE_API_HOURS)
      return {
        state: "warn",
        message: `Stock não é verificado há mais de ${STALE_API_HOURS} h. Sincronize ou ative a tarefa automática.`,
      };
    return { state: "ok", message: "Ligado e com stock verificado." };
  }

  // CSV, API por ligar e stock próprio: o stock depende do ficheiro.
  if (input.products === 0) return { state: "info", message: "Sem produtos importados." };
  if (hoursSince(input.lastImport) > STALE_CSV_DAYS * 24)
    return {
      state: "warn",
      message: `Último CSV há mais de ${STALE_CSV_DAYS} dias. Reimporte para atualizar preços e stock.`,
    };
  if (input.unknownStock > 0)
    return {
      state: "info",
      message: `${input.unknownStock} produtos com stock por confirmar: confirme com o fornecedor antes de aceitar a encomenda.`,
    };
  return { state: "ok", message: "Catálogo atualizado." };
}
