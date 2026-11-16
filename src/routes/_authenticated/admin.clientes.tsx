import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/clientes")({ component: Page });

const SEGMENTS = ["Novo", "Recorrente", "Fiel", "Inativo", "Alto valor"];

function Page() {
  return (
    <AdminCrud
      table="customers"
      title="Clientes"
      intro={
        <>
          Segmentos baseados apenas em dados observáveis, como compras e visitas, e sempre com o
          motivo indicado. RGPD: recolha só o necessário, registe a data de cada consentimento e
          apague os dados quando o cliente o pedir.
        </>
      }
      searchKeys={["name", "email", "country"]}
      filterKey="segment"
      filterOptions={SEGMENTS}
      emptyText="Ainda não há clientes registados."
      beforeSave={(p, original) => {
        // Regista quando o consentimento muda (prova exigida pelo RGPD).
        if (
          p["marketing_consent"] !== undefined &&
          p["marketing_consent"] !== !!original["marketing_consent"]
        )
          return { ...p, consent_updated_at: new Date().toISOString() };
        return p;
      }}
      columns={[
        { key: "name", label: "Nome" },
        { key: "email", label: "Email" },
        { key: "segment", label: "Segmento" },
        { key: "segment_reason", label: "Motivo" },
        {
          key: "lifetime_value",
          label: "Valor total",
          render: (r) => <span className="num">{euro(Number(r["lifetime_value"] ?? 0))}</span>,
        },
        {
          key: "marketing_consent",
          label: "Marketing",
          render: (r) =>
            r["marketing_consent"]
              ? `Sim${r["consent_updated_at"] ? `, desde ${String(r["consent_updated_at"]).slice(0, 10)}` : ", sem data"}`
              : "Não",
        },
      ]}
      fields={[
        { key: "name", label: "Nome", required: true, maxLength: 120 },
        {
          key: "email",
          label: "Email",
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
          patternMessage: "Email inválido.",
        },
        { key: "country", label: "País", maxLength: 60 },
        { key: "segment", label: "Segmento", type: "select", options: SEGMENTS },
        { key: "segment_reason", label: "Motivo do segmento (dados observados)", maxLength: 500 },
        { key: "lifetime_value", label: "Valor total de compras (€)", type: "number", min: 0 },
        { key: "marketing_consent", label: "Consentiu comunicações de marketing", type: "bool" },
        { key: "notes", label: "Notas internas", type: "textarea", maxLength: 2000 },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
