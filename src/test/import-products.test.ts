import {
  buildDrafts,
  guessMapping,
  parseCsv,
  parseNumber,
  toProductRow,
} from "@/lib/import-products";

const opts = { defaultCategory: "" as const, markupPercent: 100, supplier: "Teste", publish: true };

describe("importação de produtos", () => {
  it("lê CSV com aspas, ponto e vírgula e quebras de linha", () => {
    const rows = parseCsv('Nome;Preço;Descrição\n"Mala ""Siena""";"89,90";"linha 1\nlinha 2"\n');
    expect(rows).toEqual([
      ["Nome", "Preço", "Descrição"],
      ['Mala "Siena"', "89,90", "linha 1\nlinha 2"],
    ]);
  });

  it("converte preços em formato português e inglês", () => {
    expect(parseNumber("1.234,56 €")).toBe(1234.56);
    expect(parseNumber("$1,234.50")).toBe(1234.5);
    expect(parseNumber("")).toBeNull();
  });

  it("agrupa variantes do Shopify e valida imagem, preço e categoria", () => {
    const csv = [
      "Handle,Title,Body (HTML),Variant Price,Image Src,Option1 Value,Variant SKU,Product Type,Variant Inventory Qty",
      "tote-nera,Tote Nera Leather Bag,<p>Pele <b>granulada</b></p>,129.00,https://cdn.example.com/t.jpg,Única,TN-1,Bags,3",
      "loafer-x,Loafer X,,,http://insecure.example.com/l.jpg,40,LX-40,Shoes,10",
      "loafer-x,,,,,41,LX-41,,0",
    ].join("\n");
    const rows = parseCsv(csv);
    const drafts = buildDrafts(rows.slice(1), guessMapping(rows[0]!), opts);
    expect(drafts).toHaveLength(2);
    const tote = drafts[0]!;
    expect(tote).toMatchObject({
      title: "Tote Nera Leather Bag",
      description: "Pele granulada",
      price: 129,
      category: "Malas",
      stock_status: "low_stock",
      errors: [],
    });
    const loafer = drafts[1]!;
    expect(loafer.size_options).toEqual(["40", "41"]);
    expect(loafer.category).toBe("Calçado");
    expect(loafer.errors).toEqual(["Sem preço", "A imagem tem de ser https"]);
  });

  it("usa a margem quando só há custo e cria slugs únicos", () => {
    const rows = parseCsv(
      "name,cost,image,category\nMala Roma,40,https://x.example/a.jpg,bag\nMala Roma,45,https://x.example/b.jpg,bag",
    );
    const [d] = buildDrafts(rows.slice(1), guessMapping(rows[0]!), opts);
    expect(d!.price).toBe(80);
    const taken = new Set(["mala-roma"]);
    expect(toProductRow(d!, opts, taken).slug).toBe("mala-roma-2");
  });
});
