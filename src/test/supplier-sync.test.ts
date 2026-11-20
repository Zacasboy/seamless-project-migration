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

import { syncSupplierStock } from "@/server/supplier-sync";

// Base de dados falsa: devolve as ligações e regista as atualizações.
function fakeDb(links: Record<string, unknown>[]) {
  const updates: { table: string; values: Record<string, unknown>; id: unknown }[] = [];
  const query = { not: () => query, limit: () => query, in: () => query, then: (ok: (v: unknown) => void) => ok({ data: links, error: null }) };
  const db = {
    from: (table: string) => ({
      select: () => query,
      update: (values: Record<string, unknown>) => ({
        eq: async (_c: string, id: unknown) => {
          updates.push({ table, values, id });
          return { error: null };
        },
      }),
    }),
  };
  return { db: db as never, updates };
}

describe("produto retirado pelo fornecedor", () => {
  it("sai da loja, fica marcado e não impede a sincronização dos outros", async () => {
    vi.spyOn(ADAPTERS.aliexpress, "configured").mockReturnValue(true);
    vi.spyOn(ADAPTERS.aliexpress, "fetchStock").mockResolvedValue([
      { externalId: "GONE", variants: [], gone: true },
      { externalId: "OK", variants: [{ id: "V-M", sku: null, stock: 9, available: true }] },
      { externalId: "ERR", variants: [], error: "AliExpress: timeout" },
    ]);
    const link = (id: string, ext: string, title: string, status = "in_stock") => ({
      id,
      product_id: `p-${id}`,
      external_product_id: ext,
      external_variants: saved,
      availability_status: status,
      suppliers: { provider_key: "aliexpress" },
      products: { title },
    });
    const { db, updates } = fakeDb([link("1", "GONE", "Camisola com bordados"), link("2", "OK", "Mocassins"), link("3", "ERR", "Cinto")]);
    const s = await syncSupplierStock(db);

    const prod = (id: string) => updates.find((u) => u.table === "products" && u.id === id)?.values;
    expect(prod("p-1")).toEqual({ stock_status: "out_of_stock", published: false });
    expect(updates.find((u) => u.table === "product_supplier_links" && u.id === "1")?.values).toMatchObject({ availability_status: "discontinued" });
    expect(prod("p-2")).toEqual({ stock_status: "in_stock" });
    expect(prod("p-3")).toBeUndefined(); // falha pontual: stock anterior mantém-se
    expect(s.checked).toBe(2);
    expect(s.errors.map((e) => e.message).join(" | ")).toMatch(/Camisola com bordados.*retirado da loja.*\| Cinto: AliExpress: timeout/);
    vi.restoreAllMocks();
  });

  it("não repete o aviso e avisa quando volta a estar à venda (sem republicar)", async () => {
    vi.spyOn(ADAPTERS.aliexpress, "configured").mockReturnValue(true);
    vi.spyOn(ADAPTERS.aliexpress, "fetchStock").mockResolvedValue([
      { externalId: "A", variants: [], gone: true },
      { externalId: "B", variants: [{ id: "V-M", sku: null, stock: 9, available: true }] },
    ]);
    const base = { external_variants: saved, suppliers: { provider_key: "aliexpress" } };
    const { db, updates } = fakeDb([
      { ...base, id: "1", product_id: "p-1", external_product_id: "A", availability_status: "discontinued", products: { title: "Já retirado" } },
      { ...base, id: "2", product_id: "p-2", external_product_id: "B", availability_status: "discontinued", products: { title: "Voltou" } },
    ]);
    const s = await syncSupplierStock(db);
    expect(s.errors.map((e) => e.message)).toEqual(["«Voltou» voltou a estar à venda no fornecedor; continua fora da loja até o publicar"]);
    expect(updates.find((u) => u.table === "products" && u.id === "p-2")?.values).toEqual({ stock_status: "in_stock" });
    vi.restoreAllMocks();
  });
});
