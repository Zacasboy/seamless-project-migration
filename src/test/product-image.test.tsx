import { render, screen } from "@testing-library/react";
import { productImage } from "@/lib/images";
import { ProductImage } from "@/components/ProductImage";

describe("productImage", () => {
  it("usa image_url quando é um URL válido", () => {
    expect(productImage({ image_url: "https://cdn.example.com/a.jpg" })).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("ignora os caminhos antigos do Lovable e valores vazios", () => {
    expect(productImage({ image_url: "/__l5e/assets-v1/x/p12.jpg" })).toBe("");
    expect(productImage({ image_url: "  " })).toBe("");
    expect(productImage({ image_url: null, image_key: "p12" })).toBe("");
  });
});

describe("ProductImage", () => {
  it("mostra uma superfície com aviso quando não há imagem", () => {
    render(<ProductImage product={{ title: "Mala Siena", image_url: null }} caption />);
    const el = screen.getByRole("img", { name: "Mala Siena (fotografia em breve)" });
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveTextContent("Fotografia em breve");
    expect(screen.getByText("Mala Siena")).toBeInTheDocument();
  });

  it("mostra a imagem quando há URL", () => {
    render(
      <ProductImage product={{ title: "Bota", image_url: "https://cdn.example.com/b.jpg" }} />,
    );
    expect(screen.getByRole("img", { name: "Bota" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/b.jpg",
    );
  });
});

describe("specLine", () => {
  it("extrai o material da descrição", async () => {
    const { specLine } = await import("@/lib/spec");
    expect(specLine({ description: "Mala estruturada em pele castanha com fecho dourado." })).toBe(
      "Pele castanha, fecho dourado",
    );
    expect(
      specLine({ description: "Tote espaçosa em pele granulada preta, ideal para trabalho." }),
    ).toBe("Pele granulada preta");
    expect(specLine({ description: "", category: "Malas" })).toBe("Malas");
  });
});
