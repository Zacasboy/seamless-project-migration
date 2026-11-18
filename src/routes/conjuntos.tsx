import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { OutfitBoard } from "@/components/OutfitBoard";
import { euro } from "@/lib/cart";
import { outfitsQuery, approvedOutfitPhoto } from "@/lib/outfits.functions";
import { boardPieces } from "@/lib/outfits";
import { seo } from "@/lib/site";
import { trackView } from "@/lib/track";
import { productsQuery } from "./index";

export const Route = createFileRoute("/conjuntos")({
  head: () =>
    seo({
      title: "Conjuntos",
      description: "Conjuntos Pallessiani escolhidos peça a peça, prontos a vestir. Passe o rato por cada peça para a ver.",
      path: "/conjuntos",
    }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(outfitsQuery),
      context.queryClient.ensureQueryData(productsQuery),
    ]);
  },
  component: Outfits,
});

function Outfits() {
  const { data: outfits } = useSuspenseQuery(outfitsQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  useEffect(() => trackView("/conjuntos"), []);
  return (
    <StoreLayout>
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-10">
        <h1 className="text-3xl md:text-4xl">Conjuntos</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Peças do nosso catálogo, escolhidas para usar juntas. Passe o rato (ou toque) numa peça para a ver; clique para
          abrir o artigo.
        </p>
        {outfits.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">Os primeiros conjuntos estão a ser preparados.</p>
        ) : (
          <div className="mt-8 grid gap-x-6 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
            {outfits.map((o, i) => {
              const pieces = boardPieces(o.items, products);
              if (pieces.length < 2) return null;
              const total = pieces.reduce((t, p) => t + p.price, 0);
              return (
                <article key={o.id} id={o.slug} className="scroll-mt-28">
                  <OutfitBoard title={o.title} background={o.background} pieces={pieces} eager={i < 2} photo={approvedOutfitPhoto(o)} hotspots={!!approvedOutfitPhoto(o)} />
                  <div className="mt-3 flex items-baseline justify-between gap-4">
                    <h2 className="text-lg">{o.title}</h2>
                    <p className="num text-sm">{euro(total)}</p>
                  </div>
                  {o.description && <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>}
                  <ul className="mt-3 divide-y border-y text-sm">
                    {pieces.map((p) => (
                      <li key={p.key}>
                        <Link
                          to="/produto/$slug"
                          params={{ slug: p.slug }}
                          target="_blank"
                          className="flex items-baseline justify-between gap-3 py-2 hover:underline"
                        >
                          <span className="min-w-0 truncate">
                            {p.title}
                            {p.color && <span className="text-muted-foreground"> · {p.color}</span>}
                          </span>
                          <span className="num shrink-0">{euro(p.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
