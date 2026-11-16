import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoreLayout } from "@/components/StoreLayout";
import { seo } from "@/lib/site";

// Só aceita caminhos internos (impede redirecionamentos para outros sites).
export const safeRedirect = (v: unknown) =>
  typeof v === "string" && /^\/(?!\/)[\w\-/.]*$/.test(v) && !v.includes("..") ? v : undefined;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => {
    const r = safeRedirect(s["redirect"]);
    return r ? { redirect: r } : {};
  },
  head: () =>
    seo({
      title: "Entrar",
      description: "Entre na sua conta Pallessiani para acompanhar as suas encomendas.",
      path: "/auth",
      noindex: true,
    }),
  component: AuthPage,
});

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Email ou palavra-passe incorretos.",
  "Email not confirmed": "Confirme o seu email antes de entrar. Verifique a caixa de entrada.",
  "User already registered":
    "Já existe uma conta com este email. Entre ou recupere a palavra-passe.",
  "Password should be at least": "A palavra-passe é demasiado curta.",
  "rate limit": "Demasiadas tentativas. Aguarde alguns minutos e tente de novo.",
  "weak password": "Escolha uma palavra-passe mais forte.",
};

const translate = (m: string) =>
  Object.entries(AUTH_ERRORS).find(([k]) => m.toLowerCase().includes(k.toLowerCase()))?.[1] ??
  "Não foi possível concluir. Tente de novo.";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^\w\s]/.test(pw)) s++;
  return s;
}

function AuthPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up" | "reset" | "new">("in");
  useEffect(() => {
    // Quem chega pela ligação de recuperação define aqui a nova palavra-passe.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("new");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [done, setDone] = useState("");

  function validate() {
    const f: typeof fieldErr = {};
    if (mode !== "new" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      f.email = "Indique um email válido.";
    if (mode !== "reset") {
      if ((mode === "up" || mode === "new") && password.length < 10)
        f.password = "Use pelo menos 10 caracteres.";
      else if (!password) f.password = "Indique a palavra-passe.";
    }
    setFieldErr(f);
    return Object.keys(f).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!validate()) return;
    setBusy(true);
    try {
      const origin = window.location.origin;
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await nav({ to: redirect ?? "/conta" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: origin + (redirect ?? "/conta") },
        });
        if (error) throw error;
        setDone("Conta criada. Abra o email de confirmação que enviámos para ativar a conta.");
      } else if (mode === "new") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setDone("Palavra-passe atualizada.");
        await nav({ to: redirect ?? "/conta" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: origin + "/auth",
        });
        if (error) throw error;
        // A mesma mensagem com ou sem conta, para não revelar que emails estão registados.
        setDone(
          "Se existir uma conta com este email, enviámos as instruções para recuperar a palavra-passe.",
        );
      }
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + (redirect ?? "/conta") },
    });
    if (error) setError("O acesso com Google não está disponível neste momento.");
  }

  const s = strength(password);
  const titles = {
    in: "Entrar",
    up: "Criar conta",
    reset: "Recuperar palavra-passe",
    new: "Nova palavra-passe",
  };

  return (
    <StoreLayout>
      <div className="mx-auto max-w-sm px-6 py-16 md:py-24">
        <h1 className="text-4xl">{titles[mode]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "in"
            ? "Acompanhe as suas encomendas Pallessiani."
            : mode === "up"
              ? "Uma conta permite encomendar e acompanhar os pedidos."
              : mode === "new"
                ? "Escolha a nova palavra-passe."
                : "Enviamos uma ligação para definir uma nova palavra-passe."}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {done && (
          <div
            role="status"
            className="mt-6 border border-success/40 bg-success/5 p-3 text-sm text-success"
          >
            {done}
          </div>
        )}

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div hidden={mode === "new"}>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErr.email}
              aria-describedby={fieldErr.email ? "email-erro" : undefined}
              className="mt-1 aria-[invalid=true]:border-destructive"
            />
            {fieldErr.email && (
              <p id="email-erro" className="mt-1 text-sm text-destructive">
                {fieldErr.email}
              </p>
            )}
          </div>
          {mode !== "reset" && (
            <div>
              <div className="flex items-baseline justify-between">
                <Label htmlFor="pw">Palavra-passe</Label>
                {mode === "in" && (
                  <button
                    type="button"
                    className="text-xs underline underline-offset-4"
                    onClick={() => setMode("reset")}
                  >
                    Esqueci-me
                  </button>
                )}
              </div>
              <Input
                id="pw"
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErr.password}
                aria-describedby="pw-ajuda"
                className="mt-1 aria-[invalid=true]:border-destructive"
              />
              {fieldErr.password ? (
                <p id="pw-ajuda" className="mt-1 text-sm text-destructive">
                  {fieldErr.password}
                </p>
              ) : (
                (mode === "up" || mode === "new") && (
                  <div id="pw-ajuda" className="mt-2">
                    <div className="flex gap-1" aria-hidden>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 ${i < s ? (s >= 4 ? "bg-success" : s >= 2 ? "bg-warning" : "bg-destructive") : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pelo menos 10 caracteres. Uma frase longa é mais segura do que símbolos.
                    </p>
                  </div>
                )
              )}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "A processar…" : mode === "reset" ? "Enviar ligação" : titles[mode]}
          </Button>
        </form>
        {(mode === "in" || mode === "up") && (
          <Button variant="outline" className="mt-3 w-full" onClick={google} disabled={busy}>
            Continuar com Google
          </Button>
        )}
        <button
          className="mt-6 text-sm underline underline-offset-4"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError("");
            setDone("");
            setFieldErr({});
          }}
        >
          {mode === "in" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
        {mode === "up" && (
          <p className="mt-6 text-xs text-muted-foreground">
            Ao criar conta aceita os{" "}
            <Link to="/termos" className="underline">
              termos
            </Link>{" "}
            e a{" "}
            <Link to="/privacidade" className="underline">
              política de privacidade
            </Link>
            .
          </p>
        )}
      </div>
    </StoreLayout>
  );
}
