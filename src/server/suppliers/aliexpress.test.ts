import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aliexpressAdapter, mapAliExpressProduct, signAliExpress } from "./aliexpress";
import { openToken, sealToken } from "../supplier-credentials";

describe("AliExpress", () => {
  it("assina parâmetros ordenados, com o caminho nas chamadas de sistema", () => {
    const params = { timestamp: "1", app_key: "k", code: "c", sign: "x" };
    const want = createHmac("sha256", "s").update("/auth/token/createapp_keykcodectimestamp1").digest("hex").toUpperCase();
    expect(signAliExpress("s", params, "/auth/token/create")).toBe(want);
    expect(signAliExpress("s", params)).toBe(
      createHmac("sha256", "s").update("app_keykcodectimestamp1").digest("hex").toUpperCase(),
    );
  });

  it("reconhece links de produto e ignora outros sites", () => {
    expect(aliexpressAdapter.parseRef("https://pt.aliexpress.com/item/1005006123456789.html?spm=a")).toBe("1005006123456789");
    expect(aliexpressAdapter.parseRef("https://www.aliexpress.com/item/1005006123456789.html")).toBe("1005006123456789");
    expect(aliexpressAdapter.parseRef("https://evil.com/item/1005006123456789.html")).toBeNull();
    expect(aliexpressAdapter.parseRef("1005006123456789")).toBe("1005006123456789");
  });

  it("converte o produto com variantes embrulhadas", () => {
    const p = mapAliExpressProduct("1", {
      ae_item_base_info_dto: { subject: " Mala ", detail: "<p>x</p>", product_status_type: "onSelling" },
      ae_multimedia_info_dto: { image_urls: "https://a/1.jpg;http://b/2.jpg;https://a/3.jpg" },
      ae_item_sku_info_dtos: {
        ae_item_sku_info_d_t_o: [
          {
            sku_id: "11",
            sku_attr: "14:1",
            offer_sale_price: "12.5",
            sku_available_stock: 0,
            currency_code: "EUR",
            ae_sku_property_dtos: {
              ae_sku_property_d_t_o: [
                { sku_property_name: "Color", sku_property_value: "black", property_value_definition_name: "Preto" },
                { sku_property_name: "Size", sku_property_value: "M" },
              ],
            },
          },
        ],
      },
    });
    expect(p.title).toBe("Mala");
    expect(p.images).toEqual(["https://a/1.jpg", "https://a/3.jpg"]);
    expect(p.variants[0]).toMatchObject({ id: "11", color: "Preto", size: "M", cost: 12.5, stock: 0, available: false });
  });

  it("cifra e decifra tokens; segredo errado falha", () => {
    const sealed = sealToken("tok", "segredo");
    expect(sealed).not.toContain("tok");
    expect(openToken(sealed, "segredo")).toBe("tok");
    expect(() => openToken(sealed, "outro")).toThrow();
  });
});

import { isAccountError, isGone } from "./aliexpress";
import { SupplierError } from "./types";
import { mergeStock, productStockStatus } from "../supplier-sync";

describe("AliExpress: produto que deixou de estar à venda", () => {
  it("«All SKU Unsaleable» e 404 contam como retirado; erros de conta param tudo", () => {
    expect(isGone(new SupplierError("AliExpress: All SKU Unsaleable", "aliexpress"), "AliExpress: All SKU Unsaleable")).toBe(true);
    expect(isGone(new SupplierError("Produto não encontrado na AliExpress", "aliexpress", 404), "x")).toBe(true);
    expect(isGone(new Error("AliExpress: timeout"), "AliExpress: timeout")).toBe(false);
    expect(isAccountError("AliExpress: Invalid access token")).toBe(true);
    expect(isAccountError("AliExpress: All SKU Unsaleable")).toBe(false);
  });
  it("retirado: todas as variantes guardadas ficam esgotadas", () => {
    const saved = [
      { id: "a", sku: "A", size: "41", color: "Preto", stock: 12, available: true },
      { id: "b", sku: "B", size: "42", color: "Preto", stock: 3, available: true },
    ];
    const merged = mergeStock(saved, []);
    expect(merged.every((v) => !v.available && v.stock === 0)).toBe(true);
    expect(productStockStatus(merged)).toBe("out_of_stock");
  });
});

import { pickStore } from "./printful";
describe("Printful: escolha da loja", () => {
  it("uma loja: usa-a; várias: pede PRINTFUL_STORE_ID com a lista", () => {
    expect(pickStore([{ id: 123, name: "Pallessiani" }])).toEqual({ id: "123", name: "Pallessiani" });
    expect(() => pickStore([{ id: 1, name: "A" }, { id: 2, name: "B" }])).toThrow(/PRINTFUL_STORE_ID.*A \(1\), B \(2\)/);
  });
});

import { printfulAdapter } from "./printful";
describe("Printful: referência do produto", () => {
  it("aceita número, ?id= e endereço com loja e produto (usa o último número)", () => {
    expect(printfulAdapter.parseRef("412345678")).toBe("412345678");
    expect(printfulAdapter.parseRef("https://www.printful.com/dashboard/sync/update?id=412345678")).toBe("412345678");
    expect(printfulAdapter.parseRef("https://www.printful.com/dashboard/stores/16789012/products/412345678")).toBe("412345678");
    expect(printfulAdapter.parseRef("https://example.com/412345678")).toBeNull();
  });
});
