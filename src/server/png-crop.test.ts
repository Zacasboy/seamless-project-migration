import { describe, expect, it } from "vitest";
import { decode, encode } from "fast-png";
import { cropPng, isPng } from "./png-crop";

describe("cropPng", () => {
  it("corta à volta da parte visível e reduz", () => {
    const w = 400, h = 300, d = new Uint8Array(w * h * 4);
    for (let y = 100; y < 200; y++) for (let x = 50; x < 350; x++) d.set([120, 80, 40, 255], (y * w + x) * 4);
    const src = encode({ width: w, height: h, data: d, channels: 4, depth: 8 });
    expect(isPng(src)).toBe(true);
    const r = cropPng(src, 200);
    const out = decode(r.png);
    expect(out.width).toBe(200);
    expect(out.height).toBeLessThan(90);
    expect(r.coverage).toBeCloseTo(0.25, 2);
  });
  it("recusa imagens vazias", () => {
    const src = encode({ width: 4, height: 4, data: new Uint8Array(64), channels: 4, depth: 8 });
    expect(() => cropPng(src)).toThrow(/vazio/);
  });
});
