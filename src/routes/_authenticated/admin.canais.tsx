import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { Badge } from "@/components/ui/badge";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/canais")({ component: Page });

const m = (r: any, v: string) => (r.integration_state === "Ligado" ? v : <span className="text-muted-foreground">sem dados</span>);

function Page() {
  return (
    <AdminCrud
      table="ad_channels"
      title="Canais e anúncios"
      intro="Métricas só são mostradas quando o canal está realmente ligado. Canais não ligados mostram 'sem dados' — nenhum valor é inventado."
      searchKeys={["name", "platform"]}
      filterKey="platform"
      filterOptions={["Meta", "Google", "TikTok", "Pinterest", "Email"]}
      columns={[
        { key: "name", label: "Canal" },
        { key: "platform", label: "Plataforma" },
        { key: "integration_state", label: "Integração", render: (r) => <Badge variant="outline">{r.integration_state}</Badge> },
        { key: "status", label: "Estado" },
        { key: "budget", label: "Orçamento", render: (r) => euro(Number(r.budget)) },
        { key: "spend", label: "Gasto", render: (r) => m(r, euro(Number(r.spend))) },
        { key: "clicks", label: "Cliques", render: (r) => m(r, String(r.clicks)) },
        { key: "conversions", label: "Conversões", render: (r) => m(r, String(r.conversions)) },
        { key: "roas", label: "ROAS", render: (r) => m(r, Number(r.spend) > 0 ? (Number(r.revenue) / Number(r.spend)).toFixed(2) : "—") },
      ]}
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "platform", label: "Plataforma", type: "select", options: ["Meta", "Google", "TikTok", "Pinterest", "Email"], required: true },
        { key: "status", label: "Estado", type: "select", options: ["Ativo", "Pausado"] },
        { key: "budget", label: "Orçamento planeado (€)", type: "number" },
        { key: "integration_state", label: "Integração (só a sincronização real define 'Ligado')", readOnly: true },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
