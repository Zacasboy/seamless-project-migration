/* eslint-disable @typescript-eslint/no-explicit-any -- Admin CRUD uses dynamic table/column keys not represented by the generated Supabase type map. */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/admin/colecoes")({ component: Page });

const STATUS = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicada" },
  { value: "archived", label: "Arquivada" },
];
const TONE: Record<string, string> = { draft: "warn", published: "pass", archived: "none" };

function Page() {
  return (
    <div className="flex flex-col gap-10">
      <AdminCrud
        table="collections"
        title="Coleções"
        intro="Agrupe peças por estação ou campanha. Só as coleções publicadas aparecem na loja."
        searchKeys={["title", "slug", "season", "campaign"]}
        columns={[
          { key: "title", label: "Coleção" },
          { key: "season", label: "Estação" },
          { key: "campaign", label: "Campanha" },
          {
            key: "status",
            label: "Estado",
            render: (r) => (
              <StatusPill tone={TONE[r["status"]] ?? "none"}>
                {STATUS.find((s) => s.value === r["status"])?.label ?? r["status"]}
              </StatusPill>
            ),
          },
        ]}
        fields={[
          { key: "title", label: "Título", required: true, maxLength: 200 },
          {
            key: "slug",
            label: "Endereço (slug)",
            required: true,
            pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
            patternMessage: "Só minúsculas, números e hífens.",
            maxLength: 120,
          },
          { key: "description", label: "Descrição", type: "textarea", maxLength: 10000 },
          { key: "season", label: "Estação", maxLength: 100 },
          { key: "campaign", label: "Campanha", maxLength: 200 },
          { key: "status", label: "Estado", type: "select", options: STATUS, required: true },
          { key: "is_demo", label: "Registo de demonstração", type: "bool" },
        ]}
      />
      <ItemsEditor />
    </div>
  );
}

function ItemsEditor() {
  const qc = useQueryClient();
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const cols = useQuery({
    queryKey: ["admin", "collections-lite"],
    queryFn: async () =>
      (await supabase.from("collections").select("id,title").order("title")).data ?? [],
  });
  const prods = useQuery({
    queryKey: ["admin", "products-lite"],
    queryFn: async () =>
      (await supabase.from("products").select("id,title").order("title")).data ?? [],
  });
  const items = useQuery({
    queryKey: ["admin", "items", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_items")
        .select("product_id,position")
        .eq("collection_id", cid);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const selected = new Set((items.data ?? []).map((r) => r.product_id));

  async function toggle(pid: string, on: boolean) {
    setBusy(pid);
    const next = Math.max(-1, ...(items.data ?? []).map((r) => r.position)) + 1;
    const { error } = on
      ? await supabase
          .from("collection_items")
          .insert({ collection_id: cid, product_id: pid, position: next })
      : await supabase
          .from("collection_items")
          .delete()
          .eq("collection_id", cid)
          .eq("product_id", pid);
    setBusy(null);
    if (error) toast.error(`Não foi possível atualizar: ${error.message}`);
    qc.invalidateQueries({ queryKey: ["admin", "items", cid] });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-3xl">Peças da coleção</h2>
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        Coleção
        <select
          className="h-10 rounded border bg-card px-3"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
        >
          <option value="">Escolher coleção…</option>
          {cols.data?.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      {cid && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {prods.data?.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 rounded border bg-card px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="accent-[var(--brand-accent)]"
                checked={selected.has(p.id)}
                disabled={busy === p.id || items.isLoading}
                onChange={(e) => toggle(p.id, e.target.checked)}
              />
              {p.title}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
