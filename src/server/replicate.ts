// BiRefNet (MIT) na Replicate: recorte de fotografias de produto no servidor (~0,0015 $ por foto).
// A chave fica só na Vercel (REPLICATE_API_TOKEN); nunca vai para o navegador.
const API = "https://api.replicate.com/v1";
const MODEL = "sprited/birefnet";
let version: string | null = null;

function token() {
  const t = process.env["REPLICATE_API_TOKEN"];
  if (!t) throw new Error("Falta a chave REPLICATE_API_TOKEN na Vercel (Sensitive, Production) e um novo deploy.");
  return t;
}
const headers = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
  if (r.status === 401) throw new Error("A Replicate recusou a chave REPLICATE_API_TOKEN.");
  if (r.status === 402) throw new Error("Sem saldo na Replicate: adicione crédito em replicate.com/account/billing.");
  if (r.status === 429) throw new Error("Demasiados pedidos à Replicate; tente daqui a um minuto.");
  if (!r.ok) throw new Error(`A Replicate respondeu ${r.status}.`);
  return (await r.json()) as T;
}

async function latestVersion() {
  if (version) return version;
  const m = await call<{ latest_version?: { id?: string } }>(`${API}/models/${MODEL}`, { headers: headers() });
  if (!m.latest_version?.id) throw new Error("O modelo BiRefNet deixou de estar disponível na Replicate.");
  return (version = m.latest_version.id);
}

type Prediction = { id: string; status: string; output?: unknown; error?: unknown; urls?: { get?: string } };

/** Cria a previsão, espera pelo fim e devolve o endereço da imagem produzida. */
async function predict(url: string, body: unknown): Promise<string> {
  let p = await call<Prediction>(url, {
    method: "POST",
    headers: { ...headers(), Prefer: "wait=55" },
    body: JSON.stringify(body),
  });
  const started = Date.now();
  while (!["succeeded", "failed", "canceled"].includes(p.status)) {
    if (Date.now() - started > 230_000) throw new Error("A Replicate demorou demasiado. Tente de novo.");
    await new Promise((r) => setTimeout(r, 2000));
    p = await call<Prediction>(p.urls?.get ?? `${API}/predictions/${p.id}`, { headers: headers() });
  }
  if (p.status !== "succeeded") throw new Error(`A Replicate falhou${p.error ? `: ${String(p.error).slice(0, 160)}` : "."}`);
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  const img = typeof out === "string" ? out : (out as { url?: string } | null)?.url;
  if (!img || !/^https:\/\//.test(img)) throw new Error("A Replicate não devolveu imagem.");
  return img;
}

async function download(url: string) {
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error("Não foi possível descarregar a imagem da Replicate.");
  return { bytes: new Uint8Array(await img.arrayBuffer()), type: (img.headers.get("content-type") ?? "").split(";")[0]!.trim() };
}

/** Corre o BiRefNet sobre uma fotografia pública (https) e devolve os bytes do recorte. */
export async function birefnetCutout(imageUrl: string): Promise<Uint8Array> {
  const v = await latestVersion();
  const out = await predict(`${API}/predictions`, {
    version: v,
    input: { image: imageUrl, variant: "general", output_format: "cutout", refine_fg: true },
  });
  return (await download(out)).bytes;
}

// Pedido ao modelo de edição: fotografar a composição como flat-lay sem mudar as peças nem as posições.
export const RESHOOT_PROMPT =
  "Re-photograph the FIRST image as a professional top-down fashion flat-lay photograph on the same plain background. " +
  "Keep every item exactly the same product: same colours, fabric texture, logos, buttons, stitching and proportions. " +
  "Keep each item in the same position, size and rotation as in the first image. " +
  "The other images show each real product for reference; match them faithfully. " +
  "Make it look naturally arranged by a stylist: garments laid flat (remove any hangers), shoes shown as a matching pair, " +
  "soft natural contact shadows, even soft studio light. Do not add, remove or change any item. No people, no text, no extra props.";

/**
 * "Fotografa" a composição feita no painel com o Gemini 2.5 Flash Image (google/nano-banana, oficial).
 * Recebe a composição e os recortes das peças (referências de fidelidade).
 */
export async function reshootFlatLay(composite: string, references: string[]) {
  const out = await predict(`${API}/models/google/nano-banana/predictions`, {
    input: {
      prompt: RESHOOT_PROMPT,
      image_input: [composite, ...references].slice(0, 8),
      aspect_ratio: "match_input_image",
      output_format: "png",
    },
  });
  return download(out);
}
