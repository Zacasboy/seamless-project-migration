// Linha de especificação curta a partir da descrição do produto
// (ex.: "Mala estruturada em pele castanha com fecho dourado." → "Pele castanha, fecho dourado").
export function specLine(p: { description?: string | null; category?: string | null }) {
  const d = (p.description ?? "").trim().replace(/\.$/, "");
  if (!d) return p.category ?? "";
  const m = d.match(/\bem\s+(.+)$/i);
  const core = (m ? m[1]!.split(",")[0]! : d).replace(/\s+com\s+/i, ", ");
  return core.charAt(0).toUpperCase() + core.slice(1);
}
