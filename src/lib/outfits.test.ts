import { describe, expect, it } from "vitest";
import { autoLayout, boardPieces, familyOf, roleOf, suggestOutfits } from "./outfits";

const P = (o: Record<string, unknown>) => ({
  slug: String(o["id"]),
  title: String(o["id"]),
  price: 10,
  gender: "homem",
  image_url: "https://x/a.jpg",
  gallery: [],
  published: true,
  color_options: [],
  garment_type: null,
  ...o,
}) as never;

describe("conjuntos", () => {
  it("classifica papéis e famílias de cor", () => {
    expect(roleOf({ category: "Calças" })).toBe("calcas");
    expect(roleOf({ category: "Casacos" })).toBe("camada");
    expect(roleOf({ category: "Camisolas", garment_type: "Cardigans" })).toBe("camada");
    expect(roleOf({ category: "Acessórios" })).toBe("acessorio");
    expect(familyOf("Castanho escuro")).toBe("chocolate");
    expect(familyOf("Azul-marinho")).toBe("azul-marinho");
    expect(familyOf("Bege claro")).toBe("bege");
    expect(familyOf("Marfim")).toBe("creme");
  });

  it("dispõe as peças por papel sem sobrepor tudo no mesmo sítio", () => {
    const l = autoLayout([{ role: "cima" }, { role: "calcas" }, { role: "calcado" }, { role: "acessorio" }]);
    expect(new Set(l.map((x) => `${x.x},${x.y}`)).size).toBe(4);
    expect(l[1]!.x).toBeGreaterThan(l[0]!.x); // calças à direita
    expect(l[2]!.y).toBeGreaterThan(l[0]!.y); // calçado em baixo
  });

  it("sugere conjuntos com cores que combinam e do mesmo público", () => {
    const catalog = [
      P({ id: "top", category: "Camisolas", color_options: ["Castanho escuro", "Preto"] }),
      P({ id: "calca", category: "Calças", color_options: ["Creme", "Preto"] }),
      P({ id: "sapato", category: "Calçado", color_options: ["Castanho"] }),
      P({ id: "mulher", category: "Calças", gender: "mulher", color_options: ["Bege"] }),
      P({ id: "cinto", category: "Acessórios", gender: "unisex", color_options: ["Café"] }),
    ];
    const s = suggestOutfits(catalog);
    expect(s.length).toBeGreaterThan(0);
    const first = s[0]!;
    expect(first.palette).toBe("Chocolate e creme");
    expect(first.items.map((i) => i.productId)).toEqual(["top", "calca", "sapato", "cinto"]);
    expect(first.items[0]!.color).toBe("Castanho escuro");
    expect(first.items[1]!.color).toBe("Creme");
    expect(s.every((x) => !x.items.some((i) => i.productId === "mulher"))).toBe(true);
  });

  it("monta as peças do quadro e ignora produtos em falta", () => {
    const products = [
      { id: "a", slug: "a", title: "A", price: 5, category: "Camisolas", garment_type: null, image_url: "https://x/a.jpg", gallery: [] },
      { id: "b", slug: "b", title: "B", price: 7, category: "Calças", garment_type: null, image_url: null, gallery: ["https://x/b.jpg"] },
    ];
    const pieces = boardPieces(
      [
        { id: "1", product_id: "a" },
        { id: "2", product_id: "b", image_url: "https://x/recorte.png", layout: { x: 1, y: 2, w: 30, r: 0, z: 1 } },
        { id: "3", product_id: "apagado" },
      ],
      products,
    );
    expect(pieces).toHaveLength(2);
    expect(pieces[1]!.image).toBe("https://x/recorte.png");
    expect(pieces[1]!.layout.x).toBe(1);
  });
});
