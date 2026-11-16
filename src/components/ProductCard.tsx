import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/products.functions";
import { ProductImage } from "@/components/ProductImage";
import { euro } from "@/lib/cart";
import { specLine } from "@/lib/spec";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      to="/produto/$slug"
      params={{ slug: p.slug }}
      className="product-card group flex flex-col transition-colors hover:border-foreground/40"
    >
      <div className="aspect-[4/5] overflow-hidden">
        <ProductImage
          product={p}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-sans text-[15px] font-medium leading-snug [text-wrap:pretty] group-hover:underline group-hover:underline-offset-4">
          {p.title}
        </h3>
        <p className="spec line-clamp-1">{specLine(p)}</p>
        <p className="num mt-auto pt-2 text-sm">{euro(Number(p.price))}</p>
      </div>
    </Link>
  );
}
