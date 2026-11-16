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

// Tom do placeholder por categoria, sempre dentro da paleta Soft Luxury.
const TONE: Record<string, string> = {
  Malas: "#E8DACB",
  Calçado: "#EEE2D4",
  Conjuntos: "#DDCDBD",
};

// Inicial para o monograma: a primeira palavra costuma ser o tipo de peça
// ("Mala", "Conjunto"), por isso usamos a segunda quando existe.
export function monogram(title: string) {
  const words = title
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const w = words[1] ?? words[0] ?? title.trim();
  return (w[0] ?? "P").toUpperCase();
}

// Imagem do produto com texto alternativo. Sem fotografia, mostra uma etiqueta
// editorial com o monograma da peça, até haver fotos reais.
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
  const tone = TONE[product.category ?? ""] ?? "#E8DACB";
  return (
    <div
      {...(text
        ? { role: "img", "aria-label": `${text} (fotografia em breve)` }
        : { "aria-hidden": true })}
      className={cn("product-tag relative isolate overflow-hidden text-[var(--ink)]", className)}
      style={{ backgroundColor: tone }}
    >
      {!compact && <span aria-hidden className="product-tag__frame" />}
      {!compact && <span aria-hidden className="product-tag__hole" />}
      <span
        aria-hidden
        className="product-tag__mono absolute inset-0 flex items-center justify-center font-display italic"
      >
        {monogram(product.title)}
      </span>
      {!compact && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-[9%] pb-[8%] text-left"
        >
          {caption && (
            <span className="font-display text-[clamp(1.05rem,1.6vw,1.45rem)] leading-tight">
              {product.title}
            </span>
          )}
          <span className="text-[11px] tracking-wide text-[#6E5F58]">Fotografia em breve</span>
        </span>
      )}
    </div>
  );
}
