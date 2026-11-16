import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { euro } from "@/lib/cart";
import { mapCategory, mapGender, type StoreCategory } from "@/lib/import-products";
import {
  getSupplierStatus,
  importSupplierProduct,
  previewSupplierProduct,
  syncSuppliersNow,
} from "@/lib/suppliers.functions";

type Preview = Awaited<ReturnType<typeof previewSupplierProduct>>;
type Provider = "cj" | "bigbuy" | "printful" | "brandsgateway";

// Preço com margem, arredondado para terminar em ,90.
const withMarkup = (cost: number, markup: number) =>
  Math.max(1, Math.ceil(cost * (1 + markup / 100)) - 0.1);

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "nunca";

export function SupplierConnections() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["admin", "supplier-status"],
    queryFn: () => getSupplierStatus(),
  });
  const sync = useMutation({
    mutationFn: () => syncSuppliersNow(),
    onSuccess: (s) => {
      if (s.errors.length)
        toast.warning(
          `Sincronização com avisos: ${s.errors.map((e) => `${e.provider}: ${e.message}`).join("; ")}`,
        );
      else toast.success(`${s.checked} produtos verificados, ${s.outOfStock} esgotados`);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
        <div>
          <h2 className="text-xl">Fornecedores ligados por API</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O stock dos produtos importados por API é verificado no fornecedor antes de cada
            encomenda e sincronizado periodicamente. As chaves ficam só no servidor.
          </p>
        </div>
        <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? "A sincronizar…" : "Sincronizar stock agora"}
        </Button>
      </div>
      {status.isError ? (
        <p role="alert" className="p-5 text-sm text-destructive">
          {(status.error as Error).message}
        </p>
      ) : (
        <ul className="divide-y">
          {(status.data ?? []).map((s) => (
            <li
              key={s.key}
              className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[180px_120px_minmax(0,1fr)] sm:items-center"
            >
              <span className="font-medium">{s.name}</span>
              <StatusPill tone={s.configured ? "pass" : "warn"}>
                {s.configured ? "Ligado" : "Por ligar"}
              </StatusPill>
              <span className="text-muted-foreground">
                {s.configured
                  ? `Última sincronização: ${when(s.lastSyncedAt)}${s.lastError ? ` · erro: ${s.lastError}` : ""}`
                  : `Definir no servidor: ${s.env.join(", ")}`}
              </span>
            </li>
          ))}
          {status.isLoading && <li className="h-24 animate-pulse bg-muted" aria-busy="true" />}
        </ul>
      )}
    </Panel>
  );
}

