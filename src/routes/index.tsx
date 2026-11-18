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
        "Calçado, malhas, casacos, calças, malas e acessórios de estilo intemporal. Envio para Portugal e União Europeia.",
      path: "/",
    }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      // Sem conjuntos (ou erro a lê-los), a página inicial mostra a secção antiga.
      context.queryClient.ensureQueryData(outfitsQuery).catch(() => context.queryClient.setQueryData(outfitsQuery.queryKey, [])),
    ]);
  },
  component: Home,
});

import { CATEGORIES } from "@/lib/taxonomy";
import { OutfitBoard } from "@/components/OutfitBoard";
import { boardPieces } from "@/lib/outfits";
import { outfitsQuery, approvedOutfitPhoto } from "@/lib/outfits.functions";

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
  const looks = byCat("Coordenados");
  const { data: outfits } = useSuspenseQuery(outfitsQuery);
  const boards = outfits
    .map((o) => ({ ...o, pieces: boardPieces(o.items, data) }))
    .filter((o) => o.pieces.length >= 2)
    .slice(0, 3);
  // Categorias com artigos (as reais primeiro), até seis mosaicos.
  const CATS = CATEGORIES.map((c) => ({ cat: c.name, line: c.line }))
    .filter(({ cat }) => byCat(cat).length > 0)
    .sort((a, b) => Number(a.cat === "Coordenados") - Number(b.cat === "Coordenados"))
    .slice(0, 6);
  return (
    <StoreLayout>
      <Banner />

      <section className="mx-auto max-w-[1440px] px-4 pt-14 md:px-10 md:pt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-foreground pb-3">
          <h2 className="text-2xl md:text-3xl">Comprar por categoria</h2>
          <p className="num text-xs text-muted-foreground">{data.length} artigos em catálogo</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
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
      {boards.length > 0 ? (
        <section className="mx-auto max-w-[1440px] px-4 pt-14 md:px-10 md:pt-20">
          <div className="flex items-baseline justify-between gap-4 border-b border-foreground pb-3">
            <h2 className="text-2xl md:text-3xl">Conjuntos completos</h2>
            <Link to="/conjuntos" className="text-sm underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {boards.map((b) => (
              <div key={b.id}>
                <OutfitBoard title={b.title} background={b.background} pieces={b.pieces} photo={approvedOutfitPhoto(b)} hotspots={!!approvedOutfitPhoto(b)} />
                <Link to="/conjuntos" hash={b.slug} className="mt-3 block text-lg hover:underline">
                  {b.title}
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <Section title="Coordenados" items={looks} link={{ categoria: "Coordenados" }} />
      )}

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

// Banner de campanha entre o cabeçalho e os produtos.
// A fotografia vem de VITE_CAMPAIGN_IMAGE_URL (https); sem ela mostra a superfície do tema.
const CAMPAIGN_IMAGE = (import.meta.env["VITE_CAMPAIGN_IMAGE_URL"] as string | undefined)?.trim();

function Banner() {
  const img = CAMPAIGN_IMAGE?.startsWith("https://") ? CAMPAIGN_IMAGE : "";
  return (
    <section aria-labelledby="banner-titulo" className="border-b">
      <div className="mx-auto grid max-w-[1440px] md:grid-cols-12">
        <div className="flex flex-col justify-between gap-10 bg-foreground px-6 py-10 text-background md:col-span-5 md:px-10 md:py-14">
          <p className="num text-xs uppercase tracking-wide opacity-70">Coleção outono 2026</p>
          <div>
            <h1
              id="banner-titulo"
              className="max-w-[16ch] text-[clamp(2.4rem,4.6vw,4rem)] leading-[1.02]"
            >
              Calçado, malhas e acessórios para durar.
            </h1>
            <p className="mt-5 max-w-[42ch] leading-relaxed opacity-80">
              Pele, camurça e malha escolhidas para os meses frios, com envio para Portugal e para a
              União Europeia.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/loja"
              className="inline-flex h-12 items-center bg-background px-7 text-[0.9375rem] tracking-[0.02em] text-foreground hover:bg-background/90"
            >
              Ver a coleção
            </Link>
            <Link
              to="/loja"
              search={{ categoria: "Calçado" }}
              className="inline-flex h-12 items-center border border-background/60 px-7 text-[0.9375rem] tracking-[0.02em] hover:bg-background/10"
            >
              Ver calçado
            </Link>
          </div>
        </div>
        <div className="relative min-h-[280px] md:col-span-7 md:min-h-[520px]">
          {img ? (
            <img
              src={img}
              alt="Campanha Pallessiani outono 2026"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="plate absolute inset-0 flex items-end p-5">
              <span className="num text-[11px] uppercase tracking-wide">
                Fotografia de campanha em breve
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
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
