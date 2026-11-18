import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { Product } from "@/lib/products.functions";
import { ProductImage } from "@/components/ProductImage";
import { euro } from "@/lib/cart";
import { prefersReducedMotion, storePhotos } from "@/lib/photos";

// Cartão de produto em formato de banner: as fotografias deslizam lado a lado (toque, setas ou
// pontos) e, ao passar o rato, a linha de detalhe dá lugar aos tamanhos disponíveis.
export function ProductCard({ p, eager }: { p: Product; eager?: boolean }) {
  const photos = storePhotos(p);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const next = (n + photos.length) % photos.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };
  const sizes = p.size_options ?? [];
  const colors = p.color_options ?? [];
  const detail = [p.garment_type, colors.length > 1 ? `${colors.length} cores` : colors[0]].filter(Boolean).join(" · ");
  const label = `${p.title}, ${euro(Number(p.price))}`;

  return (
    <article className="group">
      <div className="plate relative overflow-hidden">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {photos.length === 0 ? (
            <Link to="/produto/$slug" params={{ slug: p.slug }} className="block h-full w-full shrink-0" aria-label={label}>
              <ProductImage product={p} className="h-full w-full" />
            </Link>
          ) : (
            photos.map(({ src, cutout }, k) => (
              <Link
                key={src}
                to="/produto/$slug"
                params={{ slug: p.slug }}
                className="block h-full w-full shrink-0 snap-start"
                tabIndex={k === 0 ? 0 : -1}
                aria-label={k === 0 ? label : undefined}
                aria-hidden={k === 0 ? undefined : true}
              >
                <img
                  src={src}
                  alt={k === 0 ? p.image_alt?.trim() || p.title : ""}
                  loading={eager && k === 0 ? "eager" : "lazy"}
                  decoding="async"
                  width={600}
                  height={750}
                  className={`h-full w-full ${cutout ? "object-contain p-[9%]" : "object-cover"}`}
                />
              </Link>
            ))
          )}
        </div>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label={`Fotografia anterior de ${p.title}`}
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 bg-card/85 p-1.5 opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 md:block"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Fotografia seguinte de ${p.title}`}
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 bg-card/85 p-1.5 opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 md:block"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" role="group" aria-label={`Fotografias de ${p.title}`}>
          {photos.slice(0, 8).map(({ src }, k) => (
            <button
              key={src}
              type="button"
              aria-label={`Ver fotografia ${k + 1} de ${photos.length}`}
              aria-current={k === index}
              onClick={() => go(k)}
              className="grid h-4 w-4 place-items-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${k === index ? "w-4 bg-foreground" : "w-1.5 bg-foreground/30"}`}
              />
            </button>
          ))}
        </div>
      )}
      <Link to="/produto/$slug" params={{ slug: p.slug }} tabIndex={-1} className="mt-2 block">
        <h3 className="font-sans text-[13px] font-medium uppercase leading-snug tracking-[0.08em] [text-wrap:pretty]">
          {p.title}
        </h3>
        <p className="num mt-1 text-sm">{euro(Number(p.price))}</p>
        {/* Linha de detalhe; ao passar o rato, os tamanhos (sem mudar a altura do cartão). */}
        <div className="relative mt-1 h-5 overflow-hidden text-xs text-muted-foreground">
          <p className={`spec absolute inset-0 truncate transition-all duration-300 ${sizes.length ? "group-hover:-translate-y-full group-hover:opacity-0" : ""}`}>
            {detail || p.category}
          </p>
          {sizes.length > 0 && (
            <p className="num absolute inset-0 translate-y-full truncate opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              {sizes.join("  ")}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
