import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { analyticsConfigured } from "@/lib/consent";
import { missingCompanyFields, SITE } from "@/lib/site";

const DAY = 864e5;
const since = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// A migration de 16/11 acrescenta colunas; sem ela algumas gravações falham.
export function useMigrationStatus() {
  return useQuery({
    queryKey: ["admin", "migration"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { error } = await supabase.from("products").select("is_demo,cost").limit(1);
      return { applied: !error };
    },
  });
}

export function useAdminSnapshot() {
  return useQuery({
    queryKey: ["admin", "snapshot"],
    staleTime: 60_000,
    queryFn: async () => {
      const [products, orders, suppliers, customers, views, channels] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,title,published,image_url,image_alt,meta_title,meta_description,stock_status",
          ),
        supabase
          .from("orders")
          .select("id,status,total,created_at")
          .gte("created_at", since(90))
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("suppliers").select("id,name,connected,api_connection_status"),
        supabase.from("customers").select("id,marketing_consent,consent_updated_at"),
        supabase
          .from("page_views")
          .select("path,product_id,created_at")
          .gte("created_at", since(30))
          .limit(20000),
        supabase.from("ad_channels").select("id,name,last_sync_status,budget"),
      ]);
      const err = [products, orders, suppliers, customers, views, channels].find((r) => r.error);
      if (err?.error) throw new Error(err.error.message);
      return {
        products: products.data ?? [],
        orders: orders.data ?? [],
        suppliers: suppliers.data ?? [],
        customers: customers.data ?? [],
        views: views.data ?? [],
        channels: channels.data ?? [],
      };
    },
  });
}

export type Snapshot = NonNullable<ReturnType<typeof useAdminSnapshot>["data"]>;
export type CheckState = "pass" | "fail" | "none";
export type Check = {
  id: string;
  title: string;
  state: CheckState;
  value: string;
  limit: string;
  action: string;
  to: string;
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "sem dados");

export function computeKpis(s: Snapshot) {
  const live = s.orders.filter((o) => o.status !== "cancelled");
  const in30 = live.filter((o) => o.created_at >= since(30));
  const revenue30 = in30.reduce((t, o) => t + Number(o.total), 0);
  const views7 = s.views.filter((v) => v.created_at >= since(7)).length;
  const productViews30 = s.views.filter((v) => v.product_id).length;
  const pending = s.orders.filter((o) => o.status === "pending").length;
  const days = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10),
  );
  const salesByDay = days.map((d) => ({
    d,
    v: in30.filter((o) => o.created_at.startsWith(d)).reduce((t, o) => t + Number(o.total), 0),
    n: s.views.filter((v) => v.created_at.startsWith(d)).length,
  }));
  return {
    revenue30,
    orders30: in30.length,
    avg30: in30.length ? revenue30 / in30.length : 0,
    views7,
    views30: s.views.length,
    productViews30,
    delivered30: in30.filter((o) => o.status === "delivered").length,
    pending,
    salesByDay,
  };
}

