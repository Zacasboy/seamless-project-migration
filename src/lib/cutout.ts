// Remoção de fundo no navegador, sem custos por imagem.
// Modelo U²-Netp (Apache-2.0, ~4,5 MB) servido pela própria loja e executado com onnxruntime-web (MIT).
// Só corre no painel, quando o administrador pede um recorte; nada disto entra nas páginas da loja.

import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import mjsUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";

const SIZE = 320;
const MODEL_URL = "/models/u2netp.onnx";
const MAX_SIDE = 1000;
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

type Ort = typeof import("onnxruntime-web/wasm");
let session: Promise<{ ort: Ort; s: import("onnxruntime-web/wasm").InferenceSession }> | null = null;

function load() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
    ort.env.wasm.numThreads = 1; // sem isolamento entre origens não há threads
    const s = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    return { ort, s };
  })().catch((e) => {
    session = null;
    throw e;
  });
  return session;
}

/** Converte RGBA 320×320 em tensor NCHW normalizado como no treino do U²-Net. */
export function toTensorData(rgba: Uint8ClampedArray): Float32Array {
  const n = SIZE * SIZE;
  const out = new Float32Array(3 * n);
  let max = 1;
  for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c]! / max - MEAN[c]!) / STD[c]!;
  return out;
}

/** Normaliza a máscara para 0–255 e limpa o ruído (meios-tons muito fracos ficam transparentes). */
export function maskToAlpha(mask: Float32Array): Uint8ClampedArray {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of mask) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const out = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const v = (mask[i]! - lo) / span;
    out[i] = v < 0.08 ? 0 : v > 0.92 ? 255 : Math.round(v * 255);
  }
  return out;
}

export type MaskStats = { coverage: number; top: number; bottom: number; left: number; right: number; unsure: number };

/** Medidas da máscara 320×320: área ocupada, contacto com cada margem e píxeis duvidosos. */
export function maskStats(alpha: Uint8ClampedArray, size = SIZE): MaskStats {
  let on = 0, mid = 0, nonzero = 0;
  for (const v of alpha) {
    if (v > 127) on++;
    if (v > 0) nonzero++;
    if (v > 50 && v < 205) mid++;
  }
  const edge = (f: (i: number) => number) => {
    let n = 0;
    for (let i = 0; i < size; i++) if (alpha[f(i)]! > 127) n++;
    return n / size;
  };
  return {
    coverage: on / alpha.length,
    top: edge((i) => i),
    bottom: edge((i) => (size - 1) * size + i),
    left: edge((i) => i * size),
    right: edge((i) => i * size + size - 1),
    unsure: nonzero ? mid / nonzero : 1,
  };
}

/**
 * Fotografia de pessoa/cenário (fica com fundo): a peça sai cortada pelas margens da foto
 * (corpo cortado em cima/em baixo) ou o recorte é pouco seguro. Fotografias de produto
 * isolado têm margem à volta e contorno nítido.
 */
export function looksLikeModelPhoto(m: MaskStats) {
  const cut = [m.top, m.bottom, m.left, m.right].filter((e) => e > 0.06).length;
  return m.unsure > 0.3 || m.coverage < 0.03 || (cut >= 1 && (m.bottom > 0.15 || m.top > 0.15) && m.coverage > 0.18) || cut >= 3;
}

/** Caixa que contém os píxeis visíveis, com margem. Devolve null se ficar vazio. */
export function opaqueBox(alpha: Uint8ClampedArray, w: number, h: number, pad = 0.02) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x]! > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const p = Math.round(Math.max(w, h) * pad);
  return {
    x: Math.max(0, x0 - p),
    y: Math.max(0, y0 - p),
    w: Math.min(w, x1 + p + 1) - Math.max(0, x0 - p),
    h: Math.min(h, y1 + p + 1) - Math.max(0, y0 - p),
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O navegador não permite desenhar imagens.");
  return { c, ctx };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("Não foi possível abrir a fotografia."));
    img.src = src;
  });
}

export type CutoutResult = { png: string; width: number; height: number; stats: MaskStats; modelLike: boolean };

/** Recebe a fotografia (data URL) e devolve um PNG sem fundo, recortado à peça. */
export async function removeBackground(dataUrl: string): Promise<CutoutResult> {
  const [{ ort, s }, img] = await Promise.all([load(), loadImage(dataUrl)]);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);

  const small = canvas(SIZE, SIZE);
  small.ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const input = new ort.Tensor("float32", toTensorData(small.ctx.getImageData(0, 0, SIZE, SIZE).data), [1, 3, SIZE, SIZE]);
  const result = await s.run({ [s.inputNames[0]!]: input });
  const mask = result[s.outputNames[0]!]!.data as Float32Array;
  const alpha = maskToAlpha(mask);
  const stats = maskStats(alpha);

  // Máscara 320×320 em tons de cinzento, ampliada suavemente para o tamanho da fotografia.
  const m = canvas(SIZE, SIZE);
  const md = m.ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < alpha.length; i++) md.data.set([alpha[i]!, alpha[i]!, alpha[i]!, 255], i * 4);
  m.ctx.putImageData(md, 0, 0);
  const big = canvas(W, H);
  big.ctx.imageSmoothingQuality = "high";
  big.ctx.drawImage(m.c, 0, 0, W, H);
  const bigMask = big.ctx.getImageData(0, 0, W, H).data;

  const full = canvas(W, H);
  full.ctx.drawImage(img, 0, 0, W, H);
  const px = full.ctx.getImageData(0, 0, W, H);
  const a = new Uint8ClampedArray(W * H);
  // Borda mais firme: corta a orla clara que a ampliação da máscara deixa à volta da peça.
  for (let i = 0; i < a.length; i++)
    px.data[i * 4 + 3] = a[i] = Math.max(0, Math.min(255, Math.round((bigMask[i * 4]! - 70) * 1.38)));
  full.ctx.putImageData(px, 0, 0);

  const box = opaqueBox(a, W, H);
  if (!box) throw new Error("Não foi encontrada nenhuma peça na fotografia. Experimente outra.");
  const out = canvas(box.w, box.h);
  out.ctx.drawImage(full.c, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return { png: out.c.toDataURL("image/png"), width: box.w, height: box.h, stats, modelLike: looksLikeModelPhoto(stats) };
}

/** Tamanho natural de uma imagem (para dispor recortes sem os deformar). */
export async function imageSize(src: string) {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export { loadImage };
