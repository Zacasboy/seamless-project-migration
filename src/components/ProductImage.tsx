import { productImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type Props = {
  product: { title: string; image_key?: string | null; image_url?: string | null };
  className?: string;
  loading?: "lazy" | "eager";
  alt?: string;
};

// Mostra a imagem do produto ou, sem imagem, um bloco neutro com o nome.
export function ProductImage({ product, className, loading = "lazy", alt }: Props) {
  const src = productImage(product);
  if (src) {
    return <img src={src} alt={alt ?? product.title} loading={loading} className={className} />;
  }
  return (
    <div
      role="img"
      aria-label={alt ?? product.title}
      className={cn(
        "flex h-full w-full items-end bg-muted p-4 text-left text-muted-foreground",
        className,
      )}
    >
      <span className="font-display text-lg leading-tight">{product.title}</span>
    </div>
  );
}
