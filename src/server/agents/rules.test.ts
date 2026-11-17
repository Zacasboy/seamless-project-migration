import { describe, expect, it } from "vitest";
import {
  cleanDescription,
  cleanTitle,
  cutWords,
  decodeEntities,
  inferGender,
  inferType,
  metaDescription,
  normalizeColors,
  normalizeSizes,
  planProduct,
} from "./rules";

// Casos reais (produtos importados a 17/11/2026).
const CJ = {
  id: "cj",
  title: "Fashion Men's British Style Casual Leather Shoes",
  description:
    "Product information: Pattern: solid color Color: WJZ-8881 Black, WJZ-8881 Gold, WJZ-8881 Silver Processing Method: paint surface Size: 37, 38, 39, 40, 41, 42, 43, 44, 45 Toe holder shape: round head Shoe Upper material: Microfiber Applicable Gender: Male Style: Casual Packing list: Men's shoes *1 pair Product Image:",
  category: "Calçado",
  gender: "homem",
  garment_type: null,
  meta_title: null,
  meta_description: null,
  image_alt: "Fashion Men's British Style Casual Leather Shoes",
  image_url: "https://x/a.jpg",
  size_options: ["37", "38", "39", "40", "41", "42", "43", "44", "45"],
  color_options: ["Black"],
  published: true,
  stock_status: "in_stock",
  price: 22.9,
  cost: 8.8,
};
const AE = {
  ...CJ,
  id: "ae",
  title:
    "Sapatos Casuais Masculinos de Couro de Cervo 2025 Tamanho Grande 48 Versáteis Confortáveis para Trabalho Mocassins de Couro Camurça Formais",
  description:
    "nome do mod=ckeditor nome do mod=ckeditor nome do mod=ckeditor &nbsp; Lembrete: os sapatos s&atilde;o em tamanhos chineses e escolher o tamanho com base no comprimento do p&eacute; &eacute; o mais preciso. Exemplo: Comprimento do p&eacute; 25cm, escolha o tamanho 40",
  gender: "unisex",
  image_alt: null,
  size_options: ["40", "41", "42", "43", "46", "47", "48", "39", "44", "45"],
  color_options: ["brown", "dark blue", "green", "beige", "blue", "gray", "black"],
  price: 82.9,
  cost: 33.02,
};
const cfg = { rules: {}, product_language: "manter" as const };

