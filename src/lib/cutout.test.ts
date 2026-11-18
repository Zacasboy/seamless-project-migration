import { describe, expect, it, vi } from "vitest";
vi.mock("../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url", () => ({ default: "/x.wasm" }));
vi.mock("../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url", () => ({ default: "/x.mjs" }));
import { maskToAlpha, opaqueBox, toTensorData } from "./cutout";

describe("recorte", () => {
  it("normaliza a máscara e limpa os extremos", () => {
    const a = maskToAlpha(new Float32Array([0, 0.05, 0.5, 0.97, 1]));
    expect(Array.from(a)).toEqual([0, 0, 128, 255, 255]);
  });
  it("encontra a caixa da peça com margem", () => {
    const w = 10, h = 10, a = new Uint8ClampedArray(w * h);
    a[3 * w + 4] = 255;
    a[6 * w + 7] = 255;
    expect(opaqueBox(a, w, h, 0)).toEqual({ x: 4, y: 3, w: 4, h: 4 });
    expect(opaqueBox(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });
  it("cria o tensor NCHW 3×320×320", () => {
    const px = new Uint8ClampedArray(320 * 320 * 4).fill(255);
    const t = toTensorData(px);
    expect(t.length).toBe(3 * 320 * 320);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229);
  });
});

import { looksLikeModelPhoto, maskStats } from "./cutout";
describe("fotografia de pessoa ou de produto", () => {
  const S = 320;
  const mask = (fill: (x: number, y: number) => boolean) => {
    const a = new Uint8ClampedArray(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a[y * S + x] = fill(x, y) ? 255 : 0;
    return a;
  };
  it("produto isolado com margem é recortado", () => {
    const m = maskStats(mask((x, y) => x > 60 && x < 260 && y > 80 && y < 240));
    expect(looksLikeModelPhoto(m)).toBe(false);
  });
  it("pessoa cortada pela margem de baixo fica com fundo", () => {
    const m = maskStats(mask((x, y) => x > 100 && x < 220 && y > 20));
    expect(looksLikeModelPhoto(m)).toBe(true);
  });
});
