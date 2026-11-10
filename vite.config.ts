// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Fallback public backend values. The imported project's .gitignore excludes .env, so hosted
// builds would otherwise ship without them (blank screen: "Missing Supabase environment variable").
// These are publishable (public) values only — never put private keys here.
const PUBLIC_BACKEND_ENV: Record<string, string> = {
  VITE_SUPABASE_URL: "https://bssyfatruvgwsjfndrst.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_yVBZ7LV9_bIRv12_3DENDA_z_fXtKyZ",
  VITE_SUPABASE_PROJECT_ID: "bssyfatruvgwsjfndrst",
};
for (const [k, v] of Object.entries(PUBLIC_BACKEND_ENV)) {
  if (!process.env[k]) process.env[k] = v;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
