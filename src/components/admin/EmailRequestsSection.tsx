import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reviewEmailChange } from "@/lib/email-requests.functions";
import { Button } from "@/components/ui/button";

type Req = {
  id: string;
  current_email: string | null;
  new_email: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

export function EmailRequestsSection() {
  const review = useServerFn(reviewEmailChange);
  const [items, setItems] = useState<Req[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_change_requests")
      .select("id, current_email, new_email, status, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setError("Não foi possível carregar os pedidos.");
    else setItems(data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, decision: "approve" | "reject") {
    setBusy(id);
    try {
      await review({ data: { id, decision } });
      toast.success(
        decision === "approve"
          ? "Aprovado. O cliente tem de confirmar o novo email."
          : "Pedido rejeitado.",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao rever pedido");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight">Pedidos de alteração de email</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Depois de aprovado, o cliente confirma o novo endereço por email antes da mudança. Cada
        revisão fica registada.
      </p>
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
      {!items && !error && <p className="mt-6 text-sm text-muted-foreground">A carregar…</p>}
      {items?.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Sem pedidos.</p>}
      <ul className="mt-6 space-y-3">
        {items?.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <p>
                <span className="text-muted-foreground">De</span> {r.current_email ?? "—"}{" "}
                <span className="text-muted-foreground">para</span> <strong>{r.new_email}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-PT")} · {r.status}
              </p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => act(r.id, "reject")}
                >
                  Rejeitar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
