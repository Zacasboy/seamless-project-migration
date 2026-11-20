import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Produtos que o fornecedor deixou de vender: a sincronização retira-os da loja e marca a ligação
// como "discontinued". Aqui o administrador decide: apagar de vez ou manter (fora da loja).

const DISCONTINUED = "discontinued";

async function admin(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Só administradores podem usar esta função.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export type DiscontinuedRow = {
  productId: string;
  title: string;
  slug: string;
  image: string | null;
  supplier: string;
  externalId: string;
  since: string | null;
  inOutfits: number;
  inCollections: number;
};

export const listDiscontinued = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscontinuedRow[]> => {
    const db = await admin(context.supabase, context.userId);
    const { data, error } = await db
      .from("product_supplier_links")
      .select("product_id, external_product_id, last_checked_at, suppliers(name), products(title, slug, image_url)")
      .eq("availability_status", DISCONTINUED)
      .order("last_checked_at", { ascending: false });
    if (error) throw new Error("Não foi possível ler os produtos retirados.");
    const ids = (data ?? []).map((r) => r.product_id as string);
    const [outfits, cols] = ids.length
      ? await Promise.all([
          db.from("editorial_outfit_items").select("product_id").in("product_id", ids),
          db.from("collection_items").select("product_id").in("product_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const count = (rows: { product_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.product_id === id).length;
    return (data ?? []).map((r) => {
      const p = r.products as unknown as { title: string; slug: string; image_url: string | null } | null;
      return {
        productId: r.product_id as string,
        title: p?.title ?? "(sem nome)",
        slug: p?.slug ?? "",
        image: p?.image_url ?? null,
        supplier: (r.suppliers as unknown as { name?: string } | null)?.name ?? "Fornecedor",
        externalId: r.external_product_id as string,
        since: (r.last_checked_at as string | null) ?? null,
        inOutfits: count(outfits.data as never, r.product_id as string),
        inCollections: count(cols.data as never, r.product_id as string),
      };
    });
  });

const Input = z.object({ productId: z.string().uuid() });

/** Apaga o produto de vez (sai também de coleções e conjuntos; as encomendas antigas mantêm-se). */
export const deleteDiscontinued = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context.supabase, context.userId);
    const link = await db
      .from("product_supplier_links")
      .select("id")
      .eq("product_id", data.productId)
      .eq("availability_status", DISCONTINUED)
      .limit(1);
    if (!link.data?.length) throw new Error("Este produto não está marcado como retirado pelo fornecedor.");
    for (const step of [
      db.from("editorial_outfit_items").delete().eq("product_id", data.productId),
      db.from("collection_items").delete().eq("product_id", data.productId),
      db.from("collections").update({ hero_product_id: null }).eq("hero_product_id", data.productId),
    ]) {
      const { error } = await step;
      if (error) throw new Error("Não foi possível retirar o produto das coleções ou conjuntos.");
    }
    const { error } = await db.from("products").delete().eq("id", data.productId);
    if (error) throw new Error("Não foi possível apagar o produto.");
    return { ok: true };
  });

/** Mantém o produto fora da loja e tira-o desta lista (pode voltar a publicá-lo à mão). */
export const keepDiscontinued = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context.supabase, context.userId);
    const { error } = await db
      .from("product_supplier_links")
      .update({ availability_status: "out_of_stock" })
      .eq("product_id", data.productId)
      .eq("availability_status", DISCONTINUED);
    if (error) throw new Error("Não foi possível guardar.");
    return { ok: true };
  });
