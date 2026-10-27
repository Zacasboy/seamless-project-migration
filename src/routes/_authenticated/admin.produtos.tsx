import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { Badge } from "@/components/ui/badge";
import { productImage } from "@/lib/images";
import { euro } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin/produtos")({ component: Page });

function Page() {
  return (
    <AdminCrud
      table="products"
      title="Produtos"
      intro="Cada produto precisa de título, imagem, categoria, género, campos SEO e fornecedor. Imagens externas devem ser URLs https."
      searchKeys={["title", "slug", "supplier"]}
      filterKey="category"
      filterOptions={["Malas", "Calçado", "Conjuntos"]}
      columns={[
        {
          key: "title",
          label: "Produto",
          render: (r) => (
            <span className="flex items-center gap-2">
              <img src={productImage(r as any)} alt="" className="h-10 w-8 object-cover" />
              {r.title}
            </span>
          ),
        },
        { key: "category", label: "Categoria" },
        { key: "gender", label: "Género" },
        { key: "price", label: "Preço", render: (r) => euro(Number(r.price)) },
        {
          key: "stock",
          label: "Stock",
          render: (r) => (r.stock > 0 ? r.stock : <Badge variant="destructive">Esgotado</Badge>),
        },
        { key: "supplier", label: "Fornecedor" },
        { key: "published", label: "Publicado", render: (r) => (r.published ? "Sim" : "Não") },
      ]}
      fields={[
        { key: "title", label: "Título", required: true },
        { key: "slug", label: "Slug (URL)", required: true },
        { key: "description", label: "Descrição", type: "textarea" },
        { key: "price", label: "Preço (€)", type: "number", required: true },
        { key: "cost", label: "Custo (€)", type: "number" },
        { key: "stock", label: "Stock", type: "number" },
        { key: "sizes", label: "Tamanhos (separados por vírgula)", type: "list" },
        {
          key: "category",
          label: "Categoria",
          type: "select",
          options: ["Malas", "Calçado", "Conjuntos"],
          required: true,
        },
        {
          key: "gender",
          label: "Género",
          type: "select",
          options: ["mulher", "homem", "unisex"],
          required: true,
        },
        { key: "image_url", label: "URL da imagem (https)" },
        { key: "meta_title", label: "Título SEO" },
        { key: "meta_description", label: "Meta descrição SEO", type: "textarea" },
        { key: "supplier", label: "Fornecedor" },
        { key: "published", label: "Publicado", type: "bool" },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
    />
  );
}
