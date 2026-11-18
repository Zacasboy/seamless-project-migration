// Conjuntos: composições "flat-lay" com 2+ produtos do catálogo (partilhado: loja, painel, rotinas).
// A disposição é calculada pelo papel de cada peça (parte de cima, calças, calçado, acessório),
// com pequenas rotações para parecer escolhido à mão; o painel pode ajustar cada peça.

import { cutoutFor } from "@/lib/photos";
import { findType } from "@/lib/taxonomy";

export type Role = "cima" | "camada" | "calcas" | "calcado" | "acessorio" | "mala";

export type Layout = {
  x: number; // % da largura do quadro (canto superior esquerdo)
  y: number; // % da altura
  w: number; // % da largura
  r: number; // rotação em graus
  z: number;
  cutout?: boolean | undefined; // fotografia sem fundo (PNG): ganha sombra suave
};

export const BACKGROUNDS = {
  // Igual ao fundo das fotografias da loja: recortes "flutuam" como nas páginas de produto.
  loja: { label: "Fundo da loja", css: "var(--plate)", light: true },
  cinza: { label: "Cinzento mate", css: "linear-gradient(160deg,#a9a6a1 0%,#9b9893 60%,#8f8c87 100%)", light: false },
  papel: { label: "Papel claro", css: "linear-gradient(170deg,#ecebe8 0%,#e2e0dc 100%)", light: true },
  areia: { label: "Areia", css: "linear-gradient(165deg,#e9e1d5 0%,#ddd3c4 100%)", light: true },
  linho: {
    label: "Lençol de linho",
    css: "radial-gradient(120% 80% at 30% 20%,#f6f4f1 0%,#e9e6e1 55%,#dcd8d2 100%)",
    light: true,
  },
  marmore: {
    label: "Mármore",
    css: "linear-gradient(115deg,transparent 0 46%,rgba(176,150,120,.35) 47%,transparent 49%),linear-gradient(35deg,transparent 0 62%,rgba(176,150,120,.22) 63%,transparent 65%),linear-gradient(160deg,#efe6da 0%,#e6dccd 100%)",
    light: true,
  },
  madeira: {
    label: "Madeira em espinha",
    css: "repeating-linear-gradient(45deg,rgba(120,98,72,.10) 0 2px,transparent 2px 64px),repeating-linear-gradient(-45deg,rgba(120,98,72,.10) 0 2px,transparent 2px 64px),linear-gradient(160deg,#d8c7ad 0%,#c9b597 100%)",
    light: true,
  },
  chocolate: { label: "Chocolate", css: "linear-gradient(160deg,#4a3a2e 0%,#3c2f25 100%)", light: false },
} as const;
export type BackgroundKey = keyof typeof BACKGROUNDS;

/** Cores para pintar o fundo numa imagem (canvas): base, luz e textura. */
export const BACKGROUND_PAINT: Record<BackgroundKey, { from: string; to: string; texture?: "linho" | "marmore" | "madeira" }> = {
  loja: { from: "#ece8e2", to: "#e4e0d9" },
  cinza: { from: "#a9a6a1", to: "#8f8c87" },
  papel: { from: "#ecebe8", to: "#e2e0dc" },
  areia: { from: "#e9e1d5", to: "#ddd3c4" },
  linho: { from: "#f6f4f1", to: "#dcd8d2", texture: "linho" },
  marmore: { from: "#efe6da", to: "#e6dccd", texture: "marmore" },
  madeira: { from: "#d8c7ad", to: "#c9b597", texture: "madeira" },
  chocolate: { from: "#4a3a2e", to: "#3c2f25" },
};

// Papel de cada subcategoria / categoria da loja.
// O nome do produto manda quando diz claramente o que é ("Calça casual" é calças mesmo que a
// categoria esteja errada); senão usa a categoria.
export function roleOf(p: { title?: string | null; category?: string | null; garment_type?: string | null }): Role {
  const t = p.title ? findType(p.title) : null;
  const sure = t && t.category !== "Coordenados";
  const category = sure ? t.category : p.category;
  const sub = (sure ? t.sub : "") || p.garment_type || "";
  if (category === "Calças") return "calcas";
  if (category === "Calçado") return "calcado";
  if (category === "Malas") return "mala";
  if (category === "Acessórios") return "acessorio";
  if (category === "Casacos" || sub === "Cardigans") return "camada";
  return "cima";
}

