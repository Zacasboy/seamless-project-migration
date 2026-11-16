import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/routes/auth";
import { orderInputSchema } from "@/lib/orders.functions";
import { computeChecks } from "@/lib/admin-data";
import { CSP } from "@/lib/security-headers";

const ship = {
  name: "Ana Silva",
  phone: "912345678",
  address: "Rua das Flores 10",
  postal_code: "1000-100",
  city: "Lisboa",
};
const item = { product_id: "11111111-1111-4111-8111-111111111111", quantity: 1 };

describe("redirecionamento após login", () => {
  it("aceita só caminhos internos", () => {
    expect(safeRedirect("/encomendar")).toBe("/encomendar");
    expect(safeRedirect("//evil.com")).toBeUndefined();
    expect(safeRedirect("https://evil.com")).toBeUndefined();
    expect(safeRedirect("/../admin")).toBeUndefined();
    expect(safeRedirect("javascript:alert(1)")).toBeUndefined();
  });
});

describe("validação da encomenda", () => {
  it("aceita uma encomenda válida e ignora preços enviados pelo browser", () => {
    const r = orderInputSchema.parse({
      items: [{ ...item, unit_price: 0.01 }],
      shipping: ship,
      acceptTerms: true,
    });
    expect(r.items[0]).not.toHaveProperty("unit_price");
  });
  it("recusa sem aceitar termos, com código postal inválido ou quantidade excessiva", () => {
    expect(
      orderInputSchema.safeParse({ items: [item], shipping: ship, acceptTerms: false }).success,
    ).toBe(false);
    expect(
      orderInputSchema.safeParse({
        items: [item],
        shipping: { ...ship, postal_code: "1000" },
        acceptTerms: true,
      }).success,
    ).toBe(false);
    expect(
      orderInputSchema.safeParse({
        items: [{ ...item, quantity: 50 }],
        shipping: ship,
        acceptTerms: true,
      }).success,
    ).toBe(false);
    expect(
      orderInputSchema.safeParse({ items: [], shipping: ship, acceptTerms: true }).success,
    ).toBe(false);
  });
});

describe("verificações do painel", () => {
  it("assinala fornecedores marcados como ligados sem integração", () => {
    const checks = computeChecks(
      {
        products: [],
        orders: [],
        suppliers: [
          { id: "s", name: "x", connected: true, api_connection_status: "not_configured" },
        ],
        customers: [],
        views: [],
        channels: [],
      },
      true,
    );
    expect(checks.find((c) => c.id === "suppliers")?.state).toBe("fail");
    expect(checks.find((c) => c.id === "migration")?.state).toBe("pass");
    expect(checks.find((c) => c.id === "images")?.state).toBe("none");
  });
});

describe("cabeçalhos de segurança", () => {
  it("impede embutir o site e plugins", () => {
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("object-src 'none'");
  });
});
