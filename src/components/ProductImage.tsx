import { productImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type Props = {
  product: {
    title: string;
    image_key?: string | null;
    image_url?: string | null;
    image_alt?: string | null;
  };
  className?: string;
  loading?: "lazy" | "eager";
  alt?: string;
  sizes?: string;
};

// Imagem do produto com texto alternativo; sem imagem, mostra um bloco com o nome.
export function ProductImage({ product, className, loading = "lazy", alt, sizes }: Props) {
  const src = productImage(product);
  const text = alt ?? (product.image_alt?.trim() || product.title);
  if (src) {
    return (
      <img
        src={src}
        alt={text}
        loading={loading}
        decoding="async"
        fetchPriority={loading === "eager" ? "high" : "auto"}
        sizes={sizes ?? "(min-width: 768px) 25vw, 50vw"}
        width={600}
        height={800}
        className={className}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={text}
      className={cn(
        "flex h-full w-full items-end bg-[linear-gradient(160deg,var(--vanilla-silk),var(--alpine-oat))] p-4 text-left text-[var(--bordeaux-noir)]",
        className,
      )}
    >
      <span className="font-display text-lg leading-tight">{product.title}</span>
    </div>
  );
}
