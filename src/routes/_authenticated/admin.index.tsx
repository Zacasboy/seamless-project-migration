/* eslint-disable @typescript-eslint/no-explicit-any -- Admin CRUD uses dynamic table/column keys not represented by the generated Supabase type map. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Overview });

function count(table: string) {
  return async () => {
    const { count, error } = await (supabase.from(table as any) as any).select("*", {
      count: "exact",
      head: true,
    });
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
}

function Overview() {
  const products = useQuery({ queryKey: ["c", "products"], queryFn: count("products") });
  const customers = useQuery({ queryKey: ["c", "customers"], queryFn: count("customers") });
  const views = useQuery({ queryKey: ["c", "page_views"], queryFn: count("page_views") });
  const low = useQuery({
    queryKey: ["lowstock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,stock,price")
        .lt("stock", 5)
        .order("stock");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const cards = [
    { label: "Produtos", v: products.data, to: "/admin/produtos" },
    { label: "Clientes", v: customers.data, to: "/admin/clientes" },
    { label: "Visitas registadas", v: views.data, to: "/admin/trafego" },
  ] as const;
  return (
    <div>
      <h1 className="text-4xl">Visão geral</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-md border bg-card p-5 hover:border-gold">
            <p className="eyebrow">{c.label}</p>
            <p className="mt-2 font-display text-4xl">{c.v ?? "…"}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-10 text-2xl">Stock baixo (&lt; 5)</h2>
      <ul className="mt-3 divide-y rounded-md border bg-card text-sm">
        {(low.data ?? []).map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-2">
            <span>{p.title}</span>
            <span>
              {p.stock} un. · {euro(Number(p.price))}
            </span>
          </li>
        ))}
        {low.data?.length === 0 && (
          <li className="px-4 py-3 text-muted-foreground">Nenhum produto com stock baixo.</li>
        )}
      </ul>
    </div>
  );
}
