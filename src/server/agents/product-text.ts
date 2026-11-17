// Nomes e textos SEO de produto a partir de dados reais (sem IA).
// Regra da loja: o nome diz só o tipo de produto e o material (ex. "Mocassins de camurça",
// "Leather loafers"). Tamanho, sexo, fabricante, códigos de modelo e ruído de fornecedor ficam fora.
// A língua do nome é a do produto (ou a escolhida nas definições); não é obrigatório inglês nem português.
import type { STORE_CATEGORIES } from "@/lib/import-products";

export type Lang = "pt" | "en";
type Category = (typeof STORE_CATEGORIES)[number];

// Do mais específico para o mais genérico. pt = forma usada no nome; en idem.
const TYPES: { re: RegExp; pt: string; en: string; category: Category }[] = [
  { re: /\b(chelsea boots?|botas? chelsea)\b/i, pt: "Botas Chelsea", en: "Chelsea boots", category: "Calçado" },
  { re: /\b(ankle boots?|botins?)\b/i, pt: "Botins", en: "Ankle boots", category: "Calçado" },
  { re: /\b(loafers?|mocassins?|mocasines|moccasins?)\b/i, pt: "Mocassins", en: "Loafers", category: "Calçado" },
  { re: /\b(brogues?)\b/i, pt: "Brogues", en: "Brogues", category: "Calçado" },
  { re: /\b(oxfords?)\b/i, pt: "Sapatos Oxford", en: "Oxford shoes", category: "Calçado" },
  { re: /\b(derby|derbies)\b/i, pt: "Sapatos Derby", en: "Derby shoes", category: "Calçado" },
  { re: /\b(espadrilles?|alpercatas?)\b/i, pt: "Alpercatas", en: "Espadrilles", category: "Calçado" },
  { re: /\b(ballet flats?|ballerinas?|sabrinas?)\b/i, pt: "Sabrinas", en: "Ballet flats", category: "Calçado" },
  { re: /\b(mules?)\b/i, pt: "Mules", en: "Mules", category: "Calçado" },
  { re: /\b(sneakers?|trainers?|sapatilhas|t[eê]nis)\b/i, pt: "Sapatilhas", en: "Sneakers", category: "Calçado" },
  { re: /\b(boots?|botas?)\b/i, pt: "Botas", en: "Boots", category: "Calçado" },
  { re: /\b(sandals?|sand[aá]lias?)\b/i, pt: "Sandálias", en: "Sandals", category: "Calçado" },
  { re: /\b(slippers?|slides?|chinelos?|pantufas?)\b/i, pt: "Chinelos", en: "Slides", category: "Calçado" },
  { re: /\b(high heels?|heels?|pumps?|stilettos?|saltos? altos?|sapatos de salto)\b/i, pt: "Sapatos de salto", en: "Heels", category: "Calçado" },
  { re: /\b(shoes?|sapatos?)\b/i, pt: "Sapatos", en: "Shoes", category: "Calçado" },
  { re: /\b(backpacks?|mochilas?)\b/i, pt: "Mochila", en: "Backpack", category: "Malas" },
  { re: /\b(bucket bags?|mala saco)\b/i, pt: "Mala saco", en: "Bucket bag", category: "Malas" },
  { re: /\b(totes?|tote bags?|shopper)\b/i, pt: "Mala tote", en: "Tote bag", category: "Malas" },
  { re: /\b(crossbody|cross-body|tiracolo|messenger)\b/i, pt: "Mala tiracolo", en: "Crossbody bag", category: "Malas" },
  { re: /\b(clutch|pochette|envelope bag)\b/i, pt: "Clutch", en: "Clutch", category: "Malas" },
  { re: /\b(wallets?|carteiras?|purse)\b/i, pt: "Carteira", en: "Wallet", category: "Malas" },
  { re: /\b(shoulder bags?|mala de ombro)\b/i, pt: "Mala de ombro", en: "Shoulder bag", category: "Malas" },
  { re: /\b(handbags?|bags?|malas?|bolsas?)\b/i, pt: "Mala de mão", en: "Handbag", category: "Malas" },
  { re: /\b(two[- ]piece|2[- ]?pcs?|co-?ords?|conjuntos?|(?:outfit|matching) sets?)\b/i, pt: "Conjunto", en: "Two-piece set", category: "Conjuntos" },
  { re: /\b(dress(es)?|vestidos?)\b/i, pt: "Vestido", en: "Dress", category: "Conjuntos" },
  { re: /\b(blazers?)\b/i, pt: "Blazer", en: "Blazer", category: "Conjuntos" },
  { re: /\b(coats?|casacos?|trench)\b/i, pt: "Casaco", en: "Coat", category: "Conjuntos" },
  { re: /\b(jackets?|blus[aã]o|blusões)\b/i, pt: "Blusão", en: "Jacket", category: "Conjuntos" },
  { re: /\b(cardigans?)\b/i, pt: "Casaco de malha", en: "Cardigan", category: "Conjuntos" },
  { re: /\b(sweaters?|jumpers?|pullovers?|camisolas?)\b/i, pt: "Camisola", en: "Sweater", category: "Conjuntos" },
  { re: /\b(trousers|pants|cal[cç]as)\b/i, pt: "Calças", en: "Trousers", category: "Conjuntos" },
  { re: /\b(skirts?|saias?)\b/i, pt: "Saia", en: "Skirt", category: "Conjuntos" },
  { re: /\b(shirts?|camisas?|blouses?|blusas?)\b/i, pt: "Camisa", en: "Shirt", category: "Conjuntos" },
];

