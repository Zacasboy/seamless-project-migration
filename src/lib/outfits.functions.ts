import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/products.functions";
import type { Layout } from "@/lib/outfits";

export type OutfitItemRow = {
  id: string;
  outfit_id: string;
  product_id: string;
  position: number;
  size: string | null;
  color: string | null;
  image_url?: string | null;
  layout?: Layout | null;
};
export type OutfitRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  background?: string | null;
  gender?: string | null;
  palette?: string | null;
  created_at: string;
  items: OutfitItemRow[];
};

// Conjuntos publicados com as peças (só peças de produtos publicados, pela política de leitura).
export const listOutfits = createServerFn({ method: "GET" }).handler(async (): Promise<OutfitRow[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = publicClient() as any;
  const { data: outfits, error } = await db
    .from("editorial_outfits")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!outfits?.length) return [];
  const { data: items, error: e2 } = await db
    .from("editorial_outfit_items")
    .select("*")
    .in(
      "outfit_id",
      outfits.map((o: OutfitRow) => o.id),
    )
    .order("position");
  if (e2) throw new Error(e2.message);
  return outfits
    .map((o: OutfitRow) => ({ ...o, items: (items ?? []).filter((i: OutfitItemRow) => i.outfit_id === o.id) }))
    .filter((o: OutfitRow) => o.items.length >= 2);
});

// Conjuntos são um extra nas páginas: uma falha nunca impede a página de abrir.
export const outfitsQuery = queryOptions({
  queryKey: ["outfits"],
  queryFn: () => listOutfits().catch((): OutfitRow[] => []),
});
