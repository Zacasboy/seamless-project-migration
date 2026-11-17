// Ferramentas dos agentes. Leituras devolvem só o necessário; escritas passam pelo diário.
import { z } from "zod/v4";
import type { AgentKey } from "@/lib/agents";
import { STORE_CATEGORIES } from "@/lib/import-products";
import { STOREFRONT, applyOperation, pick, snapshot, type Db, type Operation } from "./journal";
import { titleProblems } from "./product-text";

export const MAX_WRITES = 30;

export type Ctx = {
  db: Db;
  agent: AgentKey | "regras";
  maxWrites?: number;
  runId: string;
  autonomy: "auto" | "propor";
  writes: number;
  siteUrl: string;
};

type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  agents: AgentKey[] | "all";
  run: (ctx: Ctx, input: never) => Promise<unknown>;
};

const ALL: AgentKey[] = ["catalogo", "marca", "conteudo", "concorrencia"];
const reason = z.string().min(5).max(600).describe("Porque fazes esta alteração (fica no diário).");
const uuid = z.string().uuid();

function tool<S extends z.ZodType>(t: {
  name: string;
  description: string;
  schema: S;
  agents: AgentKey[] | "all";
  run: (ctx: Ctx, input: z.infer<S>) => Promise<unknown>;
}): Tool {
  return t as unknown as Tool;
}

/** Escreve através do diário; no modo "propor" (ou no tema) guarda a proposta sem aplicar. */
export async function write(ctx: Ctx, o: Operation) {
  const max = ctx.maxWrites ?? MAX_WRITES;
  if (++ctx.writes > max) throw new Error(`Limite de ${max} alterações por execução atingido. Termina com o relatório.`);
  const propose =
    o.entity === "store_settings" || (ctx.autonomy === "propor" && STOREFRONT.has(o.entity));
  const base = {
    run_id: ctx.runId,
    agent: ctx.agent,
    op: o.op,
    entity: o.entity,
    label: o.label.slice(0, 300),
    reason: o.reason.slice(0, 1000),
  };
  if (propose) {
    const prev = o.id ? await snapshot(ctx.db, o.entity, o.id) : null;
    const values = pick(o.entity, o.values);
    const before = prev && o.op === "update" ? Object.fromEntries(Object.keys(values).map((k) => [k, prev[k] ?? null])) : prev;
    await ctx.db.from("agent_actions").insert({
      ...base,
      entity_id: o.id ?? null,
      before,
      after: o.op === "delete" ? null : values,
      status: "proposed",
    });
    return { estado: "proposta guardada; o administrador decide no painel" };
  }
  try {
    const r = await applyOperation(ctx.db, o);
    await ctx.db.from("agent_actions").insert({ ...base, entity_id: r.id, before: r.before, after: r.after, status: "applied" });
    return { estado: "aplicado", id: r.id };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 900);
    await ctx.db.from("agent_actions").insert({ ...base, entity_id: o.id ?? null, after: pick(o.entity, o.values), status: "failed", error: msg });
    throw new Error(msg);
  }
}

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ---------------- Leituras ----------------

