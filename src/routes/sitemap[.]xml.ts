import { createFileRoute } from "@tanstack/react-router";
import { publicClient } from "@/lib/products.functions";
import { SITE } from "@/lib/site";

const STATIC = ["/", "/loja", "/contacto", "/termos", "/privacidade"];
import { CATEGORY_NAMES } from "@/lib/taxonomy";

const CATS = CATEGORY_NAMES;

const xmlEscape = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = SITE.url || new URL(request.url).origin;
        const { data } = await publicClient()
          .from("products")
          .select("slug,created_at")
          .eq("published", true)
          .limit(5000);
        const urls = [
          ...STATIC.map((p) => ({ loc: base + p })),
          ...CATS.map((c) => ({ loc: `${base}/loja?categoria=${encodeURIComponent(c)}` })),
          ...(data ?? []).map((p) => ({
            loc: `${base}/produto/${encodeURIComponent(p.slug)}`,
            lastmod: p.created_at.slice(0, 10),
          })),
        ];
        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url><loc>${xmlEscape(u.loc)}</loc>${"lastmod" in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
