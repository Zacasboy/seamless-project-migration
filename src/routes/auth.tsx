import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else nav({ to: "/perfil" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      if (error) toast.error(error.message);
      else toast.success("Verifique o seu email para confirmar a conta.");
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) return toast.error(String(r.error.message ?? r.error));
    if (r.redirected) return;
    nav({ to: "/perfil" });
    return;
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-sm px-6 py-20">
        <h1 className="text-4xl">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pw">Palavra-passe</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <Button variant="outline" className="mt-3 w-full" onClick={google}>
          Continuar com Google
        </Button>
        <button
          className="mt-6 text-sm underline"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </StoreLayout>
  );
}