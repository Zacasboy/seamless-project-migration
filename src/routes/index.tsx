import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { listProducts, type Product } from "@/lib/products.functions";
import { ProductImage } from "@/components/ProductImage";
import { trackView } from "@/lib/track";
import { seo } from "@/lib/site";
import { euro } from "@/lib/cart";

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: () => listProducts(),
});

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      description:
        "Malas em pele, mocassins clássicos e conjuntos completos com estilo intemporal. Envio para Portugal e União Europeia.",
      path: "/",
    }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Home,
});

const CATS = [
  { cat: "Malas", line: "Pele lisa, granulada e envernizada" },
  { cat: "Calçado", line: "Mocassins para mulher e homem" },
  { cat: "Conjuntos", line: "Looks completos, prontos a vestir" },
] as const;

const SERVICE: [string, string][] = [
  ["Entrega", "Portugal e União Europeia"],
  ["Devolução", "14 dias após a receção"],
  ["Pagamento", "Combinado consigo depois de confirmarmos a encomenda"],
];

function Home() {
  const { data } = useSuspenseQuery(productsQuery);
  useEffect(() => trackView("/"), []);
  const byCat = (c: string) => data.filter((p) => p.category === c);
  const latest = [...data]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 8);
  const looks = byCat("Conjuntos");
  return (
    <StoreLayout>
      <section className="mx-auto max-w-[1440px] px-4 pt-8 md:px-10 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-foreground pb-5">
          <div>
            <p className="spec">Coleção outono 2026</p>
            <h1 className="mt-2 max-w-[18ch] text-[clamp(2.4rem,5vw,4.25rem)] leading-[1.02]">
              Malas, calçado e conjuntos para durar.
            </h1>
          </div>
          <p className="num text-xs text-muted-foreground">{data.length} artigos em catálogo</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3 md:gap-6">
          {CATS.map(({ cat, line }) => {
            const items = byCat(cat);
            const lead = items[0];
            const from = items.length ? Math.min(...items.map((p) => Number(p.price))) : 0;
            return (
              <Link
                key={cat}
                to="/loja"
                search={{ categoria: cat }}
                className="product-card group flex flex-col !text-left"
              >
                <div className="aspect-[4/5] overflow-hidden md:aspect-[3/4]">
                  {lead ? (
                    <ProductImage
                      product={lead}
                      loading="eager"
                      alt={`${cat}: ${lead.title}`}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="plate h-full w-full" />
                  )}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 p-4 md:p-5">
                  <h2 className="text-2xl group-hover:underline group-hover:underline-offset-4">
                    {cat}
                  </h2>
                  <span className="num text-xs text-muted-foreground">{items.length} artigos</span>
                  <p className="spec">{line}</p>
                  {items.length > 0 && <span className="num text-xs">desde {euro(from)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Section title="Novidades" items={latest} link={{}} />
      <Section title="Conjuntos completos" items={looks} link={{ categoria: "Conjuntos" }} />

      <section className="mx-auto max-w-[1440px] px-4 pt-20 md:px-10">
        <dl className="grid border-y border-foreground md:grid-cols-3">
          {SERVICE.map(([k, v]) => (
            <div
              key={k}
              className="border-b py-5 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
            >
              <dt className="spec">{k}</dt>
              <dd className="mt-1 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </StoreLayout>
  );
}

function Section({
  title,
  items,
  link,
}: {
  title: string;
  items: Product[];
  link: { categoria?: string };
}) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-20 md:px-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-foreground pb-3">
        <h2 className="text-2xl md:text-3xl">{title}</h2>
        <Link
          to="/loja"
          search={link}
          className="num text-xs text-muted-foreground hover:text-foreground"
        >
          Ver todos
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {items.slice(0, 8).map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
