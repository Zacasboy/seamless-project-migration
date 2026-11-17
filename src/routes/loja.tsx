import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { productsQuery } from "./index";
import { trackView } from "@/lib/track";
import { seo } from "@/lib/site";
import { CATEGORIES, subsOf } from "@/lib/taxonomy";

const GENDERS = ["todos", "mulher", "homem"];

type Search = { categoria?: string | undefined; tipo?: string | undefined; genero?: string | undefined };

export const Route = createFileRoute("/loja")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["categoria"] === "string" ? { categoria: s["categoria"] } : {}),
    ...(typeof s["tipo"] === "string" ? { tipo: s["tipo"] } : {}),
    ...(typeof s["genero"] === "string" ? { genero: s["genero"] } : {}),
  }),
  head: ({ match }) => {
    const { categoria: cat, tipo } = match.search;
    const c = CATEGORIES.find((x) => x.name === cat);
    const title = c ? (tipo && subsOf(c.name).includes(tipo) ? `${tipo} · ${c.name}` : c.name) : "Loja";
    return seo({
      title,
      description: c ? `${c.name} Pallessiani: ${c.line.toLowerCase()}.` : "Todo o calçado, roupa, malas e acessórios Pallessiani, num só lugar.",
      path: c ? `/loja?categoria=${encodeURIComponent(c.name)}${tipo ? `&tipo=${encodeURIComponent(tipo)}` : ""}` : "/loja",
    });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Shop,
});

function Shop() {
  const { data } = useSuspenseQuery(productsQuery);
  const { categoria, tipo, genero } = Route.useSearch();
  useEffect(() => trackView("/loja"), []);
  const byGender = data.filter((p) => !genero || genero === "todos" || p.gender === genero);
  const list = byGender.filter(
    (p) => (!categoria || p.category === categoria) && (!tipo || p.garment_type === tipo),
  );
  // Só mostra categorias e subcategorias com artigos.
  const cats = CATEGORIES.filter((c) => byGender.some((p) => p.category === c.name));
  const subs = categoria
    ? subsOf(categoria).filter((s) => byGender.some((p) => p.category === categoria && p.garment_type === s))
    : [];
  const tab = (active: boolean) =>
    `whitespace-nowrap pb-2 transition-colors ${active ? "border-b border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <StoreLayout>
      <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-10">
        <h1 className="sr-only">{tipo ?? categoria ?? "A loja"}</h1>
        {/* Categorias em linha, com deslizamento horizontal em ecrãs pequenos */}
        <nav aria-label="Categorias" className="nav-link -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-8">
            <li>
              <Link to="/loja" search={{ genero }} aria-current={!categoria ? "page" : undefined} className={tab(!categoria)}>
                Tudo
              </Link>
            </li>
            {cats.map((c) => (
              <li key={c.name}>
                <Link
                  to="/loja"
                  search={{ categoria: c.name, genero }}
                  aria-current={categoria === c.name && !tipo ? "page" : undefined}
                  className={tab(categoria === c.name)}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {subs.length > 0 && (
          <nav aria-label={`Tipos de ${categoria}`} className="mt-4 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <ul className="flex gap-2">
              {[undefined, ...subs].map((s) => (
                <li key={s ?? "todos"}>
                  <Link
                    to="/loja"
                    search={{ categoria, tipo: s, genero }}
                    aria-current={tipo === s ? "page" : undefined}
                    className={`block whitespace-nowrap border px-3 py-1.5 text-sm transition-colors ${
                      tipo === s ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                    }`}
                  >
                    {s ?? `Todos os ${categoria === "Calçado" ? "sapatos" : "artigos"}`}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="mt-6 flex items-center justify-between gap-4 border-b pb-3 text-sm">
          <p className="num text-xs text-muted-foreground">{list.length} artigos</p>
          <div className="nav-link flex gap-5">
            {GENDERS.map((g) => (
              <Link
                key={g}
                to="/loja"
                search={{ categoria, tipo, genero: g === "todos" ? undefined : g }}
                className={`capitalize ${(genero ?? "todos") === g ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {g}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {list.map((p, i) => (
            <ProductCard key={p.id} p={p} eager={i < 4} />
          ))}
        </div>
        {list.length === 0 && (
          <p className="py-20 text-center text-muted-foreground">Nenhum artigo nesta seleção.</p>
        )}
      </div>
    </StoreLayout>
  );
}
