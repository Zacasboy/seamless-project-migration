import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { publicClient } from "@/lib/products.functions";

// Temas visuais da loja. O painel escolhe um; a loja aplica-o a todos os visitantes.
export const STORE_THEMES = [
  {
    id: "ficha",
    name: "Ficha técnica",
    description: "Cinza quente e grafite, grelha rigorosa e especificações em monoespaçada.",
    swatches: ["#F2F2F0", "#FFFFFF", "#161616", "#5B1F24"],
    sample: "IBM Plex Sans",
  },
  {
    id: "pedra",
    name: "Pedra",
    description: "Boutique suave: pedra clara, serifada leve e acento pau-rosa.",
    swatches: ["#F6F4F0", "#ECE8E2", "#23201C", "#8A4B3E"],
    sample: "EB Garamond",
  },
  {
    id: "pedra-ficha",
    name: "Pedra técnica",
    description: "As cores da Pedra com a estrutura e as especificações da Ficha técnica.",
    swatches: ["#F6F4F0", "#FFFFFF", "#23201C", "#8A4B3E"],
    sample: "EB Garamond + IBM Plex",
  },
] as const;

export type StoreThemeId = (typeof STORE_THEMES)[number]["id"];
export const DEFAULT_THEME: StoreThemeId = "ficha";

export function normalizeTheme(v: unknown): StoreThemeId {
  return STORE_THEMES.some((t) => t.id === v) ? (v as StoreThemeId) : DEFAULT_THEME;
}

// Lê o tema guardado. Sem a tabela store_settings (migration por aplicar) usa o predefinido.
export const getStoreTheme = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await publicClient()
      .from("store_settings")
      .select("value")
      .eq("key", "theme")
      .maybeSingle();
    if (error) return DEFAULT_THEME;
    return normalizeTheme(data?.value);
  } catch {
    return DEFAULT_THEME;
  }
});

export const storeThemeQuery = queryOptions({
  queryKey: ["store-theme"],
  queryFn: () => getStoreTheme(),
  staleTime: 60_000,
});