describe("rotinas: funções", () => {
  it("descodifica entidades HTML", () => {
    expect(decodeEntities("s&atilde;o p&eacute; &amp; &#233;")).toBe("são pé & é");
  });

  it("limpa nomes sem traduzir", () => {
    expect(cleanTitle("NEW 2025 Hot Sale WOMEN LEATHER BAG Free Shipping ✨")).toBe("Women Leather Bag");
    expect(cleanTitle("Fashion Men's British Style Casual Leather Shoes")).toBe("Fashion Men's British Style Casual Leather Shoes");
    const t = cleanTitle(AE.title);
    expect(t).not.toMatch(/2025/);
    expect(t.length).toBeLessThanOrEqual(90);
    expect(t).not.toMatch(/\s(de|para|com)$/);
  });

  it("corta em palavras sem terminar em preposição", () => {
    expect(cutWords("Mala de ombro em pele para", 26)).toBe("Mala de ombro em pele");
  });

  it("limpa a descrição da AliExpress", () => {
    const d = cleanDescription(AE.description);
    expect(d).not.toMatch(/ckeditor|&\w+;/);
    expect(d).toMatch(/^Lembrete: os sapatos são em tamanhos chineses/);
  });

  it("separa a ficha técnica da CJ em linhas", () => {
    const lines = cleanDescription(CJ.description).split("\n");
    expect(lines).toContain("Pattern: solid color");
    expect(lines).toContain("Processing Method: paint surface");
    expect(lines).toContain("Shoe Upper material: Microfiber");
    expect(lines.some((l) => /^Silver Processing/.test(l))).toBe(false);
  });

  it("ordena tamanhos e uniformiza cores", () => {
    expect(normalizeSizes(AE.size_options)).toEqual(["39", "40", "41", "42", "43", "44", "45", "46", "47", "48"]);
    expect(normalizeSizes(["xl", "S", "m", "XXL", "s"])).toEqual(["S", "M", "XL", "XXL"]);
    expect(normalizeColors(["brown", "dark blue", "Brown"], "manter")).toEqual(["Brown", "Dark blue"]);
    expect(normalizeColors(["brown", "dark blue"], "pt")).toEqual(["Castanho", "Azul escuro"]);
    expect(normalizeColors(["Preto"], "en")).toEqual(["Black"]);
  });

  it("deteta género e tipo", () => {
    expect(inferGender("Sapatos Casuais Masculinos")).toBe("homem");
    expect(inferGender("Women's tote bag")).toBe("mulher");
    expect(inferGender("Unisex sneakers")).toBeNull();
    expect(inferType("... Trabalho Mocassins de Couro")).toEqual({ type: "Mocassins", category: "Calçado" });
    expect(inferType("Casual Leather Shoes")).toEqual({ type: "Sapatos", category: "Calçado" });
    expect(inferType("Crossbody bag")).toEqual({ type: "Malas tiracolo", category: "Malas" });
  });

  it("meta description ignora avisos e tem até 160 caracteres", () => {
    expect(metaDescription("Lembrete: tamanhos chineses.\nMala espaçosa em pele sintética com alça regulável e fecho de correr, ideal para o dia a dia.")).toBe(
      "Mala espaçosa em pele sintética com alça regulável e fecho de correr, ideal para o dia a dia.",
    );
    expect(metaDescription("curta")).toBeNull();
    expect((metaDescription("palavra ".repeat(60)) ?? "").length).toBeLessThanOrEqual(160);
  });
});

describe("rotinas: plano por produto", () => {
  it("AliExpress: limpa, classifica e preenche sem tocar no preço", () => {
    const r = planProduct(AE, cfg);
    expect(r.patch["gender"]).toBe("homem");
    expect(r.patch["garment_type"]).toBe("Mocassins");
    expect(r.patch["meta_title"]).toMatch(/ \| Pallessiani$/);
    expect(String(r.patch["meta_title"]).length).toBeLessThanOrEqual(70);
    expect(r.patch["image_alt"]).toBeTruthy();
    expect(r.patch).not.toHaveProperty("price");
    expect(r.patch).not.toHaveProperty("category"); // já era válida
    expect(r.patch).not.toHaveProperty("published");
  });

  it("CJ: nome em inglês só com tipo e material (o material vem da ficha, não do nome)", () => {
    const r = planProduct(CJ, cfg);
    expect(r.patch["title"]).toBe("Microfibre shoes");
    expect(r.patch).not.toHaveProperty("gender");
    expect(r.patch["garment_type"]).toBe("Sapatos");
    expect(r.patch["meta_title"]).toBe("Microfibre shoes | Pallessiani");
    expect(r.patch["meta_description"]).toBe("Microfibre shoes for men. Sizes 37–45. Colour: Black. Shop at Pallessiani with delivery to Portugal.");
    expect(r.patch["image_alt"]).toBe("Microfibre shoes, Black");
  });

  it("AliExpress: nome em português só com tipo e material, sem tamanho, sexo nem ano", () => {
    const r = planProduct(AE, cfg);
    expect(r.patch["title"]).toBe("Mocassins de camurça");
    const md = String(r.patch["meta_description"]);
    expect(md).toBe("Mocassins de camurça para homem. Tamanhos 39–48. Disponível em 7 cores. Compre na Pallessiani, com entrega em Portugal.");
    expect(md.length).toBeLessThanOrEqual(160);
  });

  it("é idempotente: aplicar duas vezes não muda mais nada", () => {
    const once = { ...AE, ...planProduct(AE, cfg).patch } as typeof AE;
    expect(planProduct(once, cfg).rules).toEqual([]);
  });

  it("regras desligadas não atuam; retirar sem foto só se ligada", () => {
    const off = { rules: { titulos: false, descricoes: false, opcoes: false, classificacao: false, seo: false, alt: false }, product_language: "manter" as const };
    expect(planProduct(AE, off).rules).toEqual([]);
    const noPhoto = { ...CJ, image_url: null };
    expect(planProduct(noPhoto, cfg).patch).not.toHaveProperty("published");
    expect(planProduct(noPhoto, { ...cfg, rules: { sem_foto: true } }).patch["published"]).toBe(false);
  });

  it("tira o rótulo vazio; avisa pele vs. sintético só se o nome continuar a dizer pele", () => {
    expect(cleanDescription(CJ.description)).not.toMatch(/Product Image/);
    expect(planProduct(CJ, cfg).alerts.join()).not.toMatch(/material sintético/);
    expect(planProduct(CJ, { ...cfg, rules: { titulos: false } }).alerts.join()).toMatch(/material sintético/);
    expect(metaDescription(cleanDescription(CJ.description))).toMatch(/^Pattern: solid color\./);
  });

  it("avisa margem baixa sem alterar o preço", () => {
    expect(planProduct({ ...CJ, price: 10 }, cfg).alerts.join()).toMatch(/margem baixa/);
  });
});

