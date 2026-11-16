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
  it("mostra o nome do produto quando não há imagem", () => {
    render(<ProductImage product={{ title: "Mala Siena", image_url: null }} />);
    expect(screen.getByRole("img", { name: "Mala Siena" }).tagName).toBe("DIV");
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