const ORDER: Role[] = ["camada", "cima", "calcas", "calcado", "mala", "acessorio"];

// Posições base (quadro 4:5), inspiradas em composições reais: parte de cima ao centro-esquerda,
// calças na vertical à direita, calçado em baixo, acessórios nas margens.
const SLOTS: Record<Role, Layout[]> = {
  camada: [{ x: 4, y: 3, w: 58, r: -2, z: 2 }],
  cima: [
    { x: 8, y: 4, w: 54, r: 2, z: 3 },
    { x: 30, y: 2, w: 40, r: -3, z: 4 },
  ],
  calcas: [{ x: 56, y: 12, w: 38, r: 1, z: 1 }],
  calcado: [{ x: 14, y: 64, w: 38, r: -4, z: 5 }],
  mala: [{ x: 4, y: 58, w: 30, r: 3, z: 4 }],
  acessorio: [
    { x: 6, y: 45, w: 22, r: 8, z: 6 },
    { x: 66, y: 2, w: 26, r: -6, z: 6 },
    { x: 70, y: 76, w: 22, r: 5, z: 6 },
  ],
};

/** Disposição automática para uma lista de peças (pela ordem dada). */
export function autoLayout(items: { role: Role }[]): Layout[] {
  const used: Partial<Record<Role, number>> = {};
  const hasLayer = items.some((i) => i.role === "camada");
  return items.map((it) => {
    const n = used[it.role] ?? 0;
    used[it.role] = n + 1;
    const slots = SLOTS[it.role];
    let base = slots[Math.min(n, slots.length - 1)]!;
    // Com casaco e camisola: a camisola espreita por cima, mais pequena.
    if (it.role === "cima" && hasLayer) base = SLOTS.cima[1]!;
    const extra = n >= slots.length ? n - slots.length + 1 : 0;
    return { ...base, x: base.x + extra * 6, y: base.y + extra * 6 };
  });
}

// Caixas onde cada peça cabe (em % do quadro 4:5), como num flat-lay real:
// parte de cima à esquerda, calças na vertical à direita, calçado em baixo, acessórios nos vazios.
type Box = { x: number; y: number; w: number; h: number; r: number; z: number };
// Modelado nas referências da marca: calças na vertical à esquerda por cima da manga, parte de cima
// grande à direita, calçado em baixo ao centro, acessórios pequenos à direita e sobre as calças.
const BOXES: Record<Role, Box[]> = {
  camada: [{ x: 26, y: 2, w: 72, h: 66, r: 0, z: 2 }],
  cima: [
    { x: 26, y: 2, w: 72, h: 66, r: 0, z: 2 },
    { x: 60, y: 52, w: 34, h: 26, r: -4, z: 3 }, // segunda peça de cima, dobrada
  ],
  calcas: [{ x: 3, y: 2, w: 34, h: 92, r: 0, z: 4 }],
  calcado: [{ x: 30, y: 69, w: 46, h: 29, r: 0, z: 6 }],
  mala: [{ x: 68, y: 70, w: 30, h: 26, r: 4, z: 5 }],
  acessorio: [
    { x: 76, y: 66, w: 18, h: 16, r: 8, z: 7 },
    { x: 8, y: 38, w: 22, h: 10, r: -4, z: 7 }, // sobre as calças (óculos, cinto enrolado)
    { x: 78, y: 82, w: 16, h: 15, r: -8, z: 7 },
    { x: 60, y: 84, w: 16, h: 13, r: 6, z: 7 },
  ],
};
const BOARD_RATIO = 5 / 4; // altura / largura

/**
 * Disposição natural a partir das proporções reais de cada recorte (largura/altura):
 * cada peça ocupa a sua caixa sem se deformar, centrada, com uma pequena rotação.
 */
