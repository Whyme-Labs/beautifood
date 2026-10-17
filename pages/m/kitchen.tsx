// Kitchen display: tickets per round, oldest first, per station; bump items through preparing → ready → served.
import { useCallback, useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useBranchChanges, useStaff } from "../../src/ui/staff";
import { Empty, Status, useAction } from "../../src/ui/components";

interface KTicket {
  orderId: string;
  number: string;
  type: string;
  tables: string[];
  round: number;
  firedAt: number | null;
  items: { id: string; name: string; qty: number; status: string; station: string; notes: string; modifiers: { option: string }[]; createdAt: number }[];
}

export default function Kitchen() {
  const s = useStaff();
  const b = useBranchApi();
  const [station, setStation] = useState("");
  const { run } = useAction();
  const { data, refresh } = usePoll(() => (s.branchId ? api<KTicket[]>(b(`kitchen${station ? `?station=${station}` : ""}`)) : Promise.resolve(null)), { interval: 15_000, deps: [s.branchId, station] });
  useBranchChanges(useCallback(() => void refresh(), [refresh]), ["order", "kitchen", "cart", "queue"]);
  const bump = (ids: string[], status: string) => run(async () => (await api(b("kitchen/status"), { body: { itemIds: ids, status } }), await refresh()));
  const next = (st: string) => (st === "pending" ? "fired" : st === "fired" ? "preparing" : st === "preparing" ? "ready" : "served");
  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Kitchen</h1>
        <div className="row">
          {["", "kitchen", "bar", "dessert"].map((x) => (
            <button key={x} className={`btn small ${station === x ? "primary" : ""}`} onClick={() => setStation(x)}>
              {x || "All stations"}
            </button>
          ))}
        </div>
      </div>
      {!data?.length && <Empty>No tickets. 🎉</Empty>}
      <div className="kds" data-testid="kds">
        {data?.map((t) => {
          const age = Math.round((Date.now() - (t.firedAt ?? t.items[0].createdAt)) / 60_000);
          const open = t.items.filter((i) => i.status !== "ready");
          return (
            <div key={`${t.orderId}:${t.round}`} className={`card ticket ${age >= 15 ? "late" : ""}`} data-testid="kds-ticket">
              <div className="row between">
                <b>{t.tables.length ? `Table ${t.tables.join("+")}` : t.type === "takeaway" ? `Takeaway #${t.number}` : `#${t.number}`}</b>
                <span className={`badge ${age >= 15 ? "bad" : ""}`}>{age}m</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Bill #{t.number} · round {t.round}
              </div>
              <div className="list">
                {t.items.map((i) => (
                  <div key={i.id} className="row between">
                    <span>
                      <b>{i.qty}×</b> {i.name}
                      {i.modifiers.length ? <div className="muted" style={{ fontSize: 12 }}>{i.modifiers.map((m) => m.option).join(", ")}</div> : null}
                      {i.notes ? <div style={{ fontSize: 12, color: "var(--warn)" }}>“{i.notes}”</div> : null}
                    </span>
                    <button className="btn small" onClick={() => bump([i.id], next(i.status))} aria-label={`${i.name}: ${next(i.status)}`}>
                      <Status s={i.status} /> →
                    </button>
                  </div>
                ))}
              </div>
              {open.length > 0 && (
                <button className="btn primary block" style={{ marginTop: 8 }} onClick={() => bump(open.map((i) => i.id), "ready")}>
                  All ready
                </button>
              )}
              {open.length === 0 && (
                <button className="btn block" style={{ marginTop: 8 }} onClick={() => bump(t.items.map((i) => i.id), "served")}>
                  Served
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
