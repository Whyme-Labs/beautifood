// Floor plan editor: tables with seats, zone, merge group and split configuration.
import { useEffect, useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { useAction } from "../../src/ui/components";

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
  const { run, pending } = useAction();
  const { data, refresh } = usePoll(() => (s.branchId ? api<T[]>(b("tables")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => setRows((data ?? []).filter((t) => !t.parentId)), [data]);
  const set = (i: number, p: Partial<T>) => setRows(rows.map((r, n) => (n === i ? { ...r, ...p } : r)));
  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Tables · {s.branch?.name}</h1>
        <div className="row">
          <a className="btn" href="/m/qr">
            Print QR codes
          </a>
          <button className="btn" onClick={() => setRows([...rows, { label: `T${rows.length + 1}`, zone: "Main", seatsMin: 1, seatsMax: 4, mergeGroup: null, splitConfig: null }])}>
            + Table
          </button>
          <button className="btn primary" disabled={pending} onClick={() => run(async () => (await api(b("tables"), { method: "PUT", body: { tables: rows.map(({ parentId: _p, ...r }) => r), replace: false } }), await refresh()), "Floor saved")}>
            Save
          </button>
        </div>
      </div>
      <p className="muted">Tables sharing a <b>merge group</b> can be pushed together for big parties. A <b>split</b> lets a large table seat two smaller parties (e.g. 10 → 6 + 4). The seating engine uses both.</p>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Zone</th>
              <th>Min</th>
              <th>Max</th>
              <th>Merge group</th>
              <th>Split into (e.g. 6+4)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? `new${i}`}>
                <td><input value={r.label} onChange={(e) => set(i, { label: e.target.value })} style={{ width: 80 }} aria-label="Label" /></td>
                <td><input value={r.zone} onChange={(e) => set(i, { zone: e.target.value })} style={{ width: 100 }} aria-label="Zone" /></td>
                <td><input type="number" min={1} value={r.seatsMin} onChange={(e) => set(i, { seatsMin: Number(e.target.value) })} style={{ width: 64 }} aria-label="Min seats" /></td>
                <td><input type="number" min={1} value={r.seatsMax} onChange={(e) => set(i, { seatsMax: Number(e.target.value) })} style={{ width: 64 }} aria-label="Max seats" /></td>
                <td><input value={r.mergeGroup ?? ""} onChange={(e) => set(i, { mergeGroup: e.target.value || null })} style={{ width: 110 }} aria-label="Merge group" /></td>
                <td>
                  <input
                    defaultValue={r.splitConfig?.map((p) => p.seats).join("+") ?? ""}
                    onBlur={(e) => {
                      const parts = e.target.value.split("+").map((x) => parseInt(x)).filter((x) => x > 0);
                      set(i, { splitConfig: parts.length > 1 ? parts.map((seats, n) => ({ suffix: String.fromCharCode(97 + n), seats })) : null });
                    }}
                    style={{ width: 90 }}
                    aria-label="Split into"
                  />
                </td>
                <td>
                  {r.id && (
                    <button className="btn small danger" onClick={() => run(async () => (await api(b(`tables/${r.id}/delete`), { method: "POST" }), await refresh()), "Removed")}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
