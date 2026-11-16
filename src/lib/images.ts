// Imagens de produto.
// As imagens de exemplo do Lovable (/__l5e/assets-v1/...) não foram migradas.
// Só são usados URLs guardados em products.image_url; sem URL, o componente
// ProductImage mostra um fundo neutro com o nome do produto.

export function productImage(p: { image_key?: string | null; image_url?: string | null }) {
  const url = p.image_url?.trim();
  if (!url || url.startsWith("/__l5e/")) return "";
  return url;
}
