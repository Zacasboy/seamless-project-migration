import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProductSupplier, refreshFromSupplier } from "@/lib/suppliers.functions";

type Row = Record<string, unknown>;

/**
 * No editor do produto: link de importação guardado, recarregar a ficha do fornecedor (corre as
 * rotinas) e escolher fotografias do fornecedor para a galeria, sem ter de procurar o link.
 */
export function ProductSupplierPanel({ row, setRow }: { row: Row; setRow: (r: Row) => void }) {
  const qc = useQueryClient();
  const id = row["id"] as string | undefined;
  const info = useQuery({
    queryKey: ["admin", "product-supplier", id],
    queryFn: () => getProductSupplier({ data: { productId: id! } }),
    enabled: !!id,
  });
  const [images, setImages] = useState<string[] | null>(null);
  const refresh = useMutation({
    mutationFn: () => refreshFromSupplier({ data: { productId: id! } }),
    onSuccess: (r) => {
      setImages(r.images);
      toast.success(r.summary);
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!id || info.isLoading) return null;
  const s = info.data;
  if (!s)
    return (
      <p className="border bg-[var(--plate)] px-3 py-2 text-sm text-muted-foreground">
        Produto criado à mão ou por CSV: sem link de importação guardado.
      </p>
    );
  const gallery = (row["gallery"] as string[] | undefined) ?? [];
  const add = (u: string) => {
    if (gallery.includes(u) || gallery.length >= 20) return;
    setRow({ ...row, gallery: [...gallery, u] });
  };

  return (
    <section aria-label="Fornecedor" className="space-y-3 border bg-[var(--plate)] p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="text-muted-foreground">Importado de </span>
          <b>{s.supplier ?? "fornecedor"}</b>
          <span className="num text-muted-foreground"> · ref. {s.externalId}</span>
        </p>
        <div className="flex gap-2">
          {s.url && (
            <Button asChild size="sm" variant="outline">
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                Abrir no fornecedor <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <Button size="sm" type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? "A consultar…" : "Recarregar do fornecedor"}
          </Button>
        </div>
      </div>
      {s.url && (
        <p className="break-all text-xs">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {s.url}
          </a>
        </p>
      )}
      {images && (
        <div>
          <p className="text-xs text-muted-foreground">
            Fotografias do fornecedor: toque para acrescentar à galeria (depois «Guardar»).
          </p>
          <ul className="mt-2 grid grid-cols-6 gap-1.5">
            {images.map((u) => {
              const inGallery = gallery.includes(u);
              return (
                <li key={u}>
                  <button
                    type="button"
                    onClick={() => add(u)}
                    disabled={inGallery}
                    aria-label={inGallery ? "Já está na galeria" : "Acrescentar à galeria"}
                    className={`relative block aspect-square w-full overflow-hidden ${inGallery ? "opacity-40" : "hover:outline hover:outline-2 hover:outline-foreground"}`}
                  >
                    <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    {inGallery && <span className="absolute inset-x-0 bottom-0 bg-card/90 text-[10px]">Na galeria</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
