import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { listProducts, type Product } from "@/lib/products.functions";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { trackView } from "@/lib/track";
import { seo } from "@/lib/site";
import { euro } from "@/lib/cart";
import { specLine } from "@/lib/spec";

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

const GENDER: Record<string, string> = { mulher: "Mulher", homem: "Homem", unissexo: "Unissexo" };

function Home() {
  const { data } = useSuspenseQuery(productsQuery);
  useEffect(() => trackView("/"), []);
  const bags = data.filter((p) => p.category === "Malas");
  const shoes = data.filter((p) => p.category === "Calçado");
  const looks = data.filter((p) => p.category === "Conjuntos");
  const hero = [...bags].sort((a, b) => Number(b.price) - Number(a.price))[0] ?? data[0];
  return (
    <StoreLayout>
      {hero && <Hero p={hero} />}
      <Section title="Malas" items={bags} cat="Malas" />
      <Section title="Calçado" items={shoes} cat="Calçado" />
      <Section title="Conjuntos" items={looks} cat="Conjuntos" />
    </StoreLayout>
  );
}

function Hero({ p }: { p: Product }) {
  const rows: [string, string][] = [
    ["Material", specLine(p)],
    ["Categoria", p.category],
    ["Para", GENDER[p.gender ?? ""] ?? "—"],
    ["Entrega", "Portugal e União Europeia"],
  ];
  return (
    <section className="mx-auto grid max-w-[1440px] gap-6 px-4 pt-6 md:grid-cols-12 md:px-10 md:pt-10">
      <Link
        to="/produto/$slug"
        params={{ slug: p.slug }}
        className="block md:col-span-7"
        aria-label={`Ver ${p.title}`}
      >
        <ProductImage
          product={p}
          loading="eager"
          sizes="(min-width: 768px) 58vw, 100vw"
          className="aspect-[4/5] w-full object-cover md:aspect-auto md:h-[640px]"
        />
      </Link>
      <div className="product-card flex flex-col gap-7 p-6 !text-left md:col-span-5 md:p-10">
        <div className="num flex justify-between gap-4 text-xs text-muted-foreground">
          <span>
            {p.category} / {GENDER[p.gender ?? ""] ?? "Todos"}
          </span>
          <span className="uppercase">Ref. {p.slug}</span>
        </div>
        <div>
          <p className="spec">Coleção outono 2026</p>
          <h1 className="mt-3 text-[clamp(2.25rem,3.6vw,3rem)] leading-[1.06]">{p.title}</h1>
          {p.description && (
            <p className="mt-4 max-w-[44ch] leading-relaxed text-muted-foreground">
              {p.description}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] border-t text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="border-b py-3 text-muted-foreground">{k}</dt>
              <dd className="border-b py-3">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
          <span className="num text-2xl">{euro(Number(p.price))}</span>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="outline">
              <Link to="/loja">Ver a loja</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/produto/$slug" params={{ slug: p.slug }}>
                Ver artigo
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({ title, items, cat }: { title: string; items: Product[]; cat: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-20 md:px-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-foreground pb-3">
        <h2 className="text-2xl md:text-3xl">{title}</h2>
        <Link
          to="/loja"
          search={{ categoria: cat }}
          className="num text-xs text-muted-foreground hover:text-foreground"
        >
          {items.length} artigos — ver todos
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {items.slice(0, 4).map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
