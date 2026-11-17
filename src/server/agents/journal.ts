// Diário das alterações dos agentes: cada operação guarda o valor anterior e o novo,
// para o painel poder desfazer, aprovar ou rejeitar. Só corre no servidor (service role).
import type { SupabaseClient } from "@supabase/supabase-js";

// Tabelas dinâmicas: o cliente tipado não aceita nomes variáveis.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any>;

export type Entity =
  | "products"
  | "collections"
  | "marketing_content"
  | "agent_plans"
  | "agent_memory"
  | "store_settings";
export type OpKind = "create" | "update" | "delete";
type Row = Record<string, unknown>;

export type Operation = {
  entity: Entity;
  op: OpKind;
  id?: string | undefined;
  values?: Row | undefined;
  label: string;
  reason: string;
};

// Colunas que os agentes podem escrever em cada tabela.
const WRITABLE: Record<Entity, string[]> = {
  products: [
    "title",
    "description",
    "category",
    "gender",
    "garment_type",
    "meta_title",
    "meta_description",
    "image_alt",
    "size_options",
    "color_options",
    "published",
  ],
  collections: ["title", "description", "campaign", "season", "status", "product_ids"],
  marketing_content: [
    "kind",
    "channel",
    "title",
    "body",
    "hashtags",
    "cta",
    "audience",
    "product_ids",
    "budget_eur",
    "expected_ctr",
    "expected_cvr",
    "success_probability",
    "rationale",
    "status",
    "scheduled_for",
    "agent",
  ],
  agent_plans: ["agent", "kind", "title", "body_md", "actions", "sources", "status"],
  agent_memory: ["value", "updated_by_agent"],
  store_settings: ["value"],
};
const KEY_COL: Record<Entity, string> = {
  products: "id",
  collections: "id",
  marketing_content: "id",
  agent_plans: "id",
  agent_memory: "key",
  store_settings: "key",
};
const HAS_UPDATED_AT = new Set<Entity>(["marketing_content", "agent_plans", "agent_memory", "store_settings", "collections"]);

/** Entidades que mudam o que o cliente vê: seguem o modo "propor" do agente. */
export const STOREFRONT = new Set<Entity>(["products", "collections", "store_settings"]);

export function pick(entity: Entity, values: Row | undefined): Row {
  const out: Row = {};
  for (const k of WRITABLE[entity]) if (values && values[k] !== undefined) out[k] = values[k];
  return out;
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(genero|categoria)-/, "")
    .slice(0, 80) || "colecao";

