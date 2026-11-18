import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { processProductPhoto, setEntry, type Engine } from "@/lib/cutout-flow";
import { cutoutMap, productPhotos, type PhotoEntry } from "@/lib/photos";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
const msg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível tratar a fotografia.");

export const ENGINE_LABEL: Record<Engine, string> = {
  replicate: "Recortar com BiRefNet (Replicate)",
  navegador: "Recortar no navegador (grátis)",
  comfyui: "Recortar com ComfyUI",
  "comfyui-nova": "Imagem nova com ComfyUI",
};

const STATE_LABEL = (e: PhotoEntry | undefined) => {
  if (!e) return { text: "Por tratar", tone: "text-muted-foreground" };
  const what = e.tipo === "recorte" ? "Recorte" : e.tipo === "foto" ? "Imagem nova" : "Original com fundo";
  if (e.estado === "aprovado") return { text: `${what} · aprovado`, tone: "text-[var(--success,#2f6b3a)]" };
  if (e.estado === "rejeitado") return { text: `${what} · rejeitado`, tone: "text-destructive" };
  return { text: `${what} · por verificar`, tone: "text-[var(--warning,#8a5a00)]" };
};

export const describe = (p: Row) =>
  [p["title"], p["garment_type"], (p["color_options"] as string[] | undefined)?.[0]].filter(Boolean).join(", ");

/**
 * Cartão de verificação de uma fotografia: original à esquerda, resultado à direita (sobre o fundo
 * da loja ou xadrez, para ver restos de fundo). Só o que for aprovado aparece na loja.
 */
