import { productImage } from "@/lib/images";

type PhotoSource = {
  gallery?: string[] | null;
  image_url?: string | null;
  image_key?: string | null;
  photo_cutouts?: unknown;
};

/** Fotografias originais de um produto pela ordem da galeria; sem galeria, a principal (image_url). */
export function productPhotos(p: PhotoSource) {
  const main = productImage(p);
  const list = p.gallery?.length ? p.gallery : main ? [main] : [];
  return [...new Set(list.filter((u) => /^https:\/\/\S+$/.test(u)))];
}

/**
 * Tratamento de cada fotografia: endereço do recorte (PNG sem fundo) ou "fundo" quando a foto
 * fica como está (pessoa a vestir, cenário). Fotografias sem entrada ainda não foram tratadas.
 */
export type CutoutMap = Record<string, string>;
export const KEEP_BACKGROUND = "fundo";

export function cutoutMap(p: PhotoSource): CutoutMap {
  const m = p.photo_cutouts;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return Object.fromEntries(
    Object.entries(m as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string" && (e[1] === KEEP_BACKGROUND || /^https:\/\/\S+$/.test(e[1])),
    ),
  );
}

export type StorePhoto = { src: string; cutout: boolean };

/**
 * Fotografias para a loja, no estilo das grandes marcas: recortes sobre o fundo da loja e,
 * no máximo, uma fotografia com fundo (a da pessoa a vestir), em segundo lugar.
 * Produtos ainda sem recortes mostram as fotografias originais.
 */
export function storePhotos(p: PhotoSource): StorePhoto[] {
  const list = productPhotos(p);
  const map = cutoutMap(p);
  const cut = list.map((u) => map[u]).filter((u): u is string => !!u && u !== KEEP_BACKGROUND);
  if (!cut.length) return list.map((src) => ({ src, cutout: false }));
  const out: StorePhoto[] = cut.map((src) => ({ src, cutout: true }));
  const withBg = list.find((u) => map[u] === KEEP_BACKGROUND);
  if (withBg) out.splice(1, 0, { src: withBg, cutout: false });
  return out;
}

/** Recorte da fotografia indicada (ou do primeiro recorte do produto). */
export function cutoutFor(p: PhotoSource, photo?: string) {
  const map = cutoutMap(p);
  if (photo && map[photo] && map[photo] !== KEEP_BACKGROUND) return map[photo];
  return storePhotos(p).find((x) => x.cutout)?.src;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