export function SupplierLinkImport() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "" as StoreCategory | "",
    gender: "unisex" as "mulher" | "homem" | "unisex",
    price: 0,
    fxRate: 1,
    markup: 150,
    publish: true,
  });
  const [chosen, setChosen] = useState<string[]>([]);

  const load = useMutation({
    mutationFn: () =>
      previewSupplierProduct({ data: { input, ...(provider ? { provider } : {}) } }),
    onSuccess: (p) => {
      setPreview(p);
      const eur = p.currency === "EUR";
      const costs = p.variants.map((v) => v.cost).filter((c): c is number => c !== null);
      const sugg = p.variants.map((v) => v.suggestedPrice).find((x) => x !== null) ?? null;
      setForm((f) => ({
        ...f,
        title: p.title.slice(0, 160),
        category: mapCategory(p.categoryHint, p.title) ?? "",
        gender: mapGender("", p.title),
        fxRate: eur ? 1 : 0,
        price: eur ? (sugg ?? (costs.length ? withMarkup(Math.max(...costs), f.markup) : 0)) : 0,
      }));
      setChosen(p.variants.filter((v) => v.available).map((v) => v.id));
    },
    onError: (e: Error) => {
      setPreview(null);
      toast.error(e.message);
    },
  });

  const save = useMutation({
    mutationFn: () =>
      importSupplierProduct({
        data: {
          input,
          ...(provider ? { provider } : {}),
          title: form.title,
          category: form.category as StoreCategory,
          gender: form.gender,
          price: form.price,
          fxRate: form.fxRate,
          publish: form.publish,
          variantIds: chosen,
        },
      }),
    onSuccess: (r) => {
      toast.success("Produto importado e ligado ao fornecedor", {
        action: {
          label: "Ver na loja",
          onClick: () => window.open(`/produto/${r.slug}`, "_blank", "noopener"),
        },
      });
      setPreview(null);
      setInput("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const foreign = preview && preview.currency !== "EUR";
  const costs = preview?.variants.map((v) => v.cost).filter((c): c is number => c !== null) ?? [];
  const costEur = costs.length ? Math.max(...costs) * form.fxRate : null;
  const margin = costEur && form.price ? ((form.price - costEur) / form.price) * 100 : null;
  const canSave =
    !!preview &&
    form.title.trim().length >= 2 &&
    !!form.category &&
    form.price > 0 &&
    form.fxRate > 0 &&
    chosen.length > 0;

  return (
    <Panel>
      <h2 className="text-xl">Importar por link</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cole o link do produto na CJDropshipping, BigBuy ou Printful. Também pode escolher o
        fornecedor e colar a referência. O sistema só lê o identificador do link e consulta a API
        oficial do fornecedor; nunca abre o link.
      </p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim().length >= 3) load.mutate();
        }}
      >
        <div>
          <Label htmlFor="ref" className="sr-only">
            Link ou referência
          </Label>
          <input
            id="ref"
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://cjdropshipping.com/product/…-p-….html"
            className="h-10 w-full border bg-card px-3 text-sm"
          />
        </div>
        <select
          aria-label="Fornecedor"
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider | "")}
          className="h-10 border bg-card px-3 text-sm"
        >
          <option value="">Detetar pelo link</option>
          <option value="cj">CJDropshipping</option>
          <option value="bigbuy">BigBuy</option>
          <option value="printful">Printful</option>
          <option value="brandsgateway">BrandsGateway</option>
        </select>
        <Button type="submit" disabled={load.isPending || input.trim().length < 3}>
          {load.isPending ? "A consultar…" : "Pré-visualizar"}
        </Button>
      </form>

      {preview && (
        <div className="mt-6 grid gap-6 border-t pt-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
            {preview.images.slice(0, 6).map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-[4/5] w-full bg-muted object-cover"
              />
            ))}
          </div>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="t">Nome na loja</Label>
                <input
                  id="t"
                  value={form.title}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 h-10 w-full border bg-card px-3 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="c">Categoria</Label>
                <select
                  id="c"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as StoreCategory })}
                  className="mt-1 h-10 w-full border bg-card px-3 text-sm"
                  aria-invalid={!form.category}
                >
                  <option value="">Escolher…</option>
                  <option>Malas</option>
                  <option>Calçado</option>
                  <option>Conjuntos</option>
                </select>
              </div>
              <div>
                <Label htmlFor="g">Para</Label>
                <select
                  id="g"
                  value={form.gender}
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value as typeof form.gender })
                  }
                  className="mt-1 h-10 w-full border bg-card px-3 text-sm"
                >
                  <option value="mulher">Mulher</option>
                  <option value="homem">Homem</option>
                  <option value="unisex">Todos</option>
                </select>
              </div>
              {foreign && (
                <div>
                  <Label htmlFor="fx">Câmbio {preview.currency} → EUR</Label>
                  <input
                    id="fx"
                    type="number"
                    step="0.0001"
                    min={0}
                    value={form.fxRate || ""}
                    onChange={(e) => setForm({ ...form, fxRate: Number(e.target.value) || 0 })}
                    placeholder="ex.: 0.92"
                    className="num mt-1 h-10 w-full border bg-card px-3 text-sm"
                    aria-describedby="fx-help"
                  />
                  <p id="fx-help" className="mt-1 text-xs text-muted-foreground">
                    Valor de hoje, do seu banco ou do BCE.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="p">Preço de venda (EUR)</Label>
                <input
                  id="p"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
                  className="num mt-1 h-10 w-full border bg-card px-3 text-sm"
                />
                {costEur !== null && form.fxRate > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, price: withMarkup(costEur, form.markup) })}
                    className="mt-1 text-xs underline underline-offset-4"
                  >
                    Calcular com margem de {form.markup} %
                  </button>
                )}
                <p className="num mt-1 text-xs text-muted-foreground">
                  {costEur !== null && form.fxRate
                    ? `Custo ${euro(costEur)}${margin !== null ? ` · margem ${margin.toFixed(0)} %` : ""}`
                    : "Sem custo indicado pelo fornecedor"}
                </p>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Variantes a vender</legend>
              <div className="mt-2 max-h-56 overflow-auto border">
                <table className="w-full text-sm">
                  <tbody>
                    {preview.variants.map((v) => (
                      <tr key={v.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Vender ${[v.color, v.size].filter(Boolean).join(" ") || v.sku || v.id}`}
                            checked={chosen.includes(v.id)}
                            onChange={(e) =>
                              setChosen(
                                e.target.checked
                                  ? [...chosen, v.id]
                                  : chosen.filter((x) => x !== v.id),
                              )
                            }
                            className="accent-[var(--brand-accent)]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {[v.color, v.size].filter(Boolean).join(" · ") || "Única"}
                        </td>
                        <td className="num px-3 py-2 text-xs text-muted-foreground">
                          {v.sku ?? ""}
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {v.stock === null ? "—" : `${v.stock} un.`}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill tone={v.available ? "pass" : "fail"}>
                            {v.available ? "Disponível" : "Esgotado"}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => setForm({ ...form, publish: e.target.checked })}
                  className="accent-[var(--brand-accent)]"
                />
                Publicar na loja
              </label>
              <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
                {save.isPending ? "A importar…" : "Importar e ligar ao fornecedor"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