export function computeChecks(s: Snapshot, migrationApplied: boolean | undefined): Check[] {
  const out: Check[] = [];
  const add = (c: Check) => out.push(c);
  const pub = s.products.filter((p) => p.published);
  const withImg = pub.filter((p) => p.image_url && p.image_url.startsWith("https://"));

  add({
    id: "migration",
    title: "Base de dados com a atualização de 16/11",
    state: migrationApplied === undefined ? "none" : migrationApplied ? "pass" : "fail",
    value: migrationApplied ? "Aplicada" : "Por aplicar",
    limit: "Aplicada",
    action: "Aplicar a migration 20261116020000 para ativar encomendas e o Radar.",
    to: "/admin/definicoes",
  });

  const late = s.orders.filter(
    (o) => o.status === "pending" && Date.now() - new Date(o.created_at).getTime() > 2 * DAY,
  ).length;
  add({
    id: "orders",
    title: "Encomendas por confirmar há mais de 48 horas",
    state: s.orders.length === 0 ? "none" : late === 0 ? "pass" : "fail",
    value: s.orders.length === 0 ? "sem encomendas" : String(late),
    limit: "0",
    action: "Confirmar ou cancelar as encomendas em atraso.",
    to: "/admin/encomendas",
  });

  add({
    id: "images",
    title: "Produtos publicados com fotografia",
    state: pub.length === 0 ? "none" : withImg.length / pub.length >= 0.8 ? "pass" : "fail",
    value: pct(withImg.length, pub.length),
    limit: "≥ 80%",
    action: "Adicionar URL https da fotografia em Produtos.",
    to: "/admin/produtos",
  });

  const altOk = withImg.filter((p) => p.image_alt && p.image_alt.trim().length >= 5).length;
  add({
    id: "alt",
    title: "Fotografias com texto alternativo",
    state: withImg.length === 0 ? "none" : altOk === withImg.length ? "pass" : "fail",
    value: withImg.length === 0 ? "sem fotografias" : pct(altOk, withImg.length),
    limit: "100%",
    action: "Descrever cada fotografia no campo Texto alternativo.",
    to: "/admin/produtos",
  });

  const seoOk = pub.filter((p) => (p.meta_description ?? "").trim().length >= 50).length;
  add({
    id: "seo",
    title: "Produtos com meta descrição completa",
    state: pub.length === 0 ? "none" : seoOk === pub.length ? "pass" : "fail",
    value: pct(seoOk, pub.length),
    limit: "100%, 50 a 160 caracteres",
    action: "Completar a meta descrição SEO dos produtos.",
    to: "/admin/produtos",
  });

  const stockKnown = pub.filter((p) => p.stock_status !== "unknown").length;
  add({
    id: "stock",
    title: "Produtos com stock indicado",
    state: pub.length === 0 ? "none" : stockKnown / pub.length >= 0.9 ? "pass" : "fail",
    value: pct(stockKnown, pub.length),
    limit: "≥ 90%",
    action: "Definir o estado de stock de cada produto.",
    to: "/admin/produtos",
  });

  const fake = s.suppliers.filter(
    (x) => x.connected && !["connected", "active"].includes(x.api_connection_status),
  ).length;
  add({
    id: "suppliers",
    title: "Fornecedores «ligados» com integração ativa",
    state: s.suppliers.length === 0 ? "none" : fake === 0 ? "pass" : "fail",
    value: fake === 0 ? "Coerente" : `${fake} sem integração`,
    limit: "0 incoerências",
    action: "Rever fornecedores marcados como ligados sem integração configurada.",
    to: "/admin/fornecedores",
  });

  const consentNoDate = s.customers.filter(
    (c) => c.marketing_consent && !c.consent_updated_at,
  ).length;
  add({
    id: "consent",
    title: "Consentimentos de marketing com data registada",
    state: s.customers.length === 0 ? "none" : consentNoDate === 0 ? "pass" : "fail",
    value: consentNoDate === 0 ? "Todos" : `${consentNoDate} sem data`,
    limit: "Todos",
    action: "Registar a data do consentimento ou desmarcá-lo (RGPD).",
    to: "/admin/clientes",
  });

  const missing = missingCompanyFields();
  add({
    id: "company",
    title: "Dados legais e contacto da empresa preenchidos",
    state: missing.length === 0 ? "pass" : "fail",
    value: missing.length === 0 ? "Completos" : `${missing.length} em falta`,
    limit: "Completos",
    action: "Preencher morada, NIPC, email e telefone em src/lib/site.ts.",
    to: "/admin/definicoes",
  });

  const v7 = s.views.filter((v) => v.created_at >= since(7)).length;
  add({
    id: "traffic",
    title: "Visitas registadas nos últimos 7 dias",
    state: v7 > 0 ? "pass" : "fail",
    value: String(v7),
    limit: "> 0",
    action: "Confirmar que a loja está publicada e a registar visitas.",
    to: "/admin/trafego",
  });

  add({
    id: "analytics",
    title: "Google Analytics e domínio configurados",
    state: analyticsConfigured && SITE.url ? "pass" : "fail",
    value:
      [analyticsConfigured ? null : "GA4", SITE.url ? null : "domínio"]
        .filter(Boolean)
        .join(" e ") || "Configurados",
    limit: "Configurados",
    action: "Definir VITE_GA_MEASUREMENT_ID e VITE_SITE_URL no ambiente.",
    to: "/admin/definicoes",
  });

  return out;
}

export function useChecks() {
  const snap = useAdminSnapshot();
  const mig = useMigrationStatus();
  const checks = snap.data ? computeChecks(snap.data, mig.data?.applied) : [];
  return { snap, mig, checks, failed: checks.filter((c) => c.state === "fail").length };
}