import { buildTitle, detectLang, findMaterial, findType, titleProblems } from "./product-text";

describe("nomes: tipo de produto + material", () => {
  it("deteta tipo, material e língua", () => {
    expect(findType("Women's Quilted Crossbody Bag")?.en).toBe("Crossbody bag");
    expect(findType("Botins Chelsea em pele")?.pt).toBe("Botins");
    expect(findType("Classic Brogues")?.en).toBe("Brogues");
    expect(findMaterial("PU Leather Tote", "")?.pt).toBe("pele sintética");
    expect(findMaterial("Wool coat", "")?.en).toBe("wool");
    expect(findMaterial("Casaco de lã", "")?.pt).toBe("lã");
    expect(findMaterial("Leather Shoes", "Upper material: Cotton")?.en).toBe("cotton");
    expect(detectLang("Sapatos de couro para homem")).toBe("pt");
    expect(detectLang("Leather shoes for men")).toBe("en");
  });

  it("monta o nome na língua do produto", () => {
    const loafer = findType("loafers")!;
    const suede = findMaterial("suede", "")!;
    expect(buildTitle(loafer, suede, "pt")).toBe("Loafers de camurça");
    expect(buildTitle(loafer, suede, "en")).toBe("Suede loafers");
    expect(buildTitle(loafer, null, "en")).toBe("Loafers");
  });

  it("deteta tamanho, sexo e fabricante no nome", () => {
    expect(titleProblems("Mocassins de camurça")).toEqual([]);
    expect(titleProblems("Leather loafers")).toEqual([]);
    expect(titleProblems("Loafers size 42")).toContain("tamanho");
    expect(titleProblems("Men's leather loafers")).toContain("sexo");
    expect(titleProblems("Sapatos femininos de couro")).toContain("sexo");
    expect(titleProblems("WJZ-8881 leather shoes")).toContain("fabricante, código ou ruído");
    expect(titleProblems("Zara leather loafers", "Zara")).toContain("fabricante, código ou ruído");
  });

  it("é idempotente e respeita nomes já bons", () => {
    const once = { ...AE, ...planProduct(AE, cfg).patch } as typeof AE;
    expect(planProduct(once, cfg).rules).toEqual([]);
    const cj = { ...CJ, ...planProduct(CJ, cfg).patch } as typeof CJ;
    expect(planProduct(cj, cfg).rules).toEqual([]);
    const manual = { ...CJ, title: "Sapatos Derby de microfibra", image_alt: "Fashion Men's British Style Casual Leather Shoes size 40" };
    const m = planProduct(manual, cfg).patch;
    expect(m).not.toHaveProperty("title"); // já tem tipo e material: fica
    expect(m["image_alt"]).toBe("Sapatos Derby de microfibra, Preto"); // cores na língua do nome // texto alternativo antigo do fornecedor é substituído
    // Sem o material da ficha, o nome é completado.
    expect(planProduct({ ...CJ, title: "Sapatos Derby pretos" }, cfg).patch["title"]).toBe("Sapatos Derby de microfibra");
  });

  it("com língua fixada, traduz tipo e material", () => {
    const r = planProduct({ ...CJ, title: "Leather loafers" }, { rules: {}, product_language: "pt" });
    expect(r.patch["title"]).toBe("Loafers de microfibra");
  });
});

