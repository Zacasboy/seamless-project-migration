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

/** Corre o BiRefNet sobre uma fotografia pública (https) e devolve os bytes do recorte. */
export async function birefnetCutout(imageUrl: string): Promise<Uint8Array> {
  const v = await latestVersion();
  let p = await call<Prediction>(`${API}/predictions`, {
    method: "POST",
    headers: { ...headers(), Prefer: "wait=55" },
    body: JSON.stringify({
      version: v,
      input: { image: imageUrl, variant: "general", output_format: "cutout", refine_fg: true },
    }),
  });
  const started = Date.now();
  while (!["succeeded", "failed", "canceled"].includes(p.status)) {
    if (Date.now() - started > 200_000) throw new Error("A Replicate demorou demasiado. Tente de novo.");
    await new Promise((r) => setTimeout(r, 1500));
    p = await call<Prediction>(p.urls?.get ?? `${API}/predictions/${p.id}`, { headers: headers() });
  }
  if (p.status !== "succeeded") throw new Error(`O recorte falhou na Replicate${p.error ? `: ${String(p.error).slice(0, 160)}` : "."}`);
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  const url = typeof out === "string" ? out : (out as { url?: string } | null)?.url;
  if (!url || !/^https:\/\//.test(url)) throw new Error("A Replicate não devolveu imagem.");
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error("Não foi possível descarregar o recorte da Replicate.");
  return new Uint8Array(await img.arrayBuffer());
}
