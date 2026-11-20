import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDiscontinued, keepDiscontinued, listDiscontinued } from "@/lib/discontinued.functions";

/**
 * Produtos que o fornecedor deixou de vender. Já estão fora da loja; aqui decide-se o que fazer.
 * Só aparece quando há algum.
 */
export function DiscontinuedPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "discontinued"], queryFn: () => listDiscontinued() });
  const [busy, setBusy] = useState<string | null>(null);
  const rows = q.data ?? [];
  if (!rows.length) return null;

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(done);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="disc-title" className="mb-6 border border-[var(--warning,#8a5a00)]/40 bg-card p-4">
      <h2 id="disc-title" className="text-lg">
        Retirados pelo fornecedor <span className="num text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O fornecedor deixou de vender estes artigos para Portugal. Já não aparecem na loja e o stock dos outros produtos continua a
        sincronizar. Apague-os ou mantenha-os guardados fora da loja.
      </p>
      <ul className="mt-3 divide-y border-y">
        {rows.map((r) => (
          <li key={r.productId} className="flex flex-wrap items-center gap-3 py-3">
            <span className="plate grid h-14 w-12 shrink-0 place-items-center overflow-hidden">
              {r.image ? <img src={r.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.title}</span>
              <span className="block text-xs text-muted-foreground">
                {r.supplier} · ref. {r.externalId}
                {r.since ? ` · desde ${new Date(r.since).toLocaleDateString("pt-PT")}` : ""}
                {r.inOutfits ? ` · em ${r.inOutfits} conjunto(s)` : ""}
                {r.inCollections ? ` · em ${r.inCollections} coleção(ões)` : ""}
              </span>
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === r.productId}
                onClick={() => act(r.productId, () => keepDiscontinued({ data: { productId: r.productId } }), "Mantido fora da loja.")}
              >
                Manter fora da loja
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy === r.productId}
                onClick={() => {
                  const extra = r.inOutfits || r.inCollections ? " Sai também dos conjuntos e coleções onde está." : "";
                  if (!window.confirm(`Apagar «${r.title}» de vez?${extra} As encomendas antigas mantêm-se.`)) return;
                  void act(r.productId, () => deleteDiscontinued({ data: { productId: r.productId } }), "Produto apagado.");
                }}
              >
                Apagar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
