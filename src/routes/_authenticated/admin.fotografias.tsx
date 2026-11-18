/* eslint-disable @typescript-eslint/no-explicit-any -- coluna photo_cutouts fora dos tipos gerados */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { BatchPhotoButton, PhotoReviewCard } from "@/components/admin/ProductPhotos";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, loadComfy, parseWorkflow, pingComfy, saveComfy, type ComfySettings } from "@/lib/comfy";
import { setEntry, type Engine } from "@/lib/cutout-flow";
import { cutoutMap, productPhotos, type PhotoState } from "@/lib/photos";

export const Route = createFileRoute("/_authenticated/admin/fotografias")({ component: Page });

type P = Record<string, any> & { id: string; title: string };
type Filter = PhotoState | "por-tratar" | "todas";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pendente", label: "Por verificar" },
  { key: "por-tratar", label: "Por tratar" },
  { key: "aprovado", label: "Aprovadas" },
  { key: "rejeitado", label: "Rejeitadas" },
  { key: "todas", label: "Todas" },
];

function Page() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "photo-review"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products") as any)
        .select("id,title,slug,garment_type,color_options,gallery,image_url,photo_cutouts,published")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as P[];
    },
  });
  const [filter, setFilter] = useState<Filter>("pendente");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [engine, setEngine] = useState<Engine>("navegador");
  const products = q.data ?? [];

  const rows = useMemo(
    () =>
      products.flatMap((p) => {
        const map = cutoutMap(p as never);
        return productPhotos(p as never).map((u) => ({ p, u, e: map[u] }));
      }),
    [products],
  );
  const count = (f: Filter) =>
    rows.filter((r) => (f === "todas" ? true : f === "por-tratar" ? !r.e : r.e?.estado === f)).length;
  const visible = rows.filter((r) => (filter === "todas" ? true : filter === "por-tratar" ? !r.e : r.e?.estado === filter));
  const key = (id: string, u: string) => `${id}|${u}`;

  const update = (id: string, map: Record<string, unknown>) =>
    qc.setQueryData<P[]>(["admin", "photo-review"], (old) => old?.map((p) => (p.id === id ? { ...p, photo_cutouts: map } : p)));

  const bulk = async (estado: "aprovado" | "rejeitado") => {
    const list = visible.filter((r) => selected.has(key(r.p.id, r.u)) && r.e);
    let n = 0;
    for (const r of list) {
      try {
        const res = await setEntry(r.p.id, r.u, { ...r.e!, estado });
        update(r.p.id, res.photo_cutouts);
        n++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
        break;
      }
    }
    setSelected(new Set());
    toast.success(`${n} fotografias ${estado === "aprovado" ? "aprovadas" : "rejeitadas"}.`);
  };

  return (
    <>
      <AdminHeader
        title="Fotografias"
        intro="Verifique cada recorte ou imagem nova antes de aparecer na loja. Toque no resultado para o ver sobre xadrez e encontrar restos de fundo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={engine} onChange={(e) => setEngine(e.target.value as Engine)} className="h-10 border bg-card px-2 text-sm" aria-label="Como tratar">
              <option value="navegador">No navegador (grátis)</option>
              <option value="comfyui">ComfyUI: recorte</option>
              <option value="comfyui-nova">ComfyUI: imagem nova</option>
            </select>
            <BatchPhotoButton engine={engine} onDone={() => void q.refetch()} />
          </div>
        }
      />
      <ComfyPanel />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2" aria-label="Filtrar fotografias">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setSelected(new Set());
                }}
                className={`border px-3 py-1.5 text-sm ${filter === f.key ? "border-foreground bg-foreground text-background" : "hover:border-foreground"}`}
              >
                {f.label} <span className="num opacity-70">{count(f.key)}</span>
              </button>
            ))}
          </nav>
          {filter === "pendente" && visible.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="underline" onClick={() => setSelected(new Set(visible.map((r) => key(r.p.id, r.u))))}>
                Selecionar todas
              </button>
              <Button size="sm" disabled={!selected.size} onClick={() => bulk("aprovado")}>
                Aprovar {selected.size || ""}
              </Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => bulk("rejeitado")}>
                Rejeitar {selected.size || ""}
              </Button>
            </div>
          )}
        </div>
        {q.isError && <p role="alert" className="mt-3 text-sm text-destructive">{(q.error as Error).message}</p>}
        {!q.isLoading && visible.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            {filter === "pendente" ? "Nada por verificar." : "Sem fotografias nesta lista."}
          </p>
        )}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((r) => (
              <PhotoReviewCard
                key={key(r.p.id, r.u)}
                showTitle
                product={r.p}
                photo={r.u}
                entry={r.e}
                onChange={(m) => update(r.p.id, m)}
                selected={selected.has(key(r.p.id, r.u))}
                onSelect={(v) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (v) n.add(key(r.p.id, r.u));
                    else n.delete(key(r.p.id, r.u));
                    return n;
                  })
                }
              />
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Recortes aprovados aparecem sobre o fundo da loja; imagens novas aprovadas ocupam o lugar da fotografia com fundo.
        </p>
      </Panel>
    </>
  );
}

