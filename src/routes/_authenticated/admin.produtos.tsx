/* eslint-disable @typescript-eslint/no-explicit-any -- Admin CRUD uses dynamic table/column keys not represented by the generated Supabase type map. */
import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { ProductSupplierPanel } from "@/components/admin/ProductSupplierPanel";
import { BatchPhotoButton, ProductPhotoPanel } from "@/components/admin/ProductPhotos";
import { DiscontinuedPanel } from "@/components/admin/DiscontinuedPanel";
import { ProductImage } from "@/components/ProductImage";
import { StatusPill } from "@/components/StatusPill";
import { euro } from "@/lib/cart";
import { CATEGORY_NAMES, CATEGORIES } from "@/lib/taxonomy";

export const Route = createFileRoute("/_authenticated/admin/produtos")({ component: Page });

const STOCK = [
  { value: "in_stock", label: "Em stock" },
  { value: "low_stock", label: "Últimas unidades" },
  { value: "out_of_stock", label: "Esgotado" },
  { value: "unknown", label: "Por indicar" },
];
const STOCK_TONE: Record<string, string> = {
  in_stock: "pass",
  low_stock: "warn",
  out_of_stock: "fail",
  unknown: "none",
};

function Page() {
  return (
    <AdminCrud
      table="products"
      title="Produtos"
      intro="Cada produto precisa de título, categoria, preço, meta descrição e, quando tiver fotografia, texto alternativo. Fotografias só por URL https; prefira WebP até 200 KB e 1200 px de largura."
      searchKeys={["title", "slug", "supplier", "sku"]}
      filterKey="category"
      filterOptions={[...CATEGORY_NAMES]}
      columns={[
        {
          key: "title",
          label: "Produto",
          render: (r) => (
            <span className="flex items-center gap-3">
              <span className="h-10 w-8 shrink-0 overflow-hidden">
                <ProductImage product={r as any} alt="" compact className="h-10 w-8 object-cover" />
              </span>
              {r["title"]}
            </span>
          ),
        },
        {
          key: "category",
          label: "Categoria",
          render: (r) => (
            <span>
              {r["category"]}
              {r["garment_type"] && <span className="block text-xs text-muted-foreground">{r["garment_type"]}</span>}
            </span>
          ),
        },
        {
          key: "price",
          label: "Preço",
          render: (r) => <span className="num">{euro(Number(r["price"]))}</span>,
        },
        {
          key: "stock_status",
          label: "Stock",
          render: (r) => (
            <StatusPill tone={STOCK_TONE[r["stock_status"]] ?? "none"}>
              {STOCK.find((s) => s.value === r["stock_status"])?.label ?? r["stock_status"]}
            </StatusPill>
          ),
        },
        {
          key: "image_url",
          label: "Fotografia",
          render: (r) =>
            r["image_url"] ? "Sim" : <span className="text-muted-foreground">Em falta</span>,
        },
        {
          key: "supplier",
          label: "Origem",
          render: (r) => <span className="text-xs">{r["supplier"] ?? "—"}</span>,
        },
        { key: "published", label: "Publicado", render: (r) => (r["published"] ? "Sim" : "Não") },
      ]}
      fields={[
        { key: "title", label: "Título", required: true, maxLength: 200 },
        {
          key: "slug",
          label: "Endereço (slug)",
          required: true,
          pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
          patternMessage: "Só minúsculas, números e hífens, por exemplo mala-terri-castanha.",
          maxLength: 120,
        },
        { key: "description", label: "Descrição", type: "textarea", maxLength: 5000 },
        { key: "price", label: "Preço com IVA (€)", type: "number", required: true, min: 0 },
        { key: "cost", label: "Custo (€), visível só no painel", type: "number", min: 0 },
        {
          key: "category",
          label: "Categoria",
          type: "select",
          options: [...CATEGORY_NAMES],
          required: true,
        },
        {
          key: "garment_type",
          label: "Subcategoria",
          type: "select",
          options: CATEGORIES.flatMap((c) => c.subs.map((s) => ({ value: s, label: `${c.name} › ${s}` }))),
          hint: "Deve pertencer à categoria escolhida. As rotinas corrigem-na pelo nome se ficar errada.",
        },
        {
          key: "gender",
          label: "Género",
          type: "select",
          options: ["mulher", "homem", "unisex"],
          required: true,
        },
        { key: "stock_status", label: "Stock", type: "select", options: STOCK, required: true },
        { key: "size_options", label: "Tamanhos (separados por vírgula)", type: "list" },
        { key: "color_options", label: "Cores (separadas por vírgula)", type: "list" },
        { key: "sku", label: "Referência interna (SKU)", maxLength: 60 },
        {
          key: "gallery",
          label: "Fotografias",
          type: "gallery",
          hint: "A primeira é a principal. Endereços https://, até 20.",
        },
        {
          key: "image_alt",
          label: "Texto alternativo da fotografia",
          maxLength: 160,
          hint: "Descreva o que se vê: «Mala castanha em pele com fecho dourado».",
        },
        { key: "meta_title", label: "Título SEO", maxLength: 60, hint: "Até 60 caracteres." },
        {
          key: "meta_description",
          label: "Meta descrição SEO",
          type: "textarea",
          maxLength: 160,
          hint: "Entre 50 e 160 caracteres.",
        },
        { key: "supplier", label: "Fornecedor", maxLength: 120 },
        { key: "published", label: "Publicado na loja", type: "bool" },
        { key: "is_demo", label: "Registo de demonstração", type: "bool" },
      ]}
      headerExtra={<BatchPhotoButton />}
      beforeTable={<DiscontinuedPanel />}
      editorExtra={(row, setRow) => (
        <>
          <ProductSupplierPanel row={row} setRow={setRow} />
          <ProductPhotoPanel row={row} setRow={setRow} />
        </>
      )}
      beforeSave={(payload, original) => {
        const gallery = (payload["gallery"] as string[] | undefined) ?? [];
        const out: Record<string, any> = { ...payload, image_url: gallery[0] ?? null };
        // Base de dados ainda sem a coluna da galeria: grava só a principal.
        if (!("gallery" in original)) delete out["gallery"];
        return out;
      }}
    />
  );
}
