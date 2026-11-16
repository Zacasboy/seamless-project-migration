import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { STORE_THEMES, normalizeTheme, type StoreThemeId } from "@/lib/theme";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { useMigrationStatus } from "@/lib/admin-data";
import { analyticsConfigured } from "@/lib/consent";
import { SITE, missingCompanyFields } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/definicoes")({ component: Page });

const LABELS: Record<string, string> = {
  legalName: "Denominação social",
  nif: "NIPC",
  address: "Morada",
  postalCode: "Código postal",
  city: "Localidade",
  email: "Email",
  phone: "Telefone",
};

function Page() {
  const mig = useMigrationStatus();
  const missing = missingCompanyFields();
  const rows: { name: string; ok: boolean | undefined; detail: string }[] = [
    {
      name: "Atualização da base de dados de 16/11",
      ok: mig.data?.applied,
      detail:
        "Ficheiro supabase/migrations/20261116020000_admin_alignment_orders.sql. Ativa encomendas seguras, Radar, métricas de canais e gestão de administradores. Só acrescenta; não apaga dados.",
    },
    {
      name: "Dados legais da empresa",
      ok: missing.length === 0,
      detail: missing.length
        ? `Em falta em src/lib/site.ts: ${missing.map((m) => LABELS[m] ?? m).join(", ")}.`
        : "Completos. Aparecem no rodapé, contacto, termos e privacidade.",
    },
    {
      name: "Domínio público",
      ok: !!SITE.url,
      detail: SITE.url
        ? SITE.url
        : "Defina VITE_SITE_URL (ex.: https://pallessiani.pt) para URLs canónicos e sitemap.",
    },
    {
      name: "Google Analytics 4",
      ok: analyticsConfigured,
      detail: analyticsConfigured
        ? "Configurado. Só carrega depois de o visitante aceitar cookies de análise."
        : "Defina VITE_GA_MEASUREMENT_ID (G-XXXXXXX). Sem ele, contam só as visitas próprias da loja.",
    },
    {
      name: "Pagamentos online",
      ok: false,
      detail:
        "Ainda não ativos. As encomendas ficam por confirmar e o pagamento é combinado com o cliente. Ao ligar um fornecedor de pagamentos, os webhooks têm de ser verificados por assinatura no servidor.",
    },
    {
      name: "Fornecedores e canais",
      ok: undefined,
      detail:
        "Cada integração precisa de um adaptador no servidor e de chaves guardadas como segredos do servidor, nunca no browser.",
    },
  ];
  return (
    <>
      <AdminHeader title="Definições" intro="Aspeto da loja e estado da configuração." />
      <ThemePanel />
      <Panel className="p-0">
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.name}
              className="grid items-start gap-2 px-5 py-4 sm:grid-cols-[110px_minmax(0,1fr)]"
            >
              <StatusPill
                className="mt-0.5"
                tone={r.ok === undefined ? "none" : r.ok ? "pass" : "warn"}
              >
                {r.ok === undefined ? "Informação" : r.ok ? "Feito" : "Por fazer"}
              </StatusPill>
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function useSavedTheme() {
  return useQuery({
    queryKey: ["admin", "store-theme"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("value, updated_at")
        .eq("key", "theme")
        .maybeSingle();
      if (error) return { ready: false as const, theme: normalizeTheme(null), updatedAt: null };
      return {
        ready: true as const,
        theme: normalizeTheme(data?.value),
        updatedAt: data?.updated_at ?? null,
      };
    },
  });
}

function ThemePanel() {
  const qc = useQueryClient();
  const saved = useSavedTheme();
  const [choice, setChoice] = useState<StoreThemeId | null>(null);
  const current = choice ?? saved.data?.theme ?? "ficha";

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("store_settings").upsert({
        key: "theme",
        value: current,
        updated_by: u.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Tema da loja atualizado");
      setChoice(null);
      void qc.invalidateQueries({ queryKey: ["admin", "store-theme"] });
      void qc.invalidateQueries({ queryKey: ["store-theme"] });
    },
    onError: (e: Error) => toast.error(`Não foi possível guardar o tema: ${e.message}`),
  });

  const dirty = saved.data?.ready && current !== saved.data.theme;

  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl">Tema da loja</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Muda as cores e a tipografia da loja para todos os visitantes. O painel mantém sempre o
            mesmo aspeto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-4"
          >
            Abrir a loja
          </a>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "A guardar…" : "Aplicar tema"}
          </Button>
        </div>
      </div>
      {saved.data && !saved.data.ready && (
        <p
          role="status"
          className="mt-4 border border-[#E9D3AE] bg-[#FBF1E1] px-4 py-3 text-sm text-[#5A3A08]"
        >
          Para guardar o tema falta aplicar a atualização da base de dados
          supabase/migrations/20261116031500_store_settings.sql. Até lá a loja usa a Ficha técnica.
        </p>
      )}
      <div role="radiogroup" aria-label="Tema da loja" className="mt-5 grid gap-4 md:grid-cols-3">
        {STORE_THEMES.map((t) => {
          const on = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saved.data ? !saved.data.ready : true}
              onClick={() => setChoice(t.id)}
              className={`flex flex-col gap-3 border bg-card p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]" : "hover:border-foreground/50"}`}
            >
              <div
                data-theme={t.id}
                className="store-theme flex h-28 flex-col justify-between border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="logo text-[11px]">Pallessiani</span>
                  <span className="nav-link text-[10px]">Carrinho (0)</span>
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">Mala Castanha Clássica</p>
                  <p className="spec text-[11px]">Pele castanha, fecho dourado</p>
                </div>
              </div>
              <div className="flex gap-1.5" aria-hidden>
                {t.swatches.map((c) => (
                  <span key={c} className="h-4 w-8 border" style={{ background: c }} />
                ))}
              </div>
              <div>
                <p className="flex items-center justify-between font-medium">
                  {t.name}
                  {saved.data?.theme === t.id && <StatusPill tone="pass">Em uso</StatusPill>}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
