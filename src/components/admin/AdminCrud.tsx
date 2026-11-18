/* eslint-disable @typescript-eslint/no-explicit-any -- Admin CRUD uses dynamic table/column keys not represented by the generated Supabase type map. */
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Row = Record<string, any>;
export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "bool" | "select" | "list" | "datetime" | "gallery";
  options?: string[] | { value: string; label: string }[];
  required?: boolean;
  readOnly?: boolean;
  hint?: string;
  pattern?: RegExp;
  patternMessage?: string;
  maxLength?: number;
  min?: number;
};

// Validação no browser antes de gravar; a base de dados volta a validar.
export function validateRow(fields: Field[], row: Row) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    const v = row[f.key];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty && f.type !== "bool") errors[f.key] = "Campo obrigatório.";
    else if (!empty && f.type === "gallery" && (v as string[]).some((u) => !/^https:\/\/\S+$/.test(u)))
      errors[f.key] = "Cada fotografia tem de ser um endereço https://.";
    else if (!empty && f.pattern && typeof v === "string" && !f.pattern.test(v))
      errors[f.key] = f.patternMessage ?? "Formato inválido.";
    else if (!empty && f.maxLength && typeof v === "string" && v.length > f.maxLength)
      errors[f.key] = `Máximo de ${f.maxLength} caracteres.`;
    else if (
      !empty &&
      f.type === "number" &&
      (!Number.isFinite(Number(v)) || (f.min !== undefined && Number(v) < f.min))
    )
      errors[f.key] = f.min !== undefined ? `Valor mínimo: ${f.min}.` : "Número inválido.";
  }
  return errors;
}

const optValue = (o: string | { value: string; label: string }) =>
  typeof o === "string" ? o : o.value;
const optLabel = (o: string | { value: string; label: string }) =>
  typeof o === "string" ? o : o.label;
export type Column = { key: string; label: string; render?: (r: Row) => ReactNode };

const PAGE = 15;

