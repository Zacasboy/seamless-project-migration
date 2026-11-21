import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { euro } from "@/lib/cart";
import { STORE_CATEGORIES, mapCategory, mapGender, type StoreCategory } from "@/lib/import-products";
import {
  getSupplierStatus,
  importSupplierProduct,
  previewSupplierProduct,
  startAliExpressAuth,
  syncSuppliersNow,
  testSupplierConnection,
} from "@/lib/suppliers.functions";

type Preview = Awaited<ReturnType<typeof previewSupplierProduct>>;
type Provider = "cj" | "bigbuy" | "printful" | "brandsgateway" | "aliexpress";

// Preço com margem, arredondado para terminar em ,90.
const withMarkup = (cost: number, markup: number) =>
  Math.max(1, Math.ceil(cost * (1 + markup / 100)) - 0.1);

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "nunca";

export function SupplierConnections() {
  const qc = useQueryClient();
  const [tests, setTests] = useState<Record<string, { ok: boolean; message: string } | "a testar">>({});
  const test = async (key: Provider) => {
    setTests((t) => ({ ...t, [key]: "a testar" }));
    try {
      const r = await testSupplierConnection({ data: { provider: key } });
      setTests((t) => ({ ...t, [key]: r }));
    } catch (e) {
      setTests((t) => ({ ...t, [key]: { ok: false, message: e instanceof Error ? e.message : "Erro" } }));
    }
  };
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
  const connectAe = useMutation({
    mutationFn: () => startAliExpressAuth(),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e: Error) => toast.error(e.message),
  });

  // Resultado do regresso da AliExpress (?aliexpress=...), mostrado uma vez.
  useEffect(() => {
    const u = new URL(window.location.href);
    const r = u.searchParams.get("aliexpress");
    if (!r) return;
    const msg: Record<string, [boolean, string]> = {
      ligado: [true, "Conta AliExpress ligada."],
      recusado: [false, "A autorização na AliExpress foi cancelada."],
      "estado-invalido": [false, "A ligação expirou ou não começou neste painel. Tente de novo."],
      "por-configurar": [false, "Faltam variáveis da AliExpress no servidor."],
      erro: [false, "A AliExpress não aceitou a autorização. Tente de novo."],
    };
    const [ok, text] = msg[r] ?? [false, "Resposta desconhecida da AliExpress."];
    (ok ? toast.success : toast.error)(text);
    u.searchParams.delete("aliexpress");
    window.history.replaceState(null, "", u.toString());
    void qc.invalidateQueries({ queryKey: ["admin", "supplier-status"] });
  }, [qc]);

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
              className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[180px_140px_minmax(0,1fr)] sm:items-center"
            >
              <span className="font-medium">{s.name}</span>
              <StatusPill tone={s.configured && (!s.oauth || s.oauth.authorized) ? "pass" : "warn"}>
                {!s.configured
                  ? "Por ligar"
                  : s.oauth && !s.oauth.authorized
                    ? "Falta autorizar"
                    : "Ligado"}
              </StatusPill>
              <span className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>
                  {!s.configured
                    ? `Definir no servidor: ${s.env.join(", ")}`
                    : s.oauth && !s.oauth.authorized
                      ? "Autorize a conta AliExpress para importar e verificar stock."
                      : `Última sincronização: ${when(s.lastSyncedAt)}${s.lastError ? ` · ${s.lastError}` : ""}${
                          s.oauth?.expiresAt ? ` · autorização válida até ${when(s.oauth.expiresAt)}` : ""
                        }`}
                </span>
                {s.configured && (!s.oauth || s.oauth.authorized) && (
                  <Button size="sm" variant="ghost" onClick={() => test(s.key as Provider)} disabled={tests[s.key] === "a testar"}>
                    {tests[s.key] === "a testar" ? "A testar…" : "Testar ligação"}
                  </Button>
                )}
                {tests[s.key] && tests[s.key] !== "a testar" && (
                  <span role="status" className={(tests[s.key] as { ok: boolean }).ok ? "text-[var(--success,#2f6b3a)]" : "text-destructive"}>
                    {(tests[s.key] as { message: string }).message}
                  </span>
                )}
                {s.configured && s.oauth && (
                  <Button
                    size="sm"
                    variant={s.oauth.authorized ? "outline" : "default"}
                    onClick={() => connectAe.mutate()}
                    disabled={connectAe.isPending}
                  >
                    {connectAe.isPending
                      ? "A abrir…"
                      : s.oauth.authorized
                        ? "Ligar de novo"
                        : "Ligar AliExpress"}
                  </Button>
                )}
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
  const [images, setImages] = useState<string[]>([]);

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
      setImages(p.images.slice(0, 20));
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
          images,
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
    chosen.length > 0 &&
    images.length > 0;

  return (
    <Panel>
      <h2 className="text-xl">Importar por link</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cole o link do produto na CJDropshipping, AliExpress, BigBuy ou Printful. Também pode escolher o
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
          <option value="aliexpress">AliExpress</option>
        </select>
        <Button type="submit" disabled={load.isPending || input.trim().length < 3}>
          {load.isPending ? "A consultar…" : "Pré-visualizar"}
        </Button>
      </form>

      {preview && (
        <div className="mt-6 grid gap-6 border-t pt-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ImagePicker all={preview.images} images={images} onChange={setImages} />
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
                  {STORE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
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

            <VariantPicker variants={preview.variants} chosen={chosen} onChange={setChosen} />

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

type Variant = Preview["variants"][number];

/** Fotografias a importar: a primeira é a principal; pode remover, repor e reordenar. */
function ImagePicker({
  all,
  images,
  onChange,
}: {
  all: string[];
  images: string[];
  onChange: (v: string[]) => void;
}) {
  const removed = all.filter((u) => !images.includes(u));
  return (
    <div>
      <p className="text-sm font-medium">
        Fotografias <span className="num text-muted-foreground">({images.length} de {all.length})</span>
      </p>
      <ul className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-2">
        {images.map((src, i) => (
          <li key={src} className="group relative">
            <img
              src={src}
              alt={`Fotografia ${i + 1}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className={`aspect-square w-full bg-muted object-cover ${i === 0 ? "outline outline-2 outline-[var(--brand-accent)]" : ""}`}
            />
            {i === 0 && (
              <span className="absolute left-1 top-1 bg-[var(--brand-accent)] px-1.5 py-0.5 text-[11px] text-white">Principal</span>
            )}
            <div className="absolute inset-x-1 bottom-1 flex gap-1">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([src, ...images.filter((u) => u !== src)])}
                  className="flex-1 bg-card/95 px-1 py-1 text-[11px] hover:bg-card"
                >
                  Tornar principal
                </button>
              )}
              <button
                type="button"
                aria-label={`Remover fotografia ${i + 1}`}
                onClick={() => onChange(images.filter((u) => u !== src))}
                className="bg-card/95 px-2 py-1 text-[11px] text-destructive hover:bg-card"
              >
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>
      {images.length === 0 && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Escolha pelo menos uma fotografia.
        </p>
      )}
      {removed.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Removidas: toque para repor</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {removed.map((src) => (
              <li key={src}>
                <button
                  type="button"
                  aria-label="Repor fotografia"
                  disabled={images.length >= 20}
                  onClick={() => onChange([...images, src])}
                  className="block opacity-50 hover:opacity-100 disabled:cursor-not-allowed"
                >
                  <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const sizeRank = (s: string) => {
  const order = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"];
  const i = order.indexOf(s.toUpperCase());
  if (i >= 0) return 1000 + i;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 5000;
};

/** Variantes a vender, com filtros por cor e tamanho e seleção em bloco. */
function VariantPicker({
  variants,
  chosen,
  onChange,
}: {
  variants: Variant[];
  chosen: string[];
  onChange: (v: string[]) => void;
}) {
  const set = new Set(chosen);
  const colors = [...new Set(variants.map((v) => v.color ?? "").filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size ?? "").filter(Boolean))].sort((a, b) => sizeRank(a) - sizeRank(b));
  const [show, setShow] = useState<"todas" | "selecionadas">("todas");

  // Liga/desliga todas as variantes disponíveis com essa cor ou tamanho.
  const toggle = (match: (v: Variant) => boolean) => {
    const group = variants.filter((v) => match(v) && v.available);
    const allOn = group.length > 0 && group.every((v) => set.has(v.id));
    const ids = new Set(group.map((v) => v.id));
    onChange(allOn ? chosen.filter((id) => !ids.has(id)) : [...new Set([...chosen, ...ids])]);
  };
  const chip = (label: string, match: (v: Variant) => boolean) => {
    const group = variants.filter(match);
    const on = group.filter((v) => set.has(v.id)).length;
    const state = on === 0 ? "none" : on === group.filter((v) => v.available).length ? "all" : "some";
    return (
      <button
        key={label}
        type="button"
        aria-pressed={state === "all"}
        onClick={() => toggle(match)}
        className={`border px-2.5 py-1 text-xs ${
          state === "all"
            ? "border-primary bg-primary text-primary-foreground"
            : state === "some"
              ? "border-primary"
              : "border-border text-muted-foreground"
        }`}
      >
        {label} <span className="num opacity-70">{on}/{group.length}</span>
      </button>
    );
  };
  const rows = show === "selecionadas" ? variants.filter((v) => set.has(v.id)) : variants;
  const available = variants.filter((v) => v.available);

  return (
    <fieldset>
      <legend className="text-sm font-medium">Variantes a vender</legend>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(available.map((v) => v.id))}>
          Selecionar todas
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([])} disabled={chosen.length === 0}>
          Desselecionar todas
        </Button>
        <span className="num ml-auto text-sm" aria-live="polite">
          {chosen.length} de {variants.length} selecionadas
        </span>
      </div>
      {colors.length > 1 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Cor: toque para incluir ou retirar todas as variantes dessa cor</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{colors.map((c) => chip(c, (v) => v.color === c))}</div>
        </div>
      )}
      {sizes.length > 1 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Tamanho</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{sizes.map((s) => chip(s, (v) => v.size === s))}</div>
        </div>
      )}
      <div className="mt-3 flex gap-3 text-xs">
        {(["todas", "selecionadas"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="radio" name="show-variants" checked={show === k} onChange={() => setShow(k)} />
            Mostrar {k}
          </label>
        ))}
      </div>
      <div className="mt-2 max-h-72 overflow-auto border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Vender ${[v.color, v.size].filter(Boolean).join(" ") || v.sku || v.id}`}
                    checked={set.has(v.id)}
                    onChange={(e) => onChange(e.target.checked ? [...chosen, v.id] : chosen.filter((x) => x !== v.id))}
                    className="accent-[var(--brand-accent)]"
                  />
                </td>
                <td className="px-3 py-2">{[v.color, v.size].filter(Boolean).join(" · ") || "Única"}</td>
                <td className="num px-3 py-2 text-right">{v.stock === null ? "—" : `${v.stock} un.`}</td>
                <td className="px-3 py-2">
                  <StatusPill tone={v.available ? "pass" : "fail"}>{v.available ? "Disponível" : "Esgotado"}</StatusPill>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-muted-foreground">Nenhuma variante selecionada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {chosen.length === 0 && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Escolha pelo menos uma variante.
        </p>
      )}
    </fieldset>
  );
}