const estadoLoja = tool({
  name: "estado_loja",
  description:
    "Visão geral da loja: contagens e lacunas do catálogo, categorias, preços, tema atual, coleções, páginas e factos técnicos de SEO. Começa por aqui.",
  schema: z.object({}),
  agents: "all",
  async run(ctx) {
    const { data: products } = await ctx.db
      .from("products")
      .select("category, gender, price, published, is_demo, image_url, description, meta_title, meta_description, image_alt, stock_status, title");
    const ps = products ?? [];
    const real = ps.filter((p) => !p.is_demo);
    const byCat: Record<string, { n: number; min: number; max: number }> = {};
    for (const p of real) {
      const c = (byCat[p.category] ??= { n: 0, min: Infinity, max: 0 });
      c.n++;
      c.min = Math.min(c.min, Number(p.price));
      c.max = Math.max(c.max, Number(p.price));
    }
    const { data: theme } = await ctx.db.from("store_settings").select("value").eq("key", "theme").maybeSingle();
    const { data: cols } = await ctx.db.from("collections").select("title, status, is_demo");
    return {
      url: ctx.siteUrl,
      produtos: {
        total: ps.length,
        exemplo_ficticios: ps.length - real.length,
        reais: real.length,
        publicados: real.filter((p) => p.published).length,
        sem_fotografia: real.filter((p) => !p.image_url).length,
        descricao_curta_menos_300: real.filter((p) => clip(p.description, 5000).length < 300).length,
        sem_meta_title: real.filter((p) => !p.meta_title).length,
        sem_meta_description: real.filter((p) => !p.meta_description).length,
        sem_texto_alternativo: real.filter((p) => !p.image_alt || p.image_alt === p.title).length,
        titulo_com_mais_de_70: real.filter((p) => p.title.length > 70).length,
        esgotados: real.filter((p) => p.stock_status === "out_of_stock").length,
        por_categoria: byCat,
      },
      categorias_da_loja: STORE_CATEGORIES,
      generos: ["mulher", "homem", "unisex"],
      tema: theme?.value ?? "ficha",
      temas_disponiveis: {
        ficha: "Ficha técnica: fundo #f2f2f0, texto #161616, acento bordeaux #5b1f24, IBM Plex Sans + IBM Plex Mono, cantos retos, fichas de especificação",
        pedra: "Pedra: fundo #f6f4f0, texto #23201c, acento terracota #8a4b3e, EB Garamond + Hanken Grotesk",
        "pedra-ficha": "Mistura: paleta Pedra com EB Garamond + IBM Plex",
      },
      colecoes: (cols ?? []).map((c) => ({ titulo: c.title, estado: c.status, exemplo: c.is_demo })),
      paginas: {
        inicio: "Cabeçalho técnico; banner escuro com fotografia de campanha; 'Comprar por categoria' (mosaicos); Novidades (8 produtos); Conjuntos; faixa de serviço; rodapé",
        loja: "/loja com filtros por categoria e género",
        produto: "/produto/<slug>: fotografia, ficha técnica (material, disponibilidade, tamanhos, cores), adicionar ao carrinho",
        outras: "/carrinho, /encomendar, /conta, /contacto, /privacidade, /termos",
        painel: "Painel com barra lateral por grupos (Decidir, Vender, Clientes e marketing, Operar, Sustentar), tabelas e painéis de cartão",
      },
      seo_tecnico: {
        robots_txt: true,
        sitemap_xml: true,
        meta_por_produto: "title = meta_title ou título; description = meta_description ou descrição (160 car.)",
        open_graph: "og:type product/website, og:site_name",
        dados_estruturados_product: false,
        https: true,
      },
    };
  },
});

const listarProdutos = tool({
  name: "listar_produtos",
  description: "Lista produtos com os campos de apresentação e indicadores de qualidade. Use filtros para encontrar o que precisa de trabalho.",
  schema: z.object({
    filtro: z
      .enum(["todos", "publicados", "rascunhos", "precisam_trabalho", "sem_seo", "esgotados"])
      .default("todos"),
    categoria: z.string().max(40).optional(),
    pesquisa: z.string().max(80).optional(),
    incluir_exemplos: z.boolean().default(false).describe("Incluir os 23 produtos fictícios de exemplo"),
    limite: z.number().int().min(1).max(40).default(20),
    offset: z.number().int().min(0).default(0),
  }),
  agents: "all",
  async run(ctx, i) {
    let q = ctx.db
      .from("products")
      .select("id, slug, title, category, gender, garment_type, price, published, stock_status, description, meta_title, meta_description, image_alt, image_url, size_options, color_options, supplier, is_demo, created_at")
      .order("created_at", { ascending: false });
    if (!i.incluir_exemplos) q = q.eq("is_demo", false);
    if (i.filtro === "publicados") q = q.eq("published", true);
    if (i.filtro === "rascunhos") q = q.eq("published", false);
    if (i.filtro === "esgotados") q = q.eq("stock_status", "out_of_stock");
    if (i.filtro === "sem_seo") q = q.or("meta_title.is.null,meta_description.is.null,meta_title.eq.,meta_description.eq.");
    if (i.categoria) q = q.eq("category", i.categoria);
    if (i.pesquisa) q = q.ilike("title", `%${i.pesquisa.replace(/[%_,()]/g, " ")}%`);
    const { data, error } = await q.range(i.offset, i.offset + (i.filtro === "precisam_trabalho" ? 200 : i.limite) - 1);
    if (error) throw new Error(error.message);
    let rows = (data ?? []).map((p) => {
      const desc = clip(p.description, 6000);
      const problemas = [
        p.title.length > 70 && "título longo",
        /[A-Z]{4,}|\b(new|hot|sale|2024|2025|free shipping|women|men)\b/i.test(p.title) && "título com termos de fornecedor/inglês",
        desc.length < 300 && "descrição curta",
        !p.meta_title && "sem meta title",
        !p.meta_description && "sem meta description",
        (!p.image_alt || p.image_alt === p.title) && "texto alternativo fraco",
        !p.image_url && "sem fotografia",
      ].filter(Boolean);
      return {
        id: p.id,
        slug: p.slug,
        titulo: p.title,
        categoria: p.category,
        genero: p.gender,
        tipo: p.garment_type,
        preco: Number(p.price),
        publicado: p.published,
        stock: p.stock_status,
        descricao_inicio: desc.slice(0, 220),
        descricao_tamanho: desc.length,
        meta_title: p.meta_title,
        meta_description: p.meta_description,
        image_alt: p.image_alt,
        tamanhos: p.size_options,
        cores: p.color_options,
        fornecedor: p.supplier,
        exemplo: p.is_demo,
        problemas,
      };
    });
    if (i.filtro === "precisam_trabalho") rows = rows.filter((r) => r.problemas.length).slice(0, i.limite);
    return { produtos: rows, devolvidos: rows.length };
  },
});

