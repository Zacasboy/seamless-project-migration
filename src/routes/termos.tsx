import { createFileRoute, Link } from "@tanstack/react-router";
import { Fill, LegalPage } from "@/components/LegalPage";
import { SITE, seo } from "@/lib/site";

export const Route = createFileRoute("/termos")({
  head: () =>
    seo({
      title: "Termos e condições",
      description:
        "Condições de venda da Pallessiani: encomendas, preços, entregas, devoluções e resolução de litígios.",
      path: "/termos",
    }),
  component: Page,
});

function Page() {
  const c = SITE.company;
  return (
    <LegalPage title="Termos e condições">
      <h2>Identificação do vendedor</h2>
      <p>
        <Fill v={c.legalName} label="Denominação social" />, NIPC <Fill v={c.nif} label="NIPC" />,{" "}
        <Fill v={c.address} label="Morada" />, <Fill v={c.postalCode} label="Código postal" />{" "}
        <Fill v={c.city} label="Localidade" />. Email <Fill v={c.email} label="Email" />, telefone{" "}
        <Fill v={c.phone} label="Telefone" />.
      </p>

      <h2>Encomendas</h2>
      <p>
        Para encomendar precisa de uma conta. Depois de enviar a encomenda recebe uma referência. A
        encomenda só fica confirmada quando validarmos a disponibilidade e combinarmos consigo o
        pagamento e a entrega. Se um artigo não estiver disponível, informamos e não cobramos esse
        artigo.
      </p>

      <h2>Preços</h2>
      <p>
        Os preços estão em euros e incluem IVA à taxa legal. O preço aplicável é o que está em vigor
        no momento em que envia a encomenda. Os portes são indicados antes da confirmação.
      </p>

      <h2>Entrega</h2>
      <p>
        Entregamos em Portugal e na União Europeia, no prazo comunicado na confirmação e nunca
        superior a 30 dias, salvo acordo diferente.
      </p>

      <h2>Direito de livre resolução</h2>
      <p>
        Pode desistir da compra no prazo de 14 dias a contar da receção dos artigos, sem indicar
        motivo, nos termos do Decreto-Lei n.º 24/2014. Basta comunicá-lo para{" "}
        <Fill v={c.email} label="Email" />. Devolvemos todos os pagamentos, incluindo os portes de
        envio normais, no prazo de 14 dias. Os artigos devem ser devolvidos em bom estado.
      </p>

      <h2>Garantia</h2>
      <p>
        Os artigos têm a garantia legal de conformidade de três anos prevista no Decreto-Lei n.º
        84/2021.
      </p>

      <h2>Resolução de litígios</h2>
      <p>
        Em caso de litígio pode recorrer à entidade de resolução alternativa de litígios de consumo{" "}
        <a href={SITE.ral.url} target="_blank" rel="noopener noreferrer">
          {SITE.ral.name}
        </a>
        , ou usar a{" "}
        <a href={SITE.odrUrl} target="_blank" rel="noopener noreferrer">
          plataforma europeia de resolução de litígios em linha
        </a>
        . Tem também à disposição o{" "}
        <a href={SITE.complaintsBookUrl} target="_blank" rel="noopener noreferrer">
          Livro de Reclamações Eletrónico
        </a>
        .
      </p>

      <h2>Dados pessoais</h2>
      <p>
        O tratamento dos seus dados segue a nossa{" "}
        <Link to="/privacidade">política de privacidade</Link>.
      </p>

      <p className="text-sm text-muted-foreground">
        Texto de base a validar por um jurista antes da publicação.
      </p>
    </LegalPage>
  );
}
