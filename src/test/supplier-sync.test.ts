import { vi } from "vitest";
import { ADAPTERS } from "@/server/suppliers";
import { checkLinesWithSuppliers, mergeStock, productStockStatus } from "@/server/supplier-sync";

const saved = [
  { id: "V-M", sku: "A-M", size: "M", color: "Preto", stock: 4, available: true },
  { id: "V-L", sku: "A-L", size: "L", color: "Preto", stock: 2, available: true },
];

describe("sincronização de stock", () => {
  it("variante que desaparece no fornecedor fica esgotada", () => {
    const merged = mergeStock(saved, [{ id: "V-M", sku: null, stock: 0, available: false }]);
    expect(merged.map((v) => [v.id, v.available])).toEqual([
      ["V-M", false],
      ["V-L", false],
    ]);
    expect(productStockStatus(merged)).toBe("out_of_stock");
    expect(productStockStatus(saved)).toBe("in_stock");
    expect(productStockStatus([{ ...saved[0]!, stock: 3 }])).toBe("low_stock");
  });

  it("bloqueia só o tamanho esgotado e deixa passar quando o fornecedor não responde", async () => {
    vi.spyOn(ADAPTERS.cj, "configured").mockReturnValue(true);
    const fetchStock = vi.spyOn(ADAPTERS.cj, "fetchStock").mockResolvedValue([
      {
        externalId: "P1",
        variants: [
          { id: "V-M", sku: null, stock: 0, available: false },
          { id: "V-L", sku: null, stock: 5, available: true },
        ],
      },
    ]);
    const refs = [
      {
        product_id: "prod-1",
        provider_key: "cj",
        external_product_id: "P1",
        external_variants: saved,
      },
    ];
    const m = await checkLinesWithSuppliers(refs, [{ product_id: "prod-1", size: "M" }]);
    expect(m.problems).toEqual([{ product_id: "prod-1", reason: "unavailable" }]);
    const l = await checkLinesWithSuppliers(refs, [{ product_id: "prod-1", size: "L" }]);
    expect(l.problems).toEqual([]);

    fetchStock.mockRejectedValueOnce(new Error("down"));
    const down = await checkLinesWithSuppliers(refs, [{ product_id: "prod-1", size: "M" }]);
    expect(down).toEqual({ problems: [], unverified: ["prod-1"] });
    vi.restoreAllMocks();
  });
});
