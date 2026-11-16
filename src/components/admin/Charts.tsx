// Gráficos leves em SVG, nas cores da marca. Valores sempre também em texto.

export function HBars({
  items,
  max,
}: {
  items: { label: string; value: number; text?: string }[];
  max?: number;
}) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2">
      {items.map((i) => (
        <div
          key={i.label}
          className="grid grid-cols-[minmax(90px,150px)_minmax(0,1fr)_auto] items-center gap-3 text-sm"
        >
          <span className="truncate">{i.label}</span>
          <div className="h-3 bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.max(i.value > 0 ? 1 : 0, (i.value / m) * 100)}%` }}
            />
          </div>
          <b className="num">{i.text ?? i.value}</b>
        </div>
      ))}
    </div>
  );
}

export function LineChart({
  points,
  format = (v) => String(v),
  label,
}: {
  points: { x: string; y: number }[];
  format?: (v: number) => string;
  label: string;
}) {
  const W = 640;
  const H = 200;
  const L = 52;
  const R = 16;
  const T = 12;
  const B = 26;
  const max = Math.max(1, ...points.map((p) => p.y));
  const step = (() => {
    const raw = max / 4;
    const pow = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? raw;
  })();
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => L + (points.length < 2 ? 0 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + ((top - v) / top) * (H - T - B);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const line = points.map((p, i) => `${x(i)},${y(p.y)}`).join(" ");
  const area = `${L},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`;
  const last = points.at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
          <text
            x={L - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {format(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % 7 === 0 || i === points.length - 1 ? (
          <text
            key={p.x}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {p.x.slice(8, 10)}/{p.x.slice(5, 7)}
          </text>
        ) : null,
      )}
      <polygon points={area} fill="var(--brand-accent)" opacity="0.08" />
      <polyline points={line} fill="none" stroke="var(--brand-accent)" strokeWidth="2" />
      {last && (
        <circle
          cx={x(points.length - 1)}
          cy={y(last.y)}
          r="4"
          fill="var(--brand-accent)"
          stroke="var(--card)"
          strokeWidth="2"
        />
      )}
      {points.map((p, i) => (
        <rect
          key={p.x}
          x={x(i) - (W - L - R) / Math.max(points.length - 1, 1) / 2}
          y={T}
          width={(W - L - R) / Math.max(points.length - 1, 1)}
          height={H - T - B}
          fill="transparent"
        >
          <title>{`${p.x}: ${format(p.y)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
