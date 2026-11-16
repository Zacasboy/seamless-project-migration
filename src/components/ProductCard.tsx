import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/products.functions";
import { ProductImage } from "@/components/ProductImage";
import { euro } from "@/lib/cart";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link to="/produto/$slug" params={{ slug: p.slug }} className="group block">
      <div className="aspect-[3/4] overflow-hidden">
        <ProductImage
          product={p}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-3">
        <h3 className="font-display text-xl leading-tight group-hover:underline group-hover:underline-offset-4">
          {p.title}
        </h3>
        <p className="num mt-1 text-sm text-muted-foreground">{euro(Number(p.price))}</p>
      </div>
    </Link>
  );
}
