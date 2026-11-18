/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas editoriais com colunas opcionais (galeria/posição) */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, Panel } from "@/components/admin/AdminHeader";
import { approvedOutfitPhoto } from "@/lib/outfits.functions";
import { OutfitBoard, type BoardPiece } from "@/components/OutfitBoard";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { euro } from "@/lib/cart";
import {
  BACKGROUNDS,
  autoLayout,
  fitLayout,
  boardPieces,
  roleOf,
  slugifyOutfit,
  sortByRole,
  suggestOutfits,
  type BackgroundKey,
  type Layout,
  type Role,
} from "@/lib/outfits";
import { cutoutFor, draftCutoutFor, isStoredCutout, productOnlyPhotos, productPhotos } from "@/lib/photos";
import { reshootOutfit, saveCutout } from "@/lib/cutouts.functions";
import { processProductPhoto } from "@/lib/cutout-flow";

export const Route = createFileRoute("/_authenticated/admin/conjuntos")({ component: Page });

type Product = {
  id: string;
  slug: string;
  title: string;
  price: number | string;
  category: string | null;
  garment_type: string | null;
  gender: string | null;
  color_options: string[] | null;
  image_url: string | null;
  gallery?: string[] | null;
  photo_cutouts?: unknown;
  published: boolean;
  is_demo: boolean;
};
type Piece = { key: string; productId: string; color: string; size: string; image: string; layout: Layout };
type Draft = {
  id?: string;
  title: string;
  description: string;
  status: "draft" | "published";
  background: BackgroundKey;
  gender: string;
  palette: string;
  cover: string;
  aiImage: string;
  aiStatus: "" | "pendente" | "aprovado" | "rejeitado";
  pieces: Piece[];
};

const ROLE_LABEL: Record<Role, string> = {
  cima: "Parte de cima",
  camada: "Casaco",
  calcas: "Calças",
  calcado: "Calçado",
  acessorio: "Acessório",
  mala: "Mala",
};
const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  status: "draft",
  background: "loja",
  gender: "homem",
  palette: "",
  cover: "",
  aiImage: "",
  aiStatus: "",
  pieces: [],
});
const newKey = () => Math.random().toString(36).slice(2, 10);

