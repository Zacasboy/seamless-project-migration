import { createFileRoute } from "@tanstack/react-router";
import { Fill, LegalPage } from "@/components/LegalPage";
import { SITE, isPending, seo } from "@/lib/site";

export const Route = createFileRoute("/contacto")({
  head: () =>
    seo({
      title: "Contacto",
      description:
        "Contactos da Pallessiani: email, telefone, morada e horário de apoio ao cliente.",
      path: "/contacto",
    }),
  component: Page,
});

function Page() {
  const c = SITE.company;
  return (
    <LegalPage title="Contacto">
      <p className="text-lg text-muted-foreground">
        Estamos disponíveis para ajudar com encomendas, tamanhos e devoluções.
      </p>
      <dl className="grid gap-6 sm:grid-cols-2">
        <div>
          <dt className="eyebrow">Email</dt>
          <dd className="mt-1">
            {isPending(c.email) ? (
              <Fill v={c.email} label="Email" />
            ) : (
              <a href={`mailto:${c.email}`}>{c.email}</a>
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Telefone</dt>
          <dd className="mt-1">
            {isPending(c.phone) ? (
              <Fill v={c.phone} label="Telefone" />
            ) : (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Morada</dt>
          <dd className="mt-1">
            <address className="not-italic">
              <Fill v={c.legalName} label="Denominação social" />
              <br />
              <Fill v={c.address} label="Morada" />
              <br />
              <Fill v={c.postalCode} label="Código postal" /> <Fill v={c.city} label="Localidade" />
              <br />
              {c.country}
            </address>
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Horário</dt>
          <dd className="mt-1">{c.hours}</dd>
        </div>
      </dl>
    </LegalPage>
  );
}
