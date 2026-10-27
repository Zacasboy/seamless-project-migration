import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Boxes,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Radar,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Painel — Pallessiani" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: Boxes },
  { to: "/admin/colecoes", label: "Coleções", icon: Layers },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/admin/canais", label: "Canais e anúncios", icon: Megaphone },
  { to: "/admin/trafego", label: "Tráfego", icon: BarChart3 },
  { to: "/admin/radar", label: "Radar de oportunidades", icon: Radar },
  { to: "/admin/utilizadores", label: "Utilizadores", icon: ShieldCheck },
  { to: "/admin/definicoes", label: "Definições", icon: Settings },
] as const;

function useAccess() {
  return useQuery({
    queryKey: ["access"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { admin: false, ownerExists: true, email: "" };
      const [{ data: admin }, { data: ownerExists }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
        supabase.rpc("owner_exists"),
      ]);
      return { admin: !!admin, ownerExists: !!ownerExists, email: u.user.email ?? "" };
    },
  });
}

function AdminLayout() {
  const access = useAccess();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (access.isLoading)
    return <p className="p-10 text-center text-muted-foreground">A verificar acesso…</p>;
  if (access.isError)
    return (
      <p className="p-10 text-center text-destructive">Não foi possível verificar o acesso.</p>
    );
  if (!access.data!.admin)
    return (
      <NoAccess
        ownerExists={access.data!.ownerExists}
        email={access.data!.email}
        onSignOut={signOut}
      />
    );

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/" className="font-display text-xl tracking-[0.25em] uppercase">
            Pallessiani
          </Link>
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1 px-3">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-5 text-xs opacity-70">
          <p className="truncate">{access.data!.email}</p>
          <button
            onClick={signOut}
            className="mt-2 flex items-center gap-2 hover:text-sidebar-primary"
          >
            <LogOut className="h-3 w-3" />
            Sair
          </button>
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="flex-1 min-w-0">
        <header className="flex h-16 items-center gap-3 border-b px-6 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg">Painel</span>
        </header>
        <main className="p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NoAccess({
  ownerExists,
  email,
  onSignOut,
}: {
  ownerExists: boolean;
  email: string;
  onSignOut: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function claim() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_owner");
    setBusy(false);
    if (error) return toast.error(`Não foi possível concluir: ${error.message}`);
    if (!data) return toast.error("Já existe um proprietário registado.");
    toast.success("Conta definida como proprietária.");
    qc.invalidateQueries({ queryKey: ["access"] });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="eyebrow">Painel Pallessiani</p>
        {!ownerExists ? (
          <>
            <h1 className="mt-3 text-4xl">Configuração inicial</h1>
            <p className="mt-3 text-muted-foreground">
              Ainda não existe proprietário. Pode definir <b>{email}</b> como proprietário da loja.
              Este passo só pode ser feito uma vez.
            </p>
            <Button className="mt-6" onClick={claim} disabled={busy}>
              Tornar-me proprietário
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-4xl">Sem acesso</h1>
            <p className="mt-3 text-muted-foreground">
              A conta {email} não tem permissões de administração. Peça ao proprietário para lhe
              atribuir acesso.
            </p>
          </>
        )}
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link to="/" className="underline">
            Voltar à loja
          </Link>
          <button onClick={onSignOut} className="underline">
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
