import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminCrud } from "@/components/admin/AdminCrud";

export const Route = createFileRoute("/_authenticated/admin/colecoes")({ component: Page });

function Page() {
  return (
    <div className="space-y-10">
      <AdminCrud
        table="collections"
        title="Coleções e conjuntos"
        searchKeys={["title", "slug"]}
        columns={[{ key: "title", label: "Coleção" }, { key: "slug", label: "Slug" }, { key: "published", label: "Publicada", render: (r) => (r.published ? "Sim" : "Não") }]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "slug", label: "Slug", required: true },
          { key: "description", label: "Descrição", type: "textarea" },
          { key: "published", label: "Publicada", type: "bool" },
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
  const cols = useQuery({ queryKey: ["admin", "collections"], queryFn: async () => (await supabase.from("collections").select("*")).data ?? [] });
  const prods = useQuery({ queryKey: ["admin", "products-lite"], queryFn: async () => (await supabase.from("products").select("id,title").order("title")).data ?? [] });
  const items = useQuery({
    queryKey: ["items", cid], enabled: !!cid,
    queryFn: async () => new Set(((await supabase.from("collection_items").select("product_id").eq("collection_id", cid)).data ?? []).map((r) => r.product_id)),
  });
  async function toggle(pid: string, on: boolean) {
    const { error } = on
      ? await supabase.from("collection_items").insert({ collection_id: cid, product_id: pid })
      : await supabase.from("collection_items").delete().eq("collection_id", cid).eq("product_id", pid);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["items", cid] });
  }
  return (
    <section>
      <h2 className="text-2xl">Peças da coleção</h2>
      <select className="mt-3 h-9 rounded-md border bg-card px-2 text-sm" value={cid} onChange={(e) => setCid(e.target.value)}>
        <option value="">Escolher coleção…</option>
        {cols.data?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      {cid && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {prods.data?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded border bg-card px-3 py-2 text-sm">
              <input type="checkbox" checked={items.data?.has(p.id) ?? false} onChange={(e) => toggle(p.id, e.target.checked)} />{p.title}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
