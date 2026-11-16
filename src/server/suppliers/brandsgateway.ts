// BrandsGateway — a API REST para sites próprios (documentação em nova.shopwoo.com/api/v1/docs)
// só é entregue com as credenciais de revendedor. Até lá, este adaptador reconhece os links
// e explica o que falta; os produtos entram pelo importador de CSV.
import { SupplierError, type SupplierAdapter } from "./types";

const env = (k: string) => process.env[k]?.trim() || "";

export const brandsgatewayAdapter: SupplierAdapter = {
  key: "brandsgateway",
  name: "BrandsGateway",
  env: ["BRANDSGATEWAY_API_URL", "BRANDSGATEWAY_API_KEY"],
  configured: () => false,
  parseRef(input) {
    try {
      const u = new URL(input.trim());
      if (!/(^|\.)brandsgateway\.com$/i.test(u.hostname)) return null;
      return u.pathname.split("/").filter(Boolean).pop() ?? null;
    } catch {
      return null;
    }
  },
  async fetchProduct() {
    throw new SupplierError(
      env("BRANDSGATEWAY_API_KEY")
        ? "A ligação à API da BrandsGateway ainda não está ativa: falta validar os pedidos com a documentação da tua conta."
        : "Peça à BrandsGateway as credenciais da API REST para sites próprios. Entretanto use o importador de CSV.",
      "brandsgateway",
    );
  },
  async ping() {
    throw new SupplierError("Ligação por ativar", "brandsgateway");
  },
  async fetchStock() {
    return [];
  },
};
