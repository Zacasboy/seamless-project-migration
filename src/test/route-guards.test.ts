import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRedirect } from "@tanstack/react-router";

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    auth: {
      getUser,
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
    },
  },
}));

const { Route: AdminRoute } = await import("@/routes/_authenticated/admin");
const { Route: GateRoute } = await import("@/routes/_authenticated/route");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (route: any, ctx: object) => route.options.beforeLoad(ctx);

describe("route guards", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
  });

  it("signed-out visitors are sent to /auth", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const err = await run(GateRoute, {}).catch((e: unknown) => e);
    expect(isRedirect(err)).toBe(true);
    expect((err as { options: { to: string } }).options.to).toBe("/auth");
  });

  it("/admin redirects a signed-in user without the admin role", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const err = await run(AdminRoute, { context: { user: { id: "u1" } } }).catch((e: unknown) => e);
    expect(isRedirect(err)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("has_role", { _role: "admin", _user_id: "u1" });
  });

  it("/admin redirects when the role check errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const err = await run(AdminRoute, { context: { user: { id: "u1" } } }).catch((e: unknown) => e);
    expect(isRedirect(err)).toBe(true);
  });

  it("/admin lets an admin through", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(run(AdminRoute, { context: { user: { id: "a1" } } })).resolves.toBeUndefined();
  });
});
