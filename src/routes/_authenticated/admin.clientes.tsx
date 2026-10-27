import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/clientes")({ component: Page });

const SEGMENTS = ["Novo", "Recorrente", "Fiel", "Inativo", "Alto valor"];

function Page() {
  return (
    <AdminCrud
      table="customers"
      title="Clientes (CRM)"
      intro={<>
        Segmentos baseados apenas em dados observáveis (compras, visitas, consentimento) — indique sempre o motivo do segmento.
        SWOT e PESTEL descrevem o <b>contexto de mercado do segmento</b> e são hipóteses de negócio, não perfis pessoais.
        RGPD: recolha só o necessário, respeite o consentimento e apague dados a pedido.
      </>}
      searchKeys={["name", "email", "country"]}
      filterKey="segment"
      filterOptions={SEGMENTS}
      columns={[
        { key: "name", label: "Nome" },
        { key: "email", label: "Email" },
        { key: "segment", label: "Segmento" },
        { key: "segment_reason", label: "Motivo do segmento" },
        { key: "orders_count", label: "Encomendas" },
        { key: "total_spent", label: "Total", render: (r) => euro(Number(r.total_spent)) },
        { key: "consent_marketing", label: "Consentimento", render: (r) => (r.consent_marketing ? "Sim" : "Não") },
      ]}
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "email", label: "Email" },
        { key: "country", label: "País" },
        { key: "segment", label: "Segmento", type: "select", options: SEGMENTS },
        { key: "segment_reason", label: "Motivo do segmento (dados observados)" },
        { key: "orders_count", label: "N.º de encomendas", type: "number" },
        { key: "total_spent", label: "Total gasto (€)", type: "number" },
        { key: "consent_marketing", label: "Consentiu comunicações de marketing", type: "bool" },
        { key: "notes", label: "Notas internas", type: "textarea" },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
