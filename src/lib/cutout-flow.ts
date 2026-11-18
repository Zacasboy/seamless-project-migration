// Fluxo completo de uma fotografia no painel: ler → tirar o fundo no navegador → decidir → guardar.
import { fetchPhotoForCutout, saveCutout, setPhotoTreatment } from "@/lib/cutouts.functions";
import { KEEP_BACKGROUND } from "@/lib/photos";

export type PhotoOutcome =
  | { kind: "recorte"; url: string; width: number; height: number; map: Record<string, string> }
  | { kind: "fundo"; map: Record<string, string> };

/**
 * Trata uma fotografia de produto. Por omissão, fotografias de pessoa/cenário ficam com fundo;
 * `force: "recorte"` recorta sempre e `force: "fundo"` só marca para manter.
 */
export async function processProductPhoto(
  productId: string,
  photo: string,
  force?: "recorte" | "fundo",
): Promise<PhotoOutcome> {
  if (force === "fundo") {
    const r = await setPhotoTreatment({ data: { productId, photo, value: KEEP_BACKGROUND } });
    return { kind: "fundo", map: r.photo_cutouts };
  }
  const { removeBackground } = await import("@/lib/cutout");
  const src = photo.startsWith("data:") ? photo : (await fetchPhotoForCutout({ data: { url: photo } })).dataUrl;
  const cut = await removeBackground(src);
  if (cut.modelLike && force !== "recorte") {
    const r = await setPhotoTreatment({ data: { productId, photo, value: KEEP_BACKGROUND } });
    return { kind: "fundo", map: r.photo_cutouts };
  }
  const { url } = await saveCutout({ data: { productId, png: cut.png } });
  const r = await setPhotoTreatment({ data: { productId, photo, value: url } });
  return { kind: "recorte", url, width: cut.width, height: cut.height, map: r.photo_cutouts };
}