export function PhotoReviewCard({
  product,
  photo,
  entry,
  onChange,
  selected,
  onSelect,
  showTitle,
}: {
  showTitle?: boolean | undefined;
  product: Row;
  photo: string;
  entry: PhotoEntry | undefined;
  onChange: (map: Record<string, unknown>) => void;
  selected?: boolean | undefined;
  onSelect?: ((v: boolean) => void) | undefined;
}) {
  const id = product["id"] as string;
  const [busy, setBusy] = useState<string | null>(null);
  const [checker, setChecker] = useState(false);
  const run = async (fn: () => Promise<{ photo_cutouts?: Record<string, unknown>; map?: Record<string, unknown> }>) => {
    setBusy("A tratar…");
    try {
      const r = await fn();
      onChange((r.map ?? r.photo_cutouts)!);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(null);
    }
  };
  const set = (v: PhotoEntry | null) => run(() => setEntry(id, photo, v));
  const redo = (engine: Engine) =>
    run(() =>
      processProductPhoto(id, photo, { engine, force: "recorte", description: describe(product), onStatus: setBusy }),
    );
  const st = STATE_LABEL(entry);
  const result = entry?.url;

  return (
    <li className={cn("border bg-card p-2 text-xs", selected && "outline outline-2 outline-foreground")}>
      {showTitle && (
        <a href={`/produto/${String(product["slug"] ?? "")}`} target="_blank" rel="noopener" className="mb-1 block truncate text-sm hover:underline">
          {String(product["title"] ?? "")}
        </a>
      )}
      <div className="grid grid-cols-2 gap-1">
        <figure>
          <div className="plate aspect-[4/5] overflow-hidden">
            <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
          <figcaption className="mt-0.5 text-muted-foreground">Original</figcaption>
        </figure>
        <figure>
          <button
            type="button"
            onClick={() => setChecker((v) => !v)}
            title="Alternar fundo da loja / xadrez para ver restos de fundo"
            className={cn("relative block aspect-[4/5] w-full overflow-hidden", checker ? "checker" : "plate")}
          >
            {result ? (
              <img src={result} alt="" loading="lazy" className={cn("h-full w-full", entry?.tipo === "recorte" ? "object-contain p-2" : "object-cover")} />
            ) : (
              <span className="grid h-full place-items-center p-2 text-center text-muted-foreground">
                {entry?.tipo === "fundo" ? "Fica a original" : "Sem resultado"}
              </span>
            )}
            {busy && <span className="absolute inset-0 grid place-items-center bg-card/80 p-2 text-center">{busy}</span>}
          </button>
          <figcaption className="mt-0.5 text-muted-foreground">Na loja {result ? "(toque: xadrez)" : ""}</figcaption>
        </figure>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={st.tone}>{st.text}</p>
        {onSelect && entry?.estado === "pendente" && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={!!selected} onChange={(e) => onSelect(e.target.checked)} />
            Selecionar
          </label>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {entry && entry.estado !== "aprovado" && (
          <Button size="sm" type="button" disabled={!!busy} onClick={() => set({ ...entry, estado: "aprovado" })}>
            <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
          </Button>
        )}
        {entry && entry.estado !== "rejeitado" && entry.tipo !== "fundo" && (
          <Button size="sm" variant="outline" type="button" disabled={!!busy} onClick={() => set({ ...entry, estado: "rejeitado" })}>
            <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
          </Button>
        )}
        {!(entry?.tipo === "fundo" && entry.estado === "aprovado") && (
          <Button size="sm" variant="ghost" type="button" disabled={!!busy} onClick={() => set({ tipo: "fundo", estado: "aprovado", origem: "original" })}>
            Usar original com fundo
          </Button>
        )}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer select-none py-1 underline">Refazer ou criar imagem nova</summary>
        <div className="flex flex-col items-start gap-1 pt-1">
          {(Object.keys(ENGINE_LABEL) as Engine[]).map((k) => (
            <button key={k} type="button" className="underline" disabled={!!busy} onClick={() => redo(k)}>
              {ENGINE_LABEL[k]}
            </button>
          ))}
          {entry && (
            <button type="button" className="text-muted-foreground underline" disabled={!!busy} onClick={() => set(null)}>
              Repor (por tratar)
            </button>
          )}
        </div>
      </details>
    </li>
  );
}

/** No editor do produto: verificação das fotografias deste produto. */
export function ProductPhotoPanel({ row, setRow }: { row: Row; setRow: (r: Row) => void }) {
  const qc = useQueryClient();
  if (!row["id"]) return null;
  const photos = productPhotos(row as never);
  if (!photos.length) return null;
  const map = cutoutMap(row as never);
  const pending = photos.filter((u) => map[u]?.estado === "pendente").length;
  return (
    <section className="space-y-3 border p-3" aria-labelledby="pp-title">
      <div>
        <h3 id="pp-title" className="font-medium">
          Fotografias na loja {pending > 0 && <span className="text-[var(--warning,#8a5a00)]">· {pending} por verificar</span>}
        </h3>
        <p className="text-xs text-muted-foreground">
          Só aparecem na loja os recortes e imagens novas aprovados. Fotografias com pessoa ficam com fundo; na loja mostra-se só uma.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {photos.map((u) => (
          <PhotoReviewCard
            key={u}
            product={row}
            photo={u}
            entry={map[u]}
            onChange={(m) => {
              setRow({ ...row, photo_cutouts: m });
              void qc.invalidateQueries({ queryKey: ["admin", "photo-review"] });
            }}
          />
        ))}
      </ul>
    </section>
  );
}

type Lite = { id: string; title: string; gallery: string[] | null; image_url: string | null; photo_cutouts?: unknown };

/** Trata todas as fotografias ainda por tratar; o resultado fica por verificar. */
export function BatchPhotoButton({ engine = "replicate", onDone }: { engine?: Engine; onDone?: () => void }) {
  const qc = useQueryClient();
  const [state, setState] = useState<{ done: number; total: number; current: string } | null>(null);
  const stop = useRef(false);

  const start = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- coluna nova fora dos tipos gerados
    const { data, error } = (await (supabase.from("products") as any)
      .select("id,title,garment_type,color_options,gallery,image_url,photo_cutouts")
      .order("created_at")) as { data: (Lite & Row)[] | null; error: { message: string } | null };
    if (error) {
      toast.error(
        /photo_cutouts/.test(error.message)
          ? "Falta aplicar a atualização da base de dados das fotografias (migration product_cutouts)."
          : "Não foi possível ler os produtos.",
      );
      return;
    }
    const jobs = (data ?? []).flatMap((p) => {
      const map = cutoutMap(p);
      return productPhotos(p).filter((u) => !map[u]).map((u) => ({ p, u }));
    });
    if (!jobs.length) {
      toast.success("Não há fotografias por tratar.");
      return;
    }
    stop.current = false;
    let ok = 0, failed = 0;
    for (const [i, { p, u }] of jobs.entries()) {
      if (stop.current) break;
      setState({ done: i, total: jobs.length, current: p.title });
      try {
        await processProductPhoto(p.id, u, { engine, description: describe(p) });
        ok++;
      } catch (e) {
        failed++;
        if (engine !== "navegador" && failed === 1) toast.error(msg(e));
      }
    }
    setState(null);
    void qc.invalidateQueries({ queryKey: ["admin"] });
    onDone?.();
    toast.success(`${ok} fotografias tratadas e por verificar${failed ? `, ${failed} com erro` : ""}.`);
  };

  if (state)
    return (
      <div className="flex items-center gap-3 text-sm" role="status" aria-live="polite">
        <span className="num">
          {state.done}/{state.total}
        </span>
        <span className="max-w-[16rem] truncate text-muted-foreground">{state.current}</span>
        <Button size="sm" variant="outline" type="button" onClick={() => (stop.current = true)}>
          Parar
        </Button>
      </div>
    );
  return (
    <Button variant="outline" type="button" onClick={start}>
      Tratar fotografias por tratar
    </Button>
  );
}