import { cleanColorName, toEuropeanPortuguese } from "./product-text";

describe("casos reais da loja (17/11)", () => {
  const base = { ...AE, description: "", size_options: [] as string[], color_options: [] as string[], meta_title: null as string | null, meta_description: null as string | null, image_alt: null as string | null, garment_type: null as string | null, gender: "homem" };
  const t = (o: Partial<typeof base>) => planProduct({ ...base, ...o } as typeof AE, cfg).patch;

  it("corrige nomes contraditórios ou incompletos e a categoria", () => {
    expect(t({ title: "Sapatos Couro de Cervo", garment_type: "mocassins" })["title"]).toBe("Mocassins de couro");
    const calca = t({ title: "Calça Casual", garment_type: "vestido", category: "Conjuntos" });
    expect(calca["title"]).toBe("Calças");
    expect(calca["category"]).toBe("Calças");
    expect(calca["garment_type"]).toBe("Casuais");
    const terno = t({ title: "Calças de Terno", category: "Conjuntos" });
    expect(terno["title"]).toBe("Calças sociais");
    expect(terno["garment_type"]).toBe("Sociais");
    const sueter = t({ title: "Suéter de Tricô com Meio Zíper", category: "Conjuntos" });
    expect(sueter["title"]).toBe("Camisola de malha com meio fecho");
    expect(sueter["category"]).toBe("Camisolas");
    expect(t({ title: "Suéter com bordados", category: "Conjuntos" })["title"]).toBe("Camisola com bordados");
    const cachecol = t({ title: "Cachecol de Lã com Franjas", category: "Conjuntos", description: "Material: Mistura de lã" });
    expect(cachecol["category"]).toBe("Acessórios");
    expect(cachecol["garment_type"]).toBe("Cachecóis");
    expect(cachecol).not.toHaveProperty("title"); // já tem tipo, material e detalhe
    const cinto = t({ title: "Cinto de couro fivela quadrada", category: "Conjuntos" });
    expect(cinto).not.toHaveProperty("title");
    expect(cinto["category"]).toBe("Acessórios");
    const casaco = t({ title: "Casaco de pele sintética", category: "Conjuntos", description: "Jaqueta Casual com Gola Dobrada" });
    expect(casaco["category"]).toBe("Casacos");
    expect(casaco).not.toHaveProperty("title"); // já está completo
  });

  it("limpa cores: códigos, pinyin e português do Brasil", () => {
    expect(cleanColorName("Kd503", "pt")).toBeNull();
    expect(cleanColorName("608 Black", "en")).toBe("Black");
    expect(cleanColorName("coffee B", "en")).toBe("coffee");
    expect(cleanColorName("Heise", "pt")).toBe("Preto");
    expect(cleanColorName("Lvse", "en")).toBe("Green");
    expect(normalizeColors(["Marrom", "Cinza escuro", "Exército verde"], "pt")).toEqual(["Castanho", "Cinzento escuro", "Verde-tropa"]);
    expect(normalizeColors(["Brown", "Light Gray"], "pt")).toEqual(["Castanho", "Cinzento claro"]);
    expect(normalizeColors(["coffee B", "coffee E", "black A"], "en")).toEqual(["Coffee", "Black"]);
    expect(normalizeColors(["Kd503", "Kd504"], "pt")).toEqual(["Kd503", "Kd504"]); // só códigos: mantém
    expect(toEuropeanPortuguese("Suéter com Zíper")).toBe("Camisola com Fecho");
  });
});
