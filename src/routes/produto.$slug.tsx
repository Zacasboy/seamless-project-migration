import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
import { prefersReducedMotion, storePhotos } from "@/lib/photos";
import { OutfitBoard } from "@/components/OutfitBoard";
import { outfitsQuery, type OutfitRow, approvedOutfitPhoto } from "@/lib/outfits.functions";
import { boardPieces } from "@/lib/outfits";

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
    await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      // Conjuntos são um extra: se falharem, a página do produto abre na mesma.
      context.queryClient.ensureQueryData(outfitsQuery),
    ]);
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
  const { data: outfits } = useSuspenseQuery(outfitsQuery);
  const cart = useCart();
  const nav = useNavigate();
  const [size, setSize] = useState<string | undefined>(undefined);
  const [sizeError, setSizeError] = useState(false);
  const [color, setColor] = useState<string | undefined>(undefined);
  const [colorError, setColorError] = useState(false);
  useEffect(() => {
    if (p) trackView(`/produto/${slug}`, p.id);
  }, [slug, p]);
  if (!p) return null;
  const related = all.filter((x) => x.id !== p.id && x.category !== p.category).slice(0, 4);
  const sizes = p.size_options ?? [];
  const colors = p.color_options ?? [];
  const chosenColor = colors.length === 1 ? colors[0] : color;
  const soldOut = p.stock_status === "out_of_stock";

  function add() {
    if (!p) return;
    if (colors.length > 1 && !color) {
      setColorError(true);
      document.getElementById("cor")?.focus();
      return;
    }
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
      color: chosenColor,
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
        {p.garment_type && (
          <>
            <span aria-hidden> / </span>
            <Link to="/loja" search={{ categoria: p.category, tipo: p.garment_type }} className="hover:underline">
              {p.garment_type}
            </Link>
          </>
        )}
      </nav>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 md:px-10 md:py-8 lg:grid-cols-12 lg:gap-12">
        <ProductGallery product={p} />
        <div className="h-fit lg:col-span-5">
          {p.garment_type && (
            <Link
              to="/loja"
              search={{ categoria: p.category, tipo: p.garment_type }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {p.garment_type}
            </Link>
          )}
          <h1 className="mt-1 text-3xl md:text-4xl">{p.title}</h1>
          <p className="num mt-3 text-2xl">{euro(Number(p.price))}</p>
          <p className="text-xs text-muted-foreground">IVA incluído</p>
          {STOCK_LABEL[p.stock_status] && (
            <p className={`mt-2 text-sm ${soldOut ? "text-destructive" : "text-success"}`}>
              {STOCK_LABEL[p.stock_status]}
            </p>
          )}

          {colors.length > 0 && (
            <fieldset className="mt-8" aria-describedby={colorError ? "cor-erro" : undefined}>
              <legend className="text-sm">
                Cor: <span className="font-medium">{chosenColor ?? "escolha uma cor"}</span>
              </legend>
              <div id="cor" tabIndex={-1} className="mt-2 flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={chosenColor === c}
                    onClick={() => {
                      setColor(c);
                      setColorError(false);
                    }}
                    className={`border px-3 py-2 text-sm transition-colors duration-200 ${
                      chosenColor === c ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {colorError && (
                <p id="cor-erro" role="alert" className="mt-2 text-sm text-destructive">
                  Escolha uma cor para continuar.
                </p>
              )}
            </fieldset>
          )}

          {sizes.length > 0 && (
            <fieldset className="mt-6" aria-describedby={sizeError ? "tamanho-erro" : undefined}>
              <legend className="text-sm">
                Tamanho: <span className="font-medium">{size ?? "escolha o tamanho"}</span>
              </legend>
              <div id="tamanho" tabIndex={-1} className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={size === s}
                    onClick={() => {
                      setSize(s);
                      setSizeError(false);
                    }}
                    className={`border px-2 py-2.5 text-sm transition-colors duration-200 ${
                      size === s ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
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

          <Button size="lg" className="mt-8 hidden w-full md:inline-flex" onClick={add} disabled={soldOut}>
            {soldOut ? "Esgotado" : "Adicionar ao carrinho"}
          </Button>

          <dl className="mt-10 grid grid-cols-[120px_minmax(0,1fr)] border-t text-sm">
            {[
              ["Categoria", [p.category, p.garment_type].filter(Boolean).join(" · ")],
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
          {p.description?.trim() && (
            <details className="group mt-2 border-b py-3" open>
              <summary className="cursor-pointer list-none text-sm font-medium">
                Descrição <span className="float-right transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </details>
          )}
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

      {p && <ShopTheLook productId={p.id} outfits={outfits} products={all} />}

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

/**
 * Galeria ao estilo das grandes lojas: miniaturas verticais à esquerda, limitadas à altura da
 * fotografia principal (com seta para descer), e transição suave entre fotografias. Em telemóvel,
 * as fotografias deslizam lado a lado com pontos.
 */
function ProductGallery({
  product: p,
}: {
  product: Parameters<typeof ProductImage>[0]["product"] & { gallery?: string[] | null; photo_cutouts?: unknown };
}) {
  const photos = storePhotos(p);
  // Recortes "flutuam" no fundo da loja; a fotografia com fundo ocupa a moldura toda.
  const fit = (cut: boolean) => (cut ? "object-contain p-[7%]" : "object-cover");
  const [active, setActive] = useState(0);
  const thumbs = useRef<HTMLUListElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const alt = p.image_alt?.trim() || p.title;
  const label = (i: number) => (photos.length > 1 ? `${alt} (fotografia ${i + 1} de ${photos.length})` : alt);
  const behavior = () => (prefersReducedMotion() ? "auto" : "smooth") as ScrollBehavior;

  if (photos.length === 0)
    return (
      <div className="lg:col-span-7">
        <ProductImage product={p} loading="eager" className="aspect-[4/5] max-h-[82vh] w-full" />
      </div>
    );

  return (
    <div className="lg:sticky lg:top-28 lg:col-span-7 lg:self-start">
      {/* Computador: miniaturas à esquerda + fotografia com transição cruzada */}
      <div className="hidden gap-3 md:grid md:grid-cols-[76px_minmax(0,1fr)]">
        <div className="relative">
          <ul ref={thumbs} className="no-scrollbar absolute inset-0 flex flex-col gap-2 overflow-y-auto pb-10" aria-label="Fotografias do produto">
            {photos.map(({ src: u, cutout }, i) => (
              <li key={u}>
                <button
                  type="button"
                  aria-label={`Ver fotografia ${i + 1}`}
                  aria-current={i === active}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`plate block aspect-[4/5] w-full overflow-hidden border-2 transition-colors ${
                    i === active ? "border-foreground" : "border-transparent hover:border-foreground/30"
                  }`}
                >
                  <img src={u} alt="" loading="lazy" className={`h-full w-full ${cutout ? "object-contain p-1" : "object-cover"}`} />
                </button>
              </li>
            ))}
          </ul>
          {photos.length > 5 && (
            <button
              type="button"
              aria-label="Mais fotografias"
              onClick={() => thumbs.current?.scrollBy({ top: 240, behavior: behavior() })}
              className="absolute bottom-0 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border bg-card shadow-sm"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="plate relative aspect-[4/5] max-h-[82vh] w-full overflow-hidden">
          {photos.map(({ src: u, cutout }, i) => (
            <img
              key={u}
              src={u}
              alt={i === active ? label(i) : ""}
              aria-hidden={i === active ? undefined : true}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={i === 0 ? "high" : "auto"}
              width={800}
              height={1000}
              className={`absolute inset-0 h-full w-full ${fit(cutout)} transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>
      </div>
      {/* Telemóvel: deslizar */}
      <div className="md:hidden">
        <div
          ref={strip}
          onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          className="no-scrollbar plate flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto"
        >
          {photos.map(({ src: u, cutout }, i) => (
            <img
              key={u}
              src={u}
              alt={label(i)}
              loading={i === 0 ? "eager" : "lazy"}
              className={`h-full w-full shrink-0 snap-start ${fit(cutout)}`}
            />
          ))}
        </div>
        {photos.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {photos.map(({ src: u }, i) => (
              <button
                key={u}
                type="button"
                aria-label={`Ver fotografia ${i + 1}`}
                aria-current={i === active}
                onClick={() =>
                  strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: behavior() })
                }
                className="grid h-5 w-5 place-items-center"
              >
                <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-4 bg-foreground" : "w-1.5 bg-foreground/30"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Shop the look": os conjuntos em que este artigo entra, com um ponto sobre cada peça.
 * Passar o rato (ou o 1.º toque) destaca a peça; clicar abre-a num separador novo.
 */
function ShopTheLook({
  productId,
  outfits,
  products,
}: {
  productId: string;
  outfits: OutfitRow[];
  products: Parameters<typeof boardPieces>[1];
}) {
  const looks = outfits.filter((o) => o.items.some((i) => i.product_id === productId)).slice(0, 2);
  if (!looks.length) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-14 md:px-10" aria-labelledby="stl">
      <h2 id="stl" className="mb-6 border-b border-foreground pb-3 text-2xl md:text-3xl">
        Shop the look
      </h2>
      <div className="space-y-12">
        {looks.map((o) => {
          const pieces = boardPieces(o.items, products);
          const total = pieces.reduce((t, x) => t + x.price, 0);
          return (
            <div key={o.id} className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:gap-10">
              <OutfitBoard title={o.title} background={o.background} pieces={pieces} hotspots currentProductId={productId} photo={approvedOutfitPhoto(o)} />
              <div className="md:self-center">
                <p className="text-xl">{o.title}</p>
                {o.description && <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>}
                <ul className="mt-5 divide-y border-y">
                  {pieces.map((x) => (
                    <li key={x.key}>
                      <a
                        href={`/produto/${x.slug}`}
                        target={x.productId === productId ? undefined : "_blank"}
                        rel="noopener"
                        aria-current={x.productId === productId ? "page" : undefined}
                        className="flex items-center gap-4 py-3 hover:bg-[var(--plate)]/50"
                      >
                        <span className="plate grid h-16 w-14 shrink-0 place-items-center overflow-hidden">
                          <img src={x.image} alt="" loading="lazy" className={`max-h-full max-w-full ${x.layout.cutout ? "object-contain p-1" : "h-full w-full object-cover"}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{x.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {x.productId === productId ? "Está a ver este artigo" : (x.color ?? "Abre num separador novo")}
                          </span>
                        </span>
                        <span className="num shrink-0">{euro(x.price)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Look completo</span>
                  <span className="num">{euro(total)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
