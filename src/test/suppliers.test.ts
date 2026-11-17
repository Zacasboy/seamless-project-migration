import { vi } from "vitest";
import { mapCjProduct, cjAdapter } from "@/server/suppliers/cj";
import { mapPrintful, printfulAvailable, printfulAdapter } from "@/server/suppliers/printful";
import { bigbuyAdapter } from "@/server/suppliers/bigbuy";
import { resolveRef } from "@/server/suppliers";
import { splitVariantName } from "@/server/suppliers/types";

describe("fornecedores: links e referências", () => {
  it("reconhece links da CJ e recusa outros domínios", () => {
    expect(
      cjAdapter.parseRef(
        "https://cjdropshipping.com/product/leather-tote-bag-p-000B9312-456A-4D31-94BD-B083E2A198E8.html",
      ),
    ).toBe("000B9312-456A-4D31-94BD-B083E2A198E8");
    expect(
      cjAdapter.parseRef("https://cjdropshipping.com.evil.example/x-p-1234567890.html"),
    ).toBeNull();
    expect(cjAdapter.parseRef("http://169.254.169.254/latest")).toBeNull();
  });

  it("resolve o fornecedor pelo link e aceita referências com fornecedor indicado", () => {
    expect(
      resolveRef("https://www.printful.com/dashboard/sync/update?id=123456")?.adapter.key,
    ).toBe("printful");
    expect(printfulAdapter.parseRef("123456")).toBe("123456");
    expect(resolveRef("S0412345", "bigbuy")?.id).toBe("S0412345");
    expect(resolveRef("https://exemplo.pt/produto/1")).toBeNull();
    expect(bigbuyAdapter.parseRef("https://www.bigbuy.eu/pt/produto-S0412345.html")).toBe(
      "S0412345",
    );
  });

  it("separa cor e tamanho das variantes", () => {
    expect(splitVariantName("Black-XL")).toEqual({ size: "XL", color: "Black" });
    expect(splitVariantName("Preto 38")).toEqual({ size: "38", color: "Preto" });
    expect(splitVariantName("Camel")).toEqual({ size: null, color: "Camel" });
  });
});

describe("fornecedores: normalização", () => {
  it("CJ: imagens https, custo em USD e stock somado por país", () => {
    const p = mapCjProduct({
      pid: "P1",
      productNameEn: "Leather Tote",
      bigImage: "https://cf.cjdropshipping.com/a.jpg",
      productImageSet: ["https://cf.cjdropshipping.com/b.jpg", "http://inseguro/c.jpg"],
      sellPrice: "12.5",
      variants: [
        {
          vid: "V1",
          variantKey: "Black-M",
          variantSellPrice: 12.5,
          inventories: [
            { countryCode: "CN", totalInventory: 3 },
            { countryCode: "DE", totalInventory: 2 },
          ],
        },
        {
          vid: "V2",
          variantKey: "Black-L",
          inventories: [{ countryCode: "CN", totalInventory: 0 }],
        },
      ],
    });
    expect(p.images).toEqual([
      "https://cf.cjdropshipping.com/a.jpg",
      "https://cf.cjdropshipping.com/b.jpg",
    ]);
    expect(p.currency).toBe("USD");
    expect(p.variants[0]).toMatchObject({
      size: "M",
      color: "Black",
      cost: 12.5,
      stock: 5,
      available: true,
    });
    expect(p.variants[1]).toMatchObject({ size: "L", cost: 12.5, stock: 0, available: false });
  });

  it("Printful: disponibilidade pela região EU", () => {
    expect(
      printfulAvailable({
        id: 1,
        availability_status: [{ region: "EU", status: "temporary_out_of_stock" }],
      }),
    ).toBe(false);
    expect(printfulAvailable({ id: 1, in_stock: true })).toBe(true);
    const p = mapPrintful(
      {
        sync_product: {
          id: 99,
          name: "Saco de pano",
          thumbnail_url: "https://files.cdn.printful.com/t.png",
        },
        sync_variants: [
          {
            id: 1,
            sku: "SP-1",
            retail_price: "29.00",
            currency: "EUR",
            variant_id: 10,
            product: { product_id: 5, image: "https://files.cdn.printful.com/p.png" },
          },
        ],
      },
      new Map([
        [
          10,
          {
            id: 10,
            size: "One size",
            color: "Natural",
            price: "11.50",
            availability_status: [{ region: "EU", status: "in_stock" }],
          },
        ],
      ]),
    );
    expect(p.variants[0]).toMatchObject({
      size: "One size",
      color: "Natural",
      cost: 11.5,
      suggestedPrice: 29,
      available: true,
      stock: null,
    });
  });
});

describe("CJ: pedidos à API", () => {
  it("obtém o token e o produto sem bloquear a fila", async () => {
    const { __resetCjForTests } = await import("@/server/suppliers/cj");
    __resetCjForTests();
    process.env["CJ_API_KEY"] = "teste";
    const calls: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      calls.push(u);
      const body = u.includes("getAccessToken")
        ? {
            code: 200,
            result: true,
            message: "ok",
            data: { accessToken: "tok", accessTokenExpiryDate: "2099-01-01T00:00:00Z" },
          }
        : {
            code: 200,
            result: true,
            message: "ok",
            data: { pid: "P1", productNameEn: "Tote", variants: [] },
          };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const p = cjAdapter.fetchProduct("1234567890ABCD");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toMatchObject({ externalId: "P1", title: "Tote" });
    expect(calls).toHaveLength(2);
    vi.useRealTimers();
    fetchMock.mockRestore();
    delete process.env["CJ_API_KEY"];
  });
});
