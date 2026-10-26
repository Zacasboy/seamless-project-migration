import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { StoreLayout } from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { euro, useCart } from "@/lib/cart";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Pallessiani" },
      { name: "description", content: "Reveja os artigos no seu carrinho Pallessiani." },
      { property: "og:title", content: "Carrinho — Pallessiani" },
      { property: "og:description", content: "Reveja os artigos no seu carrinho." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, remove, setQty, total } = useCart();
  return (
    <StoreLayout>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-5xl">Carrinho</h1>
        {items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">O seu carrinho está vazio.</p>
            <Button asChild className="mt-6"><Link to="/loja">Explorar a loja</Link></Button>
          </div>
        ) : (
          <>
            <ul className="mt-8 divide-y border-y">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-4">
                  <img src={i.image} alt={i.title} className="h-24 w-20 object-cover" />
                  <div className="flex-1">
                    <Link to="/produto/$slug" params={{ slug: i.slug }} className="font-display text-xl">{i.title}</Link>
                    <p className="text-sm text-muted-foreground">{euro(i.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setQty(i.id, i.qty - 1)} aria-label="Menos"><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center">{i.qty}</span>
                    <Button size="icon" variant="outline" onClick={() => setQty(i.id, i.qty + 1)} aria-label="Mais"><Plus className="h-3 w-3" /></Button>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(i.id)} aria-label="Remover"><X className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xl">Total: <span className="font-display text-3xl">{euro(total)}</span></p>
              <Button size="lg" disabled title="Pagamento disponível em breve">Finalizar compra (em breve)</Button>
            </div>
          </>
        )}
      </div>
    </StoreLayout>
  );
}
