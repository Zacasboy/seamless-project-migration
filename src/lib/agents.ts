// Agentes do painel (partilhado entre browser e servidor; sem segredos).

// ---- Rotinas automáticas sem IA ----
export type ProductLanguage = "manter" | "pt" | "en";

export const RULES = {
  titulos: { label: "Nomes: tipo de produto + material", desc: "Refaz nomes de fornecedor só com o tipo (mocassins, loafers, mala tiracolo…) e o material (couro, camurça, lã…), sem tamanho, sexo nem fabricante, na língua do produto.", default: true },
  descricoes: { label: "Limpar descrições", desc: "Tira restos de HTML e de editores, ligações, nomes de fornecedores; separa a ficha técnica em linhas.", default: true },
  opcoes: { label: "Arrumar cores e tamanhos", desc: "Remove repetidos, uniformiza a escrita e ordena os tamanhos.", default: true },
  classificacao: { label: "Categoria, género e tipo", desc: "Preenche categoria, género e tipo de peça pelo nome quando faltam ou estão errados.", default: true },
  seo: { label: "Título e descrição SEO", desc: "Preenche o meta title e a descrição SEO (tipo, material, para quem, tamanhos, cores) só com dados reais.", default: true },
  alt: { label: "Texto alternativo das fotos", desc: "Preenche o texto alternativo vazio ou igual ao nome antigo com o nome e a cor.", default: true },
  sem_foto: { label: "Retirar produtos sem fotografia", desc: "Despublica produtos reais sem fotografia.", default: false },
  esgotados: { label: "Retirar produtos esgotados", desc: "Despublica produtos que o fornecedor dá como esgotados.", default: false },
  colecoes: { label: "Arquivar coleções vazias", desc: "Arquiva coleções publicadas com menos de 2 produtos publicados.", default: true },
  conteudos: { label: "Arquivar rascunhos antigos", desc: "Arquiva publicações e anúncios em rascunho com mais de 30 dias ou de produtos retirados.", default: true },
} as const;
export type RuleKey = keyof typeof RULES;

export type RulesConfig = { rules: Partial<Record<RuleKey, boolean>>; product_language: ProductLanguage };

export const LANGUAGE_LABEL: Record<ProductLanguage, string> = {
  manter: "Manter a língua do fornecedor",
  pt: "Português",
  en: "Inglês",
};

// ---- Agentes de IA ----
export const AGENT_KEYS = ["catalogo", "marca", "conteudo", "concorrencia"] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

export const AGENTS: Record<
  AgentKey,
  { name: string; role: string; does: string[]; writes: string }
> = {
  catalogo: {
    name: "Catálogo e SEO",
    role: "Organiza e detalha os produtos: nomes, categorias, descrições, SEO e coleções.",
    does: [
      "Reescreve nomes e descrições a partir dos dados do fornecedor",
      "Corrige categoria, género, tipo de peça, cores e tamanhos",
      "Escreve títulos e descrições para o Google e texto alternativo das fotografias",
      "Pesquisa palavras-chave em português e cria coleções temáticas",
    ],
    writes: "Produtos (sem preços), coleções e palavras-chave",
  },
  marca: {
    name: "Marca e apresentação",
    role: "Revê a loja e o painel, mantém o guia da marca e recomenda melhorias de apresentação.",
    does: [
      "Mantém o guia da marca que os outros agentes seguem",
      "Revê textos de produtos, coleções e publicações contra o guia",
      "Assinala promessas sem prova e riscos legais na publicidade",
      "Recomenda melhorias visuais (tipografia, cor, composição) e propõe o tema",
    ],
    writes: "Guia da marca, textos, coleções e planos de apresentação; o tema é sempre proposta",
  },
  conteudo: {
    name: "Conteúdo e anúncios",
    role: "Cria publicações e anúncios com probabilidade estimada de resultado.",
    does: [
      "Escreve publicações para Instagram, Facebook, TikTok e Pinterest",
      "Prepara anúncios Meta e Google com público e orçamento sugeridos",
      "Estima CTR, conversão e probabilidade de superar a média do canal",
      "Arquiva rascunhos antigos que já não fazem sentido",
    ],
    writes: "Rascunhos de publicações e anúncios (a publicação é sempre sua)",
  },
  concorrencia: {
    name: "Concorrência",
    role: "Pesquisa a concorrência na web e cria planos para a ultrapassar.",
    does: [
      "Identifica e acompanha concorrentes em Portugal e na Europa",
      "Compara posicionamento, preços, mensagens, canais e políticas",
      "Encontra lacunas e ameaças, com fontes para cada facto",
      "Cria planos de execução com tarefas para os outros agentes",
    ],
    writes: "Lista de concorrentes e planos de ação",
  },
};

export const FREQUENCY_LABEL = { daily: "Todos os dias", weekly: "Uma vez por semana", manual: "Só quando eu mandar" } as const;
export const AUTONOMY_LABEL = {
  auto: "Aplica as alterações (pode desfazer)",
  propor: "Propõe; eu aprovo antes de aplicar",
} as const;

export const ENTITY_LABEL: Record<string, string> = {
  products: "Produto",
  collections: "Coleção",
  marketing_content: "Conteúdo",
  agent_plans: "Plano",
  agent_memory: "Conhecimento",
  store_settings: "Definições da loja",
};

export const CHANNEL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  meta_ads: "Anúncio Meta",
  google_ads: "Anúncio Google",
  email: "Email",
  blog: "Blog",
};

/** O agente deve correr hoje? (o agendamento diário chama todos; a frequência decide) */
export function isDue(frequency: string, lastRunAt: string | null, now = new Date()) {
  if (frequency === "manual") return false;
  if (!lastRunAt) return true;
  const hours = (now.getTime() - Date.parse(lastRunAt)) / 3600_000;
  return frequency === "daily" ? hours >= 20 : hours >= 6.5 * 24;
}
