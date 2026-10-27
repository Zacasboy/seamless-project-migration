import { describe, expect, it, vi } from "vitest";
import { performEmailReview } from "./email-review";

const id = "6f1c2a43-9a4b-4c2e-8f53-2d1f0b7a9e11";

describe("performEmailReview", () => {
  it("rejects non-admin callers without touching the request", async () => {
    const markReviewed = vi.fn();
    await expect(
      performEmailReview({ id, decision: "approve" }, "u1", {
        isAdmin: async () => false,
        markReviewed,
      }),
    ).rejects.toThrow("Sem permissão");
    expect(markReviewed).not.toHaveBeenCalled();
  });

  it("fails the second approval of the same request (already reviewed)", async () => {
    let pending = true;
    const deps = {
      isAdmin: async () => true,
      markReviewed: async () => {
        if (!pending) return 0;
        pending = false;
        return 1;
      },
    };
    await expect(performEmailReview({ id, decision: "approve" }, "a1", deps)).resolves.toEqual({
      ok: true,
    });
    await expect(performEmailReview({ id, decision: "approve" }, "a1", deps)).rejects.toThrow(
      "já revisto",
    );
  });

  it("records the reviewer and final status", async () => {
    const markReviewed = vi.fn().mockResolvedValue(1);
    await performEmailReview({ id, decision: "reject", note: "x" }, "admin-9", {
      isAdmin: async () => true,
      markReviewed,
    });
    expect(markReviewed).toHaveBeenCalledWith({
      id,
      status: "rejected",
      reviewerId: "admin-9",
      note: "x",
    });
  });

  it("rejects malformed input", async () => {
    const deps = { isAdmin: async () => true, markReviewed: vi.fn() };
    await expect(
      performEmailReview({ id: "nope", decision: "approve" }, "a", deps),
    ).rejects.toThrow();
    await expect(performEmailReview({ id, decision: "delete" }, "a", deps)).rejects.toThrow();
  });
});