// Materiais: do mais específico para o mais genérico. Sintéticos antes de "leather"
// para "PU leather" não virar "couro".
const MATERIALS: { re: RegExp; pt: string; en: string }[] = [
  { re: /\b(patent leather|verniz|envernizad[oa])\b/i, pt: "verniz", en: "patent leather" },
  { re: /\b(faux leather|pu leather|synthetic leather|vegan leather|artificial leather|imitation leather|pele sint[eé]tica|couro sint[eé]tico|pu|pvc)\b/i, pt: "pele sintética", en: "faux leather" },
  { re: /\b(microfib(?:er|re|ra))\b/i, pt: "microfibra", en: "microfibre" },
  { re: /\b(suede|camur[cç]a)\b/i, pt: "camurça", en: "suede" },
  { re: /\b(nubuck|nob[uú]que)\b/i, pt: "nobuque", en: "nubuck" },
  { re: /\b(genuine leather|cow ?leather|cowhide|full[- ]grain leather|leather|couro|pele genu[ií]na|pele de vaca)\b/i, pt: "couro", en: "leather" },
  { re: /\b(cashmere|caxemira)\b/i, pt: "caxemira", en: "cashmere" },
  { re: /\b(wool|woolen|woollen)\b|(?:^|[^\p{L}])lã(?![\p{L}])/iu, pt: "lã", en: "wool" },
  { re: /\b(linen|linho)\b/i, pt: "linho", en: "linen" },
  { re: /\b(silk|seda)\b/i, pt: "seda", en: "silk" },
  { re: /\b(cotton|algod[aã]o)\b/i, pt: "algodão", en: "cotton" },
  { re: /\b(denim|ganga)\b/i, pt: "ganga", en: "denim" },
  { re: /\b(velvet|veludo)\b/i, pt: "veludo", en: "velvet" },
  { re: /\b(corduroy|bombazina)\b/i, pt: "bombazina", en: "corduroy" },
  { re: /\b(canvas|lona)\b/i, pt: "lona", en: "canvas" },
  { re: /\b(knit|knitted|malha|tricot)\b/i, pt: "malha", en: "knit" },
  { re: /\b(mesh|rede respir[aá]vel)\b/i, pt: "rede", en: "mesh" },
  { re: /\b(straw|palha|raffia|r[aá]fia)\b/i, pt: "palha", en: "straw" },
  { re: /\b(nylon)\b/i, pt: "nylon", en: "nylon" },
  { re: /\b(polyester|poli[eé]ster)\b/i, pt: "poliéster", en: "polyester" },
];

// Campos de material na ficha do fornecedor: são mais fiáveis do que o nome.
const MATERIAL_FIELD =
  /(?:^|\n)\s*(?:shoe upper material|upper material|material superior|outer material|main material|fabric|tecido|material(?: da gáspea)?|material)\s*:\s*([^\n]+)/i;

export function detectLang(text: string): Lang | null {
  const t = ` ${text.toLowerCase()} `;
  const pt = (t.match(/[ãõç]|\s(de|para|com|em|sapatos|mala|couro|homem|mulher|masculin|feminin|tamanho)\s/g) ?? []).length;
  const en = (t.match(/\s(the|for|with|and|shoes|bag|leather|men'?s|women'?s|size|style)\s/g) ?? []).length;
  if (pt > en) return "pt";
  if (en > pt) return "en";
  return null;
}

export function findType(text: string) {
  return TYPES.find((t) => t.re.test(text)) ?? null;
}

