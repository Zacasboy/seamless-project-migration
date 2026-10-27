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
  type?: "text" | "number" | "textarea" | "bool" | "select" | "list" | "datetime";
  options?: string[];
  required?: boolean;
  readOnly?: boolean;
};
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
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);

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
      const payload: Row = {};
      for (const f of fields)
        if (!f.readOnly && row[f.key] !== undefined) payload[f.key] = row[f.key];
      const t = supabase.from(table as any) as any;
      const { error } = row.id ? await t.update(payload).eq("id", row.id) : await t.insert(payload);
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
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["admin", table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{title}</h1>
          {intro && <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{intro}</div>}
        </div>
        {canCreate && (
          <Button onClick={() => setEditing({})}>
            <Plus className="mr-1 h-4 w-4" />
            Novo
          </Button>
        )}
      </div>
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
          <p className="p-8 text-center text-muted-foreground">A carregar…</p>
        ) : query.isError ? (
          <p className="p-8 text-center text-destructive">
            Erro ao carregar: {(query.error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Sem registos.</p>
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
                <tr key={r.id} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 align-top">
                      {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                      {c === columns[0] && r.is_demo && (
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
                      onClick={() => setEditing(r)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover"
                        onClick={() => confirm("Remover este registo?") && del.mutate(r.id)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo registo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              id="crud"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
            >
              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  f={f}
                  value={editing[f.key]}
                  onChange={(v) => setEditing({ ...editing, [f.key]: v })}
                />
              ))}
            </form>
          )}
          <DialogFooter>
            <Button type="submit" form="crud" disabled={save.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const id = `f-${f.key}`;
  if (f.type === "bool")
    return (
      <div className="flex items-center gap-2">
        <Switch id={id} checked={!!value} disabled={f.readOnly} onCheckedChange={onChange} />
        <Label htmlFor={id}>{f.label}</Label>
      </div>
    );
  return (
    <div>
      <Label htmlFor={id}>{f.label}</Label>
      {f.type === "textarea" ? (
        <Textarea
          id={id}
          value={value ?? ""}
          readOnly={f.readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : f.type === "select" ? (
        <select
          id={id}
          className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          value={value ?? ""}
          disabled={f.readOnly}
          required={f.required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Escolher…
          </option>
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.type === "list" ? (
        <Input
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
          id={id}
          type={f.type === "number" ? "number" : "text"}
          step="any"
          value={value ?? ""}
          readOnly={f.readOnly}
          required={f.required}
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
    </div>
  );
}
