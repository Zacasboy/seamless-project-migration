import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Sincronização periódica do stock com os fornecedores e verificação dos canais.
// A Vercel Cron chama com GET e "Authorization: Bearer <CRON_SECRET>"; outros agendadores podem usar POST.
// Precisa de SUPABASE_SERVICE_ROLE_KEY no servidor. Sem CRON_SECRET (32+ caracteres), o endpoint fica desligado.
function authorized(request: Request) {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret || secret.length < 32) return false;
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authorized(request)) return new Response("Não autorizado", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { syncSupplierStock } = await import("@/server/supplier-sync");
  const { runChannelCheck } = await import("@/server/channel-check");
  try {
    const summary = await syncSupplierStock(supabaseAdmin);
    // Depois do stock, verifica todos os canais selecionados e grava o estado.
    const channels = await runChannelCheck(supabaseAdmin, { write: true });
    return Response.json({
      ...summary,
      channels: channels.map((c) => ({ name: c.name, state: c.state, message: c.message })),
    });
  } catch (e) {
    console.error("[cron sync-stock]", e);
    return Response.json({ error: "A sincronização falhou" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/cron/sync-stock")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
