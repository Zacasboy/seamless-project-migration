import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Funções do painel para fornecedores com API. Os módulos de servidor são carregados
// dentro dos handlers para nunca entrarem no código do browser.

const PROVIDERS = ["cj", "bigbuy", "printful", "brandsgateway", "aliexpress"] as const;
const CATEGORIES = ["Malas", "Calçado", "Conjuntos"] as const;

async function assertAdmin(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Só administradores podem usar esta função.");
}

// Limite de tempo para não deixar o painel à espera sem fim.
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(new Error(`${what} demorou mais de ${Math.round(ms / 1000)} s. Tente de novo.`)),
        ms,
      ),
    ),
  ]);
}

const friendly = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível falar com o fornecedor.";

export const getSupplierStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { ADAPTERS } = await import("@/server/suppliers");
    const { data: rows } = await context.supabase
      .from("suppliers")
      .select("provider_key, last_synced_at, last_sync_error")
      .not("provider_key", "is", null);
    const { credentialStatus } = await import("@/server/supplier-credentials");
    const ae = ADAPTERS.aliexpress.configured() ? await credentialStatus("aliexpress") : null;
    return Object.values(ADAPTERS).map((a) => {
      const r = rows?.find((x) => x.provider_key === a.key);
      return {
        // Só a AliExpress usa autorização da conta (OAuth); sem segredos, só datas.
        oauth:
          a.key === "aliexpress"
            ? { authorized: !!ae, expiresAt: ae?.expires_at ?? null, account: ae?.account ?? null }
            : null,
        key: a.key,
        name: a.name,
        env: a.env,
        configured: a.configured(),
        linked: !!r,
        lastSyncedAt: r?.last_synced_at ?? null,
        lastError: r?.last_sync_error ?? null,
      };
    });
  });

const refSchema = z.object({
  input: z.string().trim().min(3).max(500),
  provider: z.enum(PROVIDERS).optional(),
});

export const previewSupplierProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => refSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { resolveRef } = await import("@/server/suppliers");
    const ref = resolveRef(data.input, data.provider);
    if (!ref)
      throw new Error(
        "Não reconheci o link. Cole o link do produto na CJ, AliExpress, BigBuy ou Printful, ou escolha o fornecedor e cole a referência.",
      );
    if (!ref.adapter.configured())
      throw new Error(
        `${ref.adapter.name} ainda não está ligado: faltam ${ref.adapter.env.join(", ")} no servidor.`,
      );
    try {
      return await withTimeout(ref.adapter.fetchProduct(ref.id), 40_000, "O fornecedor");
    } catch (e) {
      throw new Error(friendly(e));
    }
  });

// Mensagem legível em vez do JSON de validação.
function parseOrExplain<S extends z.ZodTypeAny>(schema: S, d: unknown): z.output<S> {
  const r = schema.safeParse(d);
  if (r.success) return r.data;
  const i = r.error.issues[0]!;
  const field = { variantIds: "Variantes", images: "Fotografias", title: "Nome", price: "Preço" }[String(i.path[0])] ?? String(i.path[0] ?? "Dados");
  throw new Error(`${field}: ${i.message}`);
}

const importSchema = refSchema.extend({
  title: z.string().trim().min(2).max(160),
  category: z.enum(CATEGORIES),
  gender: z.enum(["mulher", "homem", "unisex"]),
  price: z.number().positive().max(100000),
  fxRate: z.number().positive().max(100).default(1), // moeda do fornecedor → EUR
  publish: z.boolean(),
  variantIds: z.array(z.string().max(120)).max(1000, "no máximo 1000 variantes").optional(),
  // Fotografias escolhidas, pela ordem (a primeira é a principal). Só aceita as do fornecedor.
  images: z.array(z.string().url().max(1000)).min(1, "escolha pelo menos uma").max(20, "no máximo 20").optional(),
});

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artigo";