const verProduto = tool({
  name: "ver_produto",
  description: "Dados completos de um produto, incluindo o texto original do fornecedor e as variantes ligadas.",
  schema: z.object({ id: uuid }),
  agents: "all",
  async run(ctx, i) {
    const { data: p, error } = await ctx.db
      .from("products")
      .select("id, slug, title, description, price, category, gender, garment_type, meta_title, meta_description, image_url, image_alt, size_options, color_options, stock_status, published, supplier, is_demo")
      .eq("id", i.id)
      .maybeSingle();
    if (error || !p) throw new Error("Produto não encontrado.");
    const { data: link } = await ctx.db
      .from("product_supplier_links")
      .select("supplier_product_url, external_variants")
      .eq("product_id", i.id)
      .maybeSingle();
    return {
      ...p,
      description: clip(p.description, 4000),
      url_loja: `${ctx.siteUrl}/produto/${p.slug}`,
      fornecedor_url: link?.supplier_product_url ?? null,
      variantes: (link?.external_variants as unknown[] | undefined)?.slice(0, 40) ?? [],
    };
  },
});

const verColecoes = tool({
  name: "ver_colecoes",
  description: "Coleções com os produtos de cada uma.",
  schema: z.object({}),
  agents: "all",
  async run(ctx) {
    const { data } = await ctx.db.from("collections").select("id, slug, title, description, campaign, season, status, is_demo").order("created_at");
    const out = [];
    for (const c of data ?? []) {
      const s = await snapshot(ctx.db, "collections", c.id);
      out.push({ ...c, description: clip(c.description, 400), product_ids: s?.["product_ids"] ?? [] });
    }
    return out;
  },
});

