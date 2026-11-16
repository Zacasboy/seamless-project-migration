import { render, screen } from "@testing-library/react";
import { productImage } from "@/lib/images";
import { ProductImage, monogram } from "@/components/ProductImage";

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
  it("mostra uma etiqueta com monograma quando não há imagem", () => {
    render(<ProductImage product={{ title: "Mala Siena", image_url: null }} caption />);
    const el = screen.getByRole("img", { name: "Mala Siena (fotografia em breve)" });
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveTextContent("S");
    expect(screen.getByText("Mala Siena")).toBeInTheDocument();
  });

  it("monograma usa a segunda palavra quando a primeira é o tipo de peça", () => {
    expect(monogram("Conjunto Gola Alta Clássico")).toBe("G");
    expect(monogram("Bota")).toBe("B");
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
