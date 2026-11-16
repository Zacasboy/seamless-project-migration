import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Sincronização periódica do stock com os fornecedores e verificação dos canais.
// Chamar com POST e "Authorization: Bearer <CRON_SECRET>" (ex.: a cada 15 minutos).
// Precisa de SUPABASE_SERVICE_ROLE_KEY no servidor. Sem CRON_SECRET, o endpoint fica desligado.
function authorized(request: Request) {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret || secret.length < 32) return false;
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/sync-stock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
      },
    },
  },
});
