import { assessChannel, channelOf } from "@/lib/channels";

const now = Date.parse("2026-11-16T12:00:00Z");
const base = { products: 0, unknownStock: 0, lastImport: null, lastStockCheck: null, now };

describe("verificação de canais", () => {
  it("classifica os fornecedores do diretório", () => {
    expect(channelOf("CJDropshipping").method).toBe("api");
    expect(channelOf("Spocket").method).toBe("csv");
    expect(channelOf("Amazon").method).toBe("none");
    expect(channelOf("Fornecedor Novo").method).toBe("csv");
  });

  it("API: por ligar, com erro, sem verificação recente e em ordem", () => {
    const env = ["CJ_API_KEY"];
    expect(assessChannel({ ...base, method: "api", api: { configured: false, env } }).state).toBe(
      "warn",
    );
    expect(
      assessChannel({
        ...base,
        method: "api",
        api: { configured: true, ok: false, error: "401", env },
      }),
    ).toMatchObject({ state: "fail" });
    expect(
      assessChannel({
        ...base,
        method: "api",
        products: 3,
        lastStockCheck: "2026-11-16T02:00:00Z",
        api: { configured: true, ok: true, env },
      }).state,
    ).toBe("warn");
    expect(
      assessChannel({
        ...base,
        method: "api",
        products: 3,
        lastStockCheck: "2026-11-16T11:30:00Z",
        api: { configured: true, ok: true, env },
      }).state,
    ).toBe("ok");
  });

  it("CSV: catálogo antigo, stock por confirmar e fornecedor que não importa", () => {
    expect(
      assessChannel({ ...base, method: "csv", products: 5, lastImport: "2026-11-01T00:00:00Z" })
        .state,
    ).toBe("warn");
    expect(
      assessChannel({
        ...base,
        method: "csv",
        products: 5,
        unknownStock: 2,
        lastImport: "2026-11-15T00:00:00Z",
      }),
    ).toMatchObject({ state: "info" });
    expect(assessChannel({ ...base, method: "none" }).state).toBe("fail");
  });
});
