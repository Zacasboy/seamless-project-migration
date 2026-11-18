import { afterEach, describe, expect, it, vi } from "vitest";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

describe("BiRefNet na Replicate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("pede a versão, cria a previsão, espera e descarrega o recorte", async () => {
    vi.stubEnv("REPLICATE_API_TOKEN", "r8_test");
    const calls: { url: string; body?: string; auth?: string | null }[] = [];
    let polls = 0;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string, auth: new Headers(init?.headers).get("Authorization") });
      if (url.endsWith("/models/sprited/birefnet")) return json({ latest_version: { id: "v123" } });
      if (url.endsWith("/predictions")) return json({ id: "p1", status: "starting", urls: { get: "https://api.replicate.com/v1/predictions/p1" } });
      if (url.endsWith("/predictions/p1")) return json(++polls < 2 ? { id: "p1", status: "processing" } : { id: "p1", status: "succeeded", output: "https://replicate.delivery/x/out.png" });
      if (url === "https://replicate.delivery/x/out.png") return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]));
      return json({}, 404);
    });
    const { birefnetCutout } = await import("./replicate");
    const out = await birefnetCutout("https://ae01.alicdn.com/kf/a.jpg");
    expect(out[0]).toBe(0x89);
    const create = calls.find((c) => c.url.endsWith("/predictions"))!;
    expect(JSON.parse(create.body!)).toMatchObject({ version: "v123", input: { image: "https://ae01.alicdn.com/kf/a.jpg", output_format: "cutout" } });
    expect(create.auth).toBe("Bearer r8_test");
  }, 15000);

  it("explica a falta da chave e a falta de saldo", async () => {
    const { birefnetCutout } = await import("./replicate");
    await expect(birefnetCutout("https://a/b.jpg")).rejects.toThrow(/REPLICATE_API_TOKEN/);
    vi.resetModules();
    vi.stubEnv("REPLICATE_API_TOKEN", "r8_test");
    vi.stubGlobal("fetch", async () => json({}, 402));
    const m = await import("./replicate");
    await expect(m.birefnetCutout("https://a/b.jpg")).rejects.toThrow(/saldo/);
  });
});
