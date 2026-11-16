import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { METHOD_LABEL, channelOf, type ChannelMethod, type ChannelState } from "@/lib/channels";
import { checkChannels } from "@/lib/suppliers.functions";

const TONE: Record<ChannelState, "pass" | "warn" | "fail" | "none"> = {
  ok: "pass",
  warn: "warn",
  fail: "fail",
  info: "none",
};
const STATE_LABEL: Record<ChannelState, string> = {
  ok: "Em ordem",
  warn: "Atenção",
  fail: "Problema",
  info: "Informação",
};
const ORDER: ChannelMethod[] = ["api", "api-possible", "csv", "stock", "none"];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—";

// Importadores que a loja usa, com verificação automática ao abrir e a cada 15 minutos.
export function ChannelsSection() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState("");
  const checks = useQuery({
    queryKey: ["admin", "channels"],
    queryFn: () => checkChannels(),
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const all = useQuery({
    queryKey: ["admin", "suppliers-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, connected")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase.from("suppliers").update({ connected: on }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      toast.success(v.on ? "Importador adicionado" : "Importador retirado");
      setAdding("");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = checks.data?.channels ?? [];
  const available = (all.data ?? []).filter((s) => !s.connected);
  const problems = list.filter((c) => c.state === "fail" || c.state === "warn").length;

  return (
    <Panel className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
        <div>
          <h2 className="text-xl">Importadores selecionados</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
            Os fornecedores que a loja usa e como cada um importa. A verificação corre sozinha ao
            abrir esta página, a cada 15 minutos e na tarefa automática do servidor.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant="outline"
            onClick={() => void checks.refetch()}
            disabled={checks.isFetching}
          >
            {checks.isFetching ? "A verificar…" : "Verificar agora"}
          </Button>
          <span className="num text-xs text-muted-foreground" aria-live="polite">
            {checks.data
              ? `Verificado ${when(checks.data.checkedAt)} · ${problems ? `${problems} a rever` : "sem problemas"}`
              : ""}
          </span>
        </div>
      </div>

      {checks.isError && (
        <p role="alert" className="border-b p-5 text-sm text-destructive">
          Não foi possível verificar os canais: {(checks.error as Error).message}
        </p>
      )}

      {checks.isLoading ? (
        <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse bg-card" />
          ))}
        </div>
      ) : list.length === 0 && !checks.isError ? (
        <p className="p-5 text-sm text-muted-foreground">
          Ainda não há importadores selecionados. Adicione os fornecedores com que trabalha.
        </p>
      ) : list.length === 0 ? null : (
        <ul className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
          {[...list]
            .sort(
              (a, b) =>
                ORDER.indexOf(a.method) - ORDER.indexOf(b.method) || a.name.localeCompare(b.name),
            )
            .map((c) => (
              <li key={c.supplierId} className="flex flex-col gap-3 bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {METHOD_LABEL[c.method]}
                    </p>
                  </div>
                  <StatusPill tone={TONE[c.state]}>{STATE_LABEL[c.state]}</StatusPill>
                </div>
                <p className="text-sm">{c.message}</p>
                <p className="text-xs text-muted-foreground">{channelOf(c.name).note}</p>
                <dl className="num grid grid-cols-2 gap-1 text-xs">
                  <dt className="text-muted-foreground">Produtos</dt>
                  <dd className="text-right">{c.products}</dd>
                  <dt className="text-muted-foreground">Última atividade</dt>
                  <dd className="text-right">{when(c.lastActivity)}</dd>
                </dl>
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-sm">
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Página do fornecedor
                    </a>
                  )}
                  {c.docsUrl && (
                    <a
                      href={c.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      {c.method === "api" || c.method === "api-possible"
                        ? "API e chave"
                        : "Documentação"}
                    </a>
                  )}
                  {c.method !== "none" && (
                    <Link to="/admin/importar" className="underline underline-offset-4">
                      Importar
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ id: c.supplierId, on: false })}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                  >
                    Retirar
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-center gap-3 border-t p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (adding) toggle.mutate({ id: adding, on: true });
        }}
      >
        <label htmlFor="add-channel" className="text-sm">
          Adicionar importador
        </label>
        <select
          id="add-channel"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          className="h-10 min-w-64 border bg-card px-3 text-sm"
        >
          <option value="">Escolher fornecedor…</option>
          {ORDER.map((m) => {
            const opts = available.filter((s) => channelOf(s.name).method === m);
            return opts.length ? (
              <optgroup key={m} label={METHOD_LABEL[m]}>
                {opts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
        <Button type="submit" variant="outline" disabled={!adding || toggle.isPending}>
          Adicionar
        </Button>
      </form>
    </Panel>
  );
}