const verVendas = tool({
  name: "ver_vendas_e_trafego",
  description: "Encomendas, receita, produtos mais vendidos e mais vistos nos últimos N dias.",
  schema: z.object({ dias: z.number().int().min(1).max(365).default(30) }),
  agents: "all",
  async run(ctx, i) {
    const since = new Date(Date.now() - i.dias * 86400_000).toISOString();
    const { data: orders } = await ctx.db.from("orders").select("id, total, status").gte("created_at", since).neq("status", "cancelled");
    const ids = (orders ?? []).map((o) => o.id);
    const { data: items } = ids.length
      ? await ctx.db.from("order_items").select("product_id, title, quantity").in("order_id", ids.slice(0, 500))
      : { data: [] as { product_id: string | null; title: string; quantity: number }[] };
    const sold = new Map<string, { titulo: string; unidades: number }>();
    for (const it of items ?? []) {
      const k = it.product_id ?? it.title;
      const s = sold.get(k) ?? { titulo: it.title, unidades: 0 };
      s.unidades += it.quantity;
      sold.set(k, s);
    }
    const { data: views } = await ctx.db.from("page_views").select("path, product_id").gte("created_at", since).limit(5000);
    const seen = new Map<string, number>();
    for (const v of views ?? []) if (v.product_id) seen.set(v.product_id, (seen.get(v.product_id) ?? 0) + 1);
    return {
      dias: i.dias,
      encomendas: orders?.length ?? 0,
      receita_eur: Math.round((orders ?? []).reduce((t, o) => t + Number(o.total), 0) * 100) / 100,
      mais_vendidos: [...sold.entries()].sort((a, b) => b[1].unidades - a[1].unidades).slice(0, 10).map(([id, s]) => ({ id, ...s })),
      visitas_paginas: views?.length ?? 0,
      mais_vistos: [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ product_id: id, visitas: n })),
      nota: (orders?.length ?? 0) < 20 ? "Poucos dados: trate as conclusões como indicativas." : undefined,
    };
  },
});

const lerConhecimento = tool({
  name: "ler_conhecimento",
  description: "Lê o conhecimento partilhado entre agentes: guia_marca, concorrentes, palavras_chave.",
  schema: z.object({ chave: z.enum(["guia_marca", "concorrentes", "palavras_chave"]) }),
  agents: "all",
  async run(ctx, i) {
    const { data } = await ctx.db.from("agent_memory").select("value, updated_at, updated_by_agent").eq("key", i.chave).maybeSingle();
    return data ?? { vazio: true };
  },
});

const verPlanos = tool({
  name: "ver_planos",
  description: "Planos de ação abertos (de todos os agentes), com as tarefas atribuídas a cada agente.",
  schema: z.object({ incluir_fechados: z.boolean().default(false) }),
  agents: "all",
  async run(ctx, i) {
    let q = ctx.db.from("agent_plans").select("id, agent, kind, title, status, actions, updated_at, body_md").order("updated_at", { ascending: false }).limit(10);
    if (!i.incluir_fechados) q = q.in("status", ["open", "in_progress"]);
    const { data } = await q;
    return (data ?? []).map((p) => ({ ...p, body_md: clip(p.body_md, 1500) }));
  },
});

const verConteudos = tool({
  name: "ver_conteudos",
  description: "Publicações e anúncios já criados.",
  schema: z.object({ estado: z.enum(["draft", "approved", "published", "archived"]).optional(), limite: z.number().int().min(1).max(40).default(20) }),
  agents: "all",
  async run(ctx, i) {
    let q = ctx.db.from("marketing_content").select("id, kind, channel, title, body, cta, product_ids, success_probability, status, created_at").order("created_at", { ascending: false }).limit(i.limite);
    if (i.estado) q = q.eq("status", i.estado);
    const { data } = await q;
    return (data ?? []).map((c) => ({ ...c, body: clip(c.body, 400) }));
  },
});

// ---------------- Escritas ----------------

