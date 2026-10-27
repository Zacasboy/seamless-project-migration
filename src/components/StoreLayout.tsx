import { Link } from "@tanstack/react-router";
import { ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";

export function StoreLayout({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <nav className="flex gap-3 text-sm sm:gap-6">
            <Link to="/loja" className="hover:text-gold" activeProps={{ className: "text-gold" }}>
              Loja
            </Link>
            <Link
              to="/loja"
              search={{ categoria: "Conjuntos" }}
              className="hidden hover:text-gold sm:inline"
            >
              Conjuntos
            </Link>
          </nav>
          <Link
            to="/"
            className="font-display text-lg tracking-[0.2em] uppercase sm:text-2xl sm:tracking-[0.3em]"
          >
            Pallessiani
          </Link>
          <div className="flex items-center gap-4 text-sm sm:gap-5">
            <Link
              to={signedIn ? "/perfil" : "/auth"}
              className="flex items-center gap-1.5 hover:text-gold"
              aria-label={signedIn ? "Perfil" : "Entrar ou criar conta"}
            >
              <UserRound className="h-5 w-5" />
              <span className="hidden sm:inline">{signedIn ? "Perfil" : "Entrar"}</span>
            </Link>
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
          <p className="text-sm opacity-60 md:text-right">
            © {new Date().getFullYear()} Pallessiani
          </p>
        </div>
      </footer>
    </div>
  );
}
