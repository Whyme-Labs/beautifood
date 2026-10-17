// Single-series bar chart (inline SVG): thin bars (≤24px) with 4px rounded data-ends
// anchored to the baseline, recessive axis, hover tooltip per bar, and a table view.
import { useState } from "react";

export interface Bar {
  label: string;
  value: number;
  display: string;
}

export function BarChart({ data, title, height = 160, testId }: { data: Bar[]; title: string; height?: number; testId?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = 40;
  const width = Math.max(240, data.length * slot);
  const plotH = height - 24;
  const barW = Math.min(24, slot - 12);
  return (
    <figure style={{ margin: 0 }} data-testid={testId}>
      <figcaption className="row between" style={{ marginBottom: 6 }}>
        <b>{title}</b>
        <button className="btn ghost small" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? "Chart" : "Table"}
        </button>
      </figcaption>
      {table ? (
        <table>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="num">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ position: "relative", overflowX: "auto" }}>
          <svg width={width} height={height} role="img" aria-label={title} style={{ display: "block" }}>
            <line x1={0} x2={width} y1={plotH + 0.5} y2={plotH + 0.5} stroke="var(--line)" />
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(2, (d.value / max) * (plotH - 8)) : 0;
              const x = i * slot + (slot - barW) / 2;
              const y = plotH - h;
              const r = Math.min(4, h);
              return (
                <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                  <rect x={i * slot} y={0} width={slot} height={plotH} fill="transparent" />
                  {h > 0 && <path d={`M${x},${plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${plotH} Z`} fill="var(--brand)" opacity={hover === null || hover === i ? 1 : 0.55} />}
                  <text x={i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && data[hover] && (
            <div className="card tight" style={{ position: "absolute", top: 0, left: Math.min(width - 140, hover * slot), pointerEvents: "none", fontSize: 13, whiteSpace: "nowrap" }}>
              <div className="muted">{data[hover].label}</div>
              <b>{data[hover].display}</b>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
