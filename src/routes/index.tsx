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

function Home() {
  const { data } = useSuspenseQuery(productsQuery);
  useEffect(() => trackView("/"), []);
  const bags = data.filter((p) => p.category === "Malas").slice(0, 4);
  const looks = data.filter((p) => p.category === "Conjuntos").slice(0, 4);
  return (
    <StoreLayout>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:pb-24 md:pt-16">
        <div className="fade-up">
          <p className="eyebrow">Coleção outono 2026</p>
          <h1 className="mt-5 text-[clamp(3rem,6.4vw,5.75rem)] leading-[0.98] tracking-[-0.02em]">
            Elegância que não passa de moda.
          </h1>
          <p className="mt-7 max-w-[34ch] text-lg leading-relaxed text-muted-foreground">
            Malas em pele, mocassins clássicos e conjuntos completos, escolhidos para durar.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/loja">Ver a loja</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/loja" search={{ categoria: "Conjuntos" }}>
                Ver conjuntos
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[560px] pb-16 sm:pb-24">
          {bags[0] && (
            <Link
              to="/produto/$slug"
              params={{ slug: bags[0].slug }}
              className="block w-[72%] shadow-[0_30px_60px_-30px_rgb(49_24_28/0.35)]"
            >
              <ProductImage
                product={bags[0]}
                loading="eager"
                caption
                sizes="(min-width: 768px) 30vw, 70vw"
                className="aspect-[3/4] w-full object-cover"
              />
            </Link>
          )}
          {looks[0] && (
            <Link
              to="/produto/$slug"
              params={{ slug: looks[0].slug }}
              className="absolute bottom-0 right-0 block w-[48%] border-[6px] border-background shadow-[0_30px_60px_-30px_rgb(49_24_28/0.4)]"
            >
              <ProductImage
                product={looks[0]}
                loading="eager"
                caption
                sizes="(min-width: 768px) 20vw, 48vw"
                className="aspect-[3/4] w-full object-cover"
              />
            </Link>
          )}
        </div>
      </section>

      <Section title="Malas" items={bags} cat="Malas" />
      <Section title="Conjuntos completos" items={looks} cat="Conjuntos" />
    </StoreLayout>
  );
}

function Section({ title, items, cat }: { title: string; items: Product[]; cat: string }) {
  return (
    <section className="mx-auto max-w-7xl border-t px-6 py-14">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 className="text-4xl md:text-5xl">{title}</h2>
        <Link
          to="/loja"
          search={{ categoria: cat }}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Ver todas
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
