import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { productsQuery } from "./index";
import { trackView } from "@/lib/track";

const CATS = ["Todos", "Malas", "Calçado", "Conjuntos"];
const GENDERS = ["todos", "mulher", "homem"];

export const Route = createFileRoute("/loja")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { categoria?: string | undefined; genero?: string | undefined } => ({
    categoria: typeof s["categoria"] === "string" ? s["categoria"] : undefined,
    genero: typeof s["genero"] === "string" ? s["genero"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Loja — Pallessiani" },
      { name: "description", content: "Todas as malas, calçado e conjuntos Pallessiani." },
      { property: "og:title", content: "Loja — Pallessiani" },
      { property: "og:description", content: "Todas as malas, calçado e conjuntos Pallessiani." },
    ],
  }),
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
        <h1 className="text-5xl">{categoria && categoria !== "Todos" ? categoria : "A loja"}</h1>
        <div className="mt-6 flex flex-wrap gap-6 border-b pb-4 text-sm">
          <div className="flex gap-4">
            {CATS.map((c) => (
              <Link
                key={c}
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
