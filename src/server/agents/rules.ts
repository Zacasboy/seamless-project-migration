// Rotinas automáticas sem IA: regras determinísticas que limpam e organizam o catálogo.
// Não inventam nada: só reorganizam, limpam ou preenchem a partir dos dados que já existem.
// Todas as escritas passam pelo diário (podem ser desfeitas no painel).
import { STORE_CATEGORIES, stripHtml } from "@/lib/import-products";
import type { Db } from "./journal";
import { brandFrom, buildTitle, detectLang, findMaterial, findType, looksLikeSpecDump, seoDescription, titleProblems } from "./product-text";
import { write, type Ctx } from "./tools";

import { RULES, type ProductLanguage, type RuleKey, type RulesConfig } from "@/lib/agents";

export { RULES };
export type { ProductLanguage, RuleKey, RulesConfig };
export const ruleOn = (c: RulesConfig, k: RuleKey) => c.rules[k] ?? RULES[k].default;

// ---------------- Funções puras (testadas) ----------------

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ordm: "º", ordf: "ª", deg: "°", times: "×",
  aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä", eacute: "é", egrave: "è", ecirc: "ê", iacute: "í",
  oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", uacute: "ú", uuml: "ü", ccedil: "ç", ntilde: "ñ",
  Aacute: "Á", Agrave: "À", Acirc: "Â", Atilde: "Ã", Eacute: "É", Ecirc: "Ê", Iacute: "Í", Oacute: "Ó", Ocirc: "Ô",
  Otilde: "Õ", Uacute: "Ú", Ccedil: "Ç", Ntilde: "Ñ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", euro: "€",
};

export function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
const TITLE_NOISE = [
  /\b20[12]\d\b/g,
  /\b(new arrivals?|new style|hot sales?|best sellers?|free shipping|dropshipping|drop shipping|high quality|top quality|wholesale|in stock|fast delivery)\b/gi,
  /\b(novos? estilos?|novidade|venda quente|mais vendid[oa]s?|frete gr[aá]tis|envio gr[aá]tis|alta qualidade|atacado|pronta entrega)\b/gi,
  /\b(nuevo|env[ií]o gratis|alta calidad)\b/gi,
  /\b(aliexpress|cjdropshipping|cj dropshipping)\b/gi,
];
const TRAILING_STOP = /\s+(de|da|do|das|dos|para|com|e|em|a|o|ou|for|with|and|the|of|in|or|to|y|con|por)$/i;

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, a, b: string) => a + b.toUpperCase());

/** Corta num limite de palavra, sem terminar em preposição. */
export function cutWords(s: string, max: number) {
  let out = s.length <= max ? s : s.slice(0, max + 1).replace(/\s+\S*$/, "");
  while (TRAILING_STOP.test(out)) out = out.replace(TRAILING_STOP, "");
  return out.replace(/[\s,;:\-–—/]+$/, "");
}

