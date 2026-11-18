// Recorte de PNG no servidor, em JavaScript puro (sem bibliotecas nativas):
// corta à volta da peça (transparência), reduz para no máximo 1200 px e volta a gravar PNG.
import { decode, encode } from "fast-png";

export const isPng = (b: Uint8Array) =>
  b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/** Converte para RGBA de 8 bits. */
function toRgba8(img: { width: number; height: number; data: ArrayLike<number>; channels: number; depth: number }) {
  const { width: w, height: h, channels: c, depth } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  const shift = depth === 16 ? 8 : 0;
  for (let i = 0; i < w * h; i++) {
    const v = (k: number) => (img.data[i * c + k]! >> shift) & 255;
    if (c >= 3) {
      out[i * 4] = v(0);
      out[i * 4 + 1] = v(1);
      out[i * 4 + 2] = v(2);
      out[i * 4 + 3] = c === 4 ? v(3) : 255;
    } else {
      const g = v(0);
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g;
      out[i * 4 + 3] = c === 2 ? v(1) : 255;
    }
  }
  return out;
}

/** Caixa dos píxeis visíveis, com margem; null se a imagem estiver vazia. */
export function alphaBox(rgba: Uint8ClampedArray, w: number, h: number, pad = 0.02) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rgba[(y * w + x) * 4 + 3]! > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const p = Math.round(Math.max(w, h) * pad);
  const x = Math.max(0, x0 - p), y = Math.max(0, y0 - p);
  return { x, y, w: Math.min(w, x1 + p + 1) - x, h: Math.min(h, y1 + p + 1) - y };
}

/** Redução por média de área (boa qualidade para encolher). */
function shrink(src: Uint8ClampedArray, w: number, h: number, W: number, H: number) {
  const out = new Uint8ClampedArray(W * H * 4);
  const sx = w / W, sy = h / H;
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const xa = Math.floor(X * sx), xb = Math.max(xa + 1, Math.floor((X + 1) * sx));
      const ya = Math.floor(Y * sy), yb = Math.max(ya + 1, Math.floor((Y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = ya; y < yb; y++)
        for (let x = xa; x < xb; x++) {
          const i = (y * w + x) * 4, al = src[i + 3]!;
          // Cor ponderada pela opacidade: evita orlas escuras nas bordas.
          r += src[i]! * al; g += src[i + 1]! * al; b += src[i + 2]! * al; a += al; n++;
        }
      const o = (Y * W + X) * 4;
      if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      out[o + 3] = a / n;
    }
  return out;
}

export function cropPng(input: Uint8Array, maxSide = 1200): { png: Uint8Array; width: number; height: number; coverage: number } {
  const img = decode(input);
  const w = img.width, h = img.height;
  const rgba = toRgba8(img as never);
  const box = alphaBox(rgba, w, h);
  if (!box) throw new Error("O recorte saiu vazio. Experimente outra fotografia.");
  let opaque = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! > 127) opaque++;
  const crop = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++)
    crop.set(rgba.subarray(((box.y + y) * w + box.x) * 4, ((box.y + y) * w + box.x + box.w) * 4), y * box.w * 4);
  const scale = Math.min(1, maxSide / Math.max(box.w, box.h));
  const W = Math.max(1, Math.round(box.w * scale)), H = Math.max(1, Math.round(box.h * scale));
  const data = scale < 1 ? shrink(crop, box.w, box.h, W, H) : crop;
  return { png: encode({ width: W, height: H, data: new Uint8Array(data.buffer), channels: 4, depth: 8 }), width: W, height: H, coverage: opaque / (w * h) };
}
