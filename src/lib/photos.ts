import { productImage } from "@/lib/images";

/** Fotografias de um produto pela ordem da galeria; sem galeria, a principal (image_url). */
export function productPhotos(p: { gallery?: string[] | null; image_url?: string | null; image_key?: string | null }) {
  const main = productImage(p);
  const list = p.gallery?.length ? p.gallery : main ? [main] : [];
  return [...new Set(list.filter((u) => /^https:\/\/\S+$/.test(u)))];
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
