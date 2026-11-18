// Categorias e subcategorias da loja (partilhado: loja, painel, importação e rotinas).
// products.category = categoria; products.garment_type = subcategoria.

export const CATEGORIES = [
  { name: "Calçado", subs: ["Sapatos", "Mocassins", "Loafers", "Sapatilhas", "Botas", "Sandálias"], line: "Sapatos, mocassins e loafers" },
  { name: "Calças", subs: ["Gangas", "Casuais", "Sociais"], line: "Gangas, casuais e sociais" },
  { name: "Camisolas", subs: ["Camisolas", "Cardigans", "Sweatshirts"], line: "Malhas para os dias frios" },
  { name: "Camisas", subs: ["Camisas", "Polos", "T-shirts"], line: "Camisas, polos e t-shirts" },
  { name: "Casacos", subs: ["Casacos", "Blusões", "Blazers"], line: "Casacos, blusões e blazers" },
  { name: "Malas", subs: ["Malas de mão", "Malas de ombro", "Malas tiracolo", "Totes", "Mochilas", "Clutches", "Carteiras"], line: "Para o dia a dia e para a noite" },
  { name: "Acessórios", subs: ["Cachecóis", "Cintos"], line: "Cachecóis e cintos" },
  { name: "Vestidos", subs: ["Vestidos", "Saias"], line: "Vestidos e saias" },
  // Produtos vendidos como conjunto (duas peças). Não confundir com a página Conjuntos (looks montados).
  { name: "Coordenados", subs: [], line: "Duas peças a condizer, vendidas juntas" },
] as const;

export type Category = (typeof CATEGORIES)[number]["name"];
export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name) as unknown as readonly [Category, ...Category[]];
export const subsOf = (c: string) => (CATEGORIES.find((x) => x.name === c)?.subs ?? []) as readonly string[];

export type ProductType = {
  re: RegExp;
  pt: string; // forma usada no nome em português
  en: string; // forma usada no nome em inglês
  category: Category;
  sub: string;
  generic?: boolean; // tipo genérico: um tipo mais específico ganha-lhe
};

