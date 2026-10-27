import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { performEmailReview, reviewSchema } from "./email-review";

/** Admin-only: approve or reject a pending email change request. */
export const reviewEmailChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    return performEmailReview(data, context.userId, {
      isAdmin: async () => {
        const { data: ok, error } = await context.supabase.rpc("has_role", {
          _user_id: context.userId,
          _role: "admin",
        });
        return !error && ok === true;
      },
      markReviewed: async ({ id, status, reviewerId, note }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await supabaseAdmin
          .from("email_change_requests")
          .update({
            status,
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            review_note: note,
          })
          .eq("id", id)
          .eq("status", "pending")
          .select("id");
        if (error) throw new Error("Falha ao registar a revisão");
        return rows?.length ?? 0;
      },
    });
  });
