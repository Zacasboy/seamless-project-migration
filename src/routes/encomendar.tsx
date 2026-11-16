import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { euro, useCart } from "@/lib/cart";
import { orderInputSchema, placeOrder } from "@/lib/orders.functions";
import { seo } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/encomendar")({
  ssr: false,
  head: () =>
    seo({
      title: "Concluir encomenda",
      description: "Indique os dados de entrega para concluir a sua encomenda Pallessiani.",
      noindex: true,
    }),
  pendingComponent: () => (
    <p className="p-16 text-center text-muted-foreground">A preparar a encomenda…</p>
  ),
  component: Checkout,
});

type Errors = Partial<Record<string, string>>;

const FIELDS = [
  { key: "name", label: "Nome completo", auto: "name", span: true },
  { key: "phone", label: "Telefone", auto: "tel", type: "tel" },
  { key: "nif", label: "NIF (opcional, para fatura)", auto: "off", inputMode: "numeric" },
  { key: "address", label: "Morada", auto: "street-address", span: true },
  { key: "postal_code", label: "Código postal", auto: "postal-code", placeholder: "0000-000" },
  { key: "city", label: "Localidade", auto: "address-level2" },
] as const;

function Checkout() {
  const cart = useCart();
  const nav = useNavigate();
  const [session, setSession] = useState<"loading" | "in" | "out">("loading");
  const [form, setForm] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session ? "in" : "out"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const input = {
      items: cart.items.map((i) => ({ product_id: i.id, quantity: i.qty, size: i.size })),
      shipping: { name: "", phone: "", address: "", postal_code: "", city: "", nif: "", ...form },
      notes,
      acceptTerms: accept,
    };
    const parsed = orderInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path.at(-1) ?? "form");
        next[issue.path[0] === "items" ? "form" : k] ??= issue.message;
      }
      setErrors(next);
      if (next["form"]) setFormError(next["form"]);
      const first = Object.keys(next).find((k) => k !== "form");
      if (first) document.getElementById(`c-${first}`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { id } = await placeOrder({ data: input });
      cart.clear();
      await nav({ to: "/obrigado", search: { encomenda: id } });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível registar a encomenda.");
    } finally {
      setBusy(false);
    }
  }

  if (session === "loading" || !cart.ready)
    return (
      <StoreLayout>
        <p className="p-16 text-center text-muted-foreground" aria-busy="true">
          A preparar a encomenda…
        </p>
      </StoreLayout>
    );

  if (cart.items.length === 0)
    return (
      <StoreLayout>
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-4xl">O carrinho está vazio</h1>
          <Button asChild className="mt-8">
            <Link to="/loja">Explorar a loja</Link>
          </Button>
        </div>
      </StoreLayout>
    );

  if (session === "out")
    return (
      <StoreLayout>
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-4xl">Entre para concluir a encomenda</h1>
          <p className="mt-3 text-muted-foreground">
            Pedimos uma conta para poder acompanhar a encomenda consigo. O carrinho fica guardado.
          </p>
          <Button asChild className="mt-8">
            <Link to="/auth" search={{ redirect: "/encomendar" }}>
              Entrar ou criar conta
            </Link>
          </Button>
        </div>
      </StoreLayout>
    );

  return (
    <StoreLayout>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} noValidate className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl">Concluir encomenda</h1>
            <p className="mt-2 text-muted-foreground">
              Sem pagamento online nesta fase. Depois de enviar, confirmamos a disponibilidade e
              combinamos consigo o pagamento e a entrega.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {formError}
            </div>
          )}

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-display text-2xl">Entrega</legend>
            {FIELDS.map((f) => (
              <div key={f.key} className={"span" in f && f.span ? "sm:col-span-2" : ""}>
                <Label htmlFor={`c-${f.key}`}>{f.label}</Label>
                <Input
                  id={`c-${f.key}`}
                  type={"type" in f ? f.type : "text"}
                  autoComplete={f.auto}
                  inputMode={"inputMode" in f ? f.inputMode : undefined}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  aria-invalid={!!errors[f.key]}
                  aria-describedby={errors[f.key] ? `e-${f.key}` : undefined}
                  className="mt-1 aria-[invalid=true]:border-destructive"
                />
                {errors[f.key] && (
                  <p id={`e-${f.key}`} className="mt-1 text-sm text-destructive">
                    {errors[f.key]}
                  </p>
                )}
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label htmlFor="c-notes">Notas para a entrega (opcional)</Label>
              <Textarea
                id="c-notes"
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </fieldset>

          <div>
            <label className="flex items-start gap-3 text-sm">
              <input
                id="c-acceptTerms"
                type="checkbox"
                className="mt-1 accent-[var(--brand-accent)]"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                aria-invalid={!!errors["acceptTerms"]}
              />
              <span>
                Li e aceito os{" "}
                <Link to="/termos" target="_blank" className="underline underline-offset-4">
                  termos e condições
                </Link>{" "}
                e a{" "}
                <Link to="/privacidade" target="_blank" className="underline underline-offset-4">
                  política de privacidade
                </Link>
                .
              </span>
            </label>
            {errors["acceptTerms"] && (
              <p className="mt-1 text-sm text-destructive">{errors["acceptTerms"]}</p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
            {busy ? "A enviar a encomenda…" : "Enviar encomenda"}
          </Button>
        </form>

        <aside className="h-fit border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl">Resumo</h2>
          <ul className="mt-4 divide-y text-sm">
            {cart.items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3 py-2">
                <span>
                  {i.qty} × {i.title}
                  {i.size && <span className="text-muted-foreground"> · {i.size}</span>}
                </span>
                <span className="num">{euro(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between border-t pt-4">
            <span>Total estimado</span>
            <span className="num font-display text-2xl">{euro(cart.total)}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            O total final é calculado com os preços em vigor no momento da encomenda.
          </p>
        </aside>
      </div>
    </StoreLayout>
  );
}
