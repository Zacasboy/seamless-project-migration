// Cabeçalhos de segurança aplicados a todas as respostas do servidor.
// A CSP só se aplica em produção: o Vite em desenvolvimento usa scripts e WebSockets próprios.

const SUPABASE = "https://*.supabase.co wss://*.supabase.co";
const GA =
  "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";

export const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' é necessário para os scripts de hidratação do TanStack Start.
  // 'wasm-unsafe-eval' permite o modelo de remoção de fundo (WebAssembly) do painel.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${SUPABASE} ${GA}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export function withSecurityHeaders(response: Response): Response {
  const res = new Response(response.body, response);
  const h = res.headers;
  if (process.env["NODE_ENV"] === "production") h.set("Content-Security-Policy", CSP);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.delete("X-Powered-By");
  return res;
}
