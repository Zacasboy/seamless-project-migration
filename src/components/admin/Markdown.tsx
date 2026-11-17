import { Fragment, type ReactNode } from "react";

// Markdown simples para relatórios dos agentes, gerado como elementos React (sem HTML cru).
// Suporta títulos, parágrafos, listas, tabelas, **negrito**, `código` e ligações http(s).

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s)<>]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`"))
      out.push(
        <code key={k} className="rounded-sm bg-muted px-1 text-[0.9em]">
          {t.slice(1, -1)}
        </code>,
      );
    else {
      const label = t.startsWith("[") ? t.slice(1, t.indexOf("]")) : t;
      const href = t.startsWith("[") ? m[2]! : t;
      out.push(
        <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4 break-words">
          {label}
        </a>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1]!.length;
      const cls = level <= 2 ? "mt-6 text-xl" : "mt-5 text-base font-semibold";
      blocks.push(
        level <= 2 ? (
          <h3 key={i} className={cls}>{inline(h[2]!, i)}</h3>
        ) : (
          <h4 key={i} className={cls}>{inline(h[2]!, i)}</h4>
        ),
      );
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && lines[i + 1]?.match(/^\s*\|?\s*:?-{2,}/)) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      blocks.push(
        <div key={i} className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                {head.map((c, j) => (
                  <th key={j} className="px-2 py-1.5 font-semibold">{inline(c, j)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b align-top last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="px-2 py-1.5">{inline(c, ri * 100 + j)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={i} className={`mt-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, j)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [lines[i++]!]; // a primeira linha entra sempre (garante progresso)
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push(
      <p key={i} className="mt-2 leading-relaxed">
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, j)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="max-w-[78ch] text-sm">{blocks}</div>;
}
