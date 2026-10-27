import { z } from "zod";

export const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReviewDeps = {
  /** Server-side, session-bound admin check (has_role via the caller's own JWT). */
  isAdmin: () => Promise<boolean>;
  /**
   * Atomically moves a request from 'pending' to the final status.
   * Must only update rows still 'pending' and return the number of rows changed,
   * so two concurrent approvals cannot both succeed.
   */
  markReviewed: (args: {
    id: string;
    status: "approved" | "rejected";
    reviewerId: string;
    note: string | null;
  }) => Promise<number>;
};

/**
 * Approving does NOT change the account email. It only authorises the change;
 * the user then confirms the new address through the standard verification email.
 */
export async function performEmailReview(input: unknown, reviewerId: string, deps: ReviewDeps) {
  const data = reviewSchema.parse(input);
  if (!(await deps.isAdmin())) throw new Error("Sem permissão");
  const changed = await deps.markReviewed({
    id: data.id,
    status: data.decision === "approve" ? "approved" : "rejected",
    reviewerId,
    note: data.note ?? null,
  });
  if (changed !== 1) throw new Error("Pedido não encontrado ou já revisto");
  return { ok: true as const };
}