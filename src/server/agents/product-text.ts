// Nomes e textos SEO de produto a partir de dados reais (sem IA).
// Regra da loja: o nome diz só o tipo de produto e o material (ex. "Mocassins de camurça",
// "Leather loafers"). Tamanho, sexo, fabricante, códigos de modelo e ruído de fornecedor ficam fora.
// A língua do nome é a do produto (ou a escolhida nas definições); não é obrigatório inglês nem português.
export type Lang = "pt" | "en";

export { findType } from "@/lib/taxonomy";

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
  { re: /\b(merino)\b/i, pt: "lã merino", en: "merino wool" },
  { re: /\b(wool|woolen|woollen|wool blend)\b|(?:^|[^\p{L}])lã(?![\p{L}])/iu, pt: "lã", en: "wool" },
  { re: /\b(linen|linho)\b/i, pt: "linho", en: "linen" },
  { re: /\b(silk|seda)\b/i, pt: "seda", en: "silk" },
  { re: /\b(cotton|algod[aã]o)\b/i, pt: "algodão", en: "cotton" },
  { re: /\b(denim|ganga)\b/i, pt: "ganga", en: "denim" },
  { re: /\b(velvet|veludo)\b/i, pt: "veludo", en: "velvet" },
  { re: /\b(corduroy|bombazina)\b/i, pt: "bombazina", en: "corduroy" },
  { re: /\b(canvas|lona)\b/i, pt: "lona", en: "canvas" },
  { re: /\b(knit|knitted|malha|tricot)\b|\btric[oô](?![a-zà-ÿ])/i, pt: "malha", en: "knit" },
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

// Detalhes que distinguem a peça (não são tamanho, sexo nem marca). adj = junto ao tipo;
// feat = "com …" no fim. Só um de cada.
const DETAILS: { re: RegExp; pt: { adj?: string; feat?: string }; en: { adj?: string; feat?: string } }[] = [
  { re: /\bpenny\b/i, pt: { adj: "penny" }, en: { adj: "penny" } },
  { re: /\b(tassels?|borlas?)\b/i, pt: { feat: "com borlas" }, en: { adj: "tassel" } },
  { re: /\b(horsebit|freio)\b/i, pt: { feat: "com freio" }, en: { adj: "horsebit" } },
  { re: /\b(chunky|thick[- ]sole[d]?|platform|sola (grossa|grosso|alta)|solado grosso|plataforma)\b/i, pt: { feat: "de sola grossa" }, en: { adj: "chunky" } },
  { re: /\b(two[- ]tone|bicolou?r|bicolores?)\b/i, pt: { adj: "bicolores" }, en: { adj: "two-tone" } },
  { re: /\b(half[- ]zip|quarter[- ]zip|meio (z[ií]per|fecho))\b/i, pt: { feat: "com meio fecho" }, en: { adj: "half-zip" } },
  { re: /\b(turtleneck|roll[- ]neck|gola alta)\b/i, pt: { feat: "de gola alta" }, en: { adj: "turtleneck" } },
  { re: /\b(embroider(ed|y)|bordad[oa]s?|bordados)\b/i, pt: { feat: "com bordados" }, en: { adj: "embroidered" } },
  { re: /\b(fringed?|franjas?)\b/i, pt: { feat: "com franjas" }, en: { adj: "fringed" } },
  { re: /\b(square buckle|fivela quadrada)\b/i, pt: { feat: "com fivela quadrada" }, en: { feat: "with square buckle" } },
  { re: /\b(wide[- ]leg|perna larga)\b/i, pt: { feat: "de perna larga" }, en: { adj: "wide-leg" } },
  { re: /\b(cargo)\b/i, pt: { adj: "cargo" }, en: { adj: "cargo" } },
  { re: /\b(chinos?)\b/i, pt: { adj: "chino" }, en: { adj: "chino" } },
  { re: /\b(hooded|capuz)\b/i, pt: { feat: "com capuz" }, en: { adj: "hooded" } },
  { re: /\b(double[- ]breasted|trespassad[oa])\b/i, pt: { adj: "trespassado" }, en: { adj: "double-breasted" } },
  { re: /\b(quilted|acolchoad[oa])\b/i, pt: { adj: "acolchoado" }, en: { adj: "quilted" } },
  { re: /\b(lapel collar|gola dobrada|gola de lapela)\b/i, pt: { feat: "com gola de lapela" }, en: { feat: "with lapel collar" } },
];

