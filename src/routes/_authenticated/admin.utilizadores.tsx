import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/utilizadores")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [uid, setUid] = useState("");
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  async function add() {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: uid.trim(), role: "admin" });
    if (error) return toast.error(`Não foi possível adicionar: ${error.message}`);
    setUid("");
    toast.success("Administrador adicionado");
    qc.invalidateQueries({ queryKey: ["roles"] });
  }
  async function remove(id: string) {
    const admins = roles.data?.filter((r) => r.role === "admin").length ?? 0;
    if (admins <= 1) return toast.error("Tem de existir pelo menos um administrador.");
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["roles"] });
  }
  return (
    <div>
      <h1 className="text-4xl">Utilizadores e permissões</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        As permissões ficam numa tabela protegida; só administradores as podem alterar. Para
        adicionar um administrador, cole o ID do utilizador (visível em Cloud → Utilizadores).
      </p>
      <div className="mt-6 flex max-w-xl gap-2">
        <Input
          placeholder="ID do utilizador"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
        />
        <Button onClick={add} disabled={!uid.trim()}>
          Tornar administrador
        </Button>
      </div>
      <ul className="mt-6 divide-y rounded-md border bg-card text-sm">
        {roles.data?.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-2">
            <span className="font-mono text-xs">{r.user_id}</span>
            <span>{r.role}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
              Remover
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
