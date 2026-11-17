import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { euro } from "@/lib/cart";
import { SupplierConnections, SupplierLinkImport } from "@/components/admin/SupplierImport";
import { runRulesNow } from "@/lib/agents.functions";
import {
  FIELD_LABELS,
  STORE_CATEGORIES,
  buildDrafts,
  guessMapping,
  parseCsv,
  toProductRow,
  type Draft,
  type Field,
  type Mapping,
  type Options,
  type StoreCategory,
} from "@/lib/import-products";

export const Route = createFileRoute("/_authenticated/admin/importar")({ component: Page });

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PRODUCTS = 2000;
const FIELDS = Object.keys(FIELD_LABELS) as Field[];

function Page() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"api" | "csv">("api");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [opts, setOpts] = useState<Options>({
    defaultCategory: "",
    markupPercent: 100,
    supplier: "",
    publish: true,
  });
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: string[] } | null>(null);

  const headers = rows[0] ?? [];
  const body = rows.slice(1);
  const drafts = useMemo(
    () => (rows.length > 1 ? buildDrafts(body, mapping, opts) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mapping, opts],
  );
  const valid = drafts.filter((d) => d.errors.length === 0);
  const invalid = drafts.length - valid.length;

  async function onFile(f: File | undefined) {
    setFileError("");
    setResult(null);
    if (!f) return;
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
      setFileError("Use um ficheiro .csv. No Excel: Ficheiro › Guardar como › CSV UTF-8.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("O ficheiro tem mais de 10 MB. Divida-o em partes mais pequenas.");
      return;
    }
    const parsed = parseCsv(await f.text());
    if (parsed.length < 2) {
      setFileError("O ficheiro não tem linhas de produtos por baixo do cabeçalho.");
      return;
    }
    setFileName(f.name);
    setRows(parsed);
    setMapping(guessMapping(parsed[0]!));
    setOpts((o) => ({ ...o, supplier: o.supplier || f.name.replace(/\.[^.]+$/, "") }));
  }

  async function runImport() {
    if (valid.length === 0) return;
    if (valid.length > MAX_PRODUCTS) {
      toast.error(`Importe no máximo ${MAX_PRODUCTS} produtos de cada vez.`);
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const [{ data: slugs, error: e1 }, { data: skus, error: e2 }] = await Promise.all([
        supabase.from("products").select("slug"),
        supabase.from("products").select("sku").not("sku", "is", null),
      ]);
      if (e1 || e2) throw new Error((e1 ?? e2)!.message);
      const taken = new Set((slugs ?? []).map((r) => r.slug));
      const skuTaken = new Set((skus ?? []).map((r) => r.sku as string));
      const skipped: string[] = [];
      const toSave = [];
      for (const d of valid) {
        if (d.sku && skuTaken.has(d.sku)) {
          skipped.push(`${d.title} (referência ${d.sku} já existe)`);
          continue;
        }
        if (d.sku) skuTaken.add(d.sku);
        toSave.push(toProductRow(d, opts, taken));
      }
      let saved = 0;
      const ids: string[] = [];
      for (let i = 0; i < toSave.length; i += 50) {
        const chunk = toSave.slice(i, i + 50);
        const { data: inserted, error } = await supabase.from("products").insert(chunk).select("id");
        if (error) throw new Error(`${error.message} (depois de ${saved} gravados)`);
        ids.push(...(inserted ?? []).map((r) => r.id));
        saved += chunk.length;
      }
      setResult({ saved, skipped });
      setRows([]); // evita importar o mesmo ficheiro duas vezes
      toast.success(`${saved} produtos importados`);
      // Rotinas automáticas (sem IA) nos produtos novos: limpeza, categoria, SEO.
      for (let i = 0; i < ids.length; i += 500)
        await runRulesNow({ data: { productIds: ids.slice(i, i + 500) } })
          .then((r) => r.summary && toast.message(`Rotinas automáticas: ${r.summary}`))
          .catch(() => toast.warning("Produtos importados, mas as rotinas automáticas não correram. Pode corrê-las em Agentes."));
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(`A importação parou: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHeader
        title="Importar produtos"
        intro="Por link ou API, os produtos ficam ligados ao fornecedor e o stock é confirmado antes de cada encomenda. Por CSV, o stock fica como no ficheiro."
      />
      <div role="tablist" aria-label="Forma de importar" className="flex gap-2">
        {(
          [
            ["api", "Por link ou API"],
            ["csv", "Ficheiro CSV"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`border px-4 py-2 text-sm ${tab === k ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "api" ? (
        <>
          <SupplierLinkImport />
          <SupplierConnections />
        </>
      ) : (
        <>
          <Panel>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <Label htmlFor="csv">Ficheiro CSV</Label>
                <input
                  id="csv"
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                  className="mt-2 block w-full text-sm file:mr-4 file:border file:border-foreground file:bg-card file:px-4 file:py-2 file:text-sm"
                  aria-describedby="csv-help"
                />
                <p id="csv-help" className="mt-2 text-sm text-muted-foreground">
                  Use só catálogos com direito de revenda e de uso das fotografias. No Excel, guarde
                  como «CSV UTF-8». Máximo 10 MB.
                </p>
                {fileError && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {fileError}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sup">Fornecedor</Label>
                  <input
                    id="sup"
                    value={opts.supplier}
                    maxLength={80}
                    onChange={(e) => setOpts({ ...opts, supplier: e.target.value })}
                    className="mt-1 h-10 w-full border bg-card px-3 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="mk">Margem sobre o custo (%)</Label>
                  <input
                    id="mk"
                    type="number"
                    min={0}
                    max={500}
                    value={opts.markupPercent}
                    onChange={(e) =>
                      setOpts({
                        ...opts,
                        markupPercent: Math.max(0, Math.min(500, Number(e.target.value) || 0)),
                      })
                    }
                    className="num mt-1 h-10 w-full border bg-card px-3 text-sm"
                    aria-describedby="mk-help"
                  />
                  <p id="mk-help" className="mt-1 text-xs text-muted-foreground">
                    Só quando o ficheiro não traz preço de venda.
                  </p>
                </div>
                <div>
                  <Label htmlFor="cat">Categoria quando não é reconhecida</Label>
                  <select
                    id="cat"
                    value={opts.defaultCategory}
                    onChange={(e) =>
                      setOpts({ ...opts, defaultCategory: e.target.value as StoreCategory | "" })
                    }
                    className="mt-1 h-10 w-full border bg-card px-3 text-sm"
                  >
                    <option value="">Não importar</option>
                    {STORE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={opts.publish}
                    onChange={(e) => setOpts({ ...opts, publish: e.target.checked })}
                    className="accent-[var(--brand-accent)]"
                  />
                  Publicar na loja logo após importar
                </label>
              </div>
            </div>
          </Panel>

          {headers.length > 0 && (
            <Panel>
              <h2 className="text-xl">Colunas de {fileName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reconhecemos as colunas mais comuns. Corrija as que estiverem erradas.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FIELDS.map((f) => (
                  <div key={f}>
                    <Label htmlFor={`map-${f}`}>{FIELD_LABELS[f]}</Label>
                    <select
                      id={`map-${f}`}
                      value={mapping[f] ?? ""}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [f]: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      className="mt-1 h-9 w-full border bg-card px-2 text-sm"
                    >
                      <option value="">—</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Coluna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {drafts.length > 0 && (
            <Panel className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
                <p className="num text-sm">
                  {drafts.length} produtos no ficheiro · <b>{valid.length} prontos</b>
                  {invalid > 0 && (
                    <span className="text-destructive"> · {invalid} com problemas</span>
                  )}
                </p>
                <Button onClick={() => void runImport()} disabled={busy || valid.length === 0}>
                  {busy ? "A importar…" : `Importar ${valid.length} produtos`}
                </Button>
              </div>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Imagem</th>
                      <th className="px-4 py-2 font-medium">Produto</th>
                      <th className="px-4 py-2 font-medium">Categoria</th>
                      <th className="px-4 py-2 text-right font-medium">Preço</th>
                      <th className="px-4 py-2 font-medium">Variantes</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.slice(0, 200).map((d) => (
                      <Row key={d.key} d={d} />
                    ))}
                  </tbody>
                </table>
                {drafts.length > 200 && (
                  <p className="p-4 text-sm text-muted-foreground">
                    A mostrar os primeiros 200. A importação inclui todos os produtos prontos.
                  </p>
                )}
              </div>
            </Panel>
          )}

          {result && (
            <Panel>
              <h2 className="text-xl">Importação concluída</h2>
              <p className="mt-1 text-sm">
                {result.saved} produtos gravados
                {opts.publish ? " e publicados na loja." : " como rascunho (não publicados)."}
              </p>
              {result.skipped.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary>{result.skipped.length} ignorados por já existirem</summary>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {result.skipped.slice(0, 100).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="mt-4 flex gap-4 text-sm">
                <Link to="/admin/produtos" className="underline underline-offset-4">
                  Ver produtos
                </Link>
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  Abrir a loja
                </a>
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}

function Row({ d }: { d: Draft }) {
  const ok = d.errors.length === 0;
  return (
    <tr className="border-t align-top">
      <td className="px-4 py-2">
        {d.image_url ? (
          <img
            src={d.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-14 w-11 bg-muted object-cover"
          />
        ) : (
          <span className="plate block h-14 w-11" />
        )}
      </td>
      <td className="px-4 py-2">
        <span className="font-medium">{d.title || "—"}</span>
        <span className="num block text-xs text-muted-foreground">{d.sku ?? ""}</span>
      </td>
      <td className="px-4 py-2">{d.category ?? "—"}</td>
      <td className="num px-4 py-2 text-right">
        {d.price ? euro(d.price) : "—"}
        {d.cost !== null && (
          <span className="block text-xs text-muted-foreground">custo {euro(d.cost)}</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {[d.size_options.join(", "), d.color_options.join(", ")].filter(Boolean).join(" · ") || "—"}
      </td>
      <td className="px-4 py-2">
        {ok ? (
          <StatusPill tone="pass">Pronto</StatusPill>
        ) : (
          <span className="flex flex-col gap-1">
            {d.errors.map((e) => (
              <StatusPill key={e} tone="fail">
                {e}
              </StatusPill>
            ))}
          </span>
        )}
      </td>
    </tr>
  );
}
