import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadAnalytics, onConsentChange, readConsent, saveConsent } from "@/lib/consent";

// Barra de consentimento. Recusar e aceitar têm o mesmo destaque, como pede a CNPD.
export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const c = readConsent();
    if (c) {
      setAnalytics(c.analytics);
      if (c.analytics) loadAnalytics();
    } else setOpen(true);
    return onConsentChange((next) => {
      if (next === null) {
        setOpen(true);
        setDetails(true);
      }
    });
  }, []);

  if (!open) return null;

  function decide(a: boolean) {
    saveConsent(a);
    if (a) loadAnalytics();
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur px-[max(1rem,env(safe-area-inset-left))] pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_30px_rgb(49_24_28/0.08)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl text-sm">
          <p id="cookie-title" className="font-display text-xl">
            Cookies
          </p>
          <p className="mt-1 text-muted-foreground">
            Usamos cookies necessários para o carrinho e a sessão. Com a sua autorização, usamos
            também cookies de análise para perceber que páginas são úteis. Saiba mais na{" "}
            <Link to="/privacidade" hash="cookies" className="underline underline-offset-4">
              política de privacidade
            </Link>
            .
          </p>
          {details && (
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked disabled className="mt-1" />
                <span>
                  <b>Necessários</b>: carrinho, sessão e esta escolha. Sempre ativos.
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--cherry-velvet)]"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                />
                <span>
                  <b>Análise</b>: Google Analytics, com IP anonimizado, para medir visitas.
                </span>
              </label>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {details ? (
            <Button onClick={() => decide(analytics)}>Guardar escolha</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => decide(false)}>
                Recusar
              </Button>
              <Button variant="outline" onClick={() => setDetails(true)}>
                Personalizar
              </Button>
              <Button onClick={() => decide(true)}>Aceitar</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
