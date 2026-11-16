import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { CartProvider } from "@/lib/cart";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/CookieBanner";
import { trackAnalyticsPage } from "@/lib/consent";
import { SITE } from "@/lib/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Link to="/" className="font-display text-2xl tracking-[0.32em] uppercase">
        Pallessiani
      </Link>
      <p className="eyebrow mt-16">Erro 404</p>
      <h1 className="mt-3 max-w-lg text-5xl md:text-6xl">Esta página saiu de coleção.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        A ligação pode estar errada ou a página pode ter mudado de lugar.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          to="/loja"
          className="inline-flex h-11 items-center bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ver a loja
        </Link>
        <Link
          to="/"
          className="inline-flex h-11 items-center border px-6 text-sm font-medium hover:bg-accent"
        >
          Página inicial
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-4xl">Não foi possível abrir esta página</h1>
        <p className="mt-3 text-muted-foreground">
          Ocorreu um erro do nosso lado. Tente de novo ou volte à página inicial.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center border px-6 text-sm font-medium hover:bg-accent"
          >
            Página inicial
          </a>
        </div>
      </div>
    </div>
  );
}

function PendingComponent() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">A carregar…</span>
      <span className="h-px w-24 animate-pulse bg-primary" />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: `${SITE.name} — Moda intemporal` },
      { name: "description", content: SITE.tagline },
      { name: "theme-color", content: "#FBF8F4" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE.name },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Karla:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: PendingComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => trackAnalyticsPage(path), [path]);

  const isAdmin = path.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <Outlet />
        <Toaster position="bottom-center" />
        {!isAdmin && <CookieBanner />}
      </CartProvider>
    </QueryClientProvider>
  );
}
