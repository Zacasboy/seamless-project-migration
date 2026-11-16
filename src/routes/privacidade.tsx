import { createFileRoute } from "@tanstack/react-router";
import { Fill, LegalPage } from "@/components/LegalPage";
import { SITE, seo } from "@/lib/site";
import { reopenConsent } from "@/lib/consent";

export const Route = createFileRoute("/privacidade")({
  head: () =>
    seo({
      title: "Política de privacidade",
      description:
        "Como a Pallessiani trata os seus dados pessoais e utiliza cookies, segundo o RGPD.",
      path: "/privacidade",
    }),
  component: Page,
});

function Page() {
  const c = SITE.company;
  return (
    <LegalPage title="Política de privacidade">
      <h2>Quem é responsável pelos seus dados</h2>
      <p>
        <Fill v={c.legalName} label="Denominação social" />, NIPC <Fill v={c.nif} label="NIPC" />,
        com sede em <Fill v={c.address} label="Morada" />,{" "}
        <Fill v={c.postalCode} label="Código postal" /> <Fill v={c.city} label="Localidade" />.
        Contacto para assuntos de privacidade: <Fill v={c.email} label="Email" />.
      </p>

      <h2>Que dados tratamos e para quê</h2>
      <ul>
        <li>
          <b>Conta</b>: email e palavra-passe cifrada, para lhe dar acesso às suas encomendas.
          Fundamento: execução do contrato.
        </li>
        <li>
          <b>Encomendas</b>: nome, telefone, morada, NIF opcional e artigos, para processar,
          entregar e faturar. Fundamento: execução do contrato e obrigações legais e fiscais.
        </li>
        <li>
          <b>Comunicações de marketing</b>: só com o seu consentimento, que pode retirar a qualquer
          momento.
        </li>
        <li>
          <b>Estatísticas da loja</b>: páginas visitadas e página de origem, sem identificar quem
          visita, para melhorar o catálogo. Fundamento: interesse legítimo.
        </li>
      </ul>

      <h2>Durante quanto tempo</h2>
      <p>
        Dados da conta: enquanto a conta existir. Dados de faturação: durante o prazo legal de
        conservação de documentos fiscais, de 10 anos. Estatísticas: até 24 meses.
      </p>

      <h2>Com quem partilhamos</h2>
      <p>
        Com prestadores que nos ajudam a operar a loja, sempre com contrato de tratamento de dados:
        alojamento e base de dados (Supabase, com servidores em Londres, no Reino Unido, país com
        decisão de adequação da Comissão Europeia), transportadoras para entrega e, se aceitar
        cookies de análise, Google Analytics (Google Ireland, com possível transferência para os EUA
        ao abrigo do EU-US Data Privacy Framework). Não vendemos dados pessoais.
      </p>

      <h2 id="cookies">Cookies</h2>
      <p>
        Usamos armazenamento necessário para o carrinho, a sessão e a sua escolha de cookies.
        Cookies de análise (Google Analytics, com IP anonimizado) só são ativados se os aceitar.{" "}
        <button type="button" onClick={reopenConsent} className="underline underline-offset-4">
          Alterar a minha escolha de cookies
        </button>
        .
      </p>

      <h2>Os seus direitos</h2>
      <p>
        Pode pedir acesso, retificação, apagamento, limitação, portabilidade ou opor-se ao
        tratamento através de <Fill v={c.email} label="Email" />. Respondemos no prazo de um mês.
        Pode também apresentar reclamação à{" "}
        <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">
          Comissão Nacional de Proteção de Dados
        </a>
        .
      </p>

      <h2>Segurança</h2>
      <p>
        As ligações são cifradas (HTTPS), as palavras-passe nunca são guardadas em texto e o acesso
        aos dados é limitado por regras na base de dados: cada cliente só vê as suas encomendas.
      </p>

      <p className="text-sm text-muted-foreground">
        Texto de base a validar por um jurista antes da publicação.
      </p>
    </LegalPage>
  );
}
