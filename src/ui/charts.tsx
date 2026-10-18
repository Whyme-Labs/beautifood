// Single-series bar chart (inline SVG): thin bars (≤24px) with 4px rounded data-ends anchored to the
// baseline, a recessive grid with a few nice ticks, a hover/focus tooltip per bar, and a table view.
import { useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useI18n } from "../i18n/react";
import { Empty } from "./components";

export interface Bar {
  /** Short axis label. */
  label: string;
  value: number;
  /** Formatted value for the tooltip and table. */
  display: string;
  /** Longer label for the tooltip and table (defaults to `label`). */
  long?: string;
}

const AXIS_W = 52;
const LABEL_H = 22;

function niceTicks(max: number) {
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  const top = step * Math.ceil(max / step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

// CJK glyphs are about twice as wide as Latin at the same size.
const textWidth = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 11 : 6.2), 0);

export function BarChart({ data, title, height = 180, testId, tick }: { data: Bar[]; title: string; height?: number; testId?: string; tick?: (v: number) => string }) {
  const { t, f } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const [boxW, setBoxW] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setBoxW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const empty = !data.length || data.every((d) => d.value <= 0);
  const ticks = niceTicks(Math.max(1, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1];
  const minSlot = Math.max(34, ...data.map((d) => textWidth(d.label) + 10));
  const width = Math.max(AXIS_W + data.length * minSlot, boxW || 0, 240);
  const slot = (width - AXIS_W) / Math.max(1, data.length);
  const plotH = height - LABEL_H;
  const plotTop = 8;
  const y = (v: number) => plotH - (v / top) * (plotH - plotTop);
  const barW = Math.min(24, Math.max(8, slot * 0.5));
  const fmtTick = tick ?? f.number;
  const tip = hover !== null ? data[hover] : null;
  const tipX = hover !== null ? AXIS_W + hover * slot + slot / 2 : 0;
  return (
    <figure className="bar-chart" data-testid={testId}>
      <figcaption>
        <b>{title}</b>
        <div className="segmented" role="group" aria-label={t("staff.boss.charts.view")}>
          <button type="button" aria-pressed={!table} className={table ? undefined : "active"} onClick={() => setTable(false)}>
            {t("staff.boss.charts.chart")}
          </button>
          <button type="button" aria-pressed={table} className={table ? "active" : undefined} onClick={() => setTable(true)}>
            {t("staff.boss.charts.table")}
          </button>
        </div>
      </figcaption>
      {empty ? (
        <Empty icon={<BarChart3 size={28} strokeWidth={1.5} />}>{t("staff.boss.charts.empty")}</Empty>
      ) : table ? (
        <table>
          <thead>
            <tr>
              <th>{title}</th>
              <th className="num">{t("staff.boss.charts.value")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.long ?? d.label}</td>
                <td className="num">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bc-box" ref={box}>
          <svg width={width} height={height} role="img" aria-label={title}>
            {ticks.map((v) => (
              <g key={v} className="bc-grid">
                <line x1={AXIS_W} x2={width} y1={Math.round(y(v)) + 0.5} y2={Math.round(y(v)) + 0.5} className={v === 0 ? "base" : undefined} />
                <text x={AXIS_W - 8} y={y(v) + 4} textAnchor="end">
                  {fmtTick(v)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(2, plotH - y(d.value)) : 0;
              const x = AXIS_W + i * slot + (slot - barW) / 2;
              const yt = plotH - h;
              const r = Math.min(4, h, barW / 2);
              return (
                <g
                  key={d.label}
                  className={`bc-bar${hover !== null && hover !== i ? " dim" : ""}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.long ?? d.label}: ${d.display}`}
                >
                  <rect x={AXIS_W + i * slot} y={0} width={slot} height={height} fill="transparent" />
                  {h > 0 && <path d={`M${x},${plotH} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + barW - r} Q${x + barW},${yt} ${x + barW},${yt + r} V${plotH} Z`} />}
                  <text x={AXIS_W + i * slot + slot / 2} y={height - 6} textAnchor="middle">
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className="bc-tip" style={{ left: Math.max(70, Math.min(width - 70, tipX)), top: Math.max(0, y(tip.value) - 8) }} aria-hidden="true">
              <span>{tip.long ?? tip.label}</span>
              <b>{tip.display}</b>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
