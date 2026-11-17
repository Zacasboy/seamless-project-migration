// Configuração Vite independente do Lovable.
// Substitui @lovable.dev/vite-tanstack-config pelos mesmos plugins, declarados aqui.
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // Carrega .env, .env.local, etc. para process.env do servidor (SSR e funções de servidor).
  // Só as variáveis VITE_* chegam ao browser; as restantes ficam no processo Node.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: { host: true, port: 8080 },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      tsconfigPaths: true,
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Sem preset fixo: Node por omissão; na Vercel o preset "vercel" é detetado sozinho.
      // Para forçar um destino: NITRO_PRESET=vercel bun run build
      // As opções "vercel" só se aplicam ao preset Vercel (ver DEPLOY.md).
      ...(command === "build"
        ? [
            nitro({
              vercel: {
                // Funções em Londres, junto à base de dados Supabase (eu-west-2).
                // maxDuration 300 s: os agentes precisam de alguns minutos (limite do Hobby com Fluid Compute).
                functions: { regions: ["lhr1"], maxDuration: 300 },
                config: {
                  version: 3,
                  // Hobby: uma vez por dia. No Pro, definir VERCEL_CRON_SCHEDULE="*/15 * * * *".
                  crons: [
                    {
                      path: "/api/cron/sync-stock",
                      schedule: process.env["VERCEL_CRON_SCHEDULE"] || "0 5 * * *",
                    },
                    // Agentes: um pedido diário cada; a frequência no painel decide se trabalham.
                    { path: "/api/cron/agents/catalogo", schedule: "17 6 * * *" },
                    { path: "/api/cron/agents/concorrencia", schedule: "17 7 * * *" },
                    { path: "/api/cron/agents/marca", schedule: "17 8 * * *" },
                    { path: "/api/cron/agents/conteudo", schedule: "17 9 * * *" },
                  ],
                },
              },
            }),
          ]
        : []),
      viteReact(),
    ],
  };
});