function useData() {
  const products = useQuery({
    queryKey: ["admin", "outfit-products"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products") as any)
        .select("*")
        .eq("is_demo", false)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Product[];
    },
  });
  const outfits = useQuery({
    queryKey: ["admin", "outfits"],
    queryFn: async () => {
      const { data: o, error } = await (supabase.from("editorial_outfits" as any) as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const ids = (o ?? []).map((x: any) => x.id);
      const { data: items } = ids.length
        ? await (supabase.from("editorial_outfit_items" as any) as any).select("*").in("outfit_id", ids).order("position")
        : { data: [] };
      return (o ?? []).map((x: any) => ({ ...x, items: (items ?? []).filter((i: any) => i.outfit_id === x.id) }));
    },
  });
  return { products, outfits };
}

function Page() {
  const qc = useQueryClient();
  const { products, outfits } = useData();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const catalog = products.data ?? [];
  const live = catalog.filter((p) => p.published);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("editorial_outfits" as any) as any).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Conjunto apagado.");
      void qc.invalidateQueries({ queryKey: ["admin", "outfits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fromSuggestion = (s: ReturnType<typeof suggestOutfits>[number]): Draft => {
    const ordered = sortByRole(s.items);
    const layouts = autoLayout(ordered);
    return {
      ...emptyDraft(),
      title: s.title,
      gender: s.gender,
      palette: s.palette,
      background: "loja",
      pieces: ordered.map((it, i) => {
        const p = catalog.find((x) => x.id === it.productId)!;
        const cut = cutoutFor(p);
        return { key: newKey(), productId: p.id, color: it.color, size: "", image: cut ?? productPhotos(p)[0] ?? "", layout: { ...layouts[i]!, cutout: !!cut } };
      }),
    };
  };

  const edit = (o: any) => {
    const auto = boardPieces(o.items, catalog);
    setDraft({
      id: o.id,
      title: o.title,
      description: o.description ?? "",
      status: o.status === "published" ? "published" : "draft",
      background: (o.background ?? "cinza") as BackgroundKey,
      gender: o.gender ?? "homem",
      palette: o.palette ?? "",
      cover: o.cover_url ?? "",
      aiImage: o.ai_image_url ?? "",
      aiStatus: o.ai_status ?? "",
      pieces: o.items
        .filter((i: any) => catalog.some((p) => p.id === i.product_id))
        .map((i: any) => ({
          key: i.id,
          productId: i.product_id,
          color: i.color ?? "",
          size: i.size ?? "",
          image: i.image_url ?? auto.find((a) => a.key === i.id)?.image ?? "",
          layout: auto.find((a) => a.key === i.id)?.layout ?? { x: 10, y: 10, w: 40, r: 0, z: 1 },
        })),
    });
  };

  return (
    <>
      <AdminHeader
        title="Conjuntos"
        intro="Junte 2 ou mais produtos do catálogo numa composição pronta a vestir. Na loja, cada peça destaca-se ao passar o rato e abre o artigo."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSuggestions((v) => !v)} disabled={!live.length}>
              {showSuggestions ? "Esconder sugestões" : "Sugerir conjuntos"}
            </Button>
            <Button onClick={() => setDraft(emptyDraft())}>Novo conjunto</Button>
          </div>
        }
      />
      {draft && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          catalog={catalog}
          onDone={() => {
            setDraft(null);
            void qc.invalidateQueries({ queryKey: ["admin", "outfits"] });
            void qc.invalidateQueries({ queryKey: ["outfits"] });
          }}
        />
      )}
      {showSuggestions && !draft && <Suggestions catalog={catalog} onUse={(s) => setDraft(fromSuggestion(s))} />}
      <Panel>
        <h2 className="text-xl">Conjuntos guardados</h2>
        {outfits.isError && <p role="alert" className="mt-2 text-sm text-destructive">{(outfits.error as Error).message}</p>}
        {!outfits.isLoading && !(outfits.data ?? []).length && (
          <p className="mt-2 text-sm text-muted-foreground">
            Ainda não há conjuntos. Use «Sugerir conjuntos» para começar a partir das combinações de cores da marca.
          </p>
        )}
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(outfits.data ?? []).map((o: any) => {
            const pieces = boardPieces(o.items, catalog);
            return (
              <div key={o.id}>
                <OutfitBoard title={o.title} background={o.background} pieces={pieces} photo={approvedOutfitPhoto(o)} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{o.title}</p>
                  <StatusPill tone={o.status === "published" ? "pass" : "warn"}>
                    {o.status === "published" ? "Publicado" : "Rascunho"}
                  </StatusPill>
                </div>
                <p className="text-xs text-muted-foreground">{pieces.length} peças</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => edit(o)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => confirm("Apagar este conjunto? Os produtos ficam.") && remove.mutate(o.id)}
                  >
                    Apagar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

function Suggestions({ catalog, onUse }: { catalog: Product[]; onUse: (s: ReturnType<typeof suggestOutfits>[number]) => void }) {
  const list = useMemo(() => suggestOutfits(catalog, 8), [catalog]);
  return (
    <Panel>
      <h2 className="text-xl">Sugestões pelas combinações de cores</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Junta parte de cima, calças e calçado do mesmo público com cores que combinam (Chocolate e creme, Azul-marinho e camel…).
        Escolha uma para editar e guardar.
      </p>
      {list.length === 0 ? (
        <p className="mt-4 text-sm">
          Ainda não há peças suficientes: são precisos produtos publicados com fotografia em pelo menos três papéis (parte de
          cima, calças e calçado) e cores reconhecíveis.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((s, i) => {
            const ordered = sortByRole(s.items);
            const layouts = autoLayout(ordered);
            const pieces: BoardPiece[] = ordered.flatMap((it, k) => {
              const p = catalog.find((x) => x.id === it.productId);
              const cut = p ? cutoutFor(p) : undefined;
              const image = cut ?? (p ? productPhotos(p)[0] : undefined);
              return p && image
                ? [{ key: `${i}-${k}`, productId: p.id, slug: p.slug, title: p.title, price: Number(p.price), image, color: it.color, layout: { ...layouts[k]!, cutout: !!cut } }]
                : [];
            });
            return (
              <div key={i}>
                <OutfitBoard title={s.title} background={s.palette.includes("hocolate") ? "areia" : "cinza"} pieces={pieces} />
                <p className="mt-2 font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{pieces.map((p) => `${p.title}${p.color ? ` (${p.color})` : ""}`).join(" · ")}</p>
                <Button size="sm" className="mt-2" onClick={() => onUse(s)}>
                  Usar esta sugestão
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Editor({
  draft,
  setDraft,
  catalog,
  onDone,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft | null>>;
  catalog: Product[];
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(draft.pieces[0]?.key ?? null);
  const [cutting, setCutting] = useState<string | null>(null);
  const [composing, setComposing] = useState<string | null>(null);
  // Recorte grátis no navegador: lê a foto pelo servidor, tira o fundo aqui e guarda o PNG
  // (fica também no produto, para a loja e para os próximos conjuntos).
  const cutOut = async (key: string, productId: string, image: string) => {
    if (!image) return;
    setCutting(key);
    try {
      const { url } = (await processProductPhoto(productId, image, { force: "recorte" })) as { url: string };
      setDraft((d) =>
        d && {
          ...d,
          pieces: d.pieces.map((p) => (p.key === key ? { ...p, image: url, layout: { ...p.layout, cutout: true } } : p)),
        },
      );
      toast.success("Fundo removido. Confirme o resultado no quadro.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover o fundo.");
    } finally {
      setCutting(null);
    }
  };
  /**
   * Cria a imagem do conjunto: tira o fundo às peças que ainda o têm, dispõe-nas pelas proporções
   * reais (como um flat-lay) e desenha a imagem final com o fundo escolhido.
   */
  const compose = async () => {
    if (draft.pieces.length < 2) {
      toast.error("Escolha pelo menos 2 peças.");
      return;
    }
    try {
      const ready: Piece[] = [];
      const skipped: string[] = [];
      for (const [i, pc] of draft.pieces.entries()) {
        const p = productOf(pc.productId);
        if (!p) continue;
        setComposing(`A preparar ${i + 1} de ${draft.pieces.length}: ${p.title}`);
        // Num flat-lay só entram peças sem fundo: nunca a fotografia original com pessoa ou cenário.
        let image = isStoredCutout(pc.image) ? pc.image : draftCutoutFor(p, pc.image);
        if (!image) {
          const usable = productOnlyPhotos(p);
          const source = usable.includes(pc.image) ? pc.image : usable[0];
          if (!source) {
            skipped.push(p.title);
            continue;
          }
          image = ((await processProductPhoto(p.id, source, { force: "recorte", onStatus: (m) => setComposing(`${p.title}: ${m}`) })) as { url: string }).url;
        }
        ready.push({ ...pc, image, layout: { ...pc.layout, cutout: true } });
      }
      if (skipped.length)
        toast.warning(`Ficaram de fora (só têm fotografias com pessoa): ${skipped.join(", ")}. Importe uma fotografia só do produto.`);
      if (ready.length < 2) throw new Error("São precisas pelo menos 2 peças com fotografia só do produto.");
      setComposing("A compor a imagem…");
      const { imageSize } = await import("@/lib/cutout");
      const sizes = await Promise.all(ready.map((pc) => imageSize(pc.image)));
      const withRole = ready.map((pc, i) => ({ pc, role: roleOf(productOf(pc.productId) ?? {}), aspect: sizes[i]!.width / Math.max(1, sizes[i]!.height) }));
      const ordered = sortByRole(withRole);
      const layouts = fitLayout(ordered);
      const pieces = ordered.map((o, i) => ({ ...o.pc, layout: layouts[i]! }));
      const { renderOutfit } = await import("@/lib/outfit-render");
      const png = await renderOutfit(draft.background, pieces);
      const { url } = await saveCutout({ data: { productId: "conjuntos", png } });
      // Nova composição: a fotografia por IA anterior deixa de corresponder às posições.
      setDraft((d) => d && { ...d, pieces, cover: url, aiImage: "", aiStatus: "" });
      toast.success("Composição criada. Agora pode «Fotografar com IA» ou ajustar as peças e criar de novo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a imagem.");
    } finally {
      setComposing(null);
    }
  };
  /**
   * Opção híbrida: a composição (recortes reais, posições certas) vai uma vez ao modelo de edição,
   * com os recortes como referência. Fica por verificar até ser aprovada.
   */
  const [shooting, setShooting] = useState(false);
  const reshoot = async () => {
    if (!draft.cover) return;
    setShooting(true);
    try {
      const references = draft.pieces.map((p) => p.image).filter(isStoredCutout).slice(0, 7);
      const { url } = await reshootOutfit({ data: { composite: draft.cover, references } });
      setDraft((d) => d && { ...d, aiImage: url, aiStatus: "pendente" });
      toast.success("Fotografia criada. Compare com a composição antes de aprovar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a fotografia.");
    } finally {
      setShooting(false);
    }
  };
  const [regions, setRegions] = useState(true);
  const live = catalog.filter((p) => p.published);
  const productOf = (id: string) => catalog.find((p) => p.id === id);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setPiece = (key: string, patch: Partial<Piece>) =>
    set({ pieces: draft.pieces.map((p) => (p.key === key ? { ...p, ...patch } : p)) });

  const relayout = (pieces: Piece[]) => {
    const withRole = pieces.map((p) => ({ ...p, role: roleOf(productOf(p.productId) ?? {}) }));
    const ordered = sortByRole(withRole);
    const layouts = autoLayout(ordered);
    return ordered.map(({ role: _r, ...p }, i) => ({ ...p, layout: { ...layouts[i]!, cutout: p.layout.cutout } }));
  };
  const add = (p: Product) => {
    const piece: Piece = {
      key: newKey(),
      productId: p.id,
      color: p.color_options?.[0] ?? "",
      size: "",
      image: cutoutFor(p) ?? productPhotos(p)[0] ?? "",
      layout: { x: 10, y: 10, w: 40, r: 0, z: 1, cutout: !!cutoutFor(p) },
    };
    const next = relayout([...draft.pieces, piece]);
    set({ pieces: next });
    setSelected(piece.key);
  };

  const pieces: BoardPiece[] = draft.pieces.flatMap((pc) => {
    const p = productOf(pc.productId);
    return p && pc.image
      ? [{ key: pc.key, productId: p.id, slug: p.slug, title: p.title, price: Number(p.price), image: pc.image, color: pc.color, layout: pc.layout }]
      : [];
  });
  const current = draft.pieces.find((p) => p.key === selected);
  const currentProduct = current ? productOf(current.productId) : undefined;
  const results = live
    .filter((p) => !draft.pieces.some((x) => x.productId === p.id))
    .filter((p) => !q.trim() || `${p.title} ${p.category} ${p.garment_type}`.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 12);

  const save = useMutation({
    mutationFn: async () => {
      if (draft.title.trim().length < 2) throw new Error("Dê um nome ao conjunto.");
      if (draft.pieces.length < 2) throw new Error("Um conjunto precisa de pelo menos 2 peças.");
      const outfits = supabase.from("editorial_outfits" as any) as any;
      const base = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        status: draft.status,
      };
      const extra = {
        background: draft.background,
        gender: draft.gender || null,
        palette: draft.palette || null,
        cover_url: draft.cover || null,
        ai_image_url: draft.aiImage || null,
        ai_status: draft.aiImage ? draft.aiStatus || "pendente" : null,
      };
      let id = draft.id;
      const write = async (row: Record<string, unknown>) =>
        id
          ? outfits.update(row).eq("id", id).select("id").single()
          : outfits.insert({ ...row, slug: `${slugifyOutfit(draft.title)}-${newKey().slice(0, 4)}` }).select("id").single();
      let r = await write({ ...base, ...extra });
      // Base de dados sem as colunas novas (migration por aplicar): grava o essencial.
      // Base de dados sem as colunas mais recentes: grava sem elas.
      if (r.error && /ai_image_url|ai_status/i.test(r.error.message)) {
        const { ai_image_url: _a, ai_status: _s, ...rest } = extra;
        r = await write({ ...base, ...rest });
      }
      if (r.error && /cover_url/i.test(r.error.message)) {
        const { cover_url: _c, ai_image_url: _a, ai_status: _s, ...rest } = extra;
        r = await write({ ...base, ...rest });
      }
      if (r.error && /background|gender|palette|column/i.test(r.error.message)) r = await write(base);
      if (r.error) throw new Error(r.error.message);
      id = r.data.id as string;
      const items = supabase.from("editorial_outfit_items" as any) as any;
      const { error: d } = await items.delete().eq("outfit_id", id);
      if (d) throw new Error(d.message);
      const rows = draft.pieces.map((p, position) => ({
        outfit_id: id,
        product_id: p.productId,
        position,
        color: p.color || null,
        size: p.size || null,
      }));
      let ins = await items.insert(rows.map((row, i) => ({ ...row, image_url: draft.pieces[i]!.image || null, layout: draft.pieces[i]!.layout })));
      if (ins.error && /image_url|layout|column/i.test(ins.error.message)) ins = await items.insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    },
    onSuccess: () => {
      toast.success(draft.status === "published" ? "Conjunto publicado." : "Rascunho guardado.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = pieces.reduce((t, p) => t + p.price, 0);

  return (
    <Panel className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <h2 className="text-xl">{draft.id ? "Editar conjunto" : "Novo conjunto"}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </div>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <OutfitBoard
            title={draft.title || "Conjunto"}
            background={draft.background}
            pieces={pieces}
            editable
            selected={selected}
            onSelect={setSelected}
            onMove={(key, layout) =>
              // Mexer nas peças depois de aprovar a fotografia obriga a verificar outra vez.
              set({
                pieces: draft.pieces.map((p) => (p.key === key ? { ...p, layout } : p)),
                ...(draft.aiStatus === "aprovado" ? { aiStatus: "pendente" as const } : {}),
              })
            }
            className="mx-auto max-w-[560px]"
          />
          <p className="mx-auto mt-2 max-w-[560px] text-xs text-muted-foreground">
            Arraste as peças para as posicionar. {pieces.length} peças · {euro(total)}
          </p>
          <div className="mx-auto mt-4 max-w-[560px] border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={compose} disabled={!!composing || draft.pieces.length < 2}>
                {composing ? "A criar…" : draft.cover ? "Criar de novo" : "Criar imagem do conjunto"}
              </Button>
              <p className="min-w-0 flex-1 text-xs text-muted-foreground" role="status" aria-live="polite">
                {composing ??
                  "Tira o fundo às peças, arruma-as como se tivessem sido pousadas à mão e cria a imagem com o fundo escolhido."}
              </p>
            </div>
            {draft.cover && (
              <div className="mt-4 border-t pt-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={reshoot} disabled={shooting || !!composing}>
                    {shooting ? "A fotografar… (até 1 min)" : draft.aiImage ? "Fotografar de novo com IA" : "Fotografar com IA"}
                  </Button>
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                    Transforma a composição numa fotografia de flat-lay natural (cerca de 4 cêntimos). A IA pode alterar detalhes:
                    só aprove se as peças estiverem iguais aos produtos e nos mesmos sítios.
                  </p>
                </div>
                {draft.aiImage && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <figure>
                        <img src={draft.cover} alt="Composição com as fotografias reais" className="w-full border" />
                        <figcaption className="mt-1 text-xs text-muted-foreground">Composição (produtos reais)</figcaption>
                      </figure>
                      <figure>
                        <OutfitBoard
                          title={draft.title || "Conjunto"}
                          background={draft.background}
                          pieces={pieces}
                          photo={draft.aiImage}
                          showRegions={regions}
                          hotspots
                        />
                        <figcaption className="mt-1 text-xs text-muted-foreground">
                          Fotografia por IA ·{" "}
                          {draft.aiStatus === "aprovado" ? "aprovada" : draft.aiStatus === "rejeitado" ? "rejeitada" : "por verificar"}
                        </figcaption>
                      </figure>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={regions} onChange={(e) => setRegions(e.target.checked)} />
                      Mostrar o contorno das peças (os pontos e o destaque da loja usam estas posições)
                    </label>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      <li>Cada peça é o mesmo produto (cor, padrão, logótipo, botões)?</li>
                      <li>Os contornos tracejados caem em cima da peça certa?</li>
                      <li>Não apareceu nem desapareceu nenhuma peça?</li>
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={draft.aiStatus === "aprovado"} onClick={() => set({ aiStatus: "aprovado" })}>
                        Aprovar fotografia
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={draft.aiStatus === "rejeitado"} onClick={() => set({ aiStatus: "rejeitado" })}>
                        Rejeitar (a loja usa a composição)
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">A decisão fica gravada ao carregar em «Guardar».</p>
                  </div>
                )}
              </div>
            )}
            {draft.cover && (
              <div className="mt-3 flex items-start gap-3">
                <img src={draft.cover} alt={`Imagem do conjunto ${draft.title}`} className="w-40 border" />
                <div className="space-y-1 text-xs">
                  <p>Imagem pronta para redes sociais e partilha (1200×1500).</p>
                  <a href={draft.cover} target="_blank" rel="noopener" className="underline">
                    Abrir imagem
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="o-t">Nome</Label>
              <input id="o-t" value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} className="mt-1 h-10 w-full border bg-card px-3" placeholder="Ex.: Chocolate e creme" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="o-d">Descrição curta</Label>
              <input id="o-d" value={draft.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} className="mt-1 h-10 w-full border bg-card px-3" placeholder="Ex.: Malha e calças de corte direito para o dia a dia." />
            </div>
            <div>
              <Label htmlFor="o-b">Fundo</Label>
              <select id="o-b" value={draft.background} onChange={(e) => set({ background: e.target.value as BackgroundKey })} className="mt-1 h-10 w-full border bg-card px-3">
                {Object.entries(BACKGROUNDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="o-s">Estado</Label>
              <select id="o-s" value={draft.status} onChange={(e) => set({ status: e.target.value as Draft["status"] })} className="mt-1 h-10 w-full border bg-card px-3">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado na loja</option>
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="font-medium">Peças ({draft.pieces.length})</legend>
            <ul className="mt-2 divide-y border">
              {draft.pieces.map((pc) => {
                const p = productOf(pc.productId);
                return (
                  <li key={pc.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(pc.key)}
                      aria-pressed={selected === pc.key}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${selected === pc.key ? "bg-[var(--plate)]" : ""}`}
                    >
                      {pc.image && <img src={pc.image} alt="" className="h-10 w-10 object-cover" />}
                      <span className="min-w-0 flex-1 truncate">{p?.title ?? "Produto removido"}</span>
                      <span className="text-xs text-muted-foreground">{p ? ROLE_LABEL[roleOf(p)] : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" type="button" onClick={() => set({ pieces: relayout(draft.pieces) })} disabled={draft.pieces.length < 1}>
                Reorganizar automaticamente
              </Button>
            </div>
          </fieldset>

          {current && currentProduct && (
            <fieldset className="space-y-3 border p-3">
              <legend className="px-1 font-medium">{currentProduct.title}</legend>
              <div>
                <p className="text-xs text-muted-foreground">Fotografia (escolha a de fundo mais limpo)</p>
                <ul className="mt-1 grid grid-cols-6 gap-1">
                  {productPhotos(currentProduct).map((u) => (
                    <li key={u}>
                      <button
                        type="button"
                        onClick={() => setPiece(current.key, { image: u })}
                        aria-pressed={current.image === u}
                        className={`block aspect-square w-full overflow-hidden border-2 ${current.image === u ? "border-foreground" : "border-transparent"}`}
                      >
                        <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
                <input
                  value={productPhotos(currentProduct).includes(current.image) ? "" : current.image}
                  onChange={(e) => /^https:\/\/\S+$/.test(e.target.value.trim()) && setPiece(current.key, { image: e.target.value.trim() })}
                  placeholder="Ou cole o endereço https:// de uma fotografia sem fundo (PNG)"
                  className="mt-2 h-9 w-full border bg-card px-2 text-xs"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={!current.image || cutting !== null}
                    aria-busy={cutting === current.key}
                    onClick={() => cutOut(current.key, currentProduct.id, current.image)}
                  >
                    {cutting === current.key ? "A remover o fundo…" : "Remover fundo"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Grátis, no seu navegador. A primeira vez demora uns segundos.</span>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!current.layout.cutout} onChange={(e) => setPiece(current.key, { layout: { ...current.layout, cutout: e.target.checked } })} />
                  Fotografia sem fundo (recorte): mostrar sombra
                </label>
              </div>
              {(currentProduct.color_options ?? []).length > 0 && (
                <div>
                  <Label htmlFor="o-c">Cor neste conjunto</Label>
                  <select id="o-c" value={current.color} onChange={(e) => setPiece(current.key, { color: e.target.value })} className="mt-1 h-9 w-full border bg-card px-2">
                    {(currentProduct.color_options ?? []).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">
                  Tamanho no quadro ({Math.round(current.layout.w)}%)
                  <input type="range" min={10} max={80} value={current.layout.w} onChange={(e) => setPiece(current.key, { layout: { ...current.layout, w: Number(e.target.value) } })} className="w-full" />
                </label>
                <label className="text-xs">
                  Rotação ({current.layout.r}°)
                  <input type="range" min={-25} max={25} value={current.layout.r} onChange={(e) => setPiece(current.key, { layout: { ...current.layout, r: Number(e.target.value) } })} className="w-full" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setPiece(current.key, { layout: { ...current.layout, z: Math.max(...draft.pieces.map((p) => p.layout.z)) + 1 } })}>
                  Trazer para a frente
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={() => setPiece(current.key, { layout: { ...current.layout, z: Math.min(...draft.pieces.map((p) => p.layout.z)) - 1 } })}>
                  Enviar para trás
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className="text-destructive"
                  onClick={() => {
                    set({ pieces: draft.pieces.filter((p) => p.key !== current.key) });
                    setSelected(null);
                  }}
                >
                  Retirar do conjunto
                </Button>
              </div>
            </fieldset>
          )}

          <div>
            <Label htmlFor="o-q">Acrescentar produto</Label>
            <input id="o-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome ou categoria" className="mt-1 h-9 w-full border bg-card px-2" />
            <ul className="mt-2 max-h-64 divide-y overflow-auto border">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--plate)]">
                    {productPhotos(p)[0] && <img src={productPhotos(p)[0]} alt="" loading="lazy" className="h-9 w-9 object-cover" />}
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-muted-foreground">{p.garment_type ?? p.category}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-2 text-muted-foreground">Nenhum produto publicado encontrado.</li>}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}
