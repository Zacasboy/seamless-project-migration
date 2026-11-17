import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useCart } from "@/lib/cart";
import { reopenConsent } from "@/lib/consent";
import { SITE, isPending } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

import { CATEGORIES } from "@/lib/taxonomy";

// Menu da loja: categorias (com subcategorias) por esta ordem; "Conjuntos" fica em Ver tudo.
const SHOP = CATEGORIES.filter((c) => c.name !== "Conjuntos").map((c) => ({
  label: c.name,
  categoria: c.name,
  subs: c.subs as readonly string[],
}));

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
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-10">
          <div>
            <button
              className="-ml-2 p-2 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <Link to="/" className="logo text-base md:text-lg" aria-label="Pallessiani, página inicial">
            Pallessiani
          </Link>
          <div className="flex items-center justify-end gap-6">
            <Link
              to={signedIn ? "/conta" : "/auth"}
              className="nav-link hidden hover:text-[var(--brand-accent)] md:inline"
            >
              {signedIn ? "Conta" : "Entrar"}
            </Link>
            <Link
              to={signedIn ? "/conta" : "/auth"}
              className="p-1 md:hidden"
              aria-label={signedIn ? "A minha conta" : "Entrar"}
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              to="/carrinho"
              className="nav-link flex items-center gap-1.5 hover:text-[var(--brand-accent)]"
              aria-label={`Carrinho, ${count} artigos`}
            >
              <ShoppingBag className="h-5 w-5 md:hidden" />
              <span className="hidden md:inline">Carrinho</span>
              <span className="num">({count})</span>
            </Link>
          </div>
        </div>
        {/* Segunda linha: categorias; ao passar ou focar, mostra as subcategorias. */}
        <nav aria-label="Categorias" className="hidden border-t lg:block">
          <ul className="mx-auto flex max-w-[1440px] items-center justify-center gap-9 px-10">
            {SHOP.map((s) => (
              <li key={s.label} className="group relative">
                <Link
                  to="/loja"
                  search={{ categoria: s.categoria }}
                  className="nav-link block py-3 hover:text-[var(--brand-accent)]"
                >
                  {s.label}
                </Link>
                {s.subs.length > 0 && (
                  <div className="invisible absolute left-1/2 top-full z-40 min-w-48 -translate-x-1/2 border bg-card py-2 opacity-0 shadow-sm transition-[opacity,visibility] duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {s.subs.map((sub) => (
                      <Link
                        key={sub}
                        to="/loja"
                        search={{ categoria: s.categoria, tipo: sub }}
                        className="block px-4 py-2 text-sm hover:bg-[var(--plate)]"
                      >
                        {sub}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
            <li>
              <Link
                to="/loja"
                className="nav-link block py-3 text-[var(--brand-accent)] hover:underline"
                activeOptions={{ includeSearch: false }}
              >
                Ver tudo
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Menu">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-80 flex-col gap-1 overflow-y-auto bg-card p-6">
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
              <div key={s.label} className="py-1">
                <Link
                  to="/loja"
                  search={{ categoria: s.categoria }}
                  onClick={() => setOpen(false)}
                  className="block py-1 font-display text-2xl"
                >
                  {s.label}
                </Link>
                {s.subs.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-sm text-muted-foreground">
                    {s.subs.map((sub) => (
                      <Link
                        key={sub}
                        to="/loja"
                        search={{ categoria: s.categoria, tipo: sub }}
                        onClick={() => setOpen(false)}
                        className="hover:text-foreground"
                      >
                        {sub}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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

      <footer className="site-footer mt-24 border-t">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
          <div>
            <p className="logo text-lg">Pallessiani</p>
            <p className="muted mt-3 max-w-xs text-sm">{SITE.tagline}</p>
          </div>
          <nav aria-label="Loja no rodapé" className="space-y-2 text-sm">
            <p className="nav-link muted">Loja</p>
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
            <p className="nav-link muted">Informação</p>
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
            <p className="nav-link muted">Contacto</p>
            {!isPending(c.email) && (
              <a href={`mailto:${c.email}`} className="block hover:underline">
                {c.email}
              </a>
            )}
            {!isPending(c.phone) && <p>{c.phone}</p>}
            {!isPending(c.address) && (
              <p className="muted">
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
        <div className="rule border-t">
          <p className="muted num mx-auto max-w-[1440px] px-6 py-5 text-xs md:px-10">
            © {new Date().getFullYear()} {isPending(c.legalName) ? SITE.name : c.legalName}
            {!isPending(c.nif) && ` · NIPC ${c.nif}`}
          </p>
        </div>
      </footer>
    </div>
  );
}
