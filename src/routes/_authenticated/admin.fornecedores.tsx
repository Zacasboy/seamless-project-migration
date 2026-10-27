import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/fornecedores")({ component: Page });

function Page() {
  return (
    <AdminCrud
      table="suppliers"
      title="Fornecedores"
      intro={<>
        Lista de fornecedores candidatos. <b>Diretório</b> = apenas referência; <b>Ligado</b> só aparece quando existir uma integração real
        autenticada (chave de API guardada em segredo no servidor). Nenhum fornecedor está ligado de momento.
      </>}
      searchKeys={["name", "region", "specialty"]}
      filterKey="api_support"
      filterOptions={["API pública", "Sem API pública / manual"]}
      orderBy="name"
      columns={[
        { key: "name", label: "Fornecedor", render: (r) => <a href={r.website} target="_blank" rel="noreferrer" className="underline">{r.name}</a> },
        { key: "region", label: "Região" },
        { key: "specialty", label: "Especialidade" },
        { key: "status", label: "Disponibilidade" },
        { key: "api_support", label: "Suporte API" },
        { key: "integration_state", label: "Integração", render: (r) => (
          <Badge variant={r.connected ? "default" : "outline"}>{r.connected ? "Ligado" : r.integration_state}</Badge>
        ) },
        { key: "last_sync_at", label: "Última sincronização", render: (r) => (r.last_sync_at ? new Date(r.last_sync_at).toLocaleString("pt-PT") : "Nunca") },
      ]}
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "website", label: "Website" },
        { key: "region", label: "Região" },
        { key: "specialty", label: "Especialidade" },
        { key: "status", label: "Disponibilidade", type: "select", options: ["Disponível", "Indisponível"] },
        { key: "api_support", label: "Suporte API", type: "select", options: ["API pública", "Sem API pública / manual", "Desconhecido"] },
        { key: "integration_state", label: "Estado da integração", type: "select", options: ["Diretório", "Aguarda credenciais", "Em aprovação"] },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
