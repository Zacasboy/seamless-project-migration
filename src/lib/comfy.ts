// Ligação ao ComfyUI que corre no computador do administrador (grátis, usa a placa gráfica local).
// O painel (no navegador) fala diretamente com http://127.0.0.1:8188: nada passa pela Vercel.
// Os workflows são os do próprio utilizador, exportados do ComfyUI em formato API; o painel só troca
// a imagem do nó "Load Image" e o texto {{descricao}}, e lê a imagem do nó "Save Image".

export type ComfySettings = {
  base: string;
  cutWorkflow: string; // remoção de fundo (ex.: modelo "Remove Background" com BiRefNet)
  genWorkflow: string; // imagem nova a partir da fotografia do produto
  genPrompt: string;
};

const KEY = "pallessiani.comfyui";
export const DEFAULT_SETTINGS: ComfySettings = {
  base: "http://127.0.0.1:8188",
  cutWorkflow: "",
  genWorkflow: "",
  genPrompt:
    "{{descricao}}, fotografia de produto de moda, peça inteira, luz suave de estúdio, fundo cinzento claro liso, sombra suave, alta definição, sem pessoas, sem texto",
};

export function loadComfy(): ComfySettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ComfySettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveComfy(s: ComfySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* navegador sem armazenamento: fica só nesta sessão */
  }
}

type Node = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };
type Workflow = Record<string, Node>;

/** Valida e lê um workflow em formato API (não o formato normal do editor). */
export function parseWorkflow(text: string): Workflow {
  let wf: unknown;
  try {
    wf = JSON.parse(text);
  } catch {
    throw new Error("O workflow não é JSON válido. No ComfyUI use Workflow → Export (API).");
  }
  if (!wf || typeof wf !== "object" || Array.isArray(wf)) throw new Error("Workflow inválido.");
  if ("nodes" in (wf as object))
    throw new Error("Este é o formato do editor. No ComfyUI use Workflow → Export (API) e cole esse ficheiro.");
  const nodes = Object.values(wf as Record<string, unknown>);
  if (!nodes.length || !nodes.every((n) => !!n && typeof n === "object" && typeof (n as Node).class_type === "string"))
    throw new Error("Workflow inválido: cada nó precisa de class_type.");
  const w = wf as Workflow;
  if (!Object.values(w).some((n) => n.class_type === "LoadImage"))
    throw new Error("O workflow precisa de um nó «Load Image» para receber a fotografia.");
  if (!Object.values(w).some((n) => /SaveImage|PreviewImage/.test(n.class_type)))
    throw new Error("O workflow precisa de um nó «Save Image» para devolver o resultado.");
  return w;
}

/** Prepara o workflow: imagem de entrada, texto e sementes novas (para variar ao refazer). */
export function prepareWorkflow(wf: Workflow, image: string, text: string): Workflow {
  const out = JSON.parse(JSON.stringify(wf)) as Workflow;
  for (const n of Object.values(out)) {
    if (n.class_type === "LoadImage") n.inputs["image"] = image;
    for (const [k, v] of Object.entries(n.inputs)) {
      if (typeof v === "string" && v.includes("{{descricao}}")) n.inputs[k] = v.replaceAll("{{descricao}}", text);
      if ((k === "seed" || k === "noise_seed") && typeof v === "number")
        n.inputs[k] = Math.floor(Math.random() * 2 ** 32);
    }
  }
  return out;
}

const trim = (b: string) => b.replace(/\/+$/, "");
const friendly = (e: unknown) =>
  e instanceof TypeError
    ? "Não foi possível falar com o ComfyUI. Confirme que está aberto neste computador com --enable-cors-header e que o navegador tem autorização para aceder à rede local."
    : e instanceof Error
      ? e.message
      : "Erro no ComfyUI.";

export async function pingComfy(base: string) {
  try {
    const r = await fetch(`${trim(base)}/system_stats`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`O ComfyUI respondeu ${r.status}.`);
    const s = (await r.json()) as { system?: { comfyui_version?: string }; devices?: { name?: string }[] };
    return `ComfyUI ${s.system?.comfyui_version ?? ""} · ${s.devices?.[0]?.name ?? "sem placa gráfica"}`.trim();
  } catch (e) {
    throw new Error(friendly(e));
  }
}

/** Corre um workflow com uma imagem e devolve a primeira imagem produzida. */
export async function runComfy(
  base: string,
  workflowText: string,
  input: Blob,
  text: string,
  onStatus?: (s: string) => void,
): Promise<Blob> {
  const b = trim(base);
  const wf = parseWorkflow(workflowText);
  try {
    onStatus?.("A enviar a fotografia para o ComfyUI…");
    const fd = new FormData();
    fd.append("image", input, `pallessiani-${Date.now()}.png`);
    fd.append("overwrite", "true");
    const up = await fetch(`${b}/upload/image`, { method: "POST", body: fd });
    if (!up.ok) throw new Error("O ComfyUI recusou a fotografia.");
    const { name, subfolder } = (await up.json()) as { name: string; subfolder?: string };
    const image = subfolder ? `${subfolder}/${name}` : name;

    const clientId = crypto.randomUUID();
    const res = await fetch(`${b}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prepareWorkflow(wf, image, text), client_id: clientId }),
    });
    const queued = (await res.json()) as { prompt_id?: string; error?: { message?: string }; node_errors?: unknown };
    if (!res.ok || !queued.prompt_id)
      throw new Error(`O workflow tem erros: ${queued.error?.message ?? "veja a consola do ComfyUI"}.`);

    const started = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 1500));
      const h = (await (await fetch(`${b}/history/${queued.prompt_id}`)).json()) as Record<
        string,
        {
          status?: { status_str?: string; completed?: boolean };
          outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
        }
      >;
      const run = h[queued.prompt_id];
      if (run?.status?.status_str === "error") throw new Error("O ComfyUI falhou a correr o workflow (veja a consola).");
      const images = Object.values(run?.outputs ?? {}).flatMap((o) => o.images ?? []);
      const pick = images.find((i) => i.type === "output") ?? images[0];
      if (pick) {
        const q = new URLSearchParams({ filename: pick.filename, subfolder: pick.subfolder, type: pick.type });
        const img = await fetch(`${b}/view?${q}`);
        if (!img.ok) throw new Error("Não foi possível ler o resultado do ComfyUI.");
        return await img.blob();
      }
      if (run?.status?.completed) throw new Error("O workflow terminou sem imagem. Confirme o nó «Save Image».");
      const secs = Math.round((Date.now() - started) / 1000);
      if (secs > 900) throw new Error("O ComfyUI demorou mais de 15 minutos.");
      onStatus?.(`O ComfyUI está a trabalhar… ${secs} s`);
    }
  } catch (e) {
    throw new Error(friendly(e));
  }
}
