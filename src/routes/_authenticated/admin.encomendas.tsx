import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { OrderStatus } from "@/integrations/supabase/types";
import { euro } from "@/lib/cart";
import {
  ORDER_STATUS,
  dateTime,
  orderRef,
  shippingOf,
  statusLabel,
  statusTone,
} from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/admin/encomendas")({ component: Page });

const STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];

function useOrders() {
  return useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id,title,quantity,unit_price,size,color,product_id)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      const ids = [...new Set((data ?? []).map((o) => o.user_id))];
      const emails = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id,email").in("id", ids);
        for (const p of profiles ?? []) if (p.email) emails.set(p.id, p.email);
      }
      return (data ?? []).map((o) => ({ ...o, email: emails.get(o.user_id) ?? "" }));
    },
  });
}

type Order = NonNullable<ReturnType<typeof useOrders>["data"]>[number];

function Page() {
  const orders = useOrders();
  const [filter, setFilter] = useState<OrderStatus | "all">("pending");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Order | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.data?.length ?? 0 };
    for (const o of orders.data ?? []) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders.data]);

  const list = (orders.data ?? []).filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const sh = shippingOf(o.shipping);
    return [orderRef(o.id), sh.name, sh.city, o.email].some((v) =>
      (v ?? "").toLowerCase().includes(s),
    );
  });

  return (
    <>
      <AdminHeader
        title="Encomendas"
        intro="Confirme a disponibilidade, combine o pagamento com o cliente e acompanhe a entrega. Os totais foram calculados com os preços da base de dados."
      />
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar por estado"
      >
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`rounded border px-3 py-1.5 text-sm ${filter === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
          >
            {s === "all" ? "Todas" : ORDER_STATUS[s].label}{" "}
            <span className="num opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
        <input
          type="search"
          placeholder="Pesquisar referência, nome ou email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Pesquisar encomendas"
          className="ml-auto h-9 w-full rounded border bg-card px-3 text-sm sm:w-72"
        />
      </div>

      <div className="overflow-x-auto rounded border bg-card">
        {orders.isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-muted" />
            ))}
          </div>
        ) : orders.isError ? (
          <p role="alert" className="p-6 text-destructive">
            Não foi possível carregar as encomendas: {(orders.error as Error).message}
          </p>
        ) : list.length === 0 ? (
          <p className="p-8 text-muted-foreground">
            {counts["all"] === 0
              ? "Ainda não há encomendas. Aparecem aqui assim que um cliente concluir uma encomenda na loja."
              : "Nenhuma encomenda com este filtro."}
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Referência</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Artigos</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const sh = shippingOf(o.shipping);
                const qty = (o.order_items ?? []).reduce((t, i) => t + i.quantity, 0);
                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-t hover:bg-muted/50"
                    onClick={() => setOpen(o)}
                  >
                    <td className="px-4 py-3">
                      <button
                        className="num font-semibold underline-offset-4 hover:underline"
                        onClick={() => setOpen(o)}
                      >
                        {orderRef(o.id)}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(o.created_at)}</td>
                    <td className="px-4 py-3">
                      {sh.name ?? "—"}
                      <span className="block text-xs text-muted-foreground">
                        {o.email || sh.city}
                      </span>
                    </td>
                    <td className="num px-4 py-3">{qty}</td>
                    <td className="num px-4 py-3 text-right">{euro(Number(o.total))}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <OrderDialog order={open} onClose={() => setOpen(null)} />
    </>
  );
}

function OrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [key, setKey] = useState("");
  if (order && key !== order.id) {
    setKey(order.id);
    setStatus(order.status);
    setNotes(order.admin_notes ?? "");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const { error } = await supabase
        .from("orders")
        .update({ status, admin_notes: notes.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", order.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Encomenda atualizada");
      qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    },
    onError: (e: Error) => toast.error(`Não foi possível guardar: ${e.message}`),
  });

  const sh = order ? shippingOf(order.shipping) : {};
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-medium">
                Encomenda <span className="num">{orderRef(order.id)}</span>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{dateTime(order.created_at)}</p>
            </DialogHeader>

            <ul className="divide-y border-y text-sm">
              {(order.order_items ?? []).map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {i.quantity} × {i.title}
                    {(i.size || i.color) && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {[i.size, i.color].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="num">{euro(Number(i.unit_price) * i.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 font-semibold">
                <span>Total</span>
                <span className="num">{euro(Number(order.total))}</span>
              </li>
            </ul>

            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Nome</dt>
              <dd>{sh.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{order.email || "—"}</dd>
              <dt className="text-muted-foreground">Telefone</dt>
              <dd>{sh.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Morada</dt>
              <dd>
                {sh.address ?? "—"}
                <br />
                {sh.postal_code} {sh.city}
              </dd>
              {sh.nif && (
                <>
                  <dt className="text-muted-foreground">NIF</dt>
                  <dd className="num">{sh.nif}</dd>
                </>
              )}
              {order.notes && (
                <>
                  <dt className="text-muted-foreground">Notas do cliente</dt>
                  <dd className="whitespace-pre-wrap">{order.notes}</dd>
                </>
              )}
            </dl>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div>
                <Label htmlFor="o-status">Estado</Label>
                <select
                  id="o-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 h-10 w-full rounded border bg-card px-3 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="o-notes">Notas internas</Label>
                <Textarea
                  id="o-notes"
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pagamento combinado, transportadora, número de seguimento…"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Fechar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "A guardar…" : "Guardar alterações"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