export async function snapshot(db: Db, entity: Entity, id: string): Promise<Row | null> {
  const { data, error } = await db.from(entity).select("*").eq(KEY_COL[entity], id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (entity === "collections") {
    const { data: items } = await db
      .from("collection_items")
      .select("product_id, position")
      .eq("collection_id", id)
      .not("product_id", "is", null)
      .order("position");
    return { ...data, product_ids: (items ?? []).map((i) => i.product_id) };
  }
  return data as Row;
}

async function setCollectionItems(db: Db, collectionId: string, productIds: string[]) {
  const { error: d } = await db.from("collection_items").delete().eq("collection_id", collectionId).not("product_id", "is", null);
  if (d) throw new Error(d.message);
  if (!productIds.length) return;
  const { error } = await db
    .from("collection_items")
    .insert(productIds.map((product_id, position) => ({ collection_id: collectionId, product_id, position })));
  if (error) throw new Error(error.message);
}

/** Aplica a operação e devolve o id e o estado anterior/novo das colunas tocadas. */
export async function applyOperation(
  db: Db,
  o: Pick<Operation, "entity" | "op" | "id" | "values">,
): Promise<{ id: string; before: Row | null; after: Row | null }> {
  const values = pick(o.entity, o.values);
  const key = KEY_COL[o.entity];
  const { product_ids, ...cols } = values as Row & { product_ids?: string[] };
  if (HAS_UPDATED_AT.has(o.entity) && o.op !== "delete") cols["updated_at"] = new Date().toISOString();

  if (o.op === "create") {
    if (o.entity === "products") throw new Error("Os agentes não criam produtos; use a importação.");
    const row: Row = { ...cols };
    if (o.id && (o.entity === "agent_memory" || o.entity === "store_settings")) row[key] = o.id;
    if (o.id && o.entity !== "agent_memory" && o.entity !== "store_settings") row["id"] = o.id; // repor depois de desfazer
    if (o.entity === "collections") {
      const base = slugify(String(cols["title"] ?? ""));
      const { data: clash } = await db.from("collections").select("slug").like("slug", `${base}%`);
      const taken = new Set((clash ?? []).map((r) => r.slug));
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
      row["slug"] = row["slug"] ?? slug;
      row["status"] = row["status"] ?? "draft";
    }
    const { data, error } = await db.from(o.entity).upsert(row).select(key).single();
    if (error) throw new Error(error.message);
    const id = String((data as unknown as Row)[key]);
    if (o.entity === "collections" && product_ids) await setCollectionItems(db, id, product_ids);
    return { id, before: null, after: await snapshot(db, o.entity, id) };
  }

  if (!o.id) throw new Error("Falta o id.");
  const prev = await snapshot(db, o.entity, o.id);
  if (!prev) throw new Error("Registo não encontrado.");

  if (o.op === "update") {
    const touched = Object.keys(values);
    if (!touched.length) throw new Error("Nada para alterar.");
    if (Object.keys(cols).length) {
      const { error } = await db.from(o.entity).update(cols).eq(key, o.id);
      if (error) throw new Error(error.message);
    }
    if (o.entity === "collections" && product_ids) await setCollectionItems(db, o.id, product_ids);
    const before: Row = {};
    const after: Row = {};
    const now = await snapshot(db, o.entity, o.id);
    for (const k of touched) {
      before[k] = prev[k] ?? null;
      after[k] = now?.[k] ?? null;
    }
    return { id: o.id, before, after };
  }

  if (o.entity === "products") throw new Error("Os agentes não apagam produtos; arquive (despublicar).");
  const { error } = await db.from(o.entity).delete().eq(key, o.id);
  if (error) throw new Error(error.message);
  return { id: o.id, before: prev, after: null };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

type ActionRow = {
  id: string;
  op: OpKind;
  entity: Entity;
  entity_id: string | null;
  before: Row | null;
  after: Row | null;
  status: string;
};

/** Desfaz uma alteração aplicada. Recusa se o registo mudou entretanto. */
export async function undoAction(db: Db, a: ActionRow) {
  if (a.status !== "applied") throw new Error("Só se desfazem alterações aplicadas.");
  if (!a.entity_id) throw new Error("Alteração sem registo associado.");
  if (a.op === "create") {
    await applyOperation(db, { entity: a.entity, op: "delete", id: a.entity_id });
    return;
  }
  if (a.op === "update") {
    const now = await snapshot(db, a.entity, a.entity_id);
    if (!now) throw new Error("O registo já não existe.");
    for (const k of Object.keys(a.after ?? {}))
      if (!same(now[k], a.after?.[k]))
        throw new Error(`O campo «${k}» foi alterado depois; desfazer iria apagar essa alteração.`);
    await applyOperation(db, { entity: a.entity, op: "update", id: a.entity_id, values: a.before ?? {} });
    return;
  }
  // delete: recria com os mesmos dados (incluindo o id)
  const prev = a.before ?? {};
  await applyOperation(db, {
    entity: a.entity,
    op: "create",
    id: a.entity_id,
    values: { ...prev, ...(a.entity === "collections" ? { product_ids: prev["product_ids"] ?? [] } : {}) },
  });
  if (a.entity === "collections" && prev["slug"]) {
    await db.from("collections").update({ slug: prev["slug"] }).eq("id", a.entity_id);
  }
}

/** Aplica uma proposta guardada (valores em "after"). */
export async function approveAction(db: Db, a: ActionRow) {
  if (a.status !== "proposed") throw new Error("Esta alteração já não está pendente.");
  return applyOperation(db, {
    entity: a.entity,
    op: a.op,
    id: a.entity_id ?? undefined,
    values: a.after ?? undefined,
  });
}