/** Um adjetivo e uma característica, por esta ordem de fontes (nome primeiro). */
export function findDetails(...sources: (string | null | undefined)[]) {
  const found: (typeof DETAILS)[number][] = [];
  for (const src of sources)
    if (src) for (const d of DETAILS) if (d.re.test(src) && !found.includes(d)) found.push(d);
  return found;
}

/** Nome = tipo [+ detalhe] + material, na língua indicada (até 60 caracteres). */
export function buildTitle(
  type: { pt: string; en: string },
  material: { pt: string; en: string } | null,
  lang: Lang,
  details: ReturnType<typeof findDetails> = [],
) {
  const d = details.map((x) => x[lang]);
  const adj = d.find((x) => x.adj)?.adj;
  const feat = d.find((x) => x.feat)?.feat;
  const build = (withFeat: boolean) => {
    if (lang === "pt") {
      // "Camisola" + "de malha" + "com meio fecho"; não repete o material quando o tipo já o diz.
      const mat = material && !type.pt.toLowerCase().includes(material.pt) ? ` de ${material.pt}` : "";
      return [type.pt + (adj ? ` ${adj}` : "") + mat, withFeat ? feat : null].filter(Boolean).join(" ");
    }
    const t = type.en.charAt(0).toLowerCase() + type.en.slice(1);
    const mat = material && !t.includes(material.en) ? `${material.en} ` : "";
    return cap(`${mat}${adj ? `${adj} ` : ""}${t}${withFeat && feat ? ` ${feat}` : ""}`);
  };
  const full = build(true);
  return full.length <= 60 ? full : build(false);
}

// Português do Brasil → português europeu (nomes e cores vindos de traduções automáticas).
const BR_PT: [RegExp, string][] = [
  [/\bsu[eé]ter(es)?\b/gi, "camisola"],
  [/\bz[ií]per\b/gi, "fecho"],
  [/\bterno\b/gi, "fato"],
  [/\bcal[cç]a\b/gi, "calças"], // singular "calça" é do Brasil
  [/\bjaqueta\b/gi, "blusão"],
  [/\bmoletom\b/gi, "sweatshirt"],
  [/\bt[eê]nis\b/gi, "sapatilhas"],
  [/\bmarrom\b/gi, "castanho"],
  [/\bcinza\b/gi, "cinzento"],
  [/\bex[eé]rcito verde\b/gi, "verde-tropa"],
  [/\bc[aá]qui\b/gi, "caqui"],
];
export const hasBrazilian = (s: string) => BR_PT.some(([re]) => new RegExp(re.source, "i").test(s));
export function toEuropeanPortuguese(s: string) {
  let out = s;
  for (const [re, pt] of BR_PT)
    out = out.replace(re, (m) => (m[0] === m[0]!.toUpperCase() ? pt.charAt(0).toUpperCase() + pt.slice(1) : pt));
  return out.replace(/\btric[oô](?![a-zà-ÿ])/gi, "malha");
}

// Cores em pinyin (traduções automáticas da AliExpress).
const PINYIN: Record<string, [string, string]> = {
  heise: ["Preto", "Black"], baise: ["Branco", "White"], huise: ["Cinzento", "Grey"], shenhui: ["Cinzento escuro", "Dark grey"],
  qianhui: ["Cinzento claro", "Light grey"], lanse: ["Azul", "Blue"], zangqing: ["Azul-marinho", "Navy"], lvse: ["Verde", "Green"],
  hongse: ["Vermelho", "Red"], kafeise: ["Café", "Coffee"], kafei: ["Café", "Coffee"], mise: ["Bege", "Beige"],
  xingse: ["Damasco", "Apricot"], kase: ["Caqui", "Khaki"], kaqi: ["Caqui", "Khaki"], zongse: ["Castanho", "Brown"],
  fense: ["Rosa", "Pink"], huangse: ["Amarelo", "Yellow"], zise: ["Roxo", "Purple"], jiuhong: ["Bordeaux", "Burgundy"],
};

/** Tira códigos do fornecedor ("Kd503", "608 Black", "coffee B") e converte pinyin. */
export function cleanColorName(c: string, lang: Lang) {
  const raw = c.trim();
  const py = PINYIN[raw.toLowerCase().replace(/\s+/g, "")];
  if (py) return lang === "pt" ? py[0] : py[1];
  const cleaned = raw
    .split(/\s+/)
    .filter((w) => !/\d/.test(w) && !/^[A-Z]$/.test(w))
    .join(" ")
    .trim();
  return cleaned.length >= 2 ? cleaned : null; // só código: sem nome de cor
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
