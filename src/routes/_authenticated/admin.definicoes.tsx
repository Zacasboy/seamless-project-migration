import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/definicoes")({ component: Page });

const ITEMS = [
  [
    "Pagamentos (Stripe)",
    "Pendente — os pagamentos integrados requerem um plano pago do Lovable. O botão de checkout está desativado até lá.",
  ],
  [
    "Fornecedores",
    "Cada fornecedor terá um adaptador no servidor (importar catálogo, stock, encomendas). As chaves de API ficam em segredos do servidor, nunca no navegador.",
  ],
  [
    "Canais de marketing",
    "Meta, Google, TikTok e Pinterest exigem aprovação da app e chaves próprias. Até lá, nenhuma métrica é mostrada como real.",
  ],
  [
    "Privacidade (RGPD)",
    "Visitas guardadas sem dados pessoais. Fotos do provador nunca saem do navegador e não são guardadas.",
  ],
];

function Page() {
  return (
    <div>
      <h1 className="text-4xl">Definições</h1>
      <dl className="mt-6 space-y-4">
        {ITEMS.map(([k, v]) => (
          <div key={k} className="rounded-md border bg-card p-4">
            <dt className="font-display text-xl">{k}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