const productFields = z
  .object({
    title: z.string().min(3).max(60).optional().describe("Só tipo de produto + material; sem tamanho, sexo, fabricante ou estilo"),
    description: z.string().min(40).max(4000).optional().describe("Texto simples com parágrafos separados por linha em branco"),
    category: z.enum(STORE_CATEGORIES).optional(),
    gender: z.enum(["mulher", "homem", "unisex"]).optional(),
    garment_type: z.string().max(60).optional(),
    meta_title: z.string().min(10).max(70).optional(),
    meta_description: z.string().min(50).max(170).optional().describe("Descrição SEO 140–160 caracteres, na língua do produto"),
    image_alt: z.string().min(5).max(200).optional(),
    size_options: z.array(z.string().max(20)).max(20).optional(),
    color_options: z.array(z.string().max(40)).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Indique pelo menos um campo.");

const atualizarProduto = tool({
  name: "atualizar_produto",
  description: "Altera a apresentação de um produto (nunca o preço). Só os campos indicados mudam.",
  schema: z.object({ id: uuid, campos: productFields, motivo: reason }),
  agents: ["catalogo", "marca"],
  async run(ctx, i) {
    const { data: p } = await ctx.db.from("products").select("title").eq("id", i.id).maybeSingle();
    if (!p) throw new Error("Produto não encontrado.");
    if (i.campos.title) {
      const bad = titleProblems(i.campos.title);
      if (bad.length)
        throw new Error(
          `Nome recusado (${bad.join(", ")}). O nome tem só o tipo de produto e o material, ex. "Mocassins de camurça" ou "Leather loafers".`,
        );
    }
    return write(ctx, { entity: "products", op: "update", id: i.id, values: i.campos, label: `${p.title}: ${Object.keys(i.campos).join(", ")}`, reason: i.motivo });
  },
});

const publicarProduto = tool({
  name: "publicar_produto",
  description: "Publica ou retira da loja (arquiva) um produto. Para publicar precisa de fotografia, descrição e categoria.",
  schema: z.object({ id: uuid, publicado: z.boolean(), motivo: reason }),
  agents: ["catalogo"],
  async run(ctx, i) {
    const { data: p } = await ctx.db.from("products").select("title, image_url, description, category, is_demo").eq("id", i.id).maybeSingle();
    if (!p) throw new Error("Produto não encontrado.");
    if (i.publicado && (!p.image_url || clip(p.description, 400).length < 80 || !p.category))
      throw new Error("Não pode publicar: falta fotografia, descrição (80+ caracteres) ou categoria.");
    return write(ctx, { entity: "products", op: "update", id: i.id, values: { published: i.publicado }, label: `${i.publicado ? "Publicar" : "Retirar da loja"}: ${p.title}`, reason: i.motivo });
  },
});

const colecaoFields = {
  title: z.string().min(2).max(120),
  description: z.string().max(2000).default(""),
  campaign: z.string().max(200).optional(),
  season: z.string().max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  product_ids: z.array(uuid).min(2).max(40),
};

const criarColecao = tool({
  name: "criar_colecao",
  description: "Cria uma coleção com produtos reais. Publique só com 4+ produtos publicados.",
  schema: z.object({ ...colecaoFields, motivo: reason }),
  agents: ["catalogo", "marca"],
  async run(ctx, { motivo, ...values }) {
    return write(ctx, { entity: "collections", op: "create", values, label: `Coleção: ${values.title}`, reason: motivo });
  },
});

const atualizarColecao = tool({
  name: "atualizar_colecao",
  description: "Altera uma coleção. product_ids substitui a lista inteira, pela ordem dada.",
  schema: z.object({
    id: uuid,
    campos: z.object({
      title: colecaoFields.title.optional(),
      description: z.string().max(2000).optional(),
      campaign: z.string().max(200).optional(),
      season: z.string().max(100).optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      product_ids: colecaoFields.product_ids.optional(),
    }),
    motivo: reason,
  }),
  agents: ["catalogo", "marca"],
  async run(ctx, i) {
    return write(ctx, { entity: "collections", op: "update", id: i.id, values: i.campos, label: `Coleção: ${Object.keys(i.campos).join(", ")}`, reason: i.motivo });
  },
});

const apagarColecao = tool({
  name: "apagar_colecao",
  description: "Apaga uma coleção (os produtos ficam). Prefira arquivar (status archived).",
  schema: z.object({ id: uuid, motivo: reason }),
  agents: ["catalogo"],
  async run(ctx, i) {
    return write(ctx, { entity: "collections", op: "delete", id: i.id, label: "Apagar coleção", reason: i.motivo });
  },
});

const guardarConhecimento = tool({
  name: "guardar_conhecimento",
  description:
    "Guarda conhecimento partilhado. guia_marca: só o agente de marca. concorrentes: só o agente de concorrência. palavras_chave: agente de catálogo.",
  schema: z.object({ chave: z.enum(["guia_marca", "concorrentes", "palavras_chave"]), valor: z.record(z.string(), z.unknown()), motivo: reason }),
  agents: "all",
  async run(ctx, i) {
    const owner = { guia_marca: "marca", concorrentes: "concorrencia", palavras_chave: "catalogo" }[i.chave];
    if (owner !== ctx.agent) throw new Error(`Só o agente «${owner}» escreve ${i.chave}.`);
    if (JSON.stringify(i.valor).length > 30000) throw new Error("Valor demasiado grande (máx. 30 000 caracteres).");
    const { data: exists } = await ctx.db.from("agent_memory").select("key").eq("key", i.chave).maybeSingle();
    return write(ctx, {
      entity: "agent_memory",
      op: exists ? "update" : "create",
      id: i.chave,
      values: { value: i.valor, updated_by_agent: ctx.agent },
      label: `Conhecimento: ${i.chave}`,
      reason: i.motivo,
    });
  },
});

const proporTema = tool({
  name: "propor_tema",
  description: "Propõe mudar o tema da loja. Fica sempre pendente da aprovação do administrador.",
  schema: z.object({ tema: z.enum(["ficha", "pedra", "pedra-ficha"]), motivo: reason }),
  agents: ["marca"],
  async run(ctx, i) {
    return write(ctx, { entity: "store_settings", op: "update", id: "theme", values: { value: i.tema }, label: `Tema da loja: ${i.tema}`, reason: i.motivo });
  },
});

const conteudoFields = z.object({
  kind: z.enum(["post", "ad", "email", "blog"]),
  channel: z.enum(["instagram", "facebook", "tiktok", "pinterest", "meta_ads", "google_ads", "email", "blog"]),
  title: z.string().min(3).max(200).describe("Título interno ou título do anúncio"),
  body: z.string().min(20).max(6000).describe("Texto completo pronto a usar; para anúncios: título, texto principal, descrição e variações A/B"),
  hashtags: z.array(z.string().max(40)).max(15).default([]),
  cta: z.string().max(120).optional(),
  audience: z.string().max(600).optional().describe("Público-alvo e segmentação sugerida"),
  product_ids: z.array(uuid).max(10).default([]),
  budget_eur: z.number().min(0).max(5000).optional(),
  expected_ctr: z.number().min(0).max(1).optional().describe("Fração, ex. 0.012 = 1,2%"),
  expected_cvr: z.number().min(0).max(1).optional(),
  success_probability: z.number().min(0).max(1).describe("Probabilidade estimada de superar a média de referência do canal"),
  rationale: z.string().min(20).max(2000).describe("Base da estimativa: referências do setor, dados da loja, pressupostos"),
  scheduled_for: z.string().datetime({ offset: true }).optional(),
});

const criarConteudo = tool({
  name: "criar_conteudo",
  description: "Cria um rascunho de publicação ou anúncio. Nunca é publicado sozinho.",
  schema: z.object({ conteudo: conteudoFields, motivo: reason }),
  agents: ["conteudo"],
  async run(ctx, i) {
    return write(ctx, { entity: "marketing_content", op: "create", values: { ...i.conteudo, status: "draft", agent: ctx.agent }, label: `${i.conteudo.channel}: ${i.conteudo.title}`, reason: i.motivo });
  },
});

const atualizarConteudo = tool({
  name: "atualizar_conteudo",
  description: "Altera um rascunho, ou arquiva (status archived). Não marca como aprovado nem publicado.",
  schema: z.object({
    id: uuid,
    campos: conteudoFields.partial().extend({ status: z.enum(["draft", "archived"]).optional() }),
    motivo: reason,
  }),
  agents: ["conteudo", "marca"],
  async run(ctx, i) {
    const { data: c } = await ctx.db.from("marketing_content").select("status, title").eq("id", i.id).maybeSingle();
    if (!c) throw new Error("Conteúdo não encontrado.");
    if (c.status === "approved" || c.status === "published") throw new Error("Já aprovado pelo administrador: não altere.");
    return write(ctx, { entity: "marketing_content", op: "update", id: i.id, values: i.campos, label: `Conteúdo: ${c.title}`, reason: i.motivo });
  },
});

const apagarConteudo = tool({
  name: "apagar_conteudo",
  description: "Apaga um rascunho criado por agentes.",
  schema: z.object({ id: uuid, motivo: reason }),
  agents: ["conteudo"],
  async run(ctx, i) {
    const { data: c } = await ctx.db.from("marketing_content").select("status, title").eq("id", i.id).maybeSingle();
    if (!c) throw new Error("Conteúdo não encontrado.");
    if (c.status !== "draft" && c.status !== "archived") throw new Error("Só rascunhos ou arquivados.");
    return write(ctx, { entity: "marketing_content", op: "delete", id: i.id, label: `Apagar conteúdo: ${c.title}`, reason: i.motivo });
  },
});

const acaoPlano = z.object({
  titulo: z.string().max(200),
  responsavel: z.enum(["catalogo", "marca", "conteudo", "concorrencia", "humano"]),
  prioridade: z.enum(["alta", "media", "baixa"]),
  esforco: z.enum(["rapido", "medio", "grande"]),
  prazo: z.string().max(40).optional(),
  feito: z.boolean().default(false),
});
const fonte = z.object({ titulo: z.string().max(300), url: z.string().url().max(600) });

const criarPlano = tool({
  name: "criar_plano",
  description: "Cria um plano de ação em Markdown com tarefas atribuídas e fontes.",
  schema: z.object({
    kind: z.enum(["concorrencia", "marca", "seo", "conteudo"]),
    title: z.string().min(3).max(200),
    body_md: z.string().min(100).max(30000),
    actions: z.array(acaoPlano).max(30),
    sources: z.array(fonte).max(60).default([]),
    motivo: reason,
  }),
  agents: ["marca", "concorrencia", "catalogo"],
  async run(ctx, { motivo, ...v }) {
    return write(ctx, { entity: "agent_plans", op: "create", values: { ...v, agent: ctx.agent, status: "open" }, label: `Plano: ${v.title}`, reason: motivo });
  },
});

const atualizarPlano = tool({
  name: "atualizar_plano",
  description: "Altera um plano (texto, tarefas, estado). Qualquer agente pode marcar as suas tarefas como feitas.",
  schema: z.object({
    id: uuid,
    campos: z.object({
      title: z.string().min(3).max(200).optional(),
      body_md: z.string().max(30000).optional(),
      actions: z.array(acaoPlano).max(30).optional(),
      sources: z.array(fonte).max(60).optional(),
      status: z.enum(["open", "in_progress", "done", "archived"]).optional(),
    }),
    motivo: reason,
  }),
  agents: "all",
  async run(ctx, i) {
    return write(ctx, { entity: "agent_plans", op: "update", id: i.id, values: i.campos, label: `Plano: ${Object.keys(i.campos).join(", ")}`, reason: i.motivo });
  },
});

const apagarPlano = tool({
  name: "apagar_plano",
  description: "Apaga um plano obsoleto (prefira arquivar).",
  schema: z.object({ id: uuid, motivo: reason }),
  agents: ["concorrencia", "marca"],
  async run(ctx, i) {
    return write(ctx, { entity: "agent_plans", op: "delete", id: i.id, label: "Apagar plano", reason: i.motivo });
  },
});

export const TOOLS: Tool[] = [
  estadoLoja,
  listarProdutos,
  verProduto,
  verColecoes,
  verVendas,
  lerConhecimento,
  verPlanos,
  verConteudos,
  atualizarProduto,
  publicarProduto,
  criarColecao,
  atualizarColecao,
  apagarColecao,
  guardarConhecimento,
  proporTema,
  criarConteudo,
  atualizarConteudo,
  apagarConteudo,
  criarPlano,
  atualizarPlano,
  apagarPlano,
];

export function toolsFor(agent: AgentKey) {
  return TOOLS.filter((t) => t.agents === "all" || t.agents.includes(agent));
}

export function toolDefinitions(agent: AgentKey) {
  return toolsFor(agent).map((t) => {
    const { $schema: _s, ...input_schema } = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
    return { name: t.name, description: t.description, input_schema };
  });
}

export async function runTool(ctx: Ctx, name: string, input: unknown) {
  if (ctx.agent === "regras") throw new Error("As rotinas não usam ferramentas.");
  const t = toolsFor(ctx.agent).find((x) => x.name === name);
  if (!t) throw new Error(`Ferramenta desconhecida: ${name}`);
  const parsed = t.schema.safeParse(input ?? {});
  if (!parsed.success)
    throw new Error(`Dados inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return t.run(ctx, parsed.data as never);
}

export { ALL as ALL_AGENTS };
