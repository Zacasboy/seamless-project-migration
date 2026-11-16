import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/utilizadores")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const admins = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").eq("role", "admin");
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((r) => r.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,email").in("id", ids)
        : { data: [] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p.email ?? ""]));
      return (data ?? []).map((r) => ({ ...r, email: map.get(r.user_id) ?? "" }));
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError("Indique um email válido.");
      return;
    }
    setBusy(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", value)
      .maybeSingle();
    if (!profile) {
      setBusy(false);
      setError("Não existe nenhuma conta com este email. A pessoa tem de se registar primeiro.");
      return;
    }
    const { error: err } = await supabase
      .from("user_roles")
      .insert({ user_id: profile.id, role: "admin" });
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("duplicate")
          ? "Esta conta já é administradora."
          : err.message.includes("row-level security")
            ? "Sem permissão. Aplique a migration de 16/11 para gerir administradores aqui."
            : `Não foi possível adicionar: ${err.message}`,
      );
      return;
    }
    setEmail("");
    toast.success("Administrador adicionado");
    qc.invalidateQueries({ queryKey: ["admin", "roles"] });
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from("user_roles").delete().eq("id", id);
    if (err) {
      toast.error(
        err.message.includes("last_admin")
          ? "Tem de existir pelo menos um administrador."
          : `Não foi possível remover: ${err.message}`,
      );
      return;
    }
    toast.success("Acesso removido");
    qc.invalidateQueries({ queryKey: ["admin", "roles"] });
  }

  return (
    <>
      <AdminHeader
        title="Utilizadores"
        intro="Só administradores entram no painel. Novas contas recebem apenas a função de cliente; o acesso ao painel é dado aqui, por um administrador."
      />
      <form onSubmit={add} noValidate className="flex max-w-xl flex-col gap-2">
        <Label htmlFor="adm-email">Dar acesso ao painel</Label>
        <div className="flex gap-2">
          <Input
            id="adm-email"
            type="email"
            placeholder="email da conta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "adm-erro" : undefined}
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy ? "A adicionar…" : "Adicionar"}
          </Button>
        </div>
        {error && (
          <p id="adm-erro" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <div className="overflow-hidden rounded border bg-card">
        {admins.isLoading ? (
          <div className="h-24 animate-pulse bg-muted" aria-busy="true" />
        ) : admins.isError ? (
          <p role="alert" className="p-5 text-destructive">
            Não foi possível carregar: {(admins.error as Error).message}
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {admins.data?.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0 truncate">{r.email || r.user_id}</span>
                <span className="flex items-center gap-3">
                  <StatusPill tone="info">Administrador</StatusPill>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    Remover
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
