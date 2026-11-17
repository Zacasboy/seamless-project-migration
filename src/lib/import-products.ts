// Importação de produtos a partir do CSV exportado por um fornecedor
// (BrandsGateway, CJDropshipping, Bigbuy, Spocket, Shopify…).
// Tudo corre no browser do administrador; só os produtos válidos são gravados.

import { CATEGORY_NAMES, mapCategory as mapByType, type Category } from "./taxonomy";

export const STORE_CATEGORIES = CATEGORY_NAMES;
export type StoreCategory = Category;

export type Field =
  | "handle"
  | "title"
  | "description"
  | "price"
  | "cost"
  | "image"
  | "sku"
  | "category"
  | "gender"
  | "size"
  | "color"
  | "stock";

export const FIELD_LABELS: Record<Field, string> = {
  handle: "Agrupar variantes por",
  title: "Nome",
  description: "Descrição",
  price: "Preço de venda",
  cost: "Custo do fornecedor",
  image: "Imagem (URL)",
  sku: "Referência (SKU)",
  category: "Categoria",
  gender: "Género",
  size: "Tamanho",
  color: "Cor",
  stock: "Stock",
};

// Nomes de colunas habituais em português e inglês, normalizados (minúsculas, sem acentos).
const SYNONYMS: Record<Field, string[]> = {
  handle: ["handle", "parent sku", "parent_sku", "product id", "product_id", "spu", "group id"],
  title: ["title", "name", "nome", "product name", "product title", "titulo", "product_name"],
  description: [
    "description",
    "descricao",
    "body (html)",
    "body html",
    "body",
    "product description",
  ],
  price: [
    "price",
    "preco",
    "variant price",
    "retail price",
    "suggested price",
    "rrp",
    "sale price",
    "pvp",
    "selling price",
  ],
  cost: [
    "cost",
    "custo",
    "cost per item",
    "wholesale price",
    "supplier price",
    "price excl. vat",
    "dropshipping price",
    "sell price",
  ],
  image: [
    "image",
    "image url",
    "image_url",
    "image src",
    "main image",
    "imagem",
    "picture",
    "photo",
    "images",
    "variant image",
    "image1",
    "image 1",
  ],
  sku: ["sku", "variant sku", "referencia", "reference", "ref", "ean", "barcode"],
  category: [
    "category",
    "categoria",
    "product type",
    "type",
    "tipo",
    "product category",
    "categories",
  ],
  gender: ["gender", "genero", "sexo", "sex"],
  size: ["size", "sizes", "tamanho", "tamanhos", "option1 value", "variant size"],
  color: ["color", "colour", "cor", "cores", "option2 value", "variant color"],
  stock: [
    "stock",
    "quantity",
    "qty",
    "inventory",
    "stock quantity",
    "variant inventory qty",
    "quantidade",
  ],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// CSV (RFC 4180): aspas, aspas duplas escapadas, quebras de linha dentro de aspas.
// Deteta o separador entre , ; e tab pela primeira linha.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const count = (c: string) => firstLine.split(c).length - 1;
  const sep = [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0]!;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type Mapping = Partial<Record<Field, number>>;

export function guessMapping(headers: string[]): Mapping {
  const h = headers.map(norm);
  const m: Mapping = {};
  for (const f of Object.keys(SYNONYMS) as Field[]) {
    const i = h.findIndex((x) => SYNONYMS[f].includes(x));
    if (i >= 0) m[f] = i;
  }
  return m;
}

export function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  let s = v.replace(/[^\d,.-]/g, "");
  if (!s) return null;
  // 1.234,56 → 1234.56 ; 1,234.56 → 1234.56 ; 12,5 → 12.5
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function mapCategory(raw: string, title: string): StoreCategory | null {
  return mapByType(raw, title);
}

export function mapGender(raw: string, title: string): "mulher" | "homem" | "unisex" {
  const t = norm(`${raw} ${title}`);
  if (/\b(women|woman|female|ladies|mulher|feminino|senhora|her)\b/.test(t)) return "mulher";
  if (/\b(men|man|male|homem|masculino|him)\b/.test(t)) return "homem";
  return "unisex";
}

export function stripHtml(s: string) {
  return s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slugify(s: string) {
  return norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Primeira imagem https de uma célula que pode ter várias (separadas por vírgula, ; ou |).
export function firstHttpsImage(v: string | undefined): string | null {
  if (!v) return null;
  const url = v
    .split(/[\s,;|]+/)
    .map((x) => x.trim())
    .find((x) => /^https:\/\/\S+$/i.test(x));
  return url ?? null;
}

export type Options = {
  defaultCategory: StoreCategory | "";
  markupPercent: number; // usado quando só há custo
  supplier: string;
  publish: boolean;
};

export type Draft = {
  key: string;
  title: string;
  description: string;
  price: number | null;
  cost: number | null;
  image_url: string | null;
  sku: string | null;
  category: StoreCategory | null;
  gender: "mulher" | "homem" | "unisex";
  size_options: string[];
  color_options: string[];
  stock_status: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  errors: string[];
};

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

// Junta variantes (mesmo "handle" ou, sem ele, o mesmo nome) num só produto e valida.
export function buildDrafts(rows: string[][], m: Mapping, o: Options): Draft[] {
  const get = (r: string[], f: Field) => (m[f] === undefined ? "" : (r[m[f]!] ?? "").trim());
  const groups = new Map<string, string[][]>();
  for (const r of rows) {
    const key = get(r, "handle") || get(r, "title") || get(r, "sku");
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const out: Draft[] = [];
  for (const [key, rs] of groups) {
    const pick = (f: Field) => rs.map((r) => get(r, f)).find(Boolean) ?? "";
    const title = pick("title").slice(0, 160);
    const cost = parseNumber(pick("cost"));
    let price = parseNumber(pick("price"));
    if ((price === null || price <= 0) && cost !== null && cost > 0)
      price = Math.round(cost * (1 + o.markupPercent / 100) * 100) / 100;
    const rawImage = rs.map((r) => get(r, "image")).find(Boolean) ?? "";
    const image = firstHttpsImage(rawImage);
    const category = mapCategory(pick("category"), title) ?? (o.defaultCategory || null);
    const stockVals = rs
      .map((r) => parseNumber(get(r, "stock")))
      .filter((n): n is number => n !== null);
    const stock = stockVals.length ? stockVals.reduce((a, b) => a + b, 0) : null;
    const errors: string[] = [];
    if (!title) errors.push("Sem nome");
    if (price === null || price <= 0) errors.push("Sem preço");
    if (!image) errors.push(rawImage ? "A imagem tem de ser https" : "Sem imagem");
    if (!category) errors.push("Categoria por escolher");
    out.push({
      key,
      title,
      description: stripHtml(pick("description")).slice(0, 2000),
      price,
      cost,
      image_url: image,
      sku: pick("sku").slice(0, 80) || null,
      category,
      gender: mapGender(pick("gender"), title),
      size_options: uniq(rs.map((r) => get(r, "size"))).slice(0, 20),
      color_options: uniq(rs.map((r) => get(r, "color"))).slice(0, 20),
      stock_status:
        stock === null
          ? "unknown"
          : stock <= 0
            ? "out_of_stock"
            : stock < 5
              ? "low_stock"
              : "in_stock",
      errors,
    });
  }
  return out;
}

// Linha pronta a inserir em public.products, com slug único.
export function toProductRow(d: Draft, o: Options, taken: Set<string>) {
  const base = slugify(d.title) || "artigo";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return {
    slug,
    title: d.title,
    description: d.description,
    price: d.price!,
    cost: d.cost,
    image_url: d.image_url,
    image_alt: d.title,
    sku: d.sku,
    category: d.category!,
    gender: d.gender,
    size_options: d.size_options,
    color_options: d.color_options,
    stock_status: d.stock_status,
    supplier: o.supplier.trim().slice(0, 80) || null,
    published: o.publish,
    is_demo: false,
    currency: "EUR",
  };
}
