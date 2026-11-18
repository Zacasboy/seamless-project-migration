import { describe, expect, it } from "vitest";
import { CATEGORY_NAMES, findType } from "./taxonomy";

const cat = (t: string) => `${findType(t)?.category}/${findType(t)?.sub}`;

describe("classificação", () => {
  it("camisas, polos e t-shirts têm categoria própria (não «Conjuntos»)", () => {
    expect(cat("Camisa de linho")).toBe("Camisas/Camisas");
    expect(cat("Men's Oxford Shirt")).toBe("Camisas/Camisas");
    expect(cat("Blusa de seda")).toBe("Camisas/Camisas");
    expect(cat("Camisola polo de malha")).toBe("Camisas/Polos");
    expect(cat("Polo shirt knitted")).toBe("Camisas/Polos");
    expect(cat("T-shirt de algodão")).toBe("Camisas/T-shirts");
  });
  it("vestidos e saias", () => {
    expect(cat("Vestido midi")).toBe("Vestidos/Vestidos");
    expect(cat("Pleated skirt")).toBe("Vestidos/Saias");
  });
  it("conjuntos de duas peças vão para Coordenados; casos antigos mantêm-se", () => {
    expect(cat("Conjunto de duas peças")).toBe("Coordenados/");
    expect(cat("Dress pants")).toBe("Calças/Sociais");
    expect(cat("Dress shoes")).toBe("Calçado/Sapatos");
    expect(cat("Suéter com Meio Zíper")).toBe("Camisolas/Camisolas");
    expect(CATEGORY_NAMES).not.toContain("Conjuntos");
  });
});
