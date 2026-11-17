import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Regresso da autorização AliExpress. Só aceita se o "state" coincidir com o cookie
// criado pelo painel (startAliExpressAuth), troca o código pelo token e guarda-o cifrado.
const back = (origin: string, result: string) =>
  Response.redirect(`${origin}/admin/importar?aliexpress=${result}`, 303);

async function callback(request: Request) {
  const url = new URL(request.url);
  const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");
  const expected = getCookie("ae_oauth_state") ?? "";
  deleteCookie("ae_oauth_state", { path: "/api/aliexpress" });
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) return back(url.origin, "estado-invalido");
  if (!code || code.length > 512) return back(url.origin, "recusado");
  try {
    const { exchangeCode, aliexpressAdapter } = await import("@/server/suppliers/aliexpress");
    const { saveCredential } = await import("@/server/supplier-credentials");
    if (!aliexpressAdapter.configured()) return back(url.origin, "por-configurar");
    const cred = await exchangeCode(code);
    await saveCredential("aliexpress", process.env["ALIEXPRESS_APP_SECRET"]!.trim(), cred);
    return back(url.origin, "ligado");
  } catch (e) {
    console.error("[aliexpress callback]", (e as Error).message);
    return back(url.origin, "erro");
  }
}

export const Route = createFileRoute("/api/aliexpress/callback")({
  server: { handlers: { GET: ({ request }) => callback(request) } },
});
