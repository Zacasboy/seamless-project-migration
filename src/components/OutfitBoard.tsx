import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { euro } from "@/lib/cart";
import { BACKGROUNDS, type BackgroundKey, type Layout } from "@/lib/outfits";
import { cn } from "@/lib/utils";

export type BoardPiece = {
  key: string;
  productId: string;
  slug: string;
  title: string;
  price: number;
  image: string;
  color?: string | null;
  layout: Layout;
};

/**
 * Quadro de um conjunto em "flat-lay". Na loja: passar o rato (ou focar) destaca uma peça e esbate
 * as outras; clicar abre o artigo num separador novo. Em ecrã tátil, o 1.º toque destaca e o 2.º abre.
 * No painel (editable), as peças arrastam-se e devolvem a nova posição.
 */
export function OutfitBoard({
  title,
  background = "cinza",
  pieces,
  editable,
  onMove,
  selected,
  onSelect,
  className,
  eager,
  hotspots,
  currentProductId,
  photo,
  showRegions,
}: {
  title: string;
  background?: string | null | undefined;
  pieces: BoardPiece[];
  editable?: boolean | undefined;
  onMove?: ((key: string, layout: Layout) => void) | undefined;
  selected?: string | null | undefined;
  onSelect?: ((key: string) => void) | undefined;
  className?: string | undefined;
  eager?: boolean | undefined;
  /** Pontos sobre cada peça ("shop the look"), para mostrar que se pode tocar. */
  hotspots?: boolean | undefined;
  /** Produto da página atual: a etiqueta diz «Está a ver». */
  currentProductId?: string | undefined;
  /**
   * Fotografia do conjunto (gerada a partir da composição e aprovada). As peças continuam nas mesmas
   * posições, invisíveis, para o destaque e o clique de cada uma.
   */
  photo?: string | null | undefined;
  /** No painel: mostra o contorno de cada peça sobre a fotografia, para confirmar que coincidem. */
  showRegions?: boolean | undefined;
}) {
  const bg = BACKGROUNDS[(background ?? "cinza") as BackgroundKey] ?? BACKGROUNDS.cinza;
  const [active, setActive] = useState<string | null>(null);
  const pointer = useRef<string>("mouse");
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; dx: number; dy: number } | null>(null);
  const focus = editable ? selected : active;

  const startDrag = (e: ReactPointerEvent, p: BoardPiece) => {
    if (!editable || !board.current) return;
    e.preventDefault();
    onSelect?.(p.key);
    const r = board.current.getBoundingClientRect();
    drag.current = {
      key: p.key,
      dx: ((e.clientX - r.left) / r.width) * 100 - p.layout.x,
      dy: ((e.clientY - r.top) / r.height) * 100 - p.layout.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e: ReactPointerEvent, p: BoardPiece) => {
    if (!drag.current || drag.current.key !== p.key || !board.current) return;
    const r = board.current.getBoundingClientRect();
    const x = Math.max(-10, Math.min(95, ((e.clientX - r.left) / r.width) * 100 - drag.current.dx));
    const y = Math.max(-10, Math.min(95, ((e.clientY - r.top) / r.height) * 100 - drag.current.dy));
    onMove?.(p.key, { ...p.layout, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  return (
    <div
      ref={board}
      role="group"
      aria-label={`Conjunto: ${title}`}
      onMouseLeave={() => !editable && setActive(null)}
      className={cn("relative isolate aspect-[4/5] w-full touch-pan-y select-none overflow-hidden", className)}
      style={{ background: bg.css }}
    >
      {photo && (
        <img
          src={photo}
          alt=""
          aria-hidden
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      {pieces.map((p) => {
        const isOn = focus === p.key;
        const dim = !!focus && !isOn && !photo;
        const style = {
          left: `${p.layout.x}%`,
          top: `${p.layout.y}%`,
          width: `${p.layout.w}%`,
          zIndex: isOn ? 50 : p.layout.z,
          transform: `rotate(${p.layout.r}deg) ${isOn && !editable && !photo ? "translateY(-1.5%) scale(1.04)" : ""}`,
          // Sobre a fotografia: a peça em foco fica iluminada e o resto escurece ligeiramente.
          ...(photo && isOn && !editable ? { boxShadow: "0 0 0 9999px rgba(0,0,0,.28)", borderRadius: "6px" } : {}),
          ...(photo && showRegions ? { outline: "2px dashed rgba(255,255,255,.9)", outlineOffset: "-2px" } : {}),
        };
        const img = (
          <img
            src={p.image}
            alt=""
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={cn("block h-auto w-full", photo && "opacity-0")}
            style={{
              // Fotografias com fundo claro "fundem-se" no quadro; recortes ganham sombra natural.
              mixBlendMode: !p.layout.cutout && bg.light ? "multiply" : undefined,
              filter: p.layout.cutout ? "drop-shadow(0 10px 14px rgba(0,0,0,.22))" : undefined,
            }}
          />
        );
        const cls = cn(
          "absolute block outline-none transition-[transform,opacity,filter,box-shadow] duration-300 ease-out motion-reduce:transition-none",
          dim && "opacity-35 saturate-50",
          editable && "cursor-move",
          editable && isOn && "outline outline-2 outline-offset-2 outline-[var(--brand-accent)]",
        );
        if (editable)
          return (
            <div
              key={p.key}
              className={cls}
              style={style}
              onPointerDown={(e) => startDrag(e, p)}
              onPointerMove={(e) => moveDrag(e, p)}
              onPointerUp={() => (drag.current = null)}
            >
              {img}
            </div>
          );
        return (
          <a
            key={p.key}
            href={`/produto/${p.slug}`}
            target="_blank"
            rel="noopener"
            aria-label={`${p.title}${p.color ? `, ${p.color}` : ""}, ${euro(p.price)} (abre num separador novo)`}
            className={cn(cls, "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground")}
            style={style}
            onPointerDown={(e) => (pointer.current = e.pointerType)}
            onMouseEnter={() => setActive(p.key)}
            onFocus={() => setActive(p.key)}
            onClick={(e) => {
              // Toque: o primeiro destaca, o segundo abre.
              if (pointer.current !== "mouse" && active !== p.key) {
                e.preventDefault();
                setActive(p.key);
              }
            }}
          >
            {img}
            {hotspots && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md ring-1 ring-black/10 transition-opacity duration-300",
                  isOn ? "opacity-0" : "opacity-100",
                )}
                style={{ transform: `translate(-50%,-50%) rotate(${-p.layout.r}deg)` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
              </span>
            )}
          </a>
        );
      })}
      {/* Etiqueta da peça destacada */}
      {!editable &&
        pieces
          .filter((p) => p.key === active)
          .map((p) => (
            <div
              key={p.key}
              aria-hidden
              className="pointer-events-none absolute inset-x-3 bottom-3 z-[60] flex items-center justify-between gap-3 bg-card/95 px-3 py-2 text-sm shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
            >
              <span className="min-w-0 truncate">
                {p.title}
                {p.color ? <span className="text-muted-foreground"> · {p.color}</span> : null}
              </span>
              <span className="num shrink-0">
                {currentProductId === p.productId ? <span className="mr-2 text-xs text-muted-foreground">Está a ver</span> : null}
                {euro(p.price)}
              </span>
            </div>
          ))}
    </div>
  );
}
