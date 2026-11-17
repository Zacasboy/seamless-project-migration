import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { StoreLayout } from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ProductImage";
import { MAX_QTY, euro, useCart } from "@/lib/cart";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/carrinho")({
  head: () =>
    seo({
      title: "Carrinho",
      description: "Reveja os artigos no seu carrinho Pallessiani antes de encomendar.",
      noindex: true,
    }),
  component: CartPage,
});

function CartPage() {
  const { items, remove, setQty, total, ready } = useCart();
  return (
    <StoreLayout className={items.length ? "pb-sticky md:pb-0" : ""}>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-5xl">Carrinho</h1>
        {!ready ? (
          <div className="mt-8 space-y-4" aria-busy="true" aria-label="A carregar o carrinho">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">O seu carrinho está vazio.</p>
            <Button asChild className="mt-6">
              <Link to="/loja">Explorar a loja</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="mt-8 divide-y border-y">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-4 py-4">
                  <div className="h-24 w-20 shrink-0 overflow-hidden">
                    <ProductImage
                      product={{ title: i.title, image_url: i.image }}
                      compact
                      className="h-24 w-20 object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/produto/$slug"
                      params={{ slug: i.slug }}
                      className="font-display text-xl hover:underline"
                    >
                      {i.title}
                    </Link>
                    {(i.color || i.size) && (
                      <p className="text-sm text-muted-foreground">
                        {[i.color && `Cor ${i.color}`, i.size && `Tamanho ${i.size}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="num text-sm text-muted-foreground">{euro(i.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQty(i.key, i.qty - 1)}
                      disabled={i.qty <= 1}
                      aria-label={`Menos uma unidade de ${i.title}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="num w-6 text-center" aria-live="polite">
                      {i.qty}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQty(i.key, i.qty + 1)}
                      disabled={i.qty >= MAX_QTY}
                      aria-label={`Mais uma unidade de ${i.title}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(i.key)}
                    aria-label={`Remover ${i.title}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-6 hidden items-center justify-between md:flex">
              <p className="text-xl">
                Total estimado: <span className="num font-display text-3xl">{euro(total)}</span>
              </p>
              <Button asChild size="lg">
                <Link to="/encomendar">Continuar para a encomenda</Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              O preço final é confirmado no momento da encomenda. Portes e pagamento são combinados
              consigo depois de confirmarmos a disponibilidade.
            </p>
            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
              <div className="flex items-center gap-3">
                <p className="flex-1 text-sm">
                  Total
                  <span className="num block font-display text-xl">{euro(total)}</span>
                </p>
                <Button asChild size="lg">
                  <Link to="/encomendar">Encomendar</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </StoreLayout>
  );
}
