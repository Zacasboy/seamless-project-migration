import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { useCart } from "@/lib/cart";

export function StoreLayout({ children }: { children: ReactNode }) {
  const { count } = useCart();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <nav className="flex gap-6 text-sm">
            <Link to="/loja" className="hover:text-gold" activeProps={{ className: "text-gold" }}>Loja</Link>
            <Link to="/loja" search={{ categoria: "Conjuntos" }} className="hover:text-gold">Conjuntos</Link>
          </nav>
          <Link to="/" className="font-display text-2xl tracking-[0.3em] uppercase">Pallessiani</Link>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/admin" className="hover:text-gold">Painel</Link>
            <Link to="/carrinho" className="relative" aria-label="Carrinho">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] text-primary">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl tracking-[0.3em] uppercase">Pallessiani</p>
            <p className="mt-2 text-sm opacity-70">Moda intemporal, selecionada para si.</p>
          </div>
          <div className="text-sm opacity-80 space-y-1">
            <p>Malas · Calçado · Conjuntos</p>
            <p>Envio para Portugal e UE</p>
          </div>
          <p className="text-sm opacity-60 md:text-right">© {new Date().getFullYear()} Pallessiani</p>
        </div>
      </footer>
    </div>
  );
}
