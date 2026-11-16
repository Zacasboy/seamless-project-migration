import type { OrderStatus, ShippingInfo } from "@/integrations/supabase/types";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  pending: { label: "Por confirmar", tone: "warn" },
  confirmed: { label: "Confirmada", tone: "info" },
  shipped: { label: "Enviada", tone: "info" },
  delivered: { label: "Entregue", tone: "pass" },
  cancelled: { label: "Cancelada", tone: "none" },
};

export const statusLabel = (s: string) => ORDER_STATUS[s as OrderStatus]?.label ?? s;
export const statusTone = (s: string) => ORDER_STATUS[s as OrderStatus]?.tone ?? "none";

export const shippingOf = (v: unknown): ShippingInfo =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as ShippingInfo) : {};

export const orderRef = (id: string) => id.slice(0, 8).toUpperCase();

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
