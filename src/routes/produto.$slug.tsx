import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StoreLayout } from "@/components/StoreLayout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { getProduct } from "@/lib/products.functions";
import { ProductImage } from "@/components/ProductImage";
import { productImage } from "@/lib/images";
import { euro, useCart } from "@/lib/cart";
import { seo } from "@/lib/site";
import { productsQuery } from "./index";
import { trackView } from "@/lib/track";
import { specLine } from "@/lib/spec";

const productQuery = (slug: string) =>
  queryOptions({ queryKey: ["product", slug], queryFn: () => getProduct({ data: { slug } }) });

const STOCK_LABEL: Record<string, string> = {
  in_stock: "Em stock",
  low_stock: "Últimas unidades",
  out_of_stock: "Esgotado",
};

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    await context.queryClient.ensureQueryData(productsQuery);
    return {
      title: p.meta_title || p.title,
      description: (p.meta_description || p.description || p.title).slice(0, 160),
      slug: p.slug,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return seo({
        title: "Artigo indisponível",
        description: "Artigo indisponível.",
        noindex: true,
      });
    const s = seo({
      title: loaderData.title,
      description: loaderData.description,
      path: `/produto/${loaderData.slug}`,
    });
    return { ...s, meta: [...s.meta, { property: "og:type", content: "product" }] };
  },
  notFoundComponent: () => (
    <StoreLayout>
      <div className="mx-auto max-w-xl px-6 py-32 text-center">
        <p className="eyebrow">Erro 404</p>
        <h1 className="mt-3 text-4xl">Este artigo já não está disponível</h1>
        <p className="mt-3 text-muted-foreground">Pode ter esgotado ou mudado de nome.</p>
        <Button asChild className="mt-8">
          <Link to="/loja">Ver a loja</Link>
        </Button>
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
  const nav = useNavigate();
  const [size, setSize] = useState<string | undefined>(undefined);
  const [sizeError, setSizeError] = useState(false);
  useEffect(() => {
    if (p) trackView(`/produto/${slug}`, p.id);
  }, [slug, p]);
  if (!p) return null;
  const related = all.filter((x) => x.id !== p.id && x.category !== p.category).slice(0, 4);
  const sizes = p.size_options ?? [];
  const soldOut = p.stock_status === "out_of_stock";

  function add() {
    if (!p) return;
    if (sizes.length > 0 && !size) {
      setSizeError(true);
      document.getElementById("tamanho")?.focus();
      return;
    }
    cart.add({
      id: p.id,
      slug: p.slug,
      title: p.title,
      price: Number(p.price),
      image: productImage(p),
      size,
    });
    toast.success("Adicionado ao carrinho", {
      action: { label: "Ver carrinho", onClick: () => void nav({ to: "/carrinho" }) },
    });
  }

  return (
    <StoreLayout className="pb-sticky md:pb-0">
      <nav
        aria-label="Caminho"
        className="num mx-auto max-w-[1440px] px-4 pt-6 text-xs text-muted-foreground md:px-10"
      >
        <Link to="/loja" className="hover:underline">
          Loja
        </Link>
        <span aria-hidden> / </span>
        <Link to="/loja" search={{ categoria: p.category }} className="hover:underline">
          {p.category}
        </Link>
      </nav>
      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 md:grid-cols-12 md:gap-10 md:px-10 md:py-8">
        <ProductGallery product={p} />
        <div className="product-card h-fit p-6 !text-left md:col-span-6 md:p-10 lg:col-span-6 lg:col-start-7">
          <p className="num flex justify-between gap-4 text-xs text-muted-foreground">
            <span>{p.category}</span>
            <span className="uppercase">Ref. {p.slug}</span>
          </p>
          <h1 className="mt-4 text-3xl md:text-4xl">{p.title}</h1>
          <p className="spec mt-2">{specLine(p)}</p>
          <p className="num mt-4 text-2xl">{euro(Number(p.price))}</p>
          {STOCK_LABEL[p.stock_status] && (
            <p className={`mt-2 text-sm ${soldOut ? "text-destructive" : "text-success"}`}>
              {STOCK_LABEL[p.stock_status]}
            </p>
          )}
          <p className="mt-6 whitespace-pre-line leading-relaxed text-muted-foreground">{p.description}</p>
          <dl className="mt-6 grid grid-cols-[120px_minmax(0,1fr)] border-t text-sm">
            {[
              ["Categoria", p.category],
              ["Para", p.gender === "homem" ? "Homem" : p.gender === "mulher" ? "Mulher" : "Todos"],
              ["Disponibilidade", STOCK_LABEL[p.stock_status] ?? "Confirmada após a encomenda"],
              ["Entrega", "Portugal e União Europeia"],
              ["Devolução", "14 dias após a receção"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="border-b py-3 text-muted-foreground">{k}</dt>
                <dd className="border-b py-3">{v}</dd>
              </div>
            ))}
          </dl>

          {sizes.length > 0 && (
            <fieldset className="mt-8" aria-describedby={sizeError ? "tamanho-erro" : undefined}>
              <legend className="text-sm font-medium">Tamanho</legend>
              <div id="tamanho" tabIndex={-1} className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={size === s}
                    onClick={() => {
                      setSize(s);
                      setSizeError(false);
                    }}
                    className={`min-w-12 border px-3 py-2 text-sm transition-colors ${
                      size === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sizeError && (
                <p id="tamanho-erro" role="alert" className="mt-2 text-sm text-destructive">
                  Escolha um tamanho para continuar.
                </p>
              )}
            </fieldset>
          )}

          <Button
            size="lg"
            className="mt-8 hidden w-full md:inline-flex md:w-auto"
            onClick={add}
            disabled={soldOut}
          >
            {soldOut ? "Esgotado" : "Adicionar ao carrinho"}
          </Button>
        </div>
      </div>

      {/* Barra de compra fixa em telemóvel */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{p.title}</p>
            <p className="num text-lg">{euro(Number(p.price))}</p>
          </div>
          <Button size="lg" onClick={add} disabled={soldOut}>
            {soldOut ? "Esgotado" : "Adicionar"}
          </Button>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-12 md:px-10">
          <h2 className="mb-6 border-b border-foreground pb-3 text-2xl md:text-3xl">
            Completa o look
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </StoreLayout>
  );
}

/** Fotografia principal com tamanho contido (sem cortar a peça) e miniaturas das restantes. */
function ProductGallery({
  product: p,
}: {
  product: Parameters<typeof ProductImage>[0]["product"] & { gallery?: string[] | null };
}) {
  const main = productImage(p);
  const photos = (p.gallery?.length ? p.gallery : main ? [main] : []).filter((u) => /^https:\/\//.test(u));
  const [active, setActive] = useState(0);
  const src = photos[Math.min(active, photos.length - 1)];
  const alt = p.image_alt?.trim() || p.title;
  return (
    <div className="md:sticky md:top-6 md:col-span-6 md:self-start lg:col-span-5">
      {src ? (
        <div className="plate flex aspect-square max-h-[68vh] w-full items-center justify-center overflow-hidden">
          <img
            src={src}
            alt={photos.length > 1 ? `${alt} (fotografia ${active + 1} de ${photos.length})` : alt}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            width={800}
            height={800}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <ProductImage product={p} loading="eager" className="aspect-square max-h-[68vh] w-full" />
      )}
      {photos.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Fotografias do produto">
          {photos.map((u, i) => (
            <li key={u} className="shrink-0">
              <button
                type="button"
                aria-label={`Ver fotografia ${i + 1}`}
                aria-current={i === active}
                onClick={() => setActive(i)}
                className={`block h-16 w-16 overflow-hidden border md:h-20 md:w-20 ${
                  i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