/** Ligação ao ComfyUI local: endereço, teste e workflows (guardados só neste navegador). */
function ComfyPanel() {
  const [s, setS] = useState<ComfySettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string>("");
  useEffect(() => setS(loadComfy()), []);
  const save = (n: ComfySettings) => {
    setS(n);
    saveComfy(n);
  };
  const check = (text: string) => {
    if (!text.trim()) return "Por configurar";
    try {
      parseWorkflow(text);
      return "Pronto";
    } catch (e) {
      return (e as Error).message;
    }
  };
  return (
    <Panel>
      <details>
        <summary className="cursor-pointer select-none text-xl">ComfyUI no seu computador (grátis, opcional)</summary>
        <div className="mt-4 grid gap-5 text-sm lg:grid-cols-2">
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Abra o ComfyUI com <code className="bg-[var(--plate)] px-1">--enable-cors-header https://pallessiani.vercel.app</code>.
              </li>
              <li>
                Recorte: abra o modelo «Remove Background» (BiRefNet, já incluído no ComfyUI), confirme que termina num nó «Save
                Image» e exporte com Workflow → Export (API).
              </li>
              <li>
                Imagem nova: use um workflow com «Load Image» (fotografia do produto) e escreva <code className="bg-[var(--plate)] px-1">{"{{descricao}}"}</code>{" "}
                no texto positivo. Exporte em formato API.
              </li>
              <li>Cole os ficheiros abaixo e use «Testar ligação». O Chrome pode pedir autorização para aceder à rede local: aceite.</li>
            </ol>
            <div>
              <Label htmlFor="c-base">Endereço do ComfyUI</Label>
              <div className="mt-1 flex gap-2">
                <input id="c-base" value={s.base} onChange={(e) => save({ ...s, base: e.target.value.trim() })} className="h-10 flex-1 border bg-card px-3" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setStatus("A testar…");
                    try {
                      setStatus(`Ligado: ${await pingComfy(s.base)}`);
                    } catch (e) {
                      setStatus((e as Error).message);
                    }
                  }}
                >
                  Testar ligação
                </Button>
              </div>
              <p className="mt-1 text-xs" role="status" aria-live="polite">
                {status}
              </p>
            </div>
            <div>
              <Label htmlFor="c-prompt">Texto da imagem nova</Label>
              <textarea id="c-prompt" rows={3} value={s.genPrompt} onChange={(e) => save({ ...s, genPrompt: e.target.value })} className="mt-1 w-full border bg-card p-2 text-xs" />
              <p className="text-xs text-muted-foreground">{"{{descricao}}"} é trocado pelo nome, tipo e cor do produto.</p>
            </div>
          </div>
          <div className="space-y-3">
            {(
              [
                ["cutWorkflow", "Workflow de recorte (API)"],
                ["genWorkflow", "Workflow de imagem nova (API)"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <Label htmlFor={`c-${k}`}>
                  {label} · <span className="text-muted-foreground">{check(s[k])}</span>
                </Label>
                <textarea
                  id={`c-${k}`}
                  rows={6}
                  value={s[k]}
                  onChange={(e) => save({ ...s, [k]: e.target.value })}
                  placeholder='{"1": {"class_type": "LoadImage", ...}}'
                  className="mt-1 w-full border bg-card p-2 font-mono text-[11px]"
                />
              </div>
            ))}
          </div>
        </div>
      </details>
    </Panel>
  );
}
