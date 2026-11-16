import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Validação partilhada pelo formulário (browser) e pelo servidor.
export const shippingSchema = z.object({
  name: z.string().trim().min(2, "Indique o nome completo.").max(120, "Nome demasiado longo."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{9,16}$/, "Indique um telefone com 9 dígitos, ou com indicativo."),
  address: z.string().trim().min(5, "Indique a morada de entrega.").max(200),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{3}$/, "Use o formato 0000-000."),
  city: z.string().trim().min(2, "Indique a localidade.").max(80),
  nif: z
    .string()
    .trim()
    .regex(/^(\d{9})?$/, "O NIF tem 9 dígitos.")
    .optional()
    .default(""),
});

export const orderInputSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
        size: z.string().max(20).optional(),
      }),
    )
    .min(1, "O carrinho está vazio.")
    .max(20, "Máximo de 20 artigos diferentes por encomenda."),
  shipping: shippingSchema,
  notes: z.string().trim().max(1000).optional().default(""),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Tem de aceitar os termos e condições." }),
  }),
});

export type OrderInput = z.input<typeof orderInputSchema>;

const MESSAGES: Record<string, string> = {
  rate_limited: "Já fez várias encomendas na última hora. Aguarde um pouco ou contacte-nos.",
  product_unavailable: "Um dos artigos deixou de estar disponível. Reveja o carrinho.",
  invalid_quantity: "Quantidade inválida. Cada artigo aceita de 1 a 10 unidades.",
  invalid_shipping: "Os dados de entrega não são válidos. Reveja o formulário.",
  invalid_items: "O carrinho está vazio ou tem demasiados artigos.",
  not_authenticated: "A sua sessão terminou. Entre novamente para concluir.",
};

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => orderInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    // O preço nunca vem do browser: a função place_order lê-o da tabela products.
    const { data: id, error } = await context.supabase.rpc("place_order", {
      _items: data.items,
      _shipping: data.shipping,
      _notes: data.notes || null,
    });
    if (error) {
      const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
      if (!key) console.error("[place_order]", error.message);
      throw new Error(
        key
          ? MESSAGES[key]
          : error.message.includes("place_order")
            ? "As encomendas online ainda não estão ativas. Contacte-nos para encomendar."
            : "Não foi possível registar a encomenda. Tente de novo dentro de momentos.",
      );
    }
    return { id: id as string };
  });
