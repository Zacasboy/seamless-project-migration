import { createFileRoute, Link } from "@tanstack/react-router";
import { StoreLayout } from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { SITE, isPending } from "@/lib/site";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/obrigado")({
  validateSearch: (s: Record<string, unknown>): { encomenda?: string | undefined } =>
    typeof s["encomenda"] === "string" && /^[0-9a-f-]{36}$/.test(s["encomenda"])
      ? { encomenda: s["encomenda"] }
      : {},
  head: () =>
    seo({
      title: "Obrigado",
      description: "A sua encomenda Pallessiani foi recebida.",
      noindex: true,
    }),
  component: ThankYou,
});

function ThankYou() {
  const { encomenda } = Route.useSearch();
  const email = SITE.company.email;
  return (
    <StoreLayout>
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="eyebrow">Encomenda recebida</p>
        <h1 className="mt-4 text-5xl md:text-6xl">Obrigado.</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Recebemos o seu pedido. Vamos confirmar a disponibilidade dos artigos e contactá-lo para
          combinar o pagamento e a entrega.
        </p>
        {encomenda && (
          <p className="mt-6 text-sm">
            Referência:{" "}
            <span className="num font-medium">{encomenda.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/conta">Ver as minhas encomendas</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/loja">Continuar a ver</Link>
          </Button>
        </div>
        {!isPending(email) && (
          <p className="mt-10 text-sm text-muted-foreground">
            Alguma dúvida? Escreva para {email}.
          </p>
        )}
      </section>
    </StoreLayout>
  );
}