export function AdminCrud({
  table,
  title,
  intro,
  columns,
  fields,
  searchKeys,
  filterKey,
  filterOptions,
  orderBy = "created_at",
  canCreate = true,
  canDelete = true,
  beforeSave,
  editorExtra,
  headerExtra,
  emptyText = "Sem registos.",
}: {
  table: string;
  title: string;
  intro?: ReactNode;
  columns: Column[];
  fields: Field[];
  searchKeys: string[];
  filterKey?: string;
  filterOptions?: string[];
  orderBy?: string;
  canCreate?: boolean;
  canDelete?: boolean;
  beforeSave?: (payload: Row, original: Row) => Row;
  /** Bloco extra no editor (ex.: fornecedor do produto); pode alterar o registo em edição. */
  editorExtra?: (row: Row, setRow: (r: Row) => void) => ReactNode;
  headerExtra?: ReactNode;
  emptyText?: string;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [original, setOriginal] = useState<Row>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const openEditor = (r: Row) => {
    // Galeria: sem lista guardada, começa pela fotografia principal (image_url).
    const prefilled = { ...r };
    for (const f of fields)
      if (f.type === "gallery" && (!Array.isArray(r[f.key]) || r[f.key].length === 0))
        prefilled[f.key] = r["image_url"] ? [r["image_url"]] : [];
    setEditing(prefilled);
    setOriginal(r);
    setErrors({});
  };

  const query = useQuery({
    queryKey: ["admin", table],
    queryFn: async () => {
      const { data, error } = await (supabase.from(table as any) as any)
        .select("*")
        .order(orderBy, { ascending: false });
      if (error) throw new Error(error.message);
      return data as Row[];
    },
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (query.data ?? []).filter(
      (r) =>
        (!s ||
          searchKeys.some((k) =>
            String(r[k] ?? "")
              .toLowerCase()
              .includes(s),
          )) &&
        (!filter || !filterKey || r[filterKey] === filter),
    );
  }, [query.data, q, filter, filterKey, searchKeys]);
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  const save = useMutation({
    mutationFn: async (row: Row) => {
      let payload: Row = {};
      for (const f of fields)
        if (!f.readOnly && row[f.key] !== undefined)
          payload[f.key] = typeof row[f.key] === "string" ? row[f.key].trim() : row[f.key];
      if (beforeSave) payload = beforeSave(payload, original);
      const t = supabase.from(table as any) as any;
      const { error } = row["id"]
        ? await t.update(payload).eq("id", row["id"])
        : await t.insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Guardado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", table] });
    },
    onError: (e: Error) => toast.error(`Não foi possível guardar: ${e.message}`),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setConfirmId(null);
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["admin", table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <AdminHeader
        title={title}
        intro={intro}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {headerExtra}
            {canCreate && (
              <Button onClick={() => openEditor({})}>
                <Plus className="mr-1 h-4 w-4" />
                Novo
              </Button>
            )}
          </div>
        }
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          placeholder="Pesquisar…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          className="max-w-xs"
        />
        {filterOptions && (
          <select
            className="rounded-md border bg-card px-3 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            {filterOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border bg-card">
        {query.isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="A carregar">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <p role="alert" className="p-8 text-destructive">
            Não foi possível carregar: {(query.error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-muted-foreground">
            {q || filter ? "Nenhum registo com este filtro." : emptyText}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r["id"]} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 align-top">
                      {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                      {c === columns[0] && r["is_demo"] && (
                        <Badge variant="outline" className="ml-2">
                          Demo
                        </Badge>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditor(r)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover"
                        onClick={() => setConfirmId(r["id"])}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Seguinte
          </Button>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.["id"] ? "Editar" : "Novo registo"}</DialogTitle>
          </DialogHeader>
          {editing && editorExtra?.(editing, setEditing)}
          {editing && (
            <form
              id="crud"
              noValidate
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const errs = validateRow(fields, editing);
                setErrors(errs);
                const first = Object.keys(errs)[0];
                if (first) {
                  document.getElementById(`f-${first}`)?.focus();
                  return;
                }
                save.mutate(editing);
              }}
            >
              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  f={f}
                  value={editing[f.key]}
                  error={errors[f.key]}
                  onChange={(v) => {
                    setEditing({ ...editing, [f.key]: v });
                    if (errors[f.key]) setErrors({ ...errors, [f.key]: "" });
                  }}
                />
              ))}
            </form>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="crud" disabled={save.isPending}>
              {save.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover este registo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser anulada.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => confirmId && del.mutate(confirmId)}
            >
              {del.isPending ? "A remover…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({
  f,
  value,
  onChange,
  error,
}: {
  f: Field;
  value: any;
  onChange: (v: any) => void;
  error?: string | undefined;
}) {
  const id = `f-${f.key}`;
  const describedBy = error ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
  const aria = { "aria-invalid": !!error || undefined, "aria-describedby": describedBy };
  const note = error ? (
    <p id={`${id}-err`} className="mt-1 text-sm text-destructive">
      {error}
    </p>
  ) : f.hint ? (
    <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
      {f.hint}
    </p>
  ) : null;
  if (f.type === "bool")
    return (
      <div className="flex items-center gap-2">
        <Switch id={id} checked={!!value} disabled={f.readOnly} onCheckedChange={onChange} />
        <Label htmlFor={id}>{f.label}</Label>
      </div>
    );
  return (
    <div>
      <Label htmlFor={id}>
        {f.label}
        {f.required && <span className="text-destructive"> *</span>}
      </Label>
      {f.type === "textarea" ? (
        <Textarea
          {...aria}
          id={id}
          value={value ?? ""}
          readOnly={f.readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : f.type === "select" ? (
        <select
          {...aria}
          id={id}
          className="h-9 w-full rounded-md border bg-card px-2 text-sm aria-[invalid=true]:border-destructive"
          value={value ?? ""}
          disabled={f.readOnly}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Escolher…
          </option>
          {f.options!.map((o) => (
            <option key={optValue(o)} value={optValue(o)}>
              {optLabel(o)}
            </option>
          ))}
        </select>
      ) : f.type === "gallery" ? (
        <GalleryInput id={id} value={(value as string[] | null) ?? []} onChange={onChange} readOnly={f.readOnly} />
      ) : f.type === "list" ? (
        <Input
          {...aria}
          id={id}
          value={(value ?? []).join(", ")}
          readOnly={f.readOnly}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      ) : (
        <Input
          {...aria}
          id={id}
          className="aria-[invalid=true]:border-destructive"
          maxLength={f.maxLength}
          type={f.type === "number" ? "number" : "text"}
          step="any"
          value={value ?? ""}
          readOnly={f.readOnly}
          onChange={(e) =>
            onChange(
              f.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
      {note}
    </div>
  );
}

/** Fotografias do produto: a primeira é a principal. Remover, tornar principal e acrescentar por URL. */
function GalleryInput({
  id,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  readOnly?: boolean | undefined;
}) {
  const [url, setUrl] = useState("");
  const valid = /^https:\/\/\S+$/.test(url.trim());
  const add = () => {
    if (!valid || value.includes(url.trim()) || value.length >= 20) return;
    onChange([...value, url.trim()]);
    setUrl("");
  };
  return (
    <div className="mt-1 space-y-2">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem fotografias. A loja mostra «Fotografia em breve».</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {value.map((src, i) => (
            <li key={src} className="relative">
              <img
                src={src}
                alt={`Fotografia ${i + 1}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className={`aspect-square w-full bg-muted object-cover ${i === 0 ? "outline outline-2 outline-[var(--brand-accent)]" : ""}`}
              />
              {i === 0 && (
                <span className="absolute left-1 top-1 bg-[var(--brand-accent)] px-1 text-[10px] text-white">Principal</span>
              )}
              {!readOnly && (
                <div className="mt-1 flex flex-col gap-0.5 text-[11px]">
                  {i > 0 && (
                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onChange([src, ...value.filter((u) => u !== src)])}>
                      Tornar principal
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remover fotografia ${i + 1}`}
                    className="text-left text-destructive underline-offset-2 hover:underline"
                    onClick={() => onChange(value.filter((u) => u !== src))}
                  >
                    Remover
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            id={id}
            value={url}
            placeholder="https://… (acrescentar fotografia)"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!valid || value.length >= 20}>
            Acrescentar
          </Button>
        </div>
      )}
    </div>
  );
}
