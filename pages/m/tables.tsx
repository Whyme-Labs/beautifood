// Floor plan editor: tables with seats, zone, merge group and split configuration.
import { useEffect, useMemo, useState } from "react";
import { Plus, QrCode, Save, Trash2 } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { Empty, Stat, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";

interface T {
  id?: string;
  label: string;
  zone: string;
  seatsMin: number;
  seatsMax: number;
  x?: number;
  y?: number;
  mergeGroup: string | null;
  splitConfig: { suffix: string; seats: number }[] | null;
  parentId?: string | null;
}

export default function Tables() {
  const s = useStaff();
  const b = useBranchApi();
  const { t } = useI18n();
  const { run, pending } = useAction();
  const { data, refresh } = usePoll(() => (s.branchId ? api<T[]>(b("tables")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const [rows, setRows] = useState<T[]>([]);
  const saved = useMemo(() => (data ?? []).filter((t) => !t.parentId), [data]);
  useEffect(() => setRows(saved), [saved]);
  const set = (i: number, p: Partial<T>) => setRows(rows.map((r, n) => (n === i ? { ...r, ...p } : r)));
  const dirty = data != null && JSON.stringify(rows) !== JSON.stringify(saved);
  const seats = rows.reduce((a, r) => a + (r.seatsMax || 0), 0);
  const zones = new Set(rows.map((r) => r.zone.trim()).filter(Boolean)).size;
  const focusRow = (i: number) => document.getElementById(`tbl-label-${i}`)?.focus();
  const addTable = () => {
    setRows([...rows, { label: `T${rows.length + 1}`, zone: rows.at(-1)?.zone || t("staff.tables.defaultZone"), seatsMin: 1, seatsMax: 4, mergeGroup: null, splitConfig: null }]);
    setTimeout(() => focusRow(rows.length), 0);
  };

  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.tables.title")}</h1>
          <div className="muted">{s.branch?.name}</div>
        </div>
        <div className="row">
          {dirty && <span className="badge warn">{t("staff.tables.unsaved")}</span>}
          <a className="btn" href="/m/qr">
            <QrCode size={18} aria-hidden /> {t("staff.tables.printQr")}
          </a>
          <button className="btn" onClick={addTable}>
            <Plus size={18} aria-hidden /> {t("staff.tables.addTable")}
          </button>
          <button className="btn primary" disabled={pending} onClick={() => run(async () => (await api(b("tables"), { method: "PUT", body: { tables: rows.map(({ parentId: _p, ...r }) => r), replace: false } }), await refresh()), t("staff.tables.floorSaved"))}>
            <Save size={18} aria-hidden /> {t("common.save")}
          </button>
        </div>
      </div>

      <div className="card flat stats" style={{ padding: 0 }}>
        <Stat label={t("staff.tables.statTables")} value={rows.length} />
        <Stat label={t("staff.tables.statSeats")} value={seats} />
        <Stat label={t("staff.tables.statZones")} value={zones} />
      </div>

      {!data ? (
        <div className="muted">{t("common.loading")}</div>
      ) : !rows.length ? (
        <div className="card flat">
          <Empty>{t("staff.tables.empty")}</Empty>
        </div>
      ) : (
        <>
          <section aria-labelledby="floor-h" className="col">
            <h2 id="floor-h" style={{ margin: 0 }}>
              {t("staff.tables.floor")}
            </h2>
            <div className="floor">
              {rows.map((r, i) => (
                <button key={r.id ?? `new${i}`} className="tbl" onClick={() => focusRow(i)} aria-label={t("staff.tables.editTable", { label: r.label })}>
                  <b>{r.label || "?"}</b>
                  <small>{r.seatsMin === r.seatsMax ? t("common.paxOne", { count: r.seatsMax }) : t("common.pax", { min: r.seatsMin, max: r.seatsMax })}</small>
                  <small>{r.zone}</small>
                  {r.mergeGroup && <small>{t("staff.tables.merges", { group: r.mergeGroup })}</small>}
                  {r.splitConfig && <small>{t("staff.tables.splits", { parts: r.splitConfig.map((p) => p.seats).join("+") })}</small>}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="editor-h" className="col">
            <h2 id="editor-h" style={{ margin: 0 }}>
              {t("staff.tables.editor")}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {t("staff.tables.intro")}
            </p>
            <div className="card flat tbl-editor">
              <div className="tbl-row tbl-head" aria-hidden>
                <span>{t("staff.tables.label")}</span>
                <span>{t("staff.tables.zone")}</span>
                <span>{t("staff.tables.min")}</span>
                <span>{t("staff.tables.max")}</span>
                <span>{t("staff.tables.mergeGroup")}</span>
                <span>
                  {t("staff.tables.splitInto")} <span className="hint">({t("staff.tables.splitHint")})</span>
                </span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div key={r.id ?? `new${i}`} className="tbl-row">
                  <label>
                    <span className="tbl-cap">{t("staff.tables.label")}</span>
                    <input id={`tbl-label-${i}`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} aria-label={t("staff.tables.label")} />
                  </label>
                  <label>
                    <span className="tbl-cap">{t("staff.tables.zone")}</span>
                    <input value={r.zone} onChange={(e) => set(i, { zone: e.target.value })} aria-label={t("staff.tables.zone")} />
                  </label>
                  <label>
                    <span className="tbl-cap">{t("staff.tables.min")}</span>
                    <input type="number" inputMode="numeric" min={1} value={r.seatsMin} onChange={(e) => set(i, { seatsMin: Number(e.target.value) })} aria-label={t("staff.tables.minSeats")} />
                  </label>
                  <label>
                    <span className="tbl-cap">{t("staff.tables.max")}</span>
                    <input type="number" inputMode="numeric" min={1} value={r.seatsMax} onChange={(e) => set(i, { seatsMax: Number(e.target.value) })} aria-label={t("staff.tables.maxSeats")} />
                  </label>
                  <label>
                    <span className="tbl-cap">{t("staff.tables.mergeGroup")}</span>
                    <input value={r.mergeGroup ?? ""} onChange={(e) => set(i, { mergeGroup: e.target.value || null })} aria-label={t("staff.tables.mergeGroup")} />
                  </label>
                  <label>
                    <span className="tbl-cap">{t("staff.tables.splitInto")}</span>
                    <input
                      defaultValue={r.splitConfig?.map((p) => p.seats).join("+") ?? ""}
                      onBlur={(e) => {
                        const parts = e.target.value.split("+").map((x) => parseInt(x)).filter((x) => x > 0);
                        set(i, { splitConfig: parts.length > 1 ? parts.map((seats, n) => ({ suffix: String.fromCharCode(97 + n), seats })) : null });
                      }}
                      placeholder={t("staff.tables.splitHint")}
                      aria-label={t("staff.tables.splitInto")}
                    />
                  </label>
                  <span className="tbl-act">
                    {r.id ? (
                      <button className="btn small danger" onClick={() => run(async () => (await api(b(`tables/${r.id}/delete`), { method: "POST" }), await refresh()), t("staff.tables.removed"))} aria-label={t("staff.tables.removeTable", { label: r.label })}>
                        <Trash2 size={15} aria-hidden /> <span className="hide-sm">{t("common.remove")}</span>
                      </button>
                    ) : (
                      <span className="badge brand">{t("staff.tables.isNew")}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
