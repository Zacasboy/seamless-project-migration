import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Recortes (fotografias sem fundo) para os quadros dos conjuntos.
// O recorte é feito no navegador do administrador; aqui só se lê a fotografia original
// (os sites dos fornecedores não deixam o navegador lê-la diretamente) e se guarda o PNG final.

type StoredEntry = string | { tipo: string; estado: string; url?: string; origem?: string };
export type StoredMap = Record<string, StoredEntry>;

export const CUTOUT_BUCKET = "outfit-cutouts";
const MAX_SOURCE = 8 * 1024 * 1024;
const MAX_CUTOUT = 5 * 1024 * 1024;

async function assertAdmin(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Só administradores podem usar esta função.");
}

// Só endereços https públicos (sem IPs nem nomes internos).
function safeUrl(raw: string): URL {
  const u = new URL(raw);
  const host = u.hostname.toLowerCase();
  if (
    u.protocol !== "https:" ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    /(^|\.)(localhost|local|internal)$/.test(host)
  )
    throw new Error("Endereço de fotografia inválido.");
  return u;
}

export const fetchPhotoForCutout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await fetch(safeUrl(data.url), {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" },
    });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!res.ok || !type.startsWith("image/")) throw new Error("Não foi possível ler a fotografia.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_SOURCE) throw new Error("Fotografia demasiado grande (máx. 8 MB).");
    return { dataUrl: `data:${type};base64,${buf.toString("base64")}` };
  });

export const saveCutout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid().or(z.string().min(1).max(64)),
        png: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).max(Math.ceil(MAX_CUTOUT * 1.4)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const bytes = Buffer.from(data.png.slice(data.png.indexOf(",") + 1), "base64");
    // Confirma que é mesmo um PNG.
    if (bytes.byteLength > MAX_CUTOUT || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
      throw new Error("Recorte inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeId = data.productId.replace(/[^a-zA-Z0-9-]/g, "");
    const path = `${safeId}/${Date.now().toString(36)}.png`;
    const up = await supabaseAdmin.storage.from(CUTOUT_BUCKET).upload(path, bytes, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    if (up.error)
      throw new Error(
        /bucket/i.test(up.error.message)
          ? "Falta criar o espaço de armazenamento dos recortes (migration outfit_cutouts)."
          : "Não foi possível guardar o recorte.",
      );
    return { url: supabaseAdmin.storage.from(CUTOUT_BUCKET).getPublicUrl(path).data.publicUrl };
  });

/**
 * Regista o tratamento de uma fotografia do produto: endereço do recorte, "fundo" (fica como está)
 * ou null (volta a "por tratar"). A fotografia original nunca é apagada.
 */
export const setPhotoTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        productId: z.string().min(1).max(64),
        photo: z.string().regex(/^https:\/\/\S+$/).max(2000),
        value: z.union([
          z.null(),
          z
            .object({
              tipo: z.enum(["recorte", "foto", "fundo"]),
              estado: z.enum(["pendente", "aprovado", "rejeitado"]),
              url: z.string().regex(/^https:\/\/\S+$/).max(2000).optional(),
              origem: z.enum(["replicate", "navegador", "comfyui", "comfyui-nova", "original"]).optional(),
            })
            .refine((v) => v.tipo === "fundo" || !!v.url, "Falta o endereço da imagem."),
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const cur = await db.from("products").select("photo_cutouts").eq("id", data.productId).maybeSingle();
    if (cur.error)
      throw new Error(
        /photo_cutouts/.test(cur.error.message)
          ? "Falta aplicar a atualização da base de dados das fotografias (migration product_cutouts)."
          : "Não foi possível ler o produto.",
      );
    if (!cur.data) throw new Error("Produto não encontrado.");
    const map = { ...((cur.data as { photo_cutouts?: Record<string, unknown> }).photo_cutouts ?? {}) };
    if (data.value === null) delete map[data.photo];
    else map[data.photo] = data.value;
    const up = await db.from("products").update({ photo_cutouts: map }).eq("id", data.productId);
    if (up.error) throw new Error("Não foi possível guardar.");
    return { photo_cutouts: map as StoredMap };
  });

/**
 * Recorte com BiRefNet na Replicate: corre no servidor, corta à volta da peça e guarda o PNG.
 * Fica "pendente" até ser aprovado em Painel → Fotografias.
 */
export const replicateCutout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ productId: z.string().min(1).max(64), photo: z.string().regex(/^https:\/\/\S+$/).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    safeUrl(data.photo);
    const { birefnetCutout } = await import("@/server/replicate");
    const { cropPng, isPng } = await import("@/server/png-crop");
    const raw = await birefnetCutout(data.photo);
    if (!isPng(raw)) throw new Error("A Replicate devolveu um formato inesperado (não PNG).");
    const { png, coverage } = cropPng(raw);
    if (png.byteLength > MAX_CUTOUT) throw new Error("Recorte demasiado grande.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeId = data.productId.replace(/[^a-zA-Z0-9-]/g, "");
    const path = `${safeId}/${Date.now().toString(36)}-birefnet.png`;
    const up = await supabaseAdmin.storage
      .from(CUTOUT_BUCKET)
      .upload(path, png, { contentType: "image/png", cacheControl: "31536000", upsert: false });
    if (up.error) throw new Error("Não foi possível guardar o recorte.");
    const url = supabaseAdmin.storage.from(CUTOUT_BUCKET).getPublicUrl(path).data.publicUrl;
    // Peça que ocupa quase toda a foto ou quase nada: provavelmente foto de pessoa/cenário.
    const doubtful = coverage > 0.6 || coverage < 0.02;
    return { url, doubtful };
  });

/**
 * Opção híbrida dos conjuntos: a composição feita no painel (recortes reais, posições certas) é
 * "fotografada" como flat-lay por IA. O resultado fica por verificar: só vai para a loja depois de
 * comparado lado a lado e aprovado.
 */
export const reshootOutfit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        composite: z.string().regex(/^https:\/\/\S+$/).max(2000),
        references: z.array(z.string().regex(/^https:\/\/\S+$/).max(2000)).max(7),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    for (const u of [data.composite, ...data.references]) safeUrl(u);
    const { reshootFlatLay } = await import("@/server/replicate");
    const { bytes, type } = await reshootFlatLay(data.composite, data.references);
    const ext = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
    if (bytes.byteLength > MAX_CUTOUT) throw new Error("A imagem gerada é demasiado grande.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `conjuntos/ia-${Date.now().toString(36)}.${ext}`;
    const up = await supabaseAdmin.storage
      .from(CUTOUT_BUCKET)
      .upload(path, bytes, { contentType: type || "image/png", cacheControl: "31536000", upsert: false });
    if (up.error)
      throw new Error(
        /mime|type/i.test(up.error.message)
          ? "Falta a atualização da base de dados das imagens de conjunto (migration outfit_ai)."
          : "Não foi possível guardar a imagem gerada.",
      );
    return { url: supabaseAdmin.storage.from(CUTOUT_BUCKET).getPublicUrl(path).data.publicUrl };
  });