export const importSupplierProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => parseOrExplain(importSchema, d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertAdmin(db, context.userId);
    const { resolveRef } = await import("@/server/suppliers");
    const { productStockStatus } = await import("@/server/supplier-sync");
    const ref = resolveRef(data.input, data.provider);
    if (!ref || !ref.adapter.configured()) throw new Error("Fornecedor por ligar.");

    // Dados do produto lidos de novo no servidor: custo, imagens e stock nunca vêm do browser.
    let p;
    try {
      p = await withTimeout(ref.adapter.fetchProduct(ref.id), 40_000, "O fornecedor");
    } catch (e) {
      throw new Error(friendly(e));
    }
    if (p.images.length === 0)
      throw new Error("O fornecedor não tem fotografias https para este produto.");
    const images = data.images?.length ? data.images.filter((u) => p.images.includes(u)) : p.images.slice(0, 20);
    if (images.length === 0) throw new Error("As fotografias escolhidas já não existem no fornecedor. Pré-visualize de novo.");

    const { data: supplier } = await db
      .from("suppliers")
      .select("id")
      .eq("provider_key", ref.adapter.key)
      .maybeSingle();
    if (!supplier)
      throw new Error(
        "Falta aplicar a atualização da base de dados 20261116050000_supplier_links.sql.",
      );

    const { data: existing } = await db
      .from("product_supplier_links")
      .select("product_id")
      .eq("supplier_id", supplier.id)
      .eq("external_product_id", p.externalId)
      .maybeSingle();
    if (existing) throw new Error("Este produto do fornecedor já foi importado.");

    const variants = (
      data.variantIds?.length
        ? p.variants.filter((v) => data.variantIds!.includes(v.id))
        : p.variants
    ).map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock: v.stock,
      available: v.available,
    }));
    if (variants.length === 0) throw new Error("Escolha pelo menos uma variante.");
    const costs = p.variants.map((v) => v.cost).filter((c): c is number => c !== null);
    const cost = costs.length ? Math.round(Math.max(...costs) * data.fxRate * 100) / 100 : null;

    let slug = slugify(data.title);
    const { data: clash } = await db.from("products").select("slug").like("slug", `${slug}%`);
    const taken = new Set((clash ?? []).map((r) => r.slug));
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(data.title)}-${n}`;

    const uniq = (xs: (string | null)[]) =>
      [...new Set(xs.filter((x): x is string => !!x))].slice(0, 20);
    const row = {
        slug,
        title: data.title,
        description: p.description
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000),
        price: Math.round(data.price * 100) / 100,
        cost,
        currency: "EUR",
        category: data.category,
        gender: data.gender,
        image_url: images[0]!,
        image_alt: data.title,
        size_options: uniq(variants.map((v) => v.size)),
        color_options: uniq(variants.map((v) => v.color)),
        stock_status: productStockStatus(variants),
        supplier: ref.adapter.name,
        sku: null,
        published: data.publish,
        is_demo: false,
    };
    // Galeria (coluna products.gallery); se a base de dados ainda não a tiver, grava só a principal.
    let { data: product, error } = await db
      .from("products")
      .insert({ ...row, gallery: images } as typeof row)
      .select("id, slug")
      .single();
    if (error && /gallery/i.test(error.message))
      ({ data: product, error } = await db.from("products").insert(row).select("id, slug").single());
    if (error || !product) throw new Error(`Não foi possível gravar o produto: ${error?.message}`);

    const { error: linkError } = await db.from("product_supplier_links").insert({
      product_id: product.id,
      supplier_id: supplier.id,
      external_product_id: p.externalId,
      external_variants: variants,
      supplier_product_url: p.url,
      supplier_sku: variants[0]?.sku ?? null,
      supplier_cost: costs.length ? Math.max(...costs) : null,
      supplier_currency: p.currency,
      availability_status: productStockStatus(variants),
      last_checked_at: new Date().toISOString(),
    });
    if (linkError) {
      await db.from("products").delete().eq("id", product.id);
      throw new Error(`Não foi possível ligar o produto ao fornecedor: ${linkError.message}`);
    }
    // Rotinas automáticas no produto acabado de importar (sem IA; falhas não bloqueiam a importação).
    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runRules } = await import("@/server/agents/rules");
        await runRules(supabaseAdmin as unknown as import("@/server/agents/journal").Db, {
          trigger: "import",
          userId: context.userId,
          productIds: [product.id],
        });
      } catch (e) {
        console.error("[regras após importação]", (e as Error).message);
      }
    }
    return { slug: product.slug };
  });

export const syncSuppliersNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { syncSupplierStock } = await import("@/server/supplier-sync");
    return syncSupplierStock(context.supabase);
  });

export const checkOrderSupplierStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertAdmin(db, context.userId);
    const { data: items, error } = await db
      .from("order_items")
      .select("product_id, size, title")
      .eq("order_id", data.orderId);
    if (error) throw new Error(error.message);
    const lines = (items ?? []).filter((i) => i.product_id) as {
      product_id: string;
      size: string | null;
      title: string;
    }[];
    if (lines.length === 0)
      return { linked: 0, problems: [] as string[], unverified: [] as string[] };
    const { data: refs, error: e2 } = await db.rpc("order_supplier_refs", {
      _product_ids: lines.map((l) => l.product_id),
    });
    if (e2) throw new Error("Falta aplicar a atualização da base de dados dos fornecedores.");
    const { checkLinesWithSuppliers, syncSupplierStock } = await import("@/server/supplier-sync");
    const res = await checkLinesWithSuppliers(refs ?? [], lines);
    if ((refs ?? []).length)
      await syncSupplierStock(
        db,
        lines.map((l) => l.product_id),
      ).catch(() => undefined);
    const title = (id: string) => lines.find((l) => l.product_id === id)?.title ?? id;
    return {
      linked: (refs ?? []).length,
      problems: [...new Set(res.problems.map((p) => title(p.product_id)))],
      unverified: [...new Set(res.unverified.map(title))],
    };
  });

// Início da ligação à conta AliExpress: devolve o link de autorização e guarda um
// "state" aleatório num cookie httpOnly, confirmado no regresso (proteção CSRF).
export const startAliExpressAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { aliexpressAdapter, authorizeUrl, aliexpressRedirectUri } = await import(
      "@/server/suppliers/aliexpress"
    );
    if (!aliexpressAdapter.configured())
      throw new Error(
        `Faltam no servidor: ${aliexpressAdapter.env.join(", ")}. Defina-as na Vercel e faça redeploy.`,
      );
    const { randomBytes } = await import("node:crypto");
    const { setCookie, getRequestUrl } = await import("@tanstack/react-start/server");
    const state = randomBytes(24).toString("base64url");
    const redirectUri = aliexpressRedirectUri(getRequestUrl().origin);
    setCookie("ae_oauth_state", state, {
      httpOnly: true,
      secure: redirectUri.startsWith("https://"),
      sameSite: "lax",
      path: "/api/aliexpress",
      maxAge: 600,
    });
    return { url: authorizeUrl(redirectUri, state) };
  });

// Verificação automática dos canais selecionados; grava o estado de cada fornecedor.
export const checkChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runChannelCheck } = await import("@/server/channel-check");
    return {
      checkedAt: new Date().toISOString(),
      channels: await runChannelCheck(context.supabase, { write: true }),
    };
  });
