import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/radar")({ component: Page });

function useLiveFindings() {
  return useQuery({
    queryKey: ["radar-live"],
    queryFn: async () => {
      const [{ data: products }, { data: views }] = await Promise.all([
        supabase.from("products").select("id,title,stock,price,cost,published"),
        supabase.from("page_views").select("product_id").not("product_id", "is", null).limit(5000),
      ]);
      const viewCount = new Map<string, number>();
      for (const v of views ?? [])
        viewCount.set(v.product_id!, (viewCount.get(v.product_id!) ?? 0) + 1);
      const out: { title: string; evidence: string; action: string; confidence: string }[] = [];
      for (const p of products ?? []) {
        const vc = viewCount.get(p.id) ?? 0;
        if (vc >= 3 && p.stock < 5)
          out.push({
            title: `${p.title}: procura com pouco stock`,
            evidence: `${vc} visitas registadas, ${p.stock} unidades em stock`,
            action: "Reabastecer antes de promover",
            confidence: vc >= 10 ? "Alta" : "Média",
          });
        if (
          p.cost &&
          Number(p.price) > 0 &&
          (Number(p.price) - Number(p.cost)) / Number(p.price) < 0.3
        )
          out.push({
            title: `${p.title}: margem baixa`,
            evidence: `Margem ${Math.round(((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100)}%`,
            action: "Rever preço ou fornecedor",
            confidence: "Alta",
          });
      }
      return out;
    },
  });
}

function Page() {
  const live = useLiveFindings();
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-4xl">Radar de oportunidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Calculado agora a partir de visitas reais da loja, stock e margens. Comparação entre
          canais aparece quando houver canais ligados.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {live.isLoading && <p className="text-muted-foreground">A analisar…</p>}
          {live.data?.length === 0 && (
            <p className="text-muted-foreground">
              Sem oportunidades detetadas com os dados atuais.
            </p>
          )}
          {live.data?.map((f, i) => (
            <div key={i} className="rounded-md border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">{f.title}</h3>
                <Badge variant="outline">Confiança {f.confidence}</Badge>
              </div>
              <p className="mt-2 text-sm">
                <b>Fonte:</b> eventos da loja + produtos
              </p>
              <p className="text-sm">
                <b>Evidência:</b> {f.evidence}
              </p>
              <p className="text-sm">
                <b>Ação sugerida:</b> {f.action}
              </p>
            </div>
          ))}
        </div>
      </section>
      <AdminCrud
        table="opportunity_findings"
        title="Oportunidades registadas"
        intro="Notas e hipóteses guardadas manualmente. Valores de exemplo estão marcados como Demo."
        searchKeys={["title", "source"]}
        columns={[
          { key: "title", label: "Oportunidade" },
          { key: "source", label: "Fonte" },
          { key: "confidence", label: "Confiança" },
          { key: "evidence", label: "Evidência" },
          { key: "upside", label: "Potencial" },
          { key: "action", label: "Ação" },
        ]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "source", label: "Fonte", required: true },
          {
            key: "confidence",
            label: "Confiança",
            type: "select",
            options: ["Baixa", "Média", "Alta"],
          },
          { key: "evidence", label: "Evidência", type: "textarea" },
          { key: "upside", label: "Potencial estimado" },
          { key: "assumptions", label: "Pressupostos", type: "textarea" },
          { key: "action", label: "Ação sugerida" },
          { key: "is_demo", label: "Registo de demonstração", type: "bool" },
        ]}
      />
    </div>
  );
}
