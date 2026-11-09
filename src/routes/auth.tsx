import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoreLayout } from "@/components/StoreLayout";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Pallessiani" },
      { name: "description", content: "Entre na sua conta Pallessiani." },
      { property: "og:title", content: "Entrar — Pallessiani" },
      { property: "og:description", content: "Entre na sua conta Pallessiani." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await nav({ to: "/admin" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        toast.success("Registo submetido. Verifique o seu email para confirmar a conta.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a autenticação.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) toast.error(error.message);
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-sm px-6 py-20">
        <p className="eyebrow">Pallessiani · Private access</p>
        <h1 className="mt-3 text-4xl">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "in" ? "Aceda ao seu espaço Pallessiani." : "Crie a sua conta para começar."}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw">Palavra-passe</Label>
            <Input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"}
              required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "A processar…" : mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <Button variant="outline" className="mt-3 w-full" onClick={google} disabled={busy}>
          Continuar com Google
        </Button>
        <button className="mt-6 text-sm underline underline-offset-4"
          onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </StoreLayout>
  );
}
