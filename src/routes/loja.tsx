import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { productsQuery } from "./index";
import { trackView } from "@/lib/track";
import { seo } from "@/lib/site";

const CATS = ["Todos", "Malas", "Calçado", "Conjuntos"];
const GENDERS = ["todos", "mulher", "homem"];

export const Route = createFileRoute("/loja")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { categoria?: string | undefined; genero?: string | undefined } => ({
    ...(typeof s["categoria"] === "string" ? { categoria: s["categoria"] } : {}),
    ...(typeof s["genero"] === "string" ? { genero: s["genero"] } : {}),
  }),
  head: ({ match }) => {
    const cat = match.search.categoria;
    const desc: Record<string, string> = {
      Malas: "Malas Pallessiani em pele, de estilo intemporal.",
      Calçado: "Calçado Pallessiani: mocassins clássicos para mulher e homem.",
      Conjuntos: "Conjuntos completos Pallessiani, escolhidos para durar.",
    };
    return seo({
      title: cat && desc[cat] ? cat : "Loja",
      description:
        (cat && desc[cat]) || "Todas as malas, calçado e conjuntos Pallessiani, num só lugar.",
      path: cat && desc[cat] ? `/loja?categoria=${encodeURIComponent(cat)}` : "/loja",
    });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Shop,
});

function Shop() {
  const { data } = useSuspenseQuery(productsQuery);
  const { categoria, genero } = Route.useSearch();
  useEffect(() => trackView("/loja"), []);
  const list = data.filter(
    (p) =>
      (!categoria || categoria === "Todos" || p.category === categoria) &&
      (!genero || genero === "todos" || p.gender === genero),
  );
  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="text-4xl md:text-5xl">
          {categoria && categoria !== "Todos" ? categoria : "A loja"}
        </h1>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-b pb-4 text-sm">
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1">
            {CATS.map((c) => (
              <Link
                key={c}
                aria-current={(categoria ?? "Todos") === c ? "page" : undefined}
                to="/loja"
                search={{ categoria: c === "Todos" ? undefined : c, genero }}
                className={
                  (categoria ?? "Todos") === c
                    ? "text-gold"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {c}
              </Link>
            ))}
          </div>
          <div className="flex gap-4 md:ml-auto">
            {GENDERS.map((g) => (
              <Link
                key={g}
                to="/loja"
                search={{ categoria, genero: g === "todos" ? undefined : g }}
                className={`capitalize ${(genero ?? "todos") === g ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {g}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
        {list.length === 0 && (
          <p className="py-20 text-center text-muted-foreground">Nenhum artigo nesta seleção.</p>
        )}
      </div>
    </StoreLayout>
  );
}
