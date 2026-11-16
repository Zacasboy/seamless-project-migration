// Dados legais e de contacto da loja. São usados no rodapé, na página de contacto,
// na política de privacidade, nos termos e no sitemap.
// Preenche os campos marcados com PREENCHER antes de publicar. O painel avisa
// enquanto algum ficar por preencher.

export const PENDING = "PREENCHER";

export const SITE = {
  name: "Pallessiani",
  tagline: "Malas, calçado e conjuntos de estilo intemporal.",
  // URL público sem barra final, por exemplo https://pallessiani.pt
  url: (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/+$/, "") ?? "",
  company: {
    legalName: PENDING, // denominação social
    nif: PENDING, // NIPC
    address: PENDING, // morada completa
    postalCode: PENDING, // 0000-000
    city: PENDING,
    country: "Portugal",
    email: PENDING, // email de apoio ao cliente
    phone: PENDING, // telefone com indicativo
    hours: "Segunda a sexta, 10h–18h",
  },
  // Entidade de resolução alternativa de litígios (obrigatória no comércio eletrónico em Portugal).
  ral: {
    name: "CNIACC – Centro Nacional de Informação e Arbitragem de Conflitos de Consumo",
    url: "https://www.cniacc.pt",
  },
  complaintsBookUrl: "https://www.livroreclamacoes.pt",
  odrUrl: "https://ec.europa.eu/consumers/odr",
  legalUpdated: "16 de novembro de 2026",
} as const;

export const isPending = (v: string) => !v || v === PENDING;

export const missingCompanyFields = () =>
  Object.entries(SITE.company)
    .filter(([, v]) => isPending(v))
    .map(([k]) => k);

export const companyLine = () => {
  const c = SITE.company;
  return [c.address, `${c.postalCode} ${c.city}`, c.country]
    .filter((v) => !isPending(v) && !v.includes(PENDING))
    .join(", ");
};

export const pageTitle = (t?: string) => (t ? `${t} — ${SITE.name}` : SITE.name);

// Metadados de página: título, descrição, Open Graph e URL canónico quando há VITE_SITE_URL.
export function seo(opts: {
  title?: string;
  description: string;
  path?: string;
  noindex?: boolean;
}) {
  const title = pageTitle(opts.title);
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: opts.description },
    { property: "og:title", content: title },
    { property: "og:description", content: opts.description },
    { property: "og:site_name", content: SITE.name },
    { property: "og:locale", content: "pt_PT" },
  ];
  if (opts.noindex) meta.push({ name: "robots", content: "noindex, nofollow" });
  const links: Array<Record<string, string>> = [];
  if (SITE.url && opts.path !== undefined) {
    meta.push({ property: "og:url", content: SITE.url + opts.path });
    links.push({ rel: "canonical", href: SITE.url + opts.path });
  }
  return { meta, links };
}
