// Host stand: the queue with ETAs, the seating engine's suggestions (with reasons),
// a live floor map, and seat / call / merge / split / transfer / close actions.
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useBranchChanges, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Mins, Modal, Status, useAction } from "../../src/ui/components";
import type { Suggestion } from "../../src/shared/types";

interface Table {
  id: string;
  label: string;
  zone: string;
  seatsMin: number;
  seatsMax: number;
  x: number;
  y: number;
  mergeGroup: string | null;
  splitConfig: { suffix: string; seats: number }[] | null;
  parentId: string | null;
  status: string;
  seatingId: string | null;
}
interface Ticket {
  id: string;
  number: string;
  category: string;
  partySize: number;
  name: string;
  status: string;
  createdAt: number;
  skips: number;
  priority: number;
  preferences: string[];
  source: string;
  heldTableIds: string[];
  sessionId: string | null;
  etaMinutes: number | null;
  position: number;
}
interface Seating {
  id: string;
  tableIds: string[];
  partySize: number;
  ticketId: string | null;
  orderId: string | null;
  startedAt: number;
}
interface Board {
  tickets: Ticket[];
  suggestions: Suggestion[];
  tables: Table[];
  seatings: Seating[];
  strategy: string;
  staffCalls: { reason: string; sessionId: string; at: number }[];
}

const ago = (t: number) => Math.max(0, Math.round((Date.now() - t) / 60_000));