/** Material: primeiro o campo da ficha, depois o nome, depois o resto da descrição. */
export function findMaterial(title: string, description: string) {
  const field = description.match(MATERIAL_FIELD)?.[1];
  for (const src of [field, title, description.slice(0, 600)])
    if (src) {
      const m = MATERIALS.find((x) => x.re.test(src));
      if (m) return m;
    }
  return null;
}

const SIZE_IN_TITLE =
  /\b(size|sizes|tamanhos?|talla|taille|plus size|big size|large size|tamanho grande|eu ?\d{2}|us ?\d{1,2})\b|\b(3[4-9]|4[0-9])\b(?![,.]\d)|\b(XXS|XS|XXL|XXXL|[2-5]XL)\b/i;
const GENDER_IN_TITLE =
  /\b(men'?s|women'?s|man|woman|male|female|ladies|lady|girls?|boys?|unisex|homem|homens|mulher(es)?|masculin[oa]s?|femin[ia]n[oa]s?|senhoras?|cavalheiros?)\b/i;
const MAKER_IN_TITLE =
  /\b(aliexpress|cjdropshipping|cj|zendrop|bigbuy|printful|brand|marca|official|oficial|original|factory|f[aá]brica|fashion|style|estilo)\b|\b[A-Z]{2,5}-?\d{2,6}\b/i;

/** O que está a mais no nome (tamanho, sexo, fabricante/código, demasiado longo). */
export function titleProblems(title: string, brand?: string | null) {
  const out: string[] = [];
  if (SIZE_IN_TITLE.test(title)) out.push("tamanho");
  if (GENDER_IN_TITLE.test(title)) out.push("sexo");
  if (MAKER_IN_TITLE.test(title) || (brand && brand.length > 1 && title.toLowerCase().includes(brand.toLowerCase())))
    out.push("fabricante, código ou ruído");
  if (title.length > 60) out.push("demasiado longo");
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nome = tipo de produto + material, na língua indicada. */
export function buildTitle(type: { pt: string; en: string }, material: { pt: string; en: string } | null, lang: Lang) {
  if (lang === "pt") return material ? `${type.pt} de ${material.pt}` : type.pt;
  return cap(material ? `${material.en} ${type.en.charAt(0).toLowerCase()}${type.en.slice(1)}` : type.en);
}

/** Marca indicada na ficha do fornecedor ("Brand Name: X"). */
export function brandFrom(description: string) {
  return description.match(/(?:^|\n)\s*(?:brand(?: name)?|marca)\s*:\s*([^\n,]{2,40})/i)?.[1]?.trim() ?? null;
}

function sizeRange(sizes: string[]) {
  const nums = sizes.map((s) => parseFloat(s)).filter((n) => Number.isFinite(n));
  if (nums.length >= 2 && nums.length === sizes.length) return `${Math.min(...nums)}–${Math.max(...nums)}`;
  return sizes.length ? sizes.slice(0, 6).join(", ") : null;
}

/** Descrição SEO (140–160 caracteres) só com factos do produto. */
export function seoDescription(o: {
  title: string;
  lang: Lang;
  gender: string | null;
  sizes: string[];
  colors: string[];
}) {
  const pt = o.lang === "pt";
  const who =
    o.gender === "homem" ? (pt ? " para homem" : " for men") : o.gender === "mulher" ? (pt ? " para mulher" : " for women") : "";
  const parts = [`${o.title}${who}.`];
  const range = sizeRange(o.sizes);
  if (range) parts.push(pt ? `Tamanhos ${range}.` : `Sizes ${range}.`);
  if (o.colors.length > 1) parts.push(pt ? `Disponível em ${o.colors.length} cores.` : `Available in ${o.colors.length} colours.`);
  else if (o.colors.length === 1) parts.push(pt ? `Cor: ${o.colors[0]}.` : `Colour: ${o.colors[0]}.`);
  parts.push(pt ? "Compre na Pallessiani, com entrega em Portugal." : "Shop at Pallessiani with delivery to Portugal.");
  let out = parts.join(" ");
  if (out.length > 160) out = parts.filter((_, i) => i !== 2).join(" ");
  return out.length > 160 ? out.slice(0, 157).replace(/\s+\S*$/, "") + "…" : out;
}

/** Meta description antiga gerada a partir da ficha técnica ("Pattern: … Color: …"): pode ser substituída. */
export const looksLikeSpecDump = (s: string | null) => !!s && /^[\p{L} ]{2,30}:\s/u.test(s.trim());
