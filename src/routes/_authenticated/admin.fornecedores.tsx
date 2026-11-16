import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/admin/fornecedores")({ component: Page });

const ACTIVE = ["connected", "active"];

function Integration({ r }: { r: Record<string, unknown> }) {
  const status = String(r["api_connection_status"] ?? "not_configured");
  if (r["connected"] && ACTIVE.includes(status)) return <StatusPill tone="pass">Ligado</StatusPill>;
  if (r["connected"]) return <StatusPill tone="fail">Marcado ligado, sem integração</StatusPill>;
  return <StatusPill tone="none">Diretório</StatusPill>;
}

function Page() {
  return (
    <AdminCrud
      table="suppliers"
      title="Fornecedores"
      intro={
        <>
          <b>Diretório</b> é só referência. <b>Ligado</b> aparece quando existir uma integração
          real, com a chave de API guardada no servidor. Fornecedores marcados como ligados sem
          integração são assinalados para revisão.
        </>
      }
      searchKeys={["name", "region", "specialty"]}
      filterKey="status"
      filterOptions={["Disponível", "Indisponível"]}
      orderBy="name"
      columns={[
        {
          key: "name",
          label: "Fornecedor",
          render: (r) =>
            r["website"] ? (
              <a
                href={String(r["website"])}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {String(r["name"])}
              </a>
            ) : (
              String(r["name"])
            ),
        },
        { key: "region", label: "Região" },
        { key: "specialty", label: "Especialidade" },
        { key: "status", label: "Disponibilidade" },
        { key: "api_connection_status", label: "Integração", render: (r) => <Integration r={r} /> },
        {
          key: "last_synced_at",
          label: "Última sincronização",
          render: (r) =>
            r["last_synced_at"]
              ? String(r["last_synced_at"]).slice(0, 16).replace("T", " ")
              : "Nunca",
        },
      ]}
      fields={[
        { key: "name", label: "Nome", required: true, maxLength: 120 },
        {
          key: "website",
          label: "Website",
          pattern: /^https:\/\/\S+$/,
          patternMessage: "Use um endereço que comece por https://",
        },
        { key: "region", label: "Região", maxLength: 80 },
        { key: "specialty", label: "Especialidade", maxLength: 120 },
        {
          key: "status",
          label: "Disponibilidade",
          type: "select",
          options: ["Disponível", "Indisponível"],
        },
        {
          key: "api_docs_url",
          label: "Documentação da API",
          pattern: /^https:\/\/\S+$/,
          patternMessage: "Use um endereço que comece por https://",
        },
        {
          key: "supported_operations",
          label: "Operações suportadas (separadas por vírgula)",
          type: "list",
        },
        {
          key: "connected",
          label: "Marcado como ligado (só a integração real deve ligar)",
          type: "bool",
        },
        { key: "api_connection_status", label: "Estado da integração", readOnly: true },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
