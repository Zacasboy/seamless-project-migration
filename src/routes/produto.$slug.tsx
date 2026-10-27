import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { getProduct } from "@/lib/products.functions";
import { productImage } from "@/lib/images";
import { euro, useCart } from "@/lib/cart";
import { productsQuery } from "./index";
import { trackView } from "@/lib/track";

const productQuery = (slug: string) =>
  queryOptions({ queryKey: ["product", slug], queryFn: () => getProduct({ data: { slug } }) });

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    await context.queryClient.ensureQueryData(productsQuery);
    return { title: p.meta_title ?? p.title, description: p.meta_description ?? p.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.title },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.description },
          { property: "og:type", content: "product" },
        ]
      : [{ title: "Artigo indisponível — Pallessiani" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <StoreLayout>
      <div className="py-32 text-center">
        <h1 className="text-4xl">Artigo não encontrado</h1>
        <Link to="/loja" className="mt-4 inline-block underline">
          Voltar à loja
        </Link>
      </div>
    </StoreLayout>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { data: all } = useSuspenseQuery(productsQuery);
  const cart = useCart();
  useEffect(() => {
    if (p) trackView(`/produto/${slug}`, p.id);
  }, [slug, p]);
  if (!p) return null;
  const img = productImage(p);
  const related = all.filter((x) => x.id !== p.id && x.category !== p.category).slice(0, 4);
  return (
    <StoreLayout>
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2">
        <img src={img} alt={p.title} className="aspect-[3/4] w-full object-cover" />
        <div className="md:py-12">
          <p className="eyebrow">
            {p.category} · {p.gender}
          </p>
          <h1 className="mt-3 text-5xl">{p.title}</h1>
          <p className="mt-4 text-2xl">{euro(Number(p.price))}</p>
          <p className="mt-6 text-muted-foreground leading-relaxed">{p.description}</p>
          <Button
            size="lg"
            className="mt-8 w-full md:w-auto"
            onClick={() => {
              cart.add({
                id: p.id,
                slug: p.slug,
                title: p.title,
                price: Number(p.price),
                image: img ?? "",
              });
              toast.success("Adicionado ao carrinho");
            }}
          >
            Adicionar ao carrinho
          </Button>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-16">
          <h2 className="mb-6 text-3xl">Completa o look</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </StoreLayout>
  );
}