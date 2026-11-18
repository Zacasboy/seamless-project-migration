// Fluxo completo de uma fotografia no painel: ler → tratar → guardar como "pendente".
// Nada aparece na loja antes de ser aprovado na página Fotografias.
import { fetchPhotoForCutout, replicateCutout, saveCutout, setPhotoTreatment } from "@/lib/cutouts.functions";
import type { PhotoEntry } from "@/lib/photos";

export type Engine = "replicate" | "navegador" | "comfyui" | "comfyui-nova";
export type PhotoOutcome = { entry: PhotoEntry; map: Record<string, unknown> };


async function sourceDataUrl(photo: string) {
  return photo.startsWith("data:") ? photo : (await fetchPhotoForCutout({ data: { url: photo } })).dataUrl;
}

// Sem fetch(): a política de segurança da loja não deixa ler endereços data:.
function dataUrlToBlob(d: string) {
  const [head, body = ""] = d.split(",");
  const type = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/png";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export const setEntry = (productId: string, photo: string, value: PhotoEntry | null) =>
  setPhotoTreatment({ data: { productId, photo, value } });

/**
 * Trata uma fotografia de produto.
 * - navegador: recorte grátis (U²-Netp); fotos de pessoa são sugeridas como "fica com fundo".
 * - comfyui: recorte com o workflow de remoção de fundo do ComfyUI local (ex.: BiRefNet).
 * - comfyui-nova: imagem nova a partir da fotografia (workflow de geração do ComfyUI).
 * `force: "recorte"` recorta mesmo fotos de pessoa.
 */
export async function processProductPhoto(
  productId: string,
  photo: string,
  opts: { engine?: Engine; force?: "recorte"; description?: string; onStatus?: (s: string) => void } = {},
): Promise<PhotoOutcome & { url?: string }> {
  const engine = opts.engine ?? "replicate";
  if (engine === "replicate") {
    // Corre no servidor: a fotografia não passa pelo navegador.
    opts.onStatus?.("A recortar com BiRefNet…");
    const { url } = await replicateCutout({ data: { productId, photo } });
    const entry: PhotoEntry = { url, tipo: "recorte", estado: "pendente", origem: "replicate" };
    const r = await setEntry(productId, photo, entry);
    return { entry, map: r.photo_cutouts, url };
  }
  opts.onStatus?.("A ler a fotografia…");
  const src = await sourceDataUrl(photo);

  if (engine === "navegador") {
    const { removeBackground } = await import("@/lib/cutout");
    opts.onStatus?.("A remover o fundo…");
    const cut = await removeBackground(src);
    if (cut.modelLike && opts.force !== "recorte") {
      const entry: PhotoEntry = { tipo: "fundo", estado: "pendente", origem: "navegador" };
      const r = await setEntry(productId, photo, entry);
      return { entry, map: r.photo_cutouts };
    }
    const { url } = await saveCutout({ data: { productId, png: cut.png } });
    const entry: PhotoEntry = { url, tipo: "recorte", estado: "pendente", origem: "navegador" };
    const r = await setEntry(productId, photo, entry);
    return { entry, map: r.photo_cutouts, url };
  }

  const { loadComfy, runComfy } = await import("@/lib/comfy");
  const { normalizeResult } = await import("@/lib/cutout");
  const s = loadComfy();
  const wf = engine === "comfyui" ? s.cutWorkflow : s.genWorkflow;
  if (!wf.trim())
    throw new Error(
      engine === "comfyui"
        ? "Falta o workflow de remoção de fundo do ComfyUI (Fotografias → ComfyUI)."
        : "Falta o workflow de imagem nova do ComfyUI (Fotografias → ComfyUI).",
    );
  // O texto {{descricao}} no workflow recebe o pedido completo (modelo de texto + descrição do produto).
  const prompt = s.genPrompt.replaceAll("{{descricao}}", opts.description ?? "");
  const blob = await runComfy(s.base, wf, dataUrlToBlob(src), prompt, opts.onStatus);
  opts.onStatus?.("A guardar o resultado…");
  const res = await normalizeResult(blob);
  const { url } = await saveCutout({ data: { productId, png: res.png } });
  const entry: PhotoEntry = {
    url,
    tipo: res.transparent ? "recorte" : "foto",
    estado: "pendente",
    origem: engine,
  };
  const r = await setEntry(productId, photo, entry);
  return { entry, map: r.photo_cutouts, url };
}
