import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/products.functions";
import { productImage } from "@/lib/images";
import { euro } from "@/lib/cart";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link to="/produto/$slug" params={{ slug: p.slug }} className="group block">
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        <img
          src={productImage(p)}
          alt={p.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{p.category}</p>
          <h3 className="font-display text-lg leading-tight">{p.title}</h3>
        </div>
        <p className="text-sm whitespace-nowrap">{euro(Number(p.price))}</p>
      </div>
    </Link>
  );
}