// Do mais específico para o mais genérico; a ordem resolve ambiguidades
// ("dress pants" são calças, "dress shoes" são sapatos, "denim jacket" é casaco).
export const TYPES: ProductType[] = [
  // Calçado
  { re: /\b(chelsea boots?|botas? chelsea)\b/i, pt: "Botas Chelsea", en: "Chelsea boots", category: "Calçado", sub: "Botas" },
  { re: /\b(ankle boots?|botins?)\b/i, pt: "Botins", en: "Ankle boots", category: "Calçado", sub: "Botas" },
  { re: /\b(loafers?)\b/i, pt: "Loafers", en: "Loafers", category: "Calçado", sub: "Loafers" },
  { re: /\b(mocassins?|mocassim|mocasines|moccasins?|driving shoes|penny shoes)\b/i, pt: "Mocassins", en: "Moccasins", category: "Calçado", sub: "Mocassins" },
  { re: /\b(brogues?)\b/i, pt: "Brogues", en: "Brogues", category: "Calçado", sub: "Sapatos" },
  { re: /\b(oxford (shoes?|brogues?)|sapatos? oxford|oxfords)\b|\boxford\b(?!\s*(shirts?|camisas?))/i, pt: "Sapatos Oxford", en: "Oxford shoes", category: "Calçado", sub: "Sapatos" },
  { re: /\b(derby|derbies)\b/i, pt: "Sapatos Derby", en: "Derby shoes", category: "Calçado", sub: "Sapatos" },
  { re: /\b(dress shoes|formal shoes|sapatos? (sociais|formais|social|formal))\b/i, pt: "Sapatos formais", en: "Dress shoes", category: "Calçado", sub: "Sapatos" },
  { re: /\b(espadrilles?|alpercatas?)\b/i, pt: "Alpercatas", en: "Espadrilles", category: "Calçado", sub: "Sapatos" },
  { re: /\b(ballet flats?|ballerinas?|sabrinas?)\b/i, pt: "Sabrinas", en: "Ballet flats", category: "Calçado", sub: "Sapatos" },
  { re: /\b(mules?)\b/i, pt: "Mules", en: "Mules", category: "Calçado", sub: "Sapatos" },
  { re: /\b(sneakers?|trainers?|sapatilhas|t[eê]nis)\b/i, pt: "Sapatilhas", en: "Sneakers", category: "Calçado", sub: "Sapatilhas" },
  { re: /\b(boots?|botas?)\b/i, pt: "Botas", en: "Boots", category: "Calçado", sub: "Botas" },
  { re: /\b(sandals?|sand[aá]lias?)\b/i, pt: "Sandálias", en: "Sandals", category: "Calçado", sub: "Sandálias" },
  { re: /\b(slippers?|slides?|chinelos?|pantufas?)\b/i, pt: "Chinelos", en: "Slides", category: "Calçado", sub: "Sandálias" },
  { re: /\b(high heels?|heels?|pumps?|stilettos?|saltos? altos?|sapatos de salto)\b/i, pt: "Sapatos de salto", en: "Heels", category: "Calçado", sub: "Sapatos" },
  { re: /\b(shoes?|sapatos?|cal[cç]ados?)\b/i, pt: "Sapatos", en: "Shoes", category: "Calçado", sub: "Sapatos", generic: true },
  // Acessórios
  { re: /\b(scarf|scarves|cachec[oó]is|cachecol|echarpes?|len[cç]os? de pesco[cç]o)\b/i, pt: "Cachecol", en: "Scarf", category: "Acessórios", sub: "Cachecóis" },
  { re: /\b(belts?|cintos?)\b/i, pt: "Cinto", en: "Belt", category: "Acessórios", sub: "Cintos" },
  // Malas
  { re: /\b(backpacks?|mochilas?)\b/i, pt: "Mochila", en: "Backpack", category: "Malas", sub: "Mochilas" },
  { re: /\b(totes?|tote bags?|shopper)\b/i, pt: "Mala tote", en: "Tote bag", category: "Malas", sub: "Totes" },
  { re: /\b(crossbody|cross-body|tiracolo|messenger)\b/i, pt: "Mala tiracolo", en: "Crossbody bag", category: "Malas", sub: "Malas tiracolo" },
  { re: /\b(clutch|pochette|envelope bag)\b/i, pt: "Clutch", en: "Clutch", category: "Malas", sub: "Clutches" },
  { re: /\b(wallets?|carteiras?|purse)\b/i, pt: "Carteira", en: "Wallet", category: "Malas", sub: "Carteiras" },
  { re: /\b(shoulder bags?|mala de ombro)\b/i, pt: "Mala de ombro", en: "Shoulder bag", category: "Malas", sub: "Malas de ombro" },
  { re: /\b(handbags?|bags?|malas?|bolsas?)\b/i, pt: "Mala de mão", en: "Handbag", category: "Malas", sub: "Malas de mão", generic: true },
  // Casacos (antes de calças e malhas: "denim jacket", "casaco de malha" tratados aqui ou em Cardigans)
  { re: /\b(cardigans?|casacos? de malha)\b/i, pt: "Casaco de malha", en: "Cardigan", category: "Camisolas", sub: "Cardigans" },
  { re: /\b(blazers?)\b/i, pt: "Blazer", en: "Blazer", category: "Casacos", sub: "Blazers" },
  { re: /\b(jackets?|jaquetas?|blus[aã]o|blusões|bombers?)\b/i, pt: "Blusão", en: "Jacket", category: "Casacos", sub: "Blusões" },
  { re: /\b(coats?|casacos?|sobretudos?|trench|parkas?|overcoats?)\b/i, pt: "Casaco", en: "Coat", category: "Casacos", sub: "Casacos" },
  // Calças
  { re: /\b(jeans|denim pants|gangas?|cal[cç]as? de ganga)\b/i, pt: "Calças de ganga", en: "Jeans", category: "Calças", sub: "Gangas" },
  { re: /\b(dress (pants|trousers)|suit (pants|trousers)|formal (pants|trousers)|tailored (pants|trousers)|cal[cç]as? (de terno|sociais|social|de fato|de alfaiataria|formais))\b/i, pt: "Calças sociais", en: "Tailored trousers", category: "Calças", sub: "Sociais" },
  { re: /\b(chinos?|cargo pants|joggers?|sweatpants|casual (pants|trousers)|cal[cç]as?|trousers|pants)\b/i, pt: "Calças", en: "Trousers", category: "Calças", sub: "Casuais", generic: true },
  // Camisas (polos antes das malhas: "camisola polo" é um polo)
  { re: /\b(polos?|polo shirts?)\b/i, pt: "Polo", en: "Polo shirt", category: "Camisas", sub: "Polos" },
  { re: /\b(t-?shirts?|tees?|camisetas?|t-?shirts? de manga)\b/i, pt: "T-shirt", en: "T-shirt", category: "Camisas", sub: "T-shirts" },
  // Camisolas
  { re: /\b(hoodies?|sweatshirts?|moletons?)\b/i, pt: "Sweatshirt", en: "Sweatshirt", category: "Camisolas", sub: "Sweatshirts" },
  { re: /\b(sweaters?|jumpers?|pullovers?|camisolas?|su[eé]ter(es)?|knitwear)\b|\btric[oô](?![a-zà-ÿ])/i, pt: "Camisola", en: "Sweater", category: "Camisolas", sub: "Camisolas" },
  // Coordenados (duas peças vendidas juntas)
  { re: /\b(two[- ]piece|2[- ]?pcs?|co-?ords?|conjuntos?|(?:outfit|matching) sets?)\b/i, pt: "Conjunto", en: "Two-piece set", category: "Coordenados", sub: "" },
  // Vestidos e saias
  { re: /\b(dress(es)?|vestidos?)\b/i, pt: "Vestido", en: "Dress", category: "Vestidos", sub: "Vestidos" },
  { re: /\b(skirts?|saias?)\b/i, pt: "Saia", en: "Skirt", category: "Vestidos", sub: "Saias" },
  // Camisas
  { re: /\b(shirts?|camisas?|blouses?|blusas?)\b/i, pt: "Camisa", en: "Shirt", category: "Camisas", sub: "Camisas" },
];

export function findType(text: string) {
  return TYPES.find((t) => t.re.test(text)) ?? null;
}

/**
 * Melhor tipo: o do nome (primeira fonte). Se for genérico ("Sapatos", "Calças"), aceita um mais
 * específico das outras fontes, mas só da mesma categoria (uma subcategoria antiga errada não ganha).
 */
export function bestType(...sources: (string | null | undefined)[]) {
  const [first, ...rest] = sources;
  const t0 = first ? findType(first) : null;
  if (t0 && !t0.generic) return t0;
  let fallback: ProductType | null = t0;
  for (const s of rest) {
    if (!s) continue;
    const t = findType(s);
    if (!t) continue;
    if (!t.generic && (!t0 || t.category === t0.category)) return t;
    fallback ??= t;
  }
  return fallback;
}

/** Categoria a partir do nome e da pista do fornecedor (importador). */
export function mapCategory(raw: string, title: string): Category | null {
  return bestType(title, raw)?.category ?? null;
}
