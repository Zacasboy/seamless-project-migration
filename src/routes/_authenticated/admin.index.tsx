import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { HBars, LineChart } from "@/components/admin/Charts";
import { StatusPill } from "@/components/StatusPill";
import { computeKpis, useChecks, type CheckState } from "@/lib/admin-data";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Overview });

const LABEL: Record<CheckState, string> = { pass: "Passou", fail: "Falhou", none: "Sem dados" };
const ORDER: Record<CheckState, number> = { fail: 0, none: 1, pass: 2 };

function Overview() {
  const { snap, checks } = useChecks();

  if (snap.isLoading)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="A carregar a visão geral">
        <div className="h-10 w-72 animate-pulse bg-muted" />
        <div className="h-64 animate-pulse bg-muted" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  if (snap.isError)
    return (
      <p role="alert" className="text-destructive">
        Não foi possível carregar os dados: {(snap.error as Error).message}
      </p>
    );

  const k = computeKpis(snap.data!);
  const n = { pass: 0, fail: 0, none: 0 } as Record<CheckState, number>;
  checks.forEach((c) => n[c.state]++);
  const sorted = [...checks].sort((a, b) => ORDER[a.state] - ORDER[b.state]);

  return (
    <>
      <AdminHeader
        title="O que decidir hoje"
        intro="Cada verificação compara os dados da loja com um limiar. O que falha aparece primeiro."
      />

      <section className="overflow-hidden rounded border bg-card">
        <div className="grid grid-cols-3 border-b md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(90px,0.45fr))]">
          <div className="col-span-3 border-b p-5 md:col-span-1 md:border-b-0">
            <h2 className="text-2xl">Verificação de hoje</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {n.pass + n.fail} de {checks.length} medidas com dados. Os limiares são propostas
              iniciais.
            </p>
          </div>
          {(["pass", "fail", "none"] as const).map((s, i) => (
            <div key={s} className={`p-5 ${i > 0 ? "border-l" : ""} md:border-l`}>
              <p
                className={`num font-display text-4xl ${s === "pass" ? "text-success" : s === "fail" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {n[s]}
              </p>
              <p className="text-sm">
                {s === "pass" ? "passaram" : s === "fail" ? "falharam" : "sem dados"}
              </p>
            </div>
          ))}
        </div>
        <div
          className="flex h-2 gap-0.5 bg-card"
          role="img"
          aria-label={`${n.pass} passaram, ${n.fail} falharam, ${n.none} sem dados`}
        >
          <i className="bg-success" style={{ flex: n.pass }} />
          <i className="bg-destructive" style={{ flex: n.fail }} />
          <i className="bg-muted" style={{ flex: n.none }} />
        </div>
        <ul>
          {sorted.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-3 border-t px-5 py-3 first:border-t-0 sm:grid-cols-[84px_minmax(0,1fr)_auto]"
            >
              <StatusPill tone={c.state}>{LABEL[c.state]}</StatusPill>
              <div className="min-w-0">
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-muted-foreground">
                  {c.state === "pass" ? (
                    `Limiar: ${c.limit}`
                  ) : (
                    <Link to={c.to} className="hover:text-primary hover:underline">
                      {c.action}
                    </Link>
                  )}
                </p>
              </div>
              <p className="num col-start-2 font-semibold sm:col-start-auto sm:text-right">
                {c.value}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Vendas, 30 dias" value={euro(k.revenue30)} note="Encomendas não canceladas" />
        <Kpi
          label="Encomendas, 30 dias"
          value={String(k.orders30)}
          note={`${k.pending} por confirmar`}
          to="/admin/encomendas"
        />
        <Kpi
          label="Valor médio"
          value={k.orders30 ? euro(k.avg30) : "sem dados"}
          note="Por encomenda"
        />
        <Kpi
          label="Visitas, 7 dias"
          value={String(k.views7)}
          note="Registadas pela loja"
          to="/admin/trafego"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-2xl">Funil, 30 dias</h2>
          <p className="mb-4 text-sm text-muted-foreground">Da visita à entrega.</p>
          {k.views30 === 0 && k.orders30 === 0 ? (
            <p className="py-6 text-muted-foreground">
              O funil aparece quando houver visitas registadas na loja publicada.
            </p>
          ) : (
            <HBars
              items={[
                { label: "Visitas", value: k.views30 },
                { label: "Visitas a produtos", value: k.productViews30 },
                { label: "Encomendas", value: k.orders30 },
                { label: "Entregues", value: k.delivered30 },
              ]}
            />
          )}
        </Panel>
        <Panel>
          <h2 className="text-2xl">Vendas por dia</h2>
          <p className="mb-4 text-sm text-muted-foreground">Últimos 30 dias, em euros.</p>
          {k.orders30 === 0 ? (
            <p className="py-6 text-muted-foreground">
              Ainda sem encomendas. O gráfico aparece com a primeira encomenda.
            </p>
          ) : (
            <LineChart
              label="Vendas por dia nos últimos 30 dias"
              points={k.salesByDay.map((d) => ({ x: d.d, y: d.v }))}
              format={(v) => `${Math.round(v)} €`}
            />
          )}
        </Panel>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  note,
  to,
}: {
  label: string;
  value: string;
  note: string;
  to?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="num mt-1 font-display text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </>
  );
  return to ? (
    <Link to={to} className="rounded border bg-card p-5 hover:border-primary">
      {body}
    </Link>
  ) : (
    <div className="rounded border bg-card p-5">{body}</div>
  );
}
