import { createFileRoute } from "@tanstack/react-router";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { useMigrationStatus } from "@/lib/admin-data";
import { analyticsConfigured } from "@/lib/consent";
import { SITE, missingCompanyFields } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/definicoes")({ component: Page });

const LABELS: Record<string, string> = {
  legalName: "Denominação social",
  nif: "NIPC",
  address: "Morada",
  postalCode: "Código postal",
  city: "Localidade",
  email: "Email",
  phone: "Telefone",
};

function Page() {
  const mig = useMigrationStatus();
  const missing = missingCompanyFields();
  const rows: { name: string; ok: boolean | undefined; detail: string }[] = [
    {
      name: "Atualização da base de dados de 16/11",
      ok: mig.data?.applied,
      detail:
        "Ficheiro supabase/migrations/20261116020000_admin_alignment_orders.sql. Ativa encomendas seguras, Radar, métricas de canais e gestão de administradores. Só acrescenta; não apaga dados.",
    },
    {
      name: "Dados legais da empresa",
      ok: missing.length === 0,
      detail: missing.length
        ? `Em falta em src/lib/site.ts: ${missing.map((m) => LABELS[m] ?? m).join(", ")}.`
        : "Completos. Aparecem no rodapé, contacto, termos e privacidade.",
    },
    {
      name: "Domínio público",
      ok: !!SITE.url,
      detail: SITE.url
        ? SITE.url
        : "Defina VITE_SITE_URL (ex.: https://pallessiani.pt) para URLs canónicos e sitemap.",
    },
    {
      name: "Google Analytics 4",
      ok: analyticsConfigured,
      detail: analyticsConfigured
        ? "Configurado. Só carrega depois de o visitante aceitar cookies de análise."
        : "Defina VITE_GA_MEASUREMENT_ID (G-XXXXXXX). Sem ele, contam só as visitas próprias da loja.",
    },
    {
      name: "Pagamentos online",
      ok: false,
      detail:
        "Ainda não ativos. As encomendas ficam por confirmar e o pagamento é combinado com o cliente. Ao ligar um fornecedor de pagamentos, os webhooks têm de ser verificados por assinatura no servidor.",
    },
    {
      name: "Fornecedores e canais",
      ok: undefined,
      detail:
        "Cada integração precisa de um adaptador no servidor e de chaves guardadas como segredos do servidor, nunca no browser.",
    },
  ];
  return (
    <>
      <AdminHeader title="Definições" intro="Estado da configuração da loja." />
      <Panel className="p-0">
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.name} className="grid gap-2 px-5 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
              <StatusPill tone={r.ok === undefined ? "none" : r.ok ? "pass" : "fail"}>
                {r.ok === undefined ? "Informação" : r.ok ? "Feito" : "Por fazer"}
              </StatusPill>
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