export function cleanTitle(raw: string) {
  let t = decodeEntities(raw).replace(EMOJI, " ");
  for (const re of TITLE_NOISE) t = t.replace(re, " ");
  t = t.replace(/[!¡?¿*#★☆✨]+/g, " ").replace(/\s*[|]\s*/g, " ").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^[\s,;:\-–—/]+|[\s,;:\-–—/]+$/g, "");
  while (/^(new|novo|nova|novos|novas|hot|nuevo)\s+\S/i.test(t)) t = t.replace(/^\S+\s+/, "");
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length > 8 && letters.replace(/[^\p{Lu}]/gu, "").length / letters.length > 0.6) t = titleCase(t);
  t = cutWords(t, 90);
  return t.length >= 3 ? t : raw.trim();
}

const SUPPLIER_JUNK = [
  /\b[\w ]{0,20}mod=ckeditor\b/gi, // restos do editor da AliExpress
  /\bdata-[\w-]+=("[^"]*"|\S+)/gi,
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,
  /\b(aliexpress|cjdropshipping|cj dropshipping|dropshipping|drop shipping)\b/gi,
  /\b(product images?|product pictures?|imagens? do produto|fotos? do produto)\s*:?\s*$/gim, // rótulo sem conteúdo no fim
];

// Campos habituais das fichas dos fornecedores (EN/PT/ES), do mais longo para o mais curto.
const SPEC_KEYS = [
  "product information", "informações do produto", "package includes", "packing list", "package list", "lista de embalagem",
  "shoe upper material", "upper material", "outsole material", "sole material", "lining material", "insole material",
  "material superior", "material da sola", "material do forro", "toe holder shape", "toe shape", "heel height", "heel type",
  "closure type", "processing method", "applicable gender", "applicable season", "applicable scene", "applicable people",
  "item type", "brand name", "place of origin", "origin", "style", "pattern", "material", "color", "colour", "size",
  "season", "gender", "weight", "length", "width", "height", "occasion", "fit", "cor", "tamanho", "estilo", "padrão",
  "género", "gênero", "peso", "comprimento", "largura", "altura", "ocasião", "temporada", "tipo", "forma",
];
const SPEC_KEY = new RegExp(`(?:^|\\s)(?:${SPEC_KEYS.join("|")})\\s*:`, "giu");

export function cleanDescription(raw: string) {
  let d = stripHtml(decodeEntities(decodeEntities(raw ?? ""))).replace(EMOJI, " ");
  for (const re of SUPPLIER_JUNK) d = d.replace(re, " ");
  d = d.replace(/[ \t]{2,}/g, " ");
  // Ficha técnica colada num parágrafo ("Material: X Color: Y Size: Z") → uma linha por campo conhecido.
  const keys = d.match(SPEC_KEY) ?? [];
  if (keys.length >= 2) d = d.replace(SPEC_KEY, (m) => `\n${m.trimStart()}`);
  return d
    .split("\n")
    .map((l) => l.replace(/^[\s,;:.\-–—]+/, "").trim())
    .filter((l, i, a) => l && (i === 0 || l !== a[i - 1]))
    .join("\n")
    .trim()
    .slice(0, 4000);
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL"];

export function normalizeSizes(sizes: string[]) {
  const seen = new Map<string, string>();
  for (const s of sizes) {
    const v = s.trim().replace(/\s+/g, " ");
    if (!v) continue;
    const norm = /^[a-z0-9]{1,4}$/i.test(v) ? v.toUpperCase() : v;
    if (!seen.has(norm.toLowerCase())) seen.set(norm.toLowerCase(), norm);
  }
  const rank = (v: string) => {
    const i = SIZE_ORDER.indexOf(v);
    if (i >= 0) return 1000 + i;
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : 5000;
  };
  return [...seen.values()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 20);
}

const COLORS: [string, string][] = [
  ["black", "Preto"], ["white", "Branco"], ["brown", "Castanho"], ["beige", "Bege"], ["dark blue", "Azul escuro"],
  ["navy blue", "Azul-marinho"], ["navy", "Azul-marinho"], ["light blue", "Azul claro"], ["sky blue", "Azul-céu"], ["blue", "Azul"],
  ["dark green", "Verde escuro"], ["army green", "Verde-tropa"], ["green", "Verde"], ["gray", "Cinzento"], ["grey", "Cinzento"],
  ["light gray", "Cinzento claro"], ["dark gray", "Cinzento escuro"], ["red", "Vermelho"], ["wine red", "Bordeaux"], ["burgundy", "Bordeaux"],
  ["wine", "Bordeaux"], ["pink", "Rosa"], ["yellow", "Amarelo"], ["purple", "Roxo"], ["orange", "Laranja"], ["gold", "Dourado"],
  ["golden", "Dourado"], ["silver", "Prateado"], ["khaki", "Caqui"], ["apricot", "Damasco"], ["camel", "Camel"], ["coffee", "Café"],
  ["cream", "Creme"], ["off white", "Branco-sujo"], ["multicolor", "Multicor"], ["leopard", "Leopardo"], ["transparent", "Transparente"],
];

export function normalizeColors(colors: string[], lang: ProductLanguage) {
  const out = new Map<string, string>();
  for (const c of colors) {
    let v = c.trim().replace(/\s+/g, " ");
    if (!v) continue;
    const low = v.toLowerCase();
    if (lang === "pt") v = COLORS.find(([en]) => en === low)?.[1] ?? v;
    else if (lang === "en") {
      const hit = COLORS.find(([, pt]) => pt.toLowerCase() === low);
      v = hit ? hit[0] : v;
    }
    v = v === v.toLowerCase() || v === v.toUpperCase() ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v;
    if (!out.has(v.toLowerCase())) out.set(v.toLowerCase(), v);
  }
  return [...out.values()].slice(0, 20);
}

export function inferGender(text: string): "mulher" | "homem" | null {
  const t = text.toLowerCase();
  const w = /\b(women'?s?|woman|female|ladies|lady|girls?|mulher(es)?|femin[ia]n[oa]s?|senhoras?|menina)\b/.test(t);
  const m = /\b(men'?s?|man|male|gentlemen|boys?|homens?|masculin[oa]s?|cavalheiros?)\b/.test(t);
  return w && !m ? "mulher" : m && !w ? "homem" : null;
}

export function inferType(text: string) {
  const t = findType(text);
  return t ? { type: t.pt.toLowerCase(), category: t.category } : null;
}

export function metaTitle(title: string) {
  return `${cutWords(title, 55)} | Pallessiani`;
}

const NOTE_LINE = /^(lembrete|nota|note|reminder|aten[cç][aã]o|warning|please|por favor|aviso)\b/i;

export function metaDescription(description: string) {
  const flat = description
    .split("\n")
    .filter((l) => !NOTE_LINE.test(l.trim()) && !/:\s*$/.test(l))
    .join("\n")
    .replace(/\s*\n\s*/g, ". ")
    .replace(/:\s*\./g, ":").replace(/\.{2,}/g, ".").replace(/\s{2,}/g, " ").trim();
  if (flat.length < 60) return null;
  if (flat.length <= 158) return flat;
  const cut = flat.slice(0, 158);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return end > 90 ? cut.slice(0, end + 1) : `${cutWords(flat, 155)}…`;
}

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  gender: string | null;
  garment_type: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_alt: string | null;
  image_url: string | null;
  size_options: string[] | null;
  color_options: string[] | null;
  published: boolean;
  stock_status: string | null;
  price: number | string;
  cost: number | string | null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Calcula as alterações de um produto. Devolve só os campos que mudam e as regras que atuaram. */
export function planProduct(p: ProductRow, cfg: RulesConfig) {
  const patch: Record<string, unknown> = {};
  const rules = new Set<RuleKey>();
  const set = (k: string, v: unknown, r: RuleKey) => {
    if (v !== undefined && v !== null && !same((p as Record<string, unknown>)[k], v)) {
      patch[k] = v;
      rules.add(r);
    }
  };

  const desc = ruleOn(cfg, "descricoes") && p.description ? cleanDescription(p.description) : (p.description ?? "");
  if (desc.length >= 20) set("description", desc, "descricoes");

  // Nome = tipo de produto + material, na língua do produto (ou na escolhida nas definições).
  const lang = cfg.product_language === "manter" ? detectLang(p.title) : cfg.product_language;
  const type = findType(p.title) ?? findType(p.garment_type ?? "");
  let title = p.title;
  if (ruleOn(cfg, "titulos")) {
    title = cleanTitle(p.title);
    const wrongLang = cfg.product_language !== "manter" && detectLang(p.title) !== cfg.product_language;
    if (lang && type && (titleProblems(p.title, brandFrom(desc)).length || wrongLang))
      title = buildTitle(type, findMaterial(p.title, desc), lang);
  }
  set("title", title, "titulos");

  if (ruleOn(cfg, "opcoes")) {
    if (p.size_options?.length) set("size_options", normalizeSizes(p.size_options), "opcoes");
    if (p.color_options?.length) set("color_options", normalizeColors(p.color_options, cfg.product_language), "opcoes");
  }

  if (ruleOn(cfg, "classificacao")) {
    const text = `${p.title} ${p.garment_type ?? ""}`; // nome original: o corte pode ter tirado o tipo
    const kind = type ? { type: type.pt.toLowerCase(), category: type.category } : inferType(desc.slice(0, 300));
    if (!STORE_CATEGORIES.includes(p.category as never) && kind) set("category", kind.category, "classificacao");
    if (!p.garment_type && kind) set("garment_type", kind.type, "classificacao");
    const g = inferGender(text) ?? inferGender(desc.slice(0, 400));
    if ((!p.gender || p.gender === "unisex") && g) set("gender", g, "classificacao");
  }

  const sizes = (patch["size_options"] as string[] | undefined) ?? p.size_options ?? [];
  const colors = (patch["color_options"] as string[] | undefined) ?? p.color_options ?? [];
  const gender = (patch["gender"] as string | undefined) ?? p.gender;
  if (ruleOn(cfg, "seo")) {
    // Só substitui o que estava vazio ou foi gerado automaticamente a partir do nome antigo.
    const mt = p.meta_title?.trim();
    if (!mt || mt === metaTitle(p.title)) set("meta_title", metaTitle(title), "seo");
    const md = p.meta_description?.trim();
    if (!md || looksLikeSpecDump(md) || md.startsWith(p.title) || md.startsWith(`${title} `) || md.startsWith(`${title}.`))
      set("meta_description", lang ? seoDescription({ title, lang, gender, sizes, colors }) : metaDescription(desc), "seo");
  }
  const alt = p.image_alt?.trim();
  if (ruleOn(cfg, "alt") && (!alt || alt === p.title || titleProblems(alt).some((x) => x !== "demasiado longo") || alt.length > 120)) {
    set("image_alt", cutWords(colors.length === 1 ? `${title}, ${colors[0]}` : title, 190), "alt");
  }

  if (p.published) {
    if (ruleOn(cfg, "sem_foto") && !p.image_url) set("published", false, "sem_foto");
    else if (ruleOn(cfg, "esgotados") && p.stock_status === "out_of_stock") set("published", false, "esgotados");
  }

  const alerts: string[] = [];
  const price = Number(p.price);
  const cost = p.cost === null ? null : Number(p.cost);
  if (cost && price < cost * 1.3) alerts.push(`margem baixa: preço ${price.toFixed(2)} € para custo ${cost.toFixed(2)} €`);
  if (desc.length < 120) alerts.push("descrição muito curta");
  if (!p.image_url) alerts.push("sem fotografia");
  if (ruleOn(cfg, "titulos") && !type) alerts.push("tipo de produto não identificado: nome não reconstruído");
  else if (ruleOn(cfg, "titulos") && !lang) alerts.push("língua do nome não identificada: escolha-a nas definições");
  // O nome promete pele, mas a ficha do fornecedor diz material sintético.
  if (/\b(leather|couro|pele|piel)\b/i.test(title) && !/\b(faux|synthetic|sint[eé]tica)\b/i.test(title) && /\b(microfib(er|re|ra)|pu|synthetic|sint[eé]tic[oa]|faux|vegan|pvc)\b/i.test(desc))
    alerts.push("o nome diz pele, mas a ficha indica material sintético (corrigir para não enganar o cliente)");
  return { patch, rules: [...rules], alerts };
}

// ---------------- Execução ----------------

const MAX_RULE_WRITES = 300;

export async function loadRulesConfig(db: Db): Promise<RulesConfig> {
  const { data } = await db.from("agent_settings").select("config").eq("agent", "regras").maybeSingle();
  const c = (data?.config ?? {}) as Partial<RulesConfig>;
  return { rules: c.rules ?? {}, product_language: c.product_language ?? "manter" };
}

export async function runRules(
  db: Db,
  opts: { trigger: "manual" | "cron" | "import"; userId?: string | null; productIds?: string[] },
) {
  const { data: settings } = await db.from("agent_settings").select("enabled, autonomy").eq("agent", "regras").maybeSingle();
  if (settings && !settings.enabled && opts.trigger !== "manual") return { skipped: true as const };
  const cfg = await loadRulesConfig(db);
  const { data: run, error } = await db
    .from("agent_runs")
    .insert({ agent: "regras", trigger: opts.trigger, started_by: opts.userId ?? null })
    .select("id")
    .single();
  if (error || !run) throw new Error(`Não foi possível registar a execução: ${error?.message}`);
  const ctx: Ctx = {
    db,
    agent: "regras",
    runId: run.id,
    autonomy: settings?.autonomy ?? "auto",
    writes: 0,
    maxWrites: MAX_RULE_WRITES,
    siteUrl: "",
  };

  try {
    let q = db
      .from("products")
      .select("id, title, description, category, gender, garment_type, meta_title, meta_description, image_alt, image_url, size_options, color_options, published, stock_status, price, cost")
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (opts.productIds?.length) q = q.in("id", opts.productIds.slice(0, 500));
    const { data: products, error: pe } = await q;
    if (pe) throw new Error(pe.message);

    const counts: Partial<Record<RuleKey, number>> = {};
    const alerts: { title: string; alerts: string[] }[] = [];
    const failed: string[] = [];
    let changed = 0;
    for (const p of (products ?? []) as ProductRow[]) {
      const plan = planProduct(p, cfg);
      if (plan.alerts.length) alerts.push({ title: p.title, alerts: plan.alerts });
      if (!plan.rules.length) continue;
      try {
        await write(ctx, {
          entity: "products",
          op: "update",
          id: p.id,
          values: plan.patch,
          label: `${cutWords(String(plan.patch["title"] ?? p.title), 80)}: ${plan.rules.map((r) => RULES[r].label.toLowerCase()).join(", ")}`,
          reason: `Rotina automática: ${plan.rules.map((r) => RULES[r].label).join(", ")}.`,
        });
        changed++;
        for (const r of plan.rules) counts[r] = (counts[r] ?? 0) + 1;
      } catch (e) {
        failed.push(`${p.title}: ${(e as Error).message}`);
        if (ctx.writes >= MAX_RULE_WRITES) break;
      }
    }

    // Coleções publicadas quase vazias e rascunhos antigos (só em execuções completas).
    let archivedCollections = 0;
    let archivedContent = 0;
    if (!opts.productIds?.length) {
      if (ruleOn(cfg, "colecoes")) {
        const { data: cols } = await db.from("collections").select("id, title").eq("status", "published").eq("is_demo", false);
        for (const c of cols ?? []) {
          const { data: items } = await db.from("collection_items").select("product_id").eq("collection_id", c.id).not("product_id", "is", null);
          const ids = (items ?? []).map((i) => i.product_id as string);
          const { data: live } = ids.length
            ? await db.from("products").select("id").in("id", ids).eq("published", true)
            : { data: [] as { id: string }[] };
          if ((live ?? []).length < 2) {
            await write(ctx, { entity: "collections", op: "update", id: c.id, values: { status: "archived" }, label: `Coleção ${c.title}: arquivar`, reason: "Rotina automática: coleção publicada com menos de 2 produtos publicados." }).catch((e) => failed.push(`${c.title}: ${(e as Error).message}`));
            archivedCollections++;
          }
        }
      }
      if (ruleOn(cfg, "conteudos")) {
        const old = new Date(Date.now() - 30 * 86400_000).toISOString();
        const { data: drafts } = await db.from("marketing_content").select("id, title, product_ids, created_at").eq("status", "draft");
        const { data: live } = await db.from("products").select("id").eq("published", true);
        const liveIds = new Set((live ?? []).map((x) => x.id));
        for (const d of drafts ?? []) {
          const stale = d.created_at < old || (d.product_ids ?? []).some((id: string) => !liveIds.has(id));
          if (!stale) continue;
          await write(ctx, { entity: "marketing_content", op: "update", id: d.id, values: { status: "archived" }, label: `Conteúdo ${d.title}: arquivar`, reason: "Rotina automática: rascunho com mais de 30 dias ou de produto retirado." }).catch((e) => failed.push(`${d.title}: ${(e as Error).message}`));
          archivedContent++;
        }
      }
    }

    const verb = ctx.autonomy === "propor" ? "propostas" : "alterados";
    const summary = `${products?.length ?? 0} produtos verificados, ${changed} ${verb}${archivedCollections ? `, ${archivedCollections} coleções arquivadas` : ""}${archivedContent ? `, ${archivedContent} rascunhos arquivados` : ""}${alerts.length ? `, ${alerts.length} com avisos` : ""}.`;
    const report = [
      `Resumo: ${summary}`,
      "",
      "## O que cada rotina fez",
      "| Rotina | Produtos |",
      "|---|---|",
      ...(Object.keys(RULES) as RuleKey[]).filter((k) => counts[k]).map((k) => `| ${RULES[k].label} | ${counts[k]} |`),
      ...(changed ? [] : ["| Nenhuma alteração necessária | 0 |"]),
      "",
      ...(alerts.length
        ? ["## Avisos (não alterados automaticamente)", "| Produto | Aviso |", "|---|---|", ...alerts.slice(0, 60).map((a) => `| ${a.title.replace(/\|/g, "/")} | ${a.alerts.join("; ")} |`), ""]
        : []),
      ...(failed.length ? ["## Falhas", ...failed.slice(0, 30).map((f) => `- ${f}`), ""] : []),
      "As rotinas não escrevem textos novos: limpam, arrumam e preenchem a partir dos dados existentes. Os nomes e descrições ficam na língua original, salvo indicação nas definições.",
    ].join("\n");
    await db
      .from("agent_runs")
      .update({ status: "done", summary, report_md: report, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return { runId: run.id, status: "done" as const, summary };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 1800);
    await db.from("agent_runs").update({ status: "error", error: msg, finished_at: new Date().toISOString() }).eq("id", run.id);
    return { runId: run.id, status: "error" as const, summary: msg };
  }
}
