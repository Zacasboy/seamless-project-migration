import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { listProducts } from "@/lib/products.functions";
import { heroImage, heroImage2 } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { trackView } from "@/lib/track";

export const productsQuery = queryOptions({ queryKey: ["products"], queryFn: () => listProducts() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pallessiani — Malas, calçado e conjuntos" },
      { name: "description", content: "Descubra malas, mocassins e conjuntos completos com estilo intemporal." },
      { property: "og:title", content: "Pallessiani — Moda intemporal" },
      { property: "og:description", content: "Malas, mocassins e conjuntos completos com estilo intemporal." },
    ],
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
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-2 md:py-20">
        <div className="flex flex-col justify-center fade-up">
          <p className="eyebrow">Coleção Outono · 2026</p>
          <h1 className="mt-4 text-5xl leading-[1.05] md:text-7xl">Elegância que<br />não passa de moda.</h1>
          <p className="mt-6 max-w-md text-muted-foreground">
            Malas em pele, mocassins clássicos e conjuntos completos, escolhidos para durar.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/loja">Ver a loja</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/loja" search={{ categoria: "Conjuntos" }}>Conjuntos</Link></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <img src={heroImage()} alt="Mala castanha com acessórios dourados" className="aspect-[3/4] w-full object-cover" />
          <img src={heroImage2()} alt="Look de inverno com blusão castanho" className="mt-12 aspect-[3/4] w-full object-cover" />
        </div>
      </section>

      <Section title="Malas" eyebrow="Acessórios" items={bags} cat="Malas" />
      <Section title="Conjuntos completos" eyebrow="Looks" items={looks} cat="Conjuntos" />
    </StoreLayout>
  );
}

function Section({ title, eyebrow, items, cat }: { title: string; eyebrow: string; items: ReturnType<typeof useSuspenseQuery<typeof productsQuery>>["data"]; cat: string }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="text-4xl">{title}</h2>
        </div>
        <Link to="/loja" search={{ categoria: cat }} className="text-sm underline underline-offset-4">Ver tudo</Link>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {items.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}
