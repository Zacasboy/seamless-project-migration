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
 * Tratamento de cada fotografia (products.photo_cutouts), por endereço da fotografia original:
 * - recorte: PNG sem fundo; foto: imagem nova com fundo (ComfyUI); fundo: fica a original.
 * Nada aparece na loja sem estar "aprovado" (verificação no painel).
 * Valores antigos (texto) continuam válidos: "fundo" = original aprovada; endereço = recorte por rever.
 */
export type PhotoKind = "recorte" | "foto" | "fundo";
export type PhotoState = "pendente" | "aprovado" | "rejeitado";
export type PhotoEntry = { url?: string; tipo: PhotoKind; estado: PhotoState; origem?: string };
export type CutoutMap = Record<string, PhotoEntry>;
export const KEEP_BACKGROUND = "fundo";

const HTTPS = /^https:\/\/\S+$/;
const KINDS = ["recorte", "foto", "fundo"];
const STATES = ["pendente", "aprovado", "rejeitado"];

export function parseEntry(v: unknown): PhotoEntry | null {
  if (v === KEEP_BACKGROUND) return { tipo: "fundo", estado: "aprovado" };
  if (typeof v === "string") return HTTPS.test(v) ? { url: v, tipo: "recorte", estado: "pendente" } : null;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!KINDS.includes(o["tipo"] as string) || !STATES.includes(o["estado"] as string)) return null;
  const url = typeof o["url"] === "string" && HTTPS.test(o["url"]) ? o["url"] : undefined;
  if (o["tipo"] !== "fundo" && !url) return null;
  return {
    tipo: o["tipo"] as PhotoKind,
    estado: o["estado"] as PhotoState,
    ...(url ? { url } : {}),
    ...(typeof o["origem"] === "string" ? { origem: o["origem"] } : {}),
  };
}

export function cutoutMap(p: PhotoSource): CutoutMap {
  const m = p.photo_cutouts;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const out: CutoutMap = {};
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    const e = parseEntry(v);
    if (e) out[k] = e;
  }
  return out;
}

export type StorePhoto = { src: string; cutout: boolean };

/**
 * Fotografias para a loja, no estilo das grandes marcas: recortes aprovados sobre o fundo da loja e,
 * no máximo, uma fotografia com fundo (imagem nova aprovada ou a original da pessoa), em segundo lugar.
 * Produtos sem recortes aprovados mostram as fotografias originais.
 */
export function storePhotos(p: PhotoSource): StorePhoto[] {
  const list = productPhotos(p);
  const map = cutoutMap(p);
  const ok = (u: string) => (map[u]?.estado === "aprovado" ? map[u] : undefined);
  const cut = list.flatMap((u) => {
    const e = ok(u);
    return e?.tipo === "recorte" && e.url ? [e.url] : [];
  });
  if (!cut.length) return list.map((src) => ({ src, cutout: false }));
  const out: StorePhoto[] = cut.map((src) => ({ src, cutout: true }));
  const generated = list.map(ok).find((e) => e?.tipo === "foto" && e.url)?.url;
  const withBg = generated ?? list.find((u) => ok(u)?.tipo === "fundo");
  if (withBg) out.splice(1, 0, { src: withBg, cutout: false });
  return out;
}

/** Recorte aprovado da fotografia indicada (ou o primeiro do produto). */
export function cutoutFor(p: PhotoSource, photo?: string) {
  const map = cutoutMap(p);
  const e = photo ? map[photo] : undefined;
  if (e?.estado === "aprovado" && e.tipo === "recorte" && e.url) return e.url;
  return storePhotos(p).find((x) => x.cutout)?.src;
}

/** Para compor conjuntos no painel: aceita também recortes ainda por rever (não rejeitados). */
export function draftCutoutFor(p: PhotoSource, photo?: string) {
  const map = cutoutMap(p);
  const e = photo ? map[photo] : undefined;
  if (e && e.tipo === "recorte" && e.url && e.estado !== "rejeitado") return e.url;
  const approved = cutoutFor(p, photo);
  if (approved) return approved;
  // Qualquer recorte ainda por verificar, pela ordem da galeria.
  for (const u of productPhotos(p)) {
    const x = map[u];
    if (x && x.tipo === "recorte" && x.url && x.estado !== "rejeitado") return x.url;
  }
  return undefined;
}

/** Fotografias que servem para recortar (não marcadas como foto com pessoa/cenário). */
export function productOnlyPhotos(p: PhotoSource) {
  const map = cutoutMap(p);
  return productPhotos(p).filter((u) => map[u]?.tipo !== "fundo");
}

/** Endereço de um recorte guardado pela loja (e não uma fotografia original ou uma imagem de conjunto). */
export const isStoredCutout = (url: string) => /\/outfit-cutouts\//.test(url) && !/\/outfit-cutouts\/conjuntos\//.test(url);

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
