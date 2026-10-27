import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/trafego")({ component: Page });

function Page() {
  const q = useQuery({
    queryKey: ["traffic"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const { data, error } = await supabase.from("page_views").select("path,created_at").gte("created_at", since).limit(10000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const byDay = days.map((d) => ({ d, n: (q.data ?? []).filter((v) => v.created_at.startsWith(d)).length }));
  const max = Math.max(1, ...byDay.map((x) => x.n));
  const byPath = Object.entries((q.data ?? []).reduce<Record<string, number>>((a, v) => ((a[v.path] = (a[v.path] ?? 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <div>
      <h1 className="text-4xl">Tráfego</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visitas reais registadas pela própria loja (últimos 14 dias). Sem dados pessoais.</p>
      {q.isLoading ? <p className="mt-6">A carregar…</p> : q.isError ? <p className="mt-6 text-destructive">Erro ao carregar.</p> : (
        <>
          <div className="mt-6 flex h-48 items-end gap-2 rounded-md border bg-card p-4">
            {byDay.map((x) => (
              <div key={x.d} className="flex flex-1 flex-col items-center gap-1" title={`${x.d}: ${x.n}`}>
                <div className="w-full bg-gold" style={{ height: `${(x.n / max) * 140}px` }} />
                <span className="text-[10px] text-muted-foreground">{x.d.slice(8)}</span>
              </div>
            ))}
          </div>
          <h2 className="mt-8 text-2xl">Páginas mais vistas</h2>
          <ul className="mt-3 divide-y rounded-md border bg-card text-sm">
            {byPath.map(([p, n]) => <li key={p} className="flex justify-between px-4 py-2"><span>{p}</span><span>{n}</span></li>)}
            {byPath.length === 0 && <li className="px-4 py-3 text-muted-foreground">Ainda sem visitas.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
