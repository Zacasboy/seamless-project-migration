import { supabase } from "@/integrations/supabase/client";

export function trackView(path: string, productId?: string) {
  if (typeof window === "undefined") return;
  void supabase.from("page_views").insert({
    path: path.slice(0, 280),
    product_id: productId ?? null,
    referrer: document.referrer ? document.referrer.slice(0, 280) : null,
  });
}
