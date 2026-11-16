import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useCart } from "@/lib/cart";
import { reopenConsent } from "@/lib/consent";
import { SITE, isPending } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

const SHOP = [
  { label: "Malas", categoria: "Malas" },
  { label: "Calçado", categoria: "Calçado" },
  { label: "Conjuntos", categoria: "Conjuntos" },
] as const;

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function StoreLayout({ children, className }: { children: ReactNode; className?: string }) {
  const { count } = useCart();
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  const c = SITE.company;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-4 focus:py-2"
      >
        Saltar para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6">
          <nav aria-label="Loja" className="hidden gap-6 text-sm md:flex">
            <Link
              to="/loja"
              className="hover:text-primary"
              activeOptions={{ includeSearch: false }}
            >
              Loja
            </Link>
            {SHOP.map((s) => (
              <Link
                key={s.label}
                to="/loja"
                search={{ categoria: s.categoria }}
                className="text-muted-foreground hover:text-primary"
              >
                {s.label}
              </Link>
            ))}
          </nav>
          <button
            className="-ml-2 p-2 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            to="/"
            className="font-display text-xl tracking-[0.32em] uppercase md:text-2xl"
            aria-label="Pallessiani, página inicial"
          >
            Pallessiani
          </Link>
          <div className="flex items-center justify-end gap-4 text-sm">
            <Link
              to={signedIn ? "/conta" : "/auth"}
              className="flex items-center gap-2 hover:text-primary"
              aria-label={signedIn ? "A minha conta" : "Entrar"}
            >
              <User className="h-5 w-5" />
              <span className="hidden md:inline">{signedIn ? "Conta" : "Entrar"}</span>
            </Link>
            <Link to="/carrinho" className="relative p-1" aria-label={`Carrinho, ${count} artigos`}>
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="num absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="Menu">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-72 flex-col gap-1 bg-card p-6">
            <button
              className="mb-6 self-end p-2"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Link to="/loja" onClick={() => setOpen(false)} className="py-2 font-display text-2xl">
              Loja
            </Link>
            {SHOP.map((s) => (
              <Link
                key={s.label}
                to="/loja"
                search={{ categoria: s.categoria }}
                onClick={() => setOpen(false)}
                className="py-2 font-display text-2xl"
              >
                {s.label}
              </Link>
            ))}
            <hr className="my-4" />
            <Link to="/contacto" onClick={() => setOpen(false)} className="py-2">
              Contacto
            </Link>
            <Link
              to={signedIn ? "/conta" : "/auth"}
              onClick={() => setOpen(false)}
              className="py-2"
            >
              {signedIn ? "A minha conta" : "Entrar"}
            </Link>
          </nav>
        </div>
      )}

      <main id="conteudo" className={`flex-1 ${className ?? ""}`}>
        {children}
      </main>

      <footer className="border-t bg-[var(--bordeaux-noir)] text-[var(--vanilla-silk)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-2xl tracking-[0.3em] uppercase">Pallessiani</p>
            <p className="mt-3 max-w-xs text-sm text-[var(--alpine-oat)]">{SITE.tagline}</p>
          </div>
          <nav aria-label="Loja" className="space-y-2 text-sm">
            <p className="font-display text-lg">Loja</p>
            <Link to="/loja" className="block hover:underline">
              Todos os artigos
            </Link>
            {SHOP.map((s) => (
              <Link
                key={s.label}
                to="/loja"
                search={{ categoria: s.categoria }}
                className="block hover:underline"
              >
                {s.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Informação legal" className="space-y-2 text-sm">
            <p className="font-display text-lg">Informação</p>
            <Link to="/termos" className="block hover:underline">
              Termos e condições
            </Link>
            <Link to="/privacidade" className="block hover:underline">
              Política de privacidade
            </Link>
            <button onClick={reopenConsent} className="block text-left hover:underline">
              Gerir cookies
            </button>
            <a
              href={SITE.complaintsBookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:underline"
            >
              Livro de Reclamações
            </a>
          </nav>
          <address className="space-y-2 text-sm not-italic">
            <p className="font-display text-lg">Contacto</p>
            {!isPending(c.email) && (
              <a href={`mailto:${c.email}`} className="block hover:underline">
                {c.email}
              </a>
            )}
            {!isPending(c.phone) && <p>{c.phone}</p>}
            {!isPending(c.address) && (
              <p className="text-[var(--alpine-oat)]">
                {c.address}
                <br />
                {c.postalCode} {c.city}
              </p>
            )}
            <Link to="/contacto" className="block hover:underline">
              Todos os contactos
            </Link>
          </address>
        </div>
        <div className="border-t border-[var(--sidebar-border)]">
          <p className="mx-auto max-w-7xl px-6 py-5 text-xs text-[var(--warm-greige)]">
            © {new Date().getFullYear()} {isPending(c.legalName) ? SITE.name : c.legalName}
            {!isPending(c.nif) && ` · NIPC ${c.nif}`}
          </p>
        </div>
      </footer>
    </div>
  );
}
