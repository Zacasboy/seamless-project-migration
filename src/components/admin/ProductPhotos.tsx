import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { processProductPhoto } from "@/lib/cutout-flow";
import { cutoutMap, KEEP_BACKGROUND, productPhotos } from "@/lib/photos";

type Row = Record<string, unknown>;
const msg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível tratar a fotografia.");

/**
 * No editor do produto: estado de cada fotografia (recorte sem fundo, com fundo, por tratar).
 * Na loja aparecem os recortes sobre o fundo da loja e só uma fotografia com fundo.
 */
export function ProductPhotoPanel({ row, setRow }: { row: Row; setRow: (r: Row) => void }) {
  const id = row["id"] as string | undefined;
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  if (!id) return null;
  const photos = productPhotos(row as never);
  if (!photos.length) return null;
  const map = cutoutMap(row as never);

  const run = async (photo: string, force?: "recorte" | "fundo" | "repor") => {
    setBusy(photo);
    try {
      if (force === "repor") {
        const { setPhotoTreatment } = await import("@/lib/cutouts.functions");
        const r = await setPhotoTreatment({ data: { productId: id, photo, value: null } });
        setRow({ ...row, photo_cutouts: r.photo_cutouts });
      } else {
        const r = await processProductPhoto(id, photo, force);
        setRow({ ...row, photo_cutouts: r.map });
      }
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(null);
    }
  };
  const all = async () => {
    for (const p of photos.filter((u) => !map[u])) await run(p);
  };

  return (
    <section className="space-y-3 border p-3" aria-labelledby="pp-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="pp-title" className="font-medium">Fotografias na loja</h3>
          <p className="text-xs text-muted-foreground">
            Recortes sem fundo aparecem sobre o fundo da loja. Fotografias com pessoa ficam com fundo; na loja mostra-se só uma.
          </p>
        </div>
        <Button size="sm" variant="outline" type="button" disabled={!!busy || photos.every((u) => map[u])} onClick={all}>
          Tratar as que faltam
        </Button>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((u) => {
          const v = map[u];
          const isCut = !!v && v !== KEEP_BACKGROUND;
          return (
            <li key={u} className="space-y-1 text-xs">
              <div className="plate relative aspect-[4/5] overflow-hidden">
                <img src={isCut ? v : u} alt="" loading="lazy" className={`h-full w-full ${isCut ? "object-contain p-2" : "object-cover"}`} />
                {busy === u && <span className="absolute inset-0 grid place-items-center bg-card/70">A tratar…</span>}
              </div>
              <p className={isCut ? "" : "text-muted-foreground"}>{isCut ? "Sem fundo" : v ? "Com fundo" : "Por tratar"}</p>
              <div className="flex flex-wrap gap-x-2">
                {!isCut && (
                  <button type="button" className="underline" disabled={!!busy} onClick={() => run(u, "recorte")}>
                    Recortar
                  </button>
                )}
                {v !== KEEP_BACKGROUND && (
                  <button type="button" className="underline" disabled={!!busy} onClick={() => run(u, "fundo")}>
                    Manter fundo
                  </button>
                )}
                {v && (
                  <button type="button" className="underline" disabled={!!busy} onClick={() => run(u, "repor")}>
                    Repor
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type Lite = { id: string; title: string; gallery: string[] | null; image_url: string | null; photo_cutouts?: unknown };

/** Trata as fotografias de todos os produtos (no navegador; pode demorar alguns minutos). */
export function BatchPhotoButton() {
  const qc = useQueryClient();
  const [state, setState] = useState<{ done: number; total: number; current: string } | null>(null);
  const stop = useRef(false);

  const start = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- coluna nova ainda fora dos tipos gerados
    const { data, error } = (await (supabase.from("products") as any)
      .select("id,title,gallery,image_url,photo_cutouts")
      .order("created_at")) as { data: Lite[] | null; error: { message: string } | null };
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
      toast.success("Todas as fotografias já estão tratadas.");
      return;
    }
    stop.current = false;
    let ok = 0, failed = 0;
    for (const [i, { p, u }] of jobs.entries()) {
      if (stop.current) break;
      setState({ done: i, total: jobs.length, current: p.title });
      try {
        await processProductPhoto(p.id, u);
        ok++;
      } catch {
        failed++;
      }
    }
    setState(null);
    void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(`${ok} fotografias tratadas${failed ? `, ${failed} com erro (tente de novo no produto)` : ""}.`);
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
    <Button variant="outline" type="button" onClick={start} title="Tira o fundo das fotografias de produto; fotos com pessoa ficam como estão">
      Tirar fundo das fotografias
    </Button>
  );
}
