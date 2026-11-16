import { productImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type Props = {
  product: {
    title: string;
    category?: string | null;
    image_key?: string | null;
    image_url?: string | null;
    image_alt?: string | null;
  };
  className?: string;
  loading?: "lazy" | "eager";
  alt?: string;
  sizes?: string;
  /** Mostra o nome do produto dentro do placeholder (útil quando não há legenda por baixo). */
  caption?: boolean;
  /** Miniatura: só o tom e o monograma (carrinho, tabelas). */
  compact?: boolean;
};

// Imagem do produto com texto alternativo. Sem fotografia, mostra uma superfície
// lisa no tom do tema com a indicação "Fotografia em breve".
export function ProductImage({
  product,
  className,
  loading = "lazy",
  alt,
  sizes,
  caption,
  compact,
}: Props) {
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
      {...(text
        ? { role: "img", "aria-label": `${text} (fotografia em breve)` }
        : { "aria-hidden": true })}
      className={cn("plate relative flex items-end overflow-hidden", className)}
    >
      {!compact && (
        <span aria-hidden className="flex flex-col gap-1 p-4 text-left">
          {caption && <span className="text-sm text-foreground">{product.title}</span>}
          <span className="num text-[11px] uppercase tracking-wide">Fotografia em breve</span>
        </span>
      )}
    </div>
  );
}
