import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Authentication alone is not sufficient for administrative access.
    // The role is checked against the database, never against client-editable metadata.
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: data.user.id,
    });

    if (roleError || !isAdmin) {
      throw redirect({ to: "/" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
