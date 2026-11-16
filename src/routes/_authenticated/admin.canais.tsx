/* eslint-disable @typescript-eslint/no-explicit-any -- Admin CRUD uses dynamic table/column keys not represented by the generated Supabase type map. */
import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { StatusPill } from "@/components/StatusPill";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/canais")({ component: Page });

const PLATFORMS = ["Meta", "Google", "TikTok", "Pinterest", "Email"];
const linked = (r: any) => r.last_sync_status === "connected";
const m = (r: any, v: string) =>
  linked(r) ? (
    <span className="num">{v}</span>
  ) : (
    <span className="text-muted-foreground">sem dados</span>
  );

function Page() {
  return (
    <AdminCrud
      table="ad_channels"
      title="Canais e anúncios"
      intro="As métricas só aparecem quando o canal está realmente ligado e sincronizado. Até lá, nenhum valor é inventado."
      searchKeys={["name", "platform"]}
      filterKey="platform"
      filterOptions={PLATFORMS}
      columns={[
        { key: "name", label: "Canal" },
        { key: "platform", label: "Plataforma" },
        {
          key: "last_sync_status",
          label: "Integração",
          render: (r) =>
            linked(r) ? (
              <StatusPill tone="pass">Ligado</StatusPill>
            ) : (
              <StatusPill tone="none">Não ligado</StatusPill>
            ),
        },
        { key: "status", label: "Estado" },
        {
          key: "budget",
          label: "Orçamento",
          render: (r) => <span className="num">{euro(Number(r["budget"]))}</span>,
        },
        { key: "spend", label: "Gasto", render: (r) => m(r, euro(Number(r["spend"] ?? 0))) },
        { key: "clicks", label: "Cliques", render: (r) => m(r, String(r["clicks"] ?? 0)) },
        {
          key: "conversions",
          label: "Conversões",
          render: (r) => m(r, String(r["conversions"] ?? 0)),
        },
        {
          key: "roas",
          label: "Retorno",
          render: (r) =>
            m(
              r,
              Number(r["spend"]) > 0
                ? `${(Number(r["revenue"]) / Number(r["spend"])).toFixed(1)}×`
                : "—",
            ),
        },
      ]}
      fields={[
        { key: "name", label: "Nome", required: true, maxLength: 120 },
        {
          key: "platform",
          label: "Plataforma",
          type: "select",
          options: PLATFORMS,
          required: true,
        },
        {
          key: "status",
          label: "Estado",
          type: "select",
          options: ["Ativo", "Pausado", "Planeado"],
        },
        { key: "budget", label: "Orçamento mensal planeado (€)", type: "number", min: 0 },
        { key: "tracking_id", label: "ID de acompanhamento (UTM ou pixel)", maxLength: 120 },
        {
          key: "last_sync_status",
          label: "Integração (só a sincronização real define)",
          readOnly: true,
        },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
