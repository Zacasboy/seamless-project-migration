// Consentimento de cookies (RGPD e Lei 41/2004, art. 5.º).
// Necessários: carrinho e sessão (sem consentimento). Analítica: só depois de aceitar.

export type Consent = { analytics: boolean; decidedAt: string; version: 1 };

const KEY = "pallessiani-consent";
const EVENT = "pallessiani:consent";

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Consent | null;
    return v && v.version === 1 ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean) {
  const c: Consent = { analytics, decidedAt: new Date().toISOString(), version: 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Sem armazenamento: a escolha vale só para esta visita.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: c }));
  if (!analytics) removeAnalyticsCookies();
  return c;
}

export function reopenConsent() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onConsentChange(fn: (c: Consent | null) => void) {
  const h = (e: Event) => fn((e as CustomEvent<Consent | null>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

// ---- Google Analytics 4 (opcional: define VITE_GA_MEASUREMENT_ID) ----
export const GA_ID = (import.meta.env["VITE_GA_MEASUREMENT_ID"] as string | undefined) ?? "";
const GA_ID_OK = /^G-[A-Z0-9]{4,12}$/.test(GA_ID);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;
export function loadAnalytics() {
  if (loaded || !GA_ID_OK || typeof document === "undefined") return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params -- formato exigido pelo gtag.js
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true, send_page_view: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function trackAnalyticsPage(path: string) {
  if (loaded && window.gtag) window.gtag("event", "page_view", { page_path: path });
}

function removeAnalyticsCookies() {
  const host = location.hostname.split(".").slice(-2).join(".");
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name && (name.startsWith("_ga") || name === "_gid")) {
      for (const d of ["", `; domain=.${host}`])
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  }
}

export const analyticsConfigured = GA_ID_OK;
