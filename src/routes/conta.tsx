import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StoreLayout } from "@/components/StoreLayout";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { euro } from "@/lib/cart";
import { dateTime, orderRef, statusLabel, statusTone } from "@/lib/orders";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/conta")({
  ssr: false,
  head: () =>
    seo({ title: "A minha conta", description: "As suas encomendas Pallessiani.", noindex: true }),
  component: Account,
});

function Account() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      // As regras da base de dados só devolvem as encomendas deste utilizador.
      const [orders, admin] = await Promise.all([
        supabase
          .from("orders")
          .select("id,status,total,created_at,order_items(title,quantity,size)")
          .eq("user_id", u.user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);
      if (orders.error) throw new Error(orders.error.message);
      return { email: u.user.email ?? "", orders: orders.data, admin: !!admin.data };
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    await nav({ to: "/" });
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-5xl">A minha conta</h1>
        {q.isLoading ? (
          <div className="mt-8 space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-muted" />
            ))}
          </div>
        ) : q.isError ? (
          <p role="alert" className="mt-8 text-destructive">
            Não foi possível carregar as encomendas. Atualize a página para tentar de novo.
          </p>
        ) : !q.data ? (
          <div className="mt-8">
            <p className="text-muted-foreground">Entre para ver as suas encomendas.</p>
            <Button asChild className="mt-4">
              <Link to="/auth" search={{ redirect: "/conta" }}>
                Entrar
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>{q.data.email}</span>
              {q.data.admin && (
                <Link to="/admin" className="text-primary underline underline-offset-4">
                  Abrir o painel
                </Link>
              )}
              <button onClick={signOut} className="underline underline-offset-4">
                Sair
              </button>
            </div>
            <h2 className="mt-10 text-3xl">Encomendas</h2>
            {q.data.orders.length === 0 ? (
              <p className="mt-4 text-muted-foreground">
                Ainda não fez encomendas.{" "}
                <Link to="/loja" className="underline underline-offset-4">
                  Ver a loja
                </Link>
              </p>
            ) : (
              <ul className="mt-4 divide-y border-y">
                {q.data.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">
                        Encomenda <span className="num">{orderRef(o.id)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{dateTime(o.created_at)}</p>
                      <p className="mt-1 text-sm">
                        {(o.order_items ?? [])
                          .map((i) => `${i.quantity} × ${i.title}${i.size ? ` (${i.size})` : ""}`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusPill tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusPill>
                      <p className="num mt-1 font-display text-xl">{euro(Number(o.total))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </StoreLayout>
  );
}