export default function Host() {
  const s = useStaff();
  const b = useBranchApi();
  const { run, pending } = useAction();
  const { data, error, refresh } = usePoll(() => (s.branchId ? api<Board>(b("board")) : Promise.resolve(null)), { interval: 20_000, maxInterval: 20_000, deps: [s.branchId] });
  useBranchChanges(useCallback(() => void refresh(), [refresh]));
  const [selected, setSelected] = useState<string[]>([]);
  const [seatFor, setSeatFor] = useState<Ticket | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [addTicket, setAddTicket] = useState(false);
  const [qr, setQr] = useState<{ url: string; img: string; label: string } | null>(null);
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);

  const tableById = useMemo(() => new Map((data?.tables ?? []).map((t) => [t.id, t])), [data]);
  const seatingOf = (t: Table) => data?.seatings.find((x) => x.id === t.seatingId) ?? null;
  const labels = (ids: string[]) => ids.map((id) => tableById.get(id)?.label ?? id).join(" + ");
  const sessionTables = (sid: string) => {
    const st = data?.seatings.find((x) => (x as Seating & { sessionId?: string }).sessionId === sid);
    return st ? labels(st.tableIds) : "a table";
  };
  const selTables = selected.map((id) => tableById.get(id)).filter(Boolean) as Table[];
  const oneSeated = selTables.length === 1 && selTables[0].status === "seated" ? seatingOf(selTables[0]) : null;

  useEffect(() => setSelected([]), [s.branchId]);

  const act = (path: string, body: unknown, ok?: string) => run(async () => (await api(b(path), { body }), setSelected([]), await refresh()), ok);
  const showQr = (seatingId: string, label: string) =>
    run(async () => {
      const r = await api<{ url: string }>(b(`seatings/${seatingId}/link`), { method: "POST" });
      const url = location.origin + r.url;
      setQr({ url, label, img: await QRCode.toDataURL(url, { margin: 1, width: 260 }) });
    });

  if (!s.can("queue.operate")) return <Empty>You don't have access to the host stand.</Empty>;
  const waiting = data?.tickets.filter((t) => t.status === "waiting") ?? [];
  const called = data?.tickets.filter((t) => t.status === "called") ?? [];
  const maxX = Math.max(600, ...(data?.tables ?? []).map((t) => t.x + 110));
  const maxY = Math.max(360, ...(data?.tables ?? []).map((t) => t.y + 90));

  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Host stand · {s.branch?.name}</h1>
        <div className="row">
          <span className="badge">strategy: {data?.strategy}</span>
          <button className="btn" onClick={() => setAddTicket(true)}>
            + Add to queue
          </button>
          <button className="btn primary" onClick={() => setWalkIn(true)} disabled={!selTables.length || selTables.some((t) => t.status !== "free")}>
            Seat walk-in{selTables.length ? ` at ${selTables.map((t) => t.label).join("+")}` : ""}
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {data?.staffCalls.length ? (
        <div className="card flat" style={{ borderColor: "var(--warn)" }} data-testid="staff-calls">
          🔔 {data.staffCalls.slice(0, 5).map((c, i) => <span key={i} style={{ marginRight: 12 }}>{sessionTables(c.sessionId)} — {c.reason} ({ago(c.at)}m)</span>)}
        </div>
      ) : null}
      <div className="split side">
        <section className="col">
          <div className="card">
            <h2>Suggested seatings</h2>
            {!data?.suggestions.length && <div className="muted">No seating possible right now.</div>}
            <div className="list" data-testid="suggestions">
              {data?.suggestions.map((sg) => {
                const t = data.tickets.find((x) => x.id === sg.ticketId);
                return (
                  <div key={sg.ticketId} className="row between" data-testid="suggestion">
                    <div>
                      <b>{sg.ticketNumber}</b> ({sg.partySize}) → <b>{sg.tableLabels.join(" + ")}</b> {sg.action !== "seat" && <span className="badge info">{sg.action === "merge_seat" ? "merge" : "split"}</span>}
                      <div className="muted" style={{ fontSize: 12 }}>{sg.reasons.join(" · ")}</div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {t?.status === "waiting" && (
                        <button className="btn small" disabled={pending} onClick={() => act(`tickets/${sg.ticketId}/call`, { holdTableIds: sg.action === "split_seat" ? [] : sg.tableIds }, `Called ${sg.ticketNumber}`)}>
                          Call
                        </button>
                      )}
                      <button className="btn small primary" disabled={pending} onClick={() => act(`tickets/${sg.ticketId}/seat`, { tableIds: sg.tableIds, split: sg.split ?? null }, `Seated ${sg.ticketNumber}`)}>
                        Seat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <h2>
              Queue <span className="muted">({waiting.length} waiting, {called.length} called)</span>
            </h2>
            <div className="list" data-testid="queue">
              {[...called, ...waiting].map((t) => (
                <div key={t.id} className="row between" data-testid="ticket-row">
                  <div>
                    <b>{t.number}</b> · {t.name} · {t.partySize} pax <Status s={t.status} />
                    {t.priority > 0 && <span className="badge brand">priority</span>}
                    {t.sessionId && <span className="badge info">preordered</span>}
                    <div className="muted" style={{ fontSize: 12 }}>
                      waited {ago(t.createdAt)}m · ETA <Mins v={t.etaMinutes} />
                      {t.skips ? ` · skipped ${t.skips}×` : ""}
                      {t.heldTableIds.length ? ` · holding ${labels(t.heldTableIds)}` : ""}
                      {t.preferences.length ? ` · ${t.preferences.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {t.status === "waiting" && (
                      <button className="btn small" onClick={() => act(`tickets/${t.id}/call`, {}, `Called ${t.number}`)}>
                        Call
                      </button>
                    )}
                    <button className="btn small primary" onClick={() => setSeatFor(t)}>
                      Seat…
                    </button>
                    {t.status === "called" ? (
                      <>
                        <button className="btn small" onClick={() => act(`tickets/${t.id}/requeue`, {})}>
                          Re-queue
                        </button>
                        <button className="btn small danger" onClick={() => act(`tickets/${t.id}/no_show`, {})}>
                          No-show
                        </button>
                      </>
                    ) : (
                      <button className="btn small danger" onClick={() => act(`tickets/${t.id}/cancel`, {})} aria-label={`Cancel ${t.number}`}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!waiting.length && !called.length && <div className="muted">Nobody waiting.</div>}
            </div>
          </div>
        </section>

        <section className="col">
          <div className="card">
            <div className="row between">
              <h2 style={{ margin: 0 }}>Floor</h2>
              <span className="muted" style={{ fontSize: 12 }}>Tap tables to select</span>
            </div>
            <div className="floor" style={{ height: Math.min(560, maxY + 20), marginTop: 10 }} data-testid="floor">
              <div style={{ position: "relative", width: maxX, height: maxY }}>
                {data?.tables
                  .filter((t) => t.status !== "split" || true)
                  .map((t) => {
                    const st = seatingOf(t);
                    const pos = t.parentId ? { x: (tableById.get(t.parentId)?.x ?? t.x) + (t.label.endsWith("b") ? 50 : 0), y: (tableById.get(t.parentId)?.y ?? t.y) + 40 } : { x: t.x, y: t.y };
                    if (t.status === "split") return null;
                    return (
                      <div
                        key={t.id}
                        className={`tbl ${t.status} ${selected.includes(t.id) ? "selected" : ""}`}
                        style={{ left: pos.x, top: pos.y, width: t.parentId ? 70 : 96 }}
                        onClick={() => setSelected(selected.includes(t.id) ? selected.filter((x) => x !== t.id) : [...selected, t.id])}
                        data-testid={`table-${t.label}`}
                        title={`${t.label} · ${t.seatsMin}-${t.seatsMax} seats · ${t.status}`}
                      >
                        {t.label}
                        <small>{st ? `${st.partySize}p · ${ago(st.startedAt)}m` : `${t.seatsMax} seats`}</small>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {selTables.length > 0 && (
            <div className="card col" data-testid="table-panel">
              <h3>Selected: {selTables.map((t) => `${t.label} (${t.status})`).join(", ")}</h3>
              {oneSeated && (
                <div className="col">
                  <div className="muted">
                    Party of {oneSeated.partySize} · seated {ago(oneSeated.startedAt)} min ago at {labels(oneSeated.tableIds)}
                  </div>
                  <div className="row">
                    <button className="btn small" onClick={() => showQr(oneSeated.id, labels(oneSeated.tableIds))}>
                      Show ordering QR
                    </button>
                    <a className="btn small" href={`/m/pos?seating=${oneSeated.id}`}>
                      Open bill
                    </a>
                    <button className="btn small" onClick={() => setMergeFrom(oneSeated.id)}>
                      Merge with another table…
                    </button>
                    <button className="btn small primary" onClick={() => act(`seatings/${oneSeated.id}/close`, {}, "Table closed")}>
                      Close (paid)
                    </button>
                  </div>
                </div>
              )}
              {selTables.length > 1 && selTables.filter((t) => t.status === "seated").length === 1 && (
                <button
                  className="btn small"
                  onClick={() => {
                    const seated = selTables.find((t) => t.status === "seated")!;
                    act(`seatings/${seated.seatingId}/add_tables`, { tableIds: selTables.filter((t) => t.status === "free").map((t) => t.id) }, "Tables pushed together");
                  }}
                >
                  Push free tables onto {selTables.find((t) => t.status === "seated")!.label}
                </button>
              )}
              {selTables.length >= 2 && selTables[0].status === "seated" && selTables.slice(1).every((t) => t.status === "free") && (
                <button className="btn small" onClick={() => act(`seatings/${selTables[0].seatingId}/transfer`, { tableIds: selTables.slice(1).map((t) => t.id) }, "Party moved")}>
                  Move party from {selTables[0].label} to {selTables.slice(1).map((t) => t.label).join("+")}
                </button>
              )}
              {selTables.length === 1 && (
                <div className="row">
                  {selTables[0].status === "dirty" && (
                    <button className="btn small primary" onClick={() => act(`tables/${selTables[0].id}/clean`, {}, "Table ready")}>
                      Mark clean
                    </button>
                  )}
                  {selTables[0].status === "free" && selTables[0].splitConfig && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].id}/split`, {}, `${selTables[0].label} split`)}>
                      Split into {selTables[0].splitConfig.map((p) => p.seats).join(" + ")}
                    </button>
                  )}
                  {selTables[0].parentId && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].parentId}/unsplit`, {}, "Joined back")}>
                      Join {tableById.get(selTables[0].parentId)?.label} back
                    </button>
                  )}
                  {selTables[0].status === "free" && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].id}/block`, {})}>
                      Block
                    </button>
                  )}
                  {selTables[0].status === "blocked" && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].id}/unblock`, {})}>
                      Unblock
                    </button>
                  )}
                </div>
              )}
              <button className="btn ghost small" onClick={() => setSelected([])}>
                Clear selection
              </button>
            </div>
          )}
        </section>
      </div>

      <SeatModal ticket={seatFor} tables={data?.tables ?? []} suggestion={data?.suggestions.find((x) => x.ticketId === seatFor?.id) ?? null} onClose={() => setSeatFor(null)} onSeat={(tableIds) => seatFor && act(`tickets/${seatFor.id}/seat`, { tableIds }, `Seated ${seatFor.number}`).then(() => setSeatFor(null))} />
      <WalkInModal open={walkIn} tables={selTables} onClose={() => setWalkIn(false)} onSeat={(partySize) => act("seat", { partySize, tableIds: selTables.map((t) => t.id) }, "Seated").then(() => setWalkIn(false))} />
      <AddTicketModal open={addTicket} onClose={() => setAddTicket(false)} onAdd={(body) => act("tickets", body, "Added to queue").then(() => setAddTicket(false))} />
      <Modal open={!!mergeFrom} onClose={() => setMergeFrom(null)} title="Merge with which table?">
        <div className="col">
          <p className="muted">The other table's party and bill join this one.</p>
          {data?.seatings
            .filter((x) => x.id !== mergeFrom)
            .map((x) => (
              <button key={x.id} className="btn" onClick={() => act(`seatings/${mergeFrom}/merge`, { fromSeatingId: x.id }, "Tables merged").then(() => setMergeFrom(null))}>
                {labels(x.tableIds)} · party of {x.partySize}
              </button>
            ))}
        </div>
      </Modal>
      <Modal open={!!qr} onClose={() => setQr(null)} title={`Order from ${qr?.label}`}>
        {qr && (
          <div className="col" style={{ alignItems: "center", textAlign: "center" }}>
            <img src={qr.img} alt="Table ordering QR code" width={260} height={260} />
            <p className="muted">Guests scan this to order together. It stops working when the table closes.</p>
            <a href={qr.url} target="_blank" rel="noreferrer" data-testid="qr-link">
              Open link
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SeatModal({ ticket, tables, suggestion, onClose, onSeat }: { ticket: Ticket | null; tables: Table[]; suggestion: Suggestion | null; onClose: () => void; onSeat: (tableIds: string[]) => void }) {
  const [pick, setPick] = useState<string[]>([]);
  useEffect(() => setPick(suggestion && suggestion.action !== "split_seat" ? suggestion.tableIds : []), [ticket?.id, suggestion]);
  if (!ticket) return null;
  const free = tables.filter((t) => t.status === "free" || (t.status === "reserved" && ticket.heldTableIds.includes(t.id)));
  const seats = free.filter((t) => pick.includes(t.id)).reduce((s, t) => s + t.seatsMax, 0);
  return (
    <Modal open onClose={onClose} title={`Seat ${ticket.number} · ${ticket.partySize} pax`}>
      <div className="col">
        {suggestion && <div className="muted">Suggested: {suggestion.tableLabels.join(" + ")} ({suggestion.reasons.join(", ")})</div>}
        <div className="row">
          {free.map((t) => (
            <button key={t.id} className={`btn small ${pick.includes(t.id) ? "primary" : ""}`} onClick={() => setPick(pick.includes(t.id) ? pick.filter((x) => x !== t.id) : [...pick, t.id])}>
              {t.label} ({t.seatsMax})
            </button>
          ))}
        </div>
        <div className="muted">{seats} seats selected</div>
        <button className="btn primary" disabled={!pick.length} onClick={() => onSeat(pick)}>
          Seat here
        </button>
      </div>
    </Modal>
  );
}

function WalkInModal({ open, tables, onClose, onSeat }: { open: boolean; tables: Table[]; onClose: () => void; onSeat: (n: number) => void }) {
  const [n, setN] = useState(2);
  return (
    <Modal open={open} onClose={onClose} title={`Seat walk-in at ${tables.map((t) => t.label).join(" + ")}`}>
      <div className="col">
        <label>
          Party size
          <input type="number" min={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <button className="btn primary" onClick={() => onSeat(n)}>
          Seat
        </button>
      </div>
    </Modal>
  );
}

function AddTicketModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (b: unknown) => void }) {
  const [f, setF] = useState({ name: "", partySize: 2, priority: 0 });
  return (
    <Modal open={open} onClose={onClose} title="Add to queue">
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(f);
        }}
      >
        <label>
          Name
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </label>
        <label>
          Party size
          <input type="number" min={1} value={f.partySize} onChange={(e) => setF({ ...f, partySize: Number(e.target.value) })} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={f.priority > 0} onChange={(e) => setF({ ...f, priority: e.target.checked ? 1 : 0 })} /> Priority (elderly, accessibility, VIP)
        </label>
        <button className="btn primary">Add</button>
      </form>
    </Modal>
  );
}
