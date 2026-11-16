import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { StatusPill } from "@/components/StatusPill";
import { ChannelsSection } from "@/components/admin/ChannelsSection";
import { METHOD_LABEL, channelOf } from "@/lib/channels";

export const Route = createFileRoute("/_authenticated/admin/fornecedores")({ component: Page });

const ACTIVE = ["connected", "active"];

function Integration({ r }: { r: Record<string, unknown> }) {
  const status = String(r["api_connection_status"] ?? "not_configured");
  if (!r["connected"]) return <StatusPill tone="none">Diretório</StatusPill>;
  if (ACTIVE.includes(status)) return <StatusPill tone="pass">API ligada</StatusPill>;
  if (status === "error") return <StatusPill tone="fail">API com erro</StatusPill>;
  if (status === "not_applicable") return <StatusPill tone="fail">Não importa</StatusPill>;
  if (status === "csv") return <StatusPill tone="none">Em uso por CSV</StatusPill>;
  return <StatusPill tone="warn">Em uso, por verificar</StatusPill>;
}

function Page() {
  return (
    <>
      <AdminCrud
        table="suppliers"
        title="Fornecedores"
        intro={
          <>
            <b>Em uso</b> são os importadores da loja (adicione-os na secção Importadores
            selecionados, mais abaixo). A coluna Integração mostra o resultado da verificação
            automática; <b>Diretório</b> é só referência.
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
          {
            key: "provider_key",
            label: "Importação",
            render: (r) => METHOD_LABEL[channelOf(String(r["name"])).method],
          },
          { key: "region", label: "Região" },
          { key: "specialty", label: "Especialidade" },
          { key: "status", label: "Disponibilidade" },
          {
            key: "api_connection_status",
            label: "Integração",
            render: (r) => <Integration r={r} />,
          },
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
      <ChannelsSection />
    </>
  );
}
