import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { Markdown } from "@/components/admin/Markdown";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { euro } from "@/lib/cart";
import {
  AGENTS,
  LANGUAGE_LABEL,
  RULES,
  type ProductLanguage,
  type RuleKey,
  AUTONOMY_LABEL,
  CHANNEL_LABEL,
  ENTITY_LABEL,
  FREQUENCY_LABEL,
  type AgentKey,
} from "@/lib/agents";
import {
  decideAgentAction,
  getAgentRun,
  getAgentsOverview,
  listAgentActions,
  listAgentPlans,
  listMarketingContent,
  runAgentNow,
  runRulesNow,
  setContentStatus,
  updateAgentSettings,
  updateRulesSettings,
  updatePlanStatus,
} from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/admin/agentes")({ component: Page });

type Overview = Awaited<ReturnType<typeof getAgentsOverview>>;
type AgentInfo = Overview["agents"][number];
type ActionRow = Awaited<ReturnType<typeof listAgentActions>>[number];

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—";
const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${(n * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;

function Page() {
  const [openRun, setOpenRun] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ["admin", "agents"],
    queryFn: () => getAgentsOverview(),
    refetchInterval: (q) => (q.state.data?.agents.some((a) => a.lastRun?.status === "running") ? 5000 : false),
  });
  const pendingTotal = overview.data?.agents.reduce((t, a) => t + a.pending, 0) ?? 0;

  return (
    <>
      <AdminHeader
        title="Agentes"
        intro="As rotinas automáticas arrumam o catálogo sem IA e sem custos. Os agentes de IA escrevem, revêem e analisam quando a chave da Anthropic estiver ligada. Cada alteração fica registada e pode ser desfeita."
      />
      {overview.isError && (
        <Panel>
          <p role="alert" className="text-sm text-destructive">
            {(overview.error as Error).message}
          </p>
        </Panel>
      )}
      {pendingTotal + (overview.data?.rules.pending ?? 0) > 0 && <Proposals />}
      {overview.data && <RulesPanel rules={overview.data.rules} onOpenRun={setOpenRun} />}
      <div>
        <h2 className="text-2xl">Agentes de IA</h2>
        <p className="mt-1 text-sm text-muted-foreground">Escrevem, revêem e analisam. Precisam da chave da Anthropic.</p>
      </div>
      {overview.data && <Readiness ready={overview.data.ready} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {(overview.data?.agents ?? []).map((a) => (
          <AgentCard key={a.key} info={a} onOpenRun={setOpenRun} webSearch={overview.data!.ready.webSearch} />
        ))}
        {overview.isLoading &&
          [0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-sm bg-muted" aria-busy="true" />)}
      </div>
      {openRun && <RunDetail id={openRun} onClose={() => setOpenRun(null)} />}
      <Tabs defaultValue="atividade">
        <TabsList>
          <TabsTrigger value="atividade">Diário</TabsTrigger>
          <TabsTrigger value="conteudos">Publicações e anúncios</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
        </TabsList>
        <TabsContent value="atividade">
          <Journal />
        </TabsContent>
        <TabsContent value="conteudos">
          <ContentList />
        </TabsContent>
        <TabsContent value="planos">
          <Plans />
        </TabsContent>
        <TabsContent value="conhecimento">
          <Knowledge />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Readiness({ ready }: { ready: Overview["ready"] }) {
  if (ready.apiKey && ready.serviceRole) return null;
  const missing = [!ready.apiKey && "ANTHROPIC_API_KEY", !ready.serviceRole && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  return (
    <div role="status" className="rounded-sm border border-[#E9D3AE] bg-[#FBF1E1] px-4 py-3 text-sm text-[#5A3A08]">
      <b>Os agentes de IA estão à espera.</b> Falta definir na Vercel (Production, Sensitive): {missing.join(" e ")}. Depois faça
      redeploy. As rotinas automáticas não precisam da chave da Anthropic.
    </div>
  );
}

function RulesPanel({ rules, onOpenRun }: { rules: Overview["rules"]; onOpenRun: (id: string) => void }) {
  const qc = useQueryClient();
  const s = rules.settings;
  const cfg = (s?.config ?? {}) as { rules?: Partial<Record<RuleKey, boolean>>; product_language?: ProductLanguage };
  const initial = () => ({
    enabled: s?.enabled ?? true,
    autonomy: s?.autonomy ?? "auto",
    product_language: cfg.product_language ?? "manter",
    rules: Object.fromEntries(
      (Object.keys(RULES) as RuleKey[]).map((k) => [k, cfg.rules?.[k] ?? RULES[k].default]),
    ) as Record<RuleKey, boolean>,
  });
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setForm(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.updated_at]);
  const edit = (f: typeof form) => {
    setForm(f);
    setDirty(true);
  };
  const run = useMutation({
    mutationFn: () => runRulesNow({ data: {} }),
    onSuccess: (r) => {
      (r.status === "done" ? toast.success : toast.error)(`Rotinas: ${r.summary}`);
      if (r.runId) onOpenRun(r.runId);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const save = useMutation({
    mutationFn: () => updateRulesSettings({ data: form }),
    onSuccess: () => {
      toast.success("Rotinas guardadas.");
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["admin", "agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const last = rules.lastRun;
  if (!s)
    return (
      <Panel>
        <p role="alert" className="text-sm text-destructive">
          Falta aplicar a atualização da base de dados dos agentes.
        </p>
      </Panel>
    );
  return (
    <Panel className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
        <div className="min-w-0">
          <h2 className="text-xl">Rotinas automáticas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Regras fixas, sem IA e sem custo: limpam e arrumam o catálogo todos os dias e logo depois de cada importação.
            Não escrevem textos novos nem inventam dados.
          </p>
          <p className="mt-2 text-sm">
            {last ? (
              <button className="text-left underline-offset-4 hover:underline" onClick={() => onOpenRun(last.id)}>
                Última vez {when(last.started_at)}: {last.status === "error" ? last.error : last.summary}
              </button>
            ) : (
              "Ainda não correram."
            )}
          </p>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? "A correr…" : "Correr agora"}
        </Button>
      </div>
      <form
        className="grid gap-5 p-5 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 font-semibold">O que fazem</legend>
          {(Object.keys(RULES) as RuleKey[]).map((k) => (
            <label key={k} className="flex items-start gap-3 rounded-sm border p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={form.rules[k]}
                onChange={(e) => edit({ ...form, rules: { ...form.rules, [k]: e.target.checked } })}
              />
              <span>
                <span className="font-medium">{RULES[k].label}</span>
                <span className="block text-muted-foreground">{RULES[k].desc}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1">
            <Label htmlFor="rules-lang">Língua dos nomes e descrições</Label>
            <select
              id="rules-lang"
              className="h-10 border bg-card px-3"
              value={form.product_language}
              onChange={(e) => edit({ ...form, product_language: e.target.value as ProductLanguage })}
            >
              {(Object.keys(LANGUAGE_LABEL) as ProductLanguage[]).map((k) => (
                <option key={k} value={k}>
                  {LANGUAGE_LABEL[k]}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">Vale também para o agente de Catálogo. As rotinas só traduzem nomes de cores.</span>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="rules-mode">Alterações</Label>
            <select
              id="rules-mode"
              className="h-10 border bg-card px-3"
              value={form.autonomy}
              onChange={(e) => edit({ ...form, autonomy: e.target.value as "auto" | "propor" })}
            >
              {Object.entries(AUTONOMY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="rules-on" checked={form.enabled} onCheckedChange={(v) => edit({ ...form, enabled: v })} />
            <Label htmlFor="rules-on">Correr todos os dias e após importar</Label>
          </div>
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={!dirty || save.isPending}>
            {save.isPending ? "A guardar…" : "Guardar rotinas"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function AgentCard({
  info,
  onOpenRun,
  webSearch,
}: {
  info: AgentInfo;
  onOpenRun: (id: string) => void;
  webSearch: boolean;
}) {
  const qc = useQueryClient();
  const meta = AGENTS[info.key as AgentKey];
  const [editing, setEditing] = useState(false);
  const run = useMutation({
    mutationFn: () => runAgentNow({ data: { agent: info.key } }),
    onMutate: () => setTimeout(() => void qc.invalidateQueries({ queryKey: ["admin", "agents"] }), 1500),
    onSuccess: (r) => {
      (r.status === "done" ? toast.success : toast.error)(`${meta.name}: ${r.summary}`);
      onOpenRun(r.runId);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const last = info.lastRun;
  const running = run.isPending || last?.status === "running";
  const s = info.settings;
  const needsWeb = info.key === "concorrencia" && !webSearch;

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl">{meta.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{meta.role}</p>
        </div>
        <StatusPill tone={needsWeb || !s?.enabled ? "none" : running ? "info" : last?.status === "error" ? "fail" : "pass"}>
          {needsWeb ? "À espera da pesquisa na web" : !s?.enabled ? "Desligado" : running ? "A trabalhar…" : last?.status === "error" ? "Última falhou" : "Ativo"}
        </StatusPill>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">
        {meta.does.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1 border-t pt-3 text-sm">
        <dt className="text-muted-foreground">Pode alterar</dt>
        <dd>{meta.writes}</dd>
        <dt className="text-muted-foreground">Quando</dt>
        <dd>{s ? FREQUENCY_LABEL[s.frequency] : "—"}</dd>
        <dt className="text-muted-foreground">Modo</dt>
        <dd>{s ? AUTONOMY_LABEL[s.autonomy] : "—"}</dd>
        <dt className="text-muted-foreground">Última vez</dt>
        <dd>
          {last ? (
            <button className="text-left underline-offset-4 hover:underline" onClick={() => onOpenRun(last.id)}>
              {when(last.started_at)} · {last.status === "error" ? last.error : (last.summary ?? "a trabalhar")}
            </button>
          ) : (
            "Ainda não trabalhou"
          )}
        </dd>
        {info.pending > 0 && (
          <>
            <dt className="text-muted-foreground">À espera</dt>
            <dd>{info.pending} propostas para decidir</dd>
          </>
        )}
      </dl>
      {needsWeb && (
        <p className="text-sm text-muted-foreground">
          Este agente só trabalha com pesquisa na web, para cada facto ter fonte. Fica parado até ligar a pesquisa
          (AGENTS_WEB_SEARCH=on na Vercel).
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button onClick={() => run.mutate()} disabled={running || !s?.enabled || needsWeb}>
          {running ? "A trabalhar… (até 4 min)" : "Pôr a trabalhar agora"}
        </Button>
        <Button variant="outline" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          Definições
        </Button>
      </div>
      {editing && s && <SettingsForm agent={info.key as AgentKey} settings={s} onDone={() => setEditing(false)} />}
      {info.runs.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Execuções anteriores</summary>
          <ul className="mt-2 space-y-1">
            {info.runs.slice(1).map((r) => (
              <li key={r.id}>
                <button className="text-left hover:underline" onClick={() => onOpenRun(r.id)}>
                  {when(r.started_at)} · {r.trigger === "cron" ? "agendada" : "manual"} ·{" "}
                  {r.status === "error" ? `falhou: ${r.error}` : r.summary}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function SettingsForm({
  agent,
  settings,
  onDone,
}: {
  agent: AgentKey;
  settings: NonNullable<AgentInfo["settings"]>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    enabled: settings.enabled,
    autonomy: settings.autonomy,
    frequency: settings.frequency,
    instructions: settings.instructions,
  });
  const save = useMutation({
    mutationFn: () => updateAgentSettings({ data: { agent, ...form } }),
    onSuccess: () => {
      toast.success("Definições guardadas.");
      void qc.invalidateQueries({ queryKey: ["admin", "agents"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const id = `ag-${agent}`;
  return (
    <form
      className="grid gap-3 border-t pt-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center gap-3">
        <Switch id={`${id}-on`} checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        <Label htmlFor={`${id}-on`}>Agente ligado</Label>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${id}-f`}>Trabalha</Label>
        <select
          id={`${id}-f`}
          className="h-10 border bg-card px-3"
          value={form.frequency}
          onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })}
        >
          {Object.entries(FREQUENCY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${id}-a`}>Alterações na loja</Label>
        <select
          id={`${id}-a`}
          className="h-10 border bg-card px-3"
          value={form.autonomy}
          onChange={(e) => setForm({ ...form, autonomy: e.target.value as typeof form.autonomy })}
        >
          {Object.entries(AUTONOMY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${id}-i`}>Instruções para o agente</Label>
        <Textarea
          id={`${id}-i`}
          rows={4}
          maxLength={4000}
          placeholder={
            agent === "concorrencia"
              ? "Ex.: compara com Parfois, Bimba y Lola e Mango; foca-te em malas."
              : "Ex.: dá prioridade aos produtos importados esta semana."
          }
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "A guardar…" : "Guardar definições"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function RunDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["admin", "agent-run", id],
    queryFn: () => getAgentRun({ data: { id } }),
    refetchInterval: (s) => (s.state.data?.run.status === "running" ? 4000 : false),
  });
  useEffect(() => {
    document.getElementById("agent-run")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);
  const run = q.data?.run;
  const sources = (run?.sources as { url: string; title: string }[] | undefined) ?? [];
  return (
    <Panel className="p-0">
      <div id="agent-run" className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 className="text-xl">
            {run ? `${run.agent === "regras" ? "Rotinas automáticas" : (AGENTS[run.agent as AgentKey]?.name ?? run.agent)} · ${when(run.started_at)}` : "Relatório"}
          </h2>
          {run && (
            <p className="mt-1 text-xs text-muted-foreground">
              {{ cron: "Execução agendada", manual: "Execução manual", import: "Depois de importar" }[run.trigger]} · {q.data?.actions.length ?? 0} alterações ·{" "}
              {(run.input_tokens + run.output_tokens).toLocaleString("pt-PT")} tokens
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {q.isLoading && <p aria-busy="true">A carregar…</p>}
          {run?.status === "running" && <p className="text-sm text-muted-foreground">O agente está a trabalhar. O relatório aparece aqui quando terminar.</p>}
          {run?.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              A execução falhou: {run.error}
            </p>
          )}
          {run?.report_md && <Markdown source={run.report_md} />}
          {sources.length > 0 && (
            <details className="mt-6 text-sm">
              <summary className="cursor-pointer font-semibold">Fontes consultadas ({sources.length})</summary>
              <ul className="mt-2 space-y-1">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4 break-words">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div>
          <h3 className="text-base font-semibold">Alterações desta execução</h3>
          <ActionList actions={q.data?.actions ?? []} empty="Nenhuma alteração." />
        </div>
      </div>
    </Panel>
  );
}

const STATUS_TONE: Record<string, [string, string]> = {
  applied: ["pass", "Aplicada"],
  proposed: ["warn", "Por decidir"],
  undone: ["none", "Desfeita"],
  rejected: ["none", "Rejeitada"],
  failed: ["fail", "Falhou"],
};

function short(v: unknown) {
  if (v === null || v === undefined || v === "") return "vazio";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 220 ? `${s.slice(0, 220)}…` : s;
}

function ActionList({ actions, empty }: { actions: ActionRow[]; empty: string }) {
  const qc = useQueryClient();
  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" | "undo" }) => decideAgentAction({ data: v }),
    onSuccess: (r) =>
      toast.success(r.status === "undone" ? "Alteração desfeita." : r.status === "applied" ? "Alteração aplicada." : "Proposta rejeitada."),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  if (!actions.length) return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-2 divide-y text-sm">
      {actions.map((a) => {
        const [tone, label] = STATUS_TONE[a.status] ?? ["none", a.status];
        const fields = Object.keys(a.after ?? a.before ?? {}).filter((k) => !["updated_at", "updated_by_agent", "agent"].includes(k));
        return (
          <li key={a.id} className="grid gap-1.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={tone}>{label}</StatusPill>
              <span className="text-xs text-muted-foreground">
                {ENTITY_LABEL[a.entity] ?? a.entity} · {(a.agent === "regras" ? "Rotinas" : (AGENTS[a.agent as AgentKey]?.name ?? a.agent))} · {when(a.created_at)}
              </span>
            </div>
            <p className="font-medium">{a.label}</p>
            {a.reason && <p className="text-muted-foreground">{a.reason}</p>}
            {a.error && <p className="text-destructive">{a.error}</p>}
            {a.op === "update" && fields.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">Ver antes e depois</summary>
                <dl className="mt-2 grid gap-2 text-xs">
                  {fields.slice(0, 12).map((k) => (
                    <div key={k}>
                      <dt className="font-semibold">{k}</dt>
                      <dd className="text-muted-foreground line-through">{short(a.before?.[k])}</dd>
                      <dd>{short(a.after?.[k])}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <div className="flex gap-2">
              {a.status === "proposed" && (
                <>
                  <Button size="sm" onClick={() => decide.mutate({ id: a.id, decision: "approve" })} disabled={decide.isPending}>
                    Aplicar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, decision: "reject" })} disabled={decide.isPending}>
                    Rejeitar
                  </Button>
                </>
              )}
              {a.status === "applied" && (
                <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, decision: "undo" })} disabled={decide.isPending}>
                  Desfazer
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Proposals() {
  const q = useQuery({ queryKey: ["admin", "agent-actions", "proposed"], queryFn: () => listAgentActions({ data: { status: "proposed", limit: 100 } }) });
  return (
    <Panel>
      <h2 className="text-xl">Propostas à espera da sua decisão</h2>
      <p className="mt-1 text-sm text-muted-foreground">Os agentes em modo «propor», e as mudanças de tema, esperam por si antes de mudar a loja.</p>
      <ActionList actions={q.data ?? []} empty="Nada pendente." />
    </Panel>
  );
}

function Journal() {
  const q = useQuery({ queryKey: ["admin", "agent-actions", "all"], queryFn: () => listAgentActions({ data: { status: "all", limit: 80 } }) });
  return (
    <Panel>
      <h2 className="text-xl">Diário de alterações</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tudo o que os agentes mudaram, mais recente primeiro. «Desfazer» repõe o valor anterior, desde que ninguém o tenha alterado depois.
      </p>
      {q.isError && <p role="alert" className="mt-2 text-sm text-destructive">{(q.error as Error).message}</p>}
      <ActionList actions={q.data ?? []} empty="Os agentes ainda não fizeram alterações." />
    </Panel>
  );
}

function ContentList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "marketing-content"], queryFn: () => listMarketingContent() });
  const set = useMutation({
    mutationFn: (v: { id: string; status: "draft" | "approved" | "published" | "archived" }) => setContentStatus({ data: v }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin", "marketing-content"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const items = q.data ?? [];
  if (q.isError) return <Panel><p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p></Panel>;
  if (!items.length && !q.isLoading)
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Ainda não há publicações nem anúncios. Ponha o agente de Conteúdo a trabalhar para receber as primeiras propostas.
        </p>
      </Panel>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((c) => (
        <Panel key={c.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={c.status === "approved" ? "pass" : c.status === "published" ? "info" : "none"}>
              {{ draft: "Rascunho", approved: "Aprovado", published: "Publicado", archived: "Arquivado" }[c.status]}
            </StatusPill>
            <span className="text-xs text-muted-foreground">
              {CHANNEL_LABEL[c.channel] ?? c.channel} · {when(c.created_at)}
            </span>
          </div>
          <h3 className="text-lg">{c.title}</h3>
          <dl className="grid grid-cols-3 gap-2 border-y py-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">CTR estimado</dt>
              <dd className="num">{pct(c.expected_ctr)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Conversão est.</dt>
              <dd className="num">{pct(c.expected_cvr)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Prob. de sucesso</dt>
              <dd className="num">{pct(c.success_probability)}</dd>
            </div>
          </dl>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm">{c.body}</pre>
          {c.hashtags.length > 0 && <p className="text-sm text-muted-foreground">{c.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>}
          {(c.audience || c.budget_eur) && (
            <p className="text-sm">
              {c.audience && <>Público: {c.audience}. </>}
              {c.budget_eur ? <>Orçamento sugerido: {euro(Number(c.budget_eur))}.</> : null}
            </p>
          )}
          {c.rationale && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Base da estimativa</summary>
              <p className="mt-1">{c.rationale}</p>
            </details>
          )}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText([c.body, c.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")].filter(Boolean).join("\n\n"))
                  .then(() => toast.success("Texto copiado."))
              }
            >
              Copiar texto
            </Button>
            {c.status === "draft" && (
              <Button size="sm" onClick={() => set.mutate({ id: c.id, status: "approved" })}>
                Aprovar
              </Button>
            )}
            {c.status === "approved" && (
              <Button size="sm" onClick={() => set.mutate({ id: c.id, status: "published" })}>
                Marcar como publicado
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => set.mutate({ id: c.id, status: "archived" })}>
              Arquivar
            </Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}

type PlanAction = { titulo: string; responsavel: string; prioridade: string; esforco: string; prazo?: string; feito?: boolean };

function Plans() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "agent-plans"], queryFn: () => listAgentPlans() });
  const upd = useMutation({
    mutationFn: (v: { id: string; status?: "open" | "in_progress" | "done" | "archived"; toggleAction?: number }) => updatePlanStatus({ data: v }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin", "agent-plans"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const plans = q.data?.plans ?? [];
  if (!plans.length && !q.isLoading)
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">Ainda não há planos. Os agentes de Concorrência e de Marca criam-nos.</p>
      </Panel>
    );
  return (
    <div className="grid gap-4">
      {plans.map((p) => {
        const actions = (p.actions as PlanAction[] | null) ?? [];
        return (
          <Panel key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl">{p.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {AGENTS[p.agent as AgentKey]?.name ?? p.agent} · atualizado {when(p.updated_at)}
                </p>
              </div>
              <select
                aria-label="Estado do plano"
                className="h-9 border bg-card px-2 text-sm"
                value={p.status}
                onChange={(e) => upd.mutate({ id: p.id, status: e.target.value as "open" })}
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em curso</option>
                <option value="done">Concluído</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
            {actions.length > 0 && (
              <ul className="mt-4 divide-y border-y text-sm">
                {actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!a.feito}
                      onChange={() => upd.mutate({ id: p.id, toggleAction: i })}
                      aria-label={`Marcar «${a.titulo}» como feito`}
                    />
                    <span className={a.feito ? "text-muted-foreground line-through" : ""}>
                      {a.titulo}
                      <span className="block text-xs text-muted-foreground">
                        {a.responsavel === "humano" ? "Para si" : (AGENTS[a.responsavel as AgentKey]?.name ?? a.responsavel)} · prioridade{" "}
                        {a.prioridade} · esforço {a.esforco}
                        {a.prazo ? ` · ${a.prazo}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Ler o plano completo</summary>
              <Markdown source={p.body_md} />
            </details>
          </Panel>
        );
      })}
    </div>
  );
}

const MEMORY_LABEL: Record<string, string> = {
  guia_marca: "Guia da marca (agente de Marca)",
  concorrentes: "Concorrentes (agente de Concorrência)",
  palavras_chave: "Palavras-chave (agente de Catálogo)",
};

function Knowledge() {
  const q = useQuery({ queryKey: ["admin", "agent-plans"], queryFn: () => listAgentPlans() });
  const memory = q.data?.memory ?? [];
  if (!memory.length && !q.isLoading)
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Os agentes ainda não guardaram conhecimento. O guia da marca é criado na primeira execução do agente de Marca.
        </p>
      </Panel>
    );
  return (
    <div className="grid gap-4">
      {memory.map((m) => (
        <Panel key={m.key}>
          <h3 className="text-lg">{MEMORY_LABEL[m.key] ?? m.key}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Atualizado {when(m.updated_at)}</p>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(m.value, null, 2)}</pre>
        </Panel>
      ))}
    </div>
  );
}