export function fitLayout(items: { role: Role; aspect: number }[]): Layout[] {
  const used: Partial<Record<Role, number>> = {};
  const hasLayer = items.some((i) => i.role === "camada");
  return items.map((it) => {
    const n = used[it.role] ?? 0;
    used[it.role] = n + 1;
    const list = BOXES[it.role];
    let box = list[Math.min(n, list.length - 1)]!;
    if (it.role === "cima" && hasLayer && n === 0) box = { x: 40, y: 8, w: 40, h: 34, r: 0, z: 1 }; // espreita por baixo do casaco
    const extra = n >= list.length ? n - list.length + 1 : 0;
    const a = Math.max(0.15, Math.min(6, it.aspect || 1));
    // Altura da caixa em unidades de largura do quadro.
    const hUnits = box.h * BOARD_RATIO;
    const w = Math.min(box.w, hUnits * a);
    const h = w / a / BOARD_RATIO; // em % da altura
    return {
      x: Math.round((box.x + (box.w - w) / 2 + extra * 5) * 10) / 10,
      y: Math.round((box.y + (box.h - h) / 2 + extra * 5) * 10) / 10,
      w: Math.round(w * 10) / 10,
      r: box.r,
      z: box.z,
      cutout: true,
    };
  });
}

export const sortByRole = <T extends { role: Role }>(items: T[]) =>
  [...items].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));

// ---------- Cores e combinações ----------

export type Family =
  | "preto"
  | "branco"
  | "creme"
  | "bege"
  | "camel"
  | "castanho"
  | "chocolate"
  | "cinzento"
  | "azul-marinho"
  | "azul"
  | "bordeaux"
  | "verde"
  | "outra";

const FAMILY_WORDS: [RegExp, Family][] = [
  [/\b(chocolat|chocolate|coffee|castanho escuro|dark brown|espresso)\b|\bcaf[eé](?![a-zà-ÿ])/i, "chocolate"],
  [/\b(navy|azul[- ]marinho|azul escuro|dark blue|marinho)\b/i, "azul-marinho"],
  [/\b(bordeaux|burgundy|wine|vinho)\b/i, "bordeaux"],
  [/\b(camel|caramel|tan|conhaque)\b/i, "camel"],
  [/\b(cream|creme|marfim|ivory|off[- ]white|branco[- ]sujo|ecru)\b/i, "creme"],
  [/\b(beige|bege|caqui|khaki|areia|sand|damasco|apricot|champanhe|champagne)\b/i, "bege"],
  [/\b(brown|castanho|marrom)\b/i, "castanho"],
  [/\b(black|preto|negro)\b/i, "preto"],
  [/\b(white|branco)\b/i, "branco"],
  [/\b(gr[ae]y|cinzento|cinza)\b/i, "cinzento"],
  [/\b(green|verde|olive|oliva)\b/i, "verde"],
  [/\b(blue|azul)\b/i, "azul"],
];

export function familyOf(color: string | null | undefined): Family {
  if (!color) return "outra";
  return FAMILY_WORDS.find(([re]) => re.test(color))?.[1] ?? "outra";
}

/** Combinações da paleta da marca (inspiradas no guia de cores enviado). */
export const PALETTES: { name: string; mood: string; a: Family[]; b: Family[] }[] = [
  { name: "Chocolate e creme", mood: "Luxo discreto", a: ["chocolate", "castanho"], b: ["creme", "bege", "branco"] },
  { name: "Bege e chocolate", mood: "Sofisticado", a: ["bege", "camel"], b: ["chocolate", "castanho"] },
  { name: "Azul-marinho e camel", mood: "Clássico", a: ["azul-marinho"], b: ["camel", "bege", "castanho"] },
  { name: "Azul-marinho e branco", mood: "Polido", a: ["azul-marinho"], b: ["branco", "creme"] },
  { name: "Cinzento e branco", mood: "Limpo", a: ["cinzento"], b: ["branco", "creme"] },
  { name: "Cinzento e bordeaux", mood: "Afirmativo", a: ["cinzento"], b: ["bordeaux"] },
  { name: "Chocolate e preto", mood: "Presença", a: ["chocolate"], b: ["preto"] },
  { name: "Preto e cinzento", mood: "Sóbrio", a: ["preto"], b: ["cinzento"] },
  { name: "Bege e branco", mood: "Leve", a: ["bege"], b: ["branco", "creme"] },
  { name: "Verde e creme", mood: "Old money", a: ["verde"], b: ["creme", "bege"] },
];

type CatalogItem = {
  id: string;
  title: string;
  category: string | null;
  garment_type: string | null;
  gender: string | null;
  color_options: string[] | null;
  image_url: string | null;
  gallery?: string[] | null;
  published: boolean;
};

export type Suggestion = {
  title: string;
  palette: string;
  gender: string;
  items: { productId: string; color: string; role: Role }[];
};

