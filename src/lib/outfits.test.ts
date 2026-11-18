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

import { fitLayout } from "./outfits";
import { storePhotos, cutoutFor, draftCutoutFor, parseEntry } from "./photos";

describe("fitLayout", () => {
  it("mantém as proporções e fica dentro do quadro", () => {
    const l = fitLayout([
      { role: "cima", aspect: 1 },
      { role: "calcas", aspect: 0.35 },
      { role: "calcado", aspect: 2.2 },
      { role: "acessorio", aspect: 1 },
    ]);
    for (const [i, a] of [1, 0.35, 2.2, 1].entries()) {
      const x = l[i]!;
      const h = x.w / a / 1.25;
      expect(x.x).toBeGreaterThanOrEqual(0);
      expect(x.x + x.w).toBeLessThanOrEqual(100.5);
      expect(x.y + h).toBeLessThanOrEqual(100.5);
      expect(x.cutout).toBe(true);
    }
    // Calças: nunca mais largas do que a coluna da direita.
    expect(l[1]!.w).toBeLessThanOrEqual(36);
  });
});

describe("storePhotos", () => {
  const base = { gallery: ["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg"], image_url: "https://a/1.jpg" };
  const ok = (url: string) => ({ url, tipo: "recorte", estado: "aprovado" });
  it("sem tratamento mostra as originais", () => {
    expect(storePhotos(base).map((x) => x.cutout)).toEqual([false, false, false]);
  });
  it("recortes por verificar não aparecem na loja", () => {
    const p = { ...base, photo_cutouts: { "https://a/1.jpg": "https://c/1.png", "https://a/2.jpg": { url: "https://c/2.png", tipo: "recorte", estado: "pendente" } } };
    expect(storePhotos(p).every((x) => !x.cutout)).toBe(true);
    expect(cutoutFor(p)).toBeUndefined();
    expect(draftCutoutFor(p, "https://a/2.jpg")).toBe("https://c/2.png");
  });
  it("recortes aprovados primeiro e só uma fotografia com fundo, em segundo", () => {
    const p = { ...base, photo_cutouts: { "https://a/1.jpg": ok("https://c/1.png"), "https://a/2.jpg": "fundo", "https://a/3.jpg": ok("https://c/3.png") } };
    expect(storePhotos(p)).toEqual([
      { src: "https://c/1.png", cutout: true },
      { src: "https://a/2.jpg", cutout: false },
      { src: "https://c/3.png", cutout: true },
    ]);
    expect(cutoutFor(p, "https://a/3.jpg")).toBe("https://c/3.png");
  });
  it("imagem nova aprovada substitui a foto com fundo; rejeitadas ficam de fora", () => {
    const p = {
      ...base,
      photo_cutouts: {
        "https://a/1.jpg": ok("https://c/1.png"),
        "https://a/2.jpg": { url: "https://g/2.png", tipo: "foto", estado: "aprovado" },
        "https://a/3.jpg": { url: "https://c/3.png", tipo: "recorte", estado: "rejeitado" },
      },
    };
    expect(storePhotos(p)).toEqual([
      { src: "https://c/1.png", cutout: true },
      { src: "https://g/2.png", cutout: false },
    ]);
  });
  it("ignora valores inválidos", () => {
    expect(storePhotos({ ...base, photo_cutouts: { "https://a/1.jpg": "javascript:x" } })[0]!.cutout).toBe(false);
    expect(parseEntry({ tipo: "recorte", estado: "aprovado" })).toBeNull();
  });
});

describe("roleOf pelo nome", () => {
  it("o nome manda quando a categoria está errada", () => {
    expect(roleOf({ title: "Calça Casual", category: "Conjuntos", garment_type: "vestido" })).toBe("calcas");
    expect(roleOf({ title: "Cinto de couro fivela quadrada", category: "Conjuntos" })).toBe("acessorio");
    expect(roleOf({ title: "Camisola de lã", category: "Conjuntos" })).toBe("cima");
    expect(roleOf({ title: "Sapatos Mocassin", category: "Calçado" })).toBe("calcado");
  });
});
