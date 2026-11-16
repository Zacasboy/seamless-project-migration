import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChecks } from "@/lib/admin-data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Painel — Pallessiani" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; exact?: boolean; badge?: "checks" | "orders" };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Decidir",
    items: [{ to: "/admin", label: "Visão geral", exact: true, badge: "checks" }],
  },
  {
    group: "Vender",
    items: [
      { to: "/admin/encomendas", label: "Encomendas", badge: "orders" },
      { to: "/admin/produtos", label: "Produtos" },
      { to: "/admin/colecoes", label: "Coleções" },
    ],
  },
  {
    group: "Clientes e marketing",
    items: [
      { to: "/admin/clientes", label: "Clientes" },
      { to: "/admin/canais", label: "Canais e anúncios" },
      { to: "/admin/trafego", label: "Tráfego" },
      { to: "/admin/radar", label: "Radar de oportunidades" },
    ],
  },
  { group: "Operar", items: [{ to: "/admin/fornecedores", label: "Fornecedores" }] },
  {
    group: "Sustentar",
    items: [
      { to: "/admin/utilizadores", label: "Utilizadores" },
      { to: "/admin/definicoes", label: "Definições" },
    ],
  },
];

function useAccess() {
  return useQuery({
    queryKey: ["access"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { admin: false, email: "" };
      const { data: admin } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "admin",
      });
      return { admin: !!admin, email: u.user.email ?? "" };
    },
  });
}

function AdminLayout() {
  const access = useAccess();
  const qc = useQueryClient();
  const nav = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await nav({ to: "/auth", replace: true });
  }

  if (access.isLoading)
    return (
      <p className="p-10 text-center text-muted-foreground" aria-busy="true">
        A verificar acesso…
      </p>
    );
  if (access.isError)
    return (
      <p role="alert" className="p-10 text-center text-destructive">
        Não foi possível verificar o acesso. Atualize a página.
      </p>
    );
  if (!access.data!.admin) return <NoAccess email={access.data!.email} onSignOut={signOut} />;
  return <Shell email={access.data!.email} onSignOut={signOut} />;
}

function Shell({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { failed, snap, mig } = useChecks();
  const pending = snap.data?.orders.filter((o) => o.status === "pending").length ?? 0;
  const badge = (b?: NavItem["badge"]) => (b === "checks" ? failed : b === "orders" ? pending : 0);

  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1fr)] bg-background md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-5 border-b border-sidebar-border bg-sidebar px-0 py-4 text-sidebar-foreground md:sticky md:border-b-0 md:border-r md:top-0 md:h-screen md:overflow-y-auto md:px-3 md:py-6">
        <div className="px-4 md:px-3">
          <Link
            to="/admin"
            className="font-display text-xl tracking-[0.28em] text-[var(--cherry-velvet)] uppercase"
          >
            Pallessiani
          </Link>
          <p className="mt-1 hidden text-xs text-sidebar-muted md:block">Painel de gestão</p>
        </div>
        <nav
          aria-label="Secções do painel"
          className="flex gap-1 overflow-x-auto px-4 md:flex-col md:gap-4 md:overflow-visible md:px-0"
        >
          {NAV.map((g) => (
            <div key={g.group} className="flex gap-1 md:flex-col md:gap-0.5">
              <span className="hidden px-3 pb-1.5 text-xs font-medium text-sidebar-muted md:block">
                {g.group}
              </span>
              {g.items.map((n) => {
                const count = badge(n.badge);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    activeOptions={{ exact: !!n.exact }}
                    className="relative flex items-center justify-between gap-2 whitespace-nowrap rounded px-3 py-2 text-sm text-[#4A3A35] hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{
                      className:
                        "!bg-sidebar-primary !text-sidebar-primary-foreground font-semibold shadow-[inset_2px_0_0_var(--cherry-velvet),0_0_0_1px_var(--hairline)]",
                      "aria-current": "page",
                    }}
                  >
                    {n.label}
                    {count > 0 && (
                      <span
                        className="num min-w-5 rounded-full bg-[var(--cherry-velvet)] px-1.5 text-center text-[11px] font-semibold leading-5 text-white"
                        aria-label={`${count} a rever`}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto hidden space-y-2 px-3 text-xs text-sidebar-muted md:block">
          <p className="truncate" title={email}>
            {email}
          </p>
          <Link to="/" className="flex items-center gap-2 hover:text-sidebar-foreground">
            <ExternalLink className="h-3 w-3" /> Ver a loja
          </Link>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 hover:text-sidebar-foreground"
          >
            <LogOut className="h-3 w-3" /> Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-16 pt-8 md:px-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
          {mig.data && !mig.data.applied && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#E9D3AE] bg-[#FBF1E1] px-4 py-3 text-sm text-[#5A3A08]"
            >
              <span>
                <b>A base de dados ainda não tem a atualização de 16/11.</b> Encomendas online,
                Radar e alguns campos dos formulários ficam indisponíveis até ser aplicada.
              </span>
              <Link to="/admin/definicoes" className="font-semibold underline underline-offset-4">
                Ver detalhes
              </Link>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NoAccess({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="eyebrow">Painel Pallessiani</p>
        <h1 className="mt-3 text-4xl">Sem acesso ao painel</h1>
        <p className="mt-3 text-muted-foreground">
          A conta {email} não tem permissões de administração. Se precisa de acesso, peça ao
          proprietário da loja.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link to="/conta" className="underline underline-offset-4">
            A minha conta
          </Link>
          <Link to="/" className="underline underline-offset-4">
            Voltar à loja
          </Link>
          <button onClick={onSignOut} className="underline underline-offset-4">
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