/** Cor do produto dentro das famílias pedidas; "" se o produto não tem cores; undefined se nenhuma serve. */
const pickColor = (p: CatalogItem, fams: Family[]): string | undefined => {
  const colors = p.color_options ?? [];
  if (!colors.length) return "";
  return colors.find((c) => fams.includes(familyOf(c)));
};

/**
 * Sugestões de conjuntos sem IA: para cada combinação de cores, junta uma parte de cima,
 * umas calças e um calçado do mesmo público, com cores da combinação (+ acessório, se houver).
 */
export function suggestOutfits(products: CatalogItem[], max = 6): Suggestion[] {
  const live = products.filter((p) => p.published && (p.image_url || p.gallery?.length));
  const by = (r: Role) => live.filter((p) => roleOf(p) === r || (r === "cima" && roleOf(p) === "camada"));
  const tops = by("cima");
  const bottoms = by("calcas");
  const shoes = by("calcado");
  const extras = [...by("acessorio"), ...by("mala")];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const fits = (p: CatalogItem, g: string) => !p.gender || p.gender === "unisex" || g === "unisex" || p.gender === g;

  for (const pal of PALETTES) {
    for (const [topFam, bottomFam] of [
      [pal.a, pal.b],
      [pal.b, pal.a],
    ] as const) {
      for (const top of tops) {
        const tColor = pickColor(top, [...topFam]);
        if (tColor === undefined) continue;
        const g = top.gender ?? "unisex";
        const bottom = bottoms.find((b) => fits(b, g) && pickColor(b, [...bottomFam]) !== undefined);
        if (!bottom) continue;
        const shoeFams: Family[] = [...pal.a, ...pal.b, "preto", "branco"];
        const shoe = shoes.find((s) => fits(s, g) && pickColor(s, shoeFams) !== undefined);
        if (!shoe) continue;
        const key = [top.id, bottom.id, shoe.id].sort().join();
        if (seen.has(key)) continue;
        seen.add(key);
        const extra = extras.find((e) => fits(e, g) && pickColor(e, [...pal.a, ...pal.b]) !== undefined);
        const items = [
          { productId: top.id, color: tColor, role: roleOf(top) },
          { productId: bottom.id, color: pickColor(bottom, [...bottomFam])!, role: "calcas" as Role },
          { productId: shoe.id, color: pickColor(shoe, shoeFams)!, role: "calcado" as Role },
          ...(extra ? [{ productId: extra.id, color: pickColor(extra, [...pal.a, ...pal.b])!, role: roleOf(extra) }] : []),
        ];
        out.push({ title: pal.name, palette: pal.name, gender: g, items });
        if (out.length >= max) return out;
        break;
      }
    }
  }
  return out;
}

export const slugifyOutfit = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "conjunto";

// ---------- Peças do quadro a partir das linhas guardadas + catálogo ----------

type StoredItem = {
  id: string;
  product_id: string;
  color?: string | null;
  image_url?: string | null;
  layout?: Layout | null;
};
type ProductLite = {
  id: string;
  slug: string;
  title: string;
  price: number | string;
  category: string | null;
  garment_type: string | null;
  image_url: string | null;
  gallery?: string[] | null;
  photo_cutouts?: unknown;
};

const firstPhoto = (p: ProductLite) =>
  (p.gallery?.length ? p.gallery : p.image_url ? [p.image_url] : []).find((u) => /^https:\/\/\S+$/.test(u)) ?? "";

/** Junta as peças guardadas com os produtos; posições em falta são calculadas pelo papel. */
export function boardPieces(items: StoredItem[], products: ProductLite[]) {
  const rows = items
    .map((it) => ({ it, p: products.find((x) => x.id === it.product_id) }))
    .filter((r): r is { it: StoredItem; p: ProductLite } => !!r.p && !!(r.it.image_url || firstPhoto(r.p)));
  const auto = autoLayout(rows.map((r) => ({ role: roleOf(r.p) })));
  return rows.map(({ it, p }, i) => {
    // Sem fotografia escolhida: usa o recorte do produto, se existir.
    const cut = it.image_url ? undefined : cutoutFor(p);
    const layout = it.layout ?? auto[i]!;
    return {
      key: it.id,
      productId: p.id,
      slug: p.slug,
      title: p.title,
      price: Number(p.price),
      image: it.image_url || cut || firstPhoto(p),
      color: it.color ?? null,
      layout: cut ? { ...layout, cutout: true } : layout,
    };
  });
}
