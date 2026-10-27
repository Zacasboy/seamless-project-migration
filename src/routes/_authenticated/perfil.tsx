import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { StoreLayout } from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "O meu perfil — Pallessiani" },
      { name: "description", content: "Os seus dados e encomendas Pallessiani." },
      { property: "og:title", content: "O meu perfil — Pallessiani" },
      { property: "og:description", content: "Os seus dados e encomendas Pallessiani." },
    ],
  }),
  component: ProfilePage,
});

const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^(\+?[0-9 ()-]{6,20})?$/, "Número inválido");
const emailSchema = z.string().trim().toLowerCase().email("Email inválido").max(254);

type Profile = { id: string; email: string | null; full_name: string | null; phone: string | null };
type Order = {
  id: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  order_items: { id: string; title: string; quantity: number }[];
};
type EmailReq = { id: string; new_email: string; status: string; created_at: string };

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [requests, setRequests] = useState<EmailReq[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phone, setPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, o, r, a] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, status, total, currency, created_at, order_items(id, title, quantity)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("email_change_requests")
        .select("id, new_email, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.rpc("has_role", { _role: "admin", _user_id: user.id }),
    ]);
    if (p.error || o.error) setError("Não foi possível carregar o perfil.");
    setProfile(p.data);
    setPhone(p.data?.phone ?? "");
    setOrders((o.data as Order[] | null) ?? []);
    setRequests(r.data ?? []);
    setIsAdmin(Boolean(a.data));
  }, [user.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Inválido");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: parsed.data || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error("Não foi possível guardar o telemóvel.");
    else {
      toast.success("Telemóvel atualizado.");
      void load();
    }
  }

  async function requestEmail(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Inválido");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("email_change_requests")
      .insert({ new_email: parsed.data } as never);
    setBusy(false);
    if (error) toast.error(error.code === "23505" ? "Já tem um pedido pendente." : error.message);
    else {
      toast.success("Pedido enviado. Aguarda aprovação.");
      setNewEmail("");
      void load();
    }
  }

  async function cancelRequest(id: string) {
    const { error } = await supabase.rpc("cancel_my_email_change_request", { _id: id });
    if (error) toast.error("Não foi possível cancelar.");
    else void load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  const pending = requests.find((r) => r.status === "pending");
  const currentEmail = (profile?.email ?? user.email ?? "").toLowerCase();
  const approved = requests.find((r) => r.status === "approved" && r.new_email !== currentEmail);

  async function confirmApproved(email: string) {
    setBusy(true);
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: window.location.origin + "/perfil" },
    );
    setBusy(false);
    if (error) toast.error("Não foi possível enviar a confirmação.");
    else toast.success("Enviámos um link de confirmação. O email muda depois de o abrir.");
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl">O meu perfil</h1>
          <div className="flex gap-2">
            {isAdmin && (
              <Button asChild variant="outline">
                <Link to="/admin">Painel admin</Link>
              </Button>
            )}
            <Button variant="outline" onClick={signOut}>
              Terminar sessão
            </Button>
          </div>
        </div>
        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        <section className="mt-10 space-y-6 rounded-lg border p-6" aria-labelledby="dados">
          <h2 id="dados" className="text-2xl">
            Dados
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nome</dt>
              <dd>{profile?.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{profile?.email ?? user.email}</dd>
            </div>
          </dl>
          <form onSubmit={savePhone} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="phone">Telemóvel</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 912 345 678"
              />
            </div>
            <Button type="submit" disabled={busy}>
              Guardar
            </Button>
          </form>
          <div>
            <h3 className="font-medium">Alterar email</h3>
            <p className="text-sm text-muted-foreground">
              Por segurança, a alteração de email é revista pela equipa antes de ser aplicada.
            </p>
            {approved && !pending && (
              <div className="mt-3 flex flex-col gap-2 rounded-md bg-muted p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Alteração aprovada para <strong>{approved.new_email}</strong>. Confirme o novo
                  endereço.
                </span>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => confirmApproved(approved.new_email)}
                >
                  Enviar confirmação
                </Button>
              </div>
            )}
            {pending ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted p-3 text-sm">
                <span>
                  Pedido pendente para <strong>{pending.new_email}</strong>
                </span>
                <Button size="sm" variant="ghost" onClick={() => cancelRequest(pending.id)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <form
                onSubmit={requestEmail}
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Label htmlFor="newEmail">Novo email</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    required
                    maxLength={254}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  Pedir alteração
                </Button>
              </form>
            )}
            {requests
              .filter((r) => r.status !== "pending")
              .slice(0, 3)
              .map((r) => (
                <p key={r.id} className="mt-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("pt-PT")} · {r.new_email} ·{" "}
                  {r.status === "approved"
                    ? "aprovado"
                    : r.status === "completed"
                      ? "concluído"
                      : r.status === "rejected"
                        ? "rejeitado"
                        : "cancelado"}
                </p>
              ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border p-6" aria-labelledby="encomendas">
          <h2 id="encomendas" className="text-2xl">
            Encomendas
          </h2>
          {orders === null && <p className="mt-4 text-sm text-muted-foreground">A carregar…</p>}
          {orders?.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Ainda não tem encomendas.{" "}
              <Link to="/loja" className="underline">
                Ver a loja
              </Link>
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {orders?.map((o) => (
              <li key={o.id} className="rounded-md border p-4 text-sm">
                <div className="flex justify-between">
                  <span>
                    {new Date(o.created_at).toLocaleDateString("pt-PT")} · {o.status}
                  </span>
                  <strong>
                    {Number(o.total).toFixed(2)} {o.currency}
                  </strong>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {o.order_items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </StoreLayout>
  );
}