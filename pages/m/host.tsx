// Host stand: the queue with ETAs, the seating engine's suggestions (with reasons),
// a live floor map, and seat / call / merge / split / transfer / close actions.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowRight, BellRing, Megaphone, Plus, Star, UserPlus, UtensilsCrossed, X } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useBranchChanges, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Modal, Stat, Status, stockOf, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey, Vars } from "../../src/i18n/core";
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
const STOCK = /^[A-D]$/;
const LEGEND = ["free", "seated", "reserved", "dirty", "blocked"] as const;

type T = (key: MessageKey, vars?: Vars) => string;

/** The seating engine explains itself in English; map its phrases onto the catalog. */
const REASONS: [RegExp, (m: RegExpMatchArray, t: T) => string][] = [
  [/^waiting (\d+) min$/, (m, t) => t("staff.host.reasons.waiting", { count: +m[1] })],
  [/^perfect fit$/, (_, t) => t("staff.host.reasons.perfectFit")],
  [/^(\d+) empty seats?$/, (m, t) => t("staff.host.reasons.emptySeats", { count: +m[1] })],
  [/^merges (.+)$/, (m, t) => t("staff.host.reasons.merges", { tables: m[1] })],
  [/^splits table to free the other half$/, (_, t) => t("staff.host.reasons.splits")],
  [/^priority guest$/, (_, t) => t("staff.host.reasons.priority")],
  [/^skipped (\d+)×$/, (m, t) => t("staff.host.reasons.skipped", { count: +m[1] })],
  [/^booking on this table in (\d+) min$/, (m, t) => t("staff.host.reasons.booking", { count: +m[1] })],
  [/^strict first-come-first-served$/, (_, t) => t("staff.host.reasons.fifo")],
  [/^first in line for (.+)$/, (m, t) => t("staff.host.reasons.firstInClass", { category: m[1] })],
  [/^fairness: skipped (\d+)× already$/, (m, t) => t("staff.host.reasons.fairness", { count: +m[1] })],
];
const reasonText = (r: string, t: T) => {
  for (const [re, fn] of REASONS) {
    const m = r.match(re);
    if (m) return fn(m, t);
  }
  return r;
};

/** FLIP: rows that change place slide from where they were (220ms, transform only). */
function useFlip(order: string) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    nodes.current.forEach((el, id) => {
      const top = el.offsetTop;
      next.set(id, top);
      const before = tops.current.get(id);
      if (reduce || before === undefined || !el.animate) return;
      const dy = before - top;
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    });
    tops.current = next;
  }, [order]);
  return useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(id, el);
      else nodes.current.delete(id);
    },
    [],
  );
}

export default function Host() {
  const { t, mins } = useI18n();
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

  const tableById = useMemo(() => new Map((data?.tables ?? []).map((x) => [x.id, x])), [data]);
  const seatingOf = (x: Table) => data?.seatings.find((st) => st.id === x.seatingId) ?? null;
  const labels = (ids: string[]) => ids.map((id) => tableById.get(id)?.label ?? id).join(" + ");
  const sessionTables = (sid: string) => {
    const st = data?.seatings.find((x) => (x as Seating & { sessionId?: string }).sessionId === sid);
    return st ? labels(st.tableIds) : t("staff.host.aTable");
  };
  const selTables = selected.map((id) => tableById.get(id)).filter(Boolean) as Table[];
  const oneSeated = selTables.length === 1 && selTables[0].status === "seated" ? seatingOf(selTables[0]) : null;
  const statusName = (st: string) => t(`status.${st}` as MessageKey);

  useEffect(() => setSelected([]), [s.branchId]);

  const waiting = data?.tickets.filter((x) => x.status === "waiting") ?? [];
  const called = data?.tickets.filter((x) => x.status === "called") ?? [];
  const rows = [...called, ...waiting];
  const flip = useFlip(rows.map((x) => x.id).join(","));

  const floor = useMemo(() => {
    const all = data?.tables ?? [];
    const byId = new Map(all.map((x) => [x.id, x]));
    const pos = (x: Table) => {
      const p = x.parentId ? byId.get(x.parentId) : null;
      return p ? { y: p.y, x: p.x + 0.5 + (x.label.endsWith("b") ? 0.1 : 0) } : { y: x.y, x: x.x };
    };
    const zones = new Map<string, Table[]>();
    for (const x of all.filter((x) => x.status !== "split")) {
      const z = (x.parentId ? byId.get(x.parentId)?.zone : null) ?? x.zone ?? "";
      zones.set(z, [...(zones.get(z) ?? []), x]);
    }
    for (const list of zones.values()) list.sort((a, c) => pos(a).y - pos(c).y || pos(a).x - pos(c).x || a.label.localeCompare(c.label, undefined, { numeric: true }));
    return [...zones.entries()];
  }, [data]);

  const act = (path: string, body: unknown, ok?: string) => run(async () => (await api(b(path), { body }), setSelected([]), await refresh()), ok);
  const showQr = (seatingId: string, label: string) =>
    run(async () => {
      const r = await api<{ url: string }>(b(`seatings/${seatingId}/link`), { method: "POST" });
      const url = location.origin + r.url;
      setQr({ url, label, img: await QRCode.toDataURL(url, { margin: 1, width: 260 }) });
    });
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (!s.can("queue.operate")) return <Empty>{t("staff.host.noAccess")}</Empty>;
  const strategyKey = `staff.host.strategies.${data?.strategy}` as MessageKey;
  const strategyName = t(strategyKey) === strategyKey ? (data?.strategy ?? "") : t(strategyKey);
  const seatedTables = data?.tables.filter((x) => x.status === "seated").length ?? 0;
  const freeTables = data?.tables.filter((x) => x.status === "free").length ?? 0;
  const walkInOk = selTables.length > 0 && selTables.every((x) => x.status === "free");
  const seatedInSel = selTables.filter((x) => x.status === "seated");

  return (
    <div className="col host">
      <div className="page-head">
        <div>
          <h1>{t("staff.host.title")}</h1>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {s.branch?.name && <span className="muted">{s.branch.name}</span>}
            {data?.strategy && <span className="badge">{t("staff.host.strategy", { name: strategyName })}</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setAddTicket(true)}>
            <Plus size={17} aria-hidden /> {t("staff.host.addToQueue")}
          </button>
          <button className="btn primary" onClick={() => setWalkIn(true)} disabled={!walkInOk}>
            <UserPlus size={17} aria-hidden />
            {selTables.length ? t("staff.host.seatWalkInAt", { tables: selTables.map((x) => x.label).join("+") }) : t("staff.host.seatWalkIn")}
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {data?.staffCalls.length ? (
        <div className="alert sun host-calls" role="status" data-testid="staff-calls">
          <BellRing size={18} aria-hidden />
          <div>
            <b>{t("staff.host.calls.title")}</b>
            <ul>
              {data.staffCalls.slice(0, 5).map((c, i) => {
                const rk = `staff.host.calls.reasons.${c.reason}` as MessageKey;
                return (
                  <li key={i}>
                    {t("staff.host.calls.item", { table: sessionTables(c.sessionId), reason: t(rk) === rk ? c.reason : t(rk), ago: t("staff.host.minsAgo", { count: ago(c.at) }) })}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
      {data && (
        <div className="card flat stats" style={{ padding: 0 }}>
          <Stat label={t("staff.host.stats.waiting")} value={waiting.length} />
          <Stat label={t("staff.host.stats.called")} value={called.length} />
          <Stat label={t("staff.host.stats.free")} value={freeTables} />
          <Stat label={t("staff.host.stats.seated")} value={seatedTables} />
        </div>
      )}
      <div className="split side">
        <section className="col">
          <div className="card">
            <div className="section-title">
              <h2>{t("staff.host.suggestions.title")}</h2>
            </div>
            {data && !data.suggestions.length && <div className="muted">{t("staff.host.suggestions.none")}</div>}
            <div className="list gap" data-testid="suggestions">
              {data?.suggestions.map((sg) => {
                const tk = data.tickets.find((x) => x.id === sg.ticketId);
                const stock = stockOf(sg.ticketNumber);
                return (
                  <div key={sg.ticketId} className="rowstub host-sg" data-stock={STOCK.test(stock) ? stock : "X"} data-testid="suggestion">
                    <div className="rs-num">
                      <span className="serial">{sg.ticketNumber}</span>
                      <small>{t("staff.host.suggestions.party", { count: sg.partySize })}</small>
                    </div>
                    <div className="rs-body">
                      <div className="row nowrap host-sg-to">
                        <ArrowRight size={18} aria-hidden />
                        <span className="sr-only">{t("staff.host.suggestions.to")}</span>
                        <span className="serial">{sg.tableLabels.join(" + ")}</span>
                        {sg.action !== "seat" && <span className="badge info">{sg.action === "merge_seat" ? t("staff.host.suggestions.merge") : t("staff.host.suggestions.split")}</span>}
                      </div>
                      <div className="host-reasons">
                        {sg.reasons.map((r, i) => (
                          <span key={i}>{reasonText(r, t)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rs-actions">
                      {tk?.status === "waiting" && (
                        <button className="btn small" disabled={pending} onClick={() => act(`tickets/${sg.ticketId}/call`, { holdTableIds: sg.action === "split_seat" ? [] : sg.tableIds }, t("staff.host.toasts.called", { number: sg.ticketNumber }))}>
                          <Megaphone size={15} aria-hidden /> {t("staff.host.call")}
                        </button>
                      )}
                      <button className="btn small primary" disabled={pending} onClick={() => act(`tickets/${sg.ticketId}/seat`, { tableIds: sg.tableIds, split: sg.split ?? null }, t("staff.host.toasts.seated", { number: sg.ticketNumber }))}>
                        {t("staff.host.seat")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="section-title">
              <h2>{t("staff.host.queue.title")}</h2>
              <span className="muted">{t("staff.host.queue.counts", { waiting: waiting.length, called: called.length })}</span>
            </div>
            <div className="list gap host-queue" data-testid="queue">
              {rows.map((tk) => {
                const stock = stockOf(tk.number);
                const meta = [
                  t("staff.host.queue.waited", { count: ago(tk.createdAt) }),
                  tk.skips ? t("staff.host.queue.skipped", { count: tk.skips }) : "",
                  tk.heldTableIds.length ? t("staff.host.queue.holding", { tables: labels(tk.heldTableIds) }) : "",
                  tk.preferences.join(", "),
                ].filter(Boolean);
                return (
                  <div key={tk.id} ref={flip(tk.id)} className={`rowstub ${tk.status === "called" ? "lit" : ""}`} data-stock={STOCK.test(stock) ? stock : "X"} data-testid="ticket-row">
                    <div className="rs-num">
                      <span className="serial">{tk.number}</span>
                    </div>
                    <div className="rs-body">
                      <div className="row" style={{ gap: 6 }}>
                        <b className="host-name">{tk.name}</b>
                        <span className="muted">{t("staff.host.queue.party", { count: tk.partySize })}</span>
                        <Status s={tk.status} />
                        {tk.priority > 0 && (
                          <span className="badge brand">
                            <Star aria-hidden /> {t("staff.host.queue.priority")}
                          </span>
                        )}
                        {tk.sessionId && (
                          <span className="badge info">
                            <UtensilsCrossed aria-hidden /> {t("staff.host.queue.preordered")}
                          </span>
                        )}
                      </div>
                      <div className="muted host-meta">
                        <b>{t("staff.host.queue.eta", { eta: mins(tk.etaMinutes) })}</b> · {meta.join(" · ")}
                      </div>
                    </div>
                    <div className="rs-actions">
                      {tk.status === "waiting" && (
                        <button className="btn small" onClick={() => act(`tickets/${tk.id}/call`, {}, t("staff.host.toasts.called", { number: tk.number }))}>
                          <Megaphone size={15} aria-hidden /> {t("staff.host.call")}
                        </button>
                      )}
                      <button className="btn small primary" onClick={() => setSeatFor(tk)}>
                        {t("staff.host.seatMore")}
                      </button>
                      {tk.status === "called" ? (
                        <>
                          <button className="btn small" onClick={() => act(`tickets/${tk.id}/requeue`, {})}>
                            {t("staff.host.requeue")}
                          </button>
                          <button className="btn small danger" onClick={() => act(`tickets/${tk.id}/no_show`, {})}>
                            {t("staff.host.noShow")}
                          </button>
                        </>
                      ) : (
                        <button className="btn small icon danger" onClick={() => act(`tickets/${tk.id}/cancel`, {})} aria-label={t("staff.host.cancelTicket", { number: tk.number })} title={t("staff.host.cancelTicket", { number: tk.number })}>
                          <X size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {data && !rows.length && <Empty>{t("staff.host.queue.empty")}</Empty>}
          </div>
        </section>

        <section className="col">
          <div className="card">
            <div className="section-title">
              <h2>{t("staff.host.floor.title")}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("staff.host.floor.hint")}
              </span>
            </div>
            <div className="legend" style={{ marginBottom: 12 }}>
              {LEGEND.map((st) => (
                <span key={st}>
                  <i className={`lg-${st}`} />
                  {statusName(st)}
                </span>
              ))}
            </div>
            {data && !floor.length && <Empty>{t("staff.host.floor.empty")}</Empty>}
            <div className="col" data-testid="floor">
              {floor.map(([zone, list]) => (
                <div key={zone} className="col tight">
                  {floor.length > 1 && zone && <h3 className="host-zone">{zone}</h3>}
                  <div className="floor">
                    {list.map((x) => {
                      const st = seatingOf(x);
                      const sel = selected.includes(x.id);
                      return (
                        <button
                          key={x.id}
                          type="button"
                          className={`tbl ${x.status} ${sel ? "selected" : ""}`}
                          aria-pressed={sel}
                          onClick={() => toggle(x.id)}
                          data-testid={`table-${x.label}`}
                          title={t("staff.host.floor.tileLabel", { label: x.label, min: x.seatsMin, max: x.seatsMax, status: statusName(x.status) })}
                        >
                          <b>{x.label}</b>
                          <small>{st ? t("staff.host.floor.occupied", { count: st.partySize, mins: ago(st.startedAt) }) : t("staff.host.floor.seats", { count: x.seatsMax })}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selTables.length > 0 && (
            <div className="card col" data-testid="table-panel">
              <h3 className="row" style={{ gap: 6, margin: 0 }}>
                {t("staff.host.panel.selected")}
                {selTables.map((x) => (
                  <span key={x.id} className="row" style={{ gap: 4 }}>
                    <span className="serial sm">{x.label}</span>
                    <Status s={x.status} />
                  </span>
                ))}
              </h3>
              {oneSeated && (
                <div className="col">
                  <div className="muted">{t("staff.host.panel.partyInfo", { count: oneSeated.partySize, mins: ago(oneSeated.startedAt), tables: labels(oneSeated.tableIds) })}</div>
                  <div className="row">
                    <button className="btn small" onClick={() => showQr(oneSeated.id, labels(oneSeated.tableIds))}>
                      {t("staff.host.panel.showQr")}
                    </button>
                    <a className="btn small" href={`/m/pos?seating=${oneSeated.id}`}>
                      {t("staff.host.panel.openBill")}
                    </a>
                    <button className="btn small" onClick={() => setMergeFrom(oneSeated.id)}>
                      {t("staff.host.panel.mergeWith")}
                    </button>
                    <button className="btn small primary" onClick={() => act(`seatings/${oneSeated.id}/close`, {}, t("staff.host.toasts.closed"))}>
                      {t("staff.host.panel.closePaid")}
                    </button>
                  </div>
                </div>
              )}
              {selTables.length > 1 && seatedInSel.length === 1 && (
                <button className="btn small" onClick={() => act(`seatings/${seatedInSel[0].seatingId}/add_tables`, { tableIds: selTables.filter((x) => x.status === "free").map((x) => x.id) }, t("staff.host.toasts.pushed"))}>
                  {t("staff.host.panel.pushOnto", { label: seatedInSel[0].label })}
                </button>
              )}
              {selTables.length >= 2 && selTables[0].status === "seated" && selTables.slice(1).every((x) => x.status === "free") && (
                <button className="btn small" onClick={() => act(`seatings/${selTables[0].seatingId}/transfer`, { tableIds: selTables.slice(1).map((x) => x.id) }, t("staff.host.toasts.moved"))}>
                  {t("staff.host.panel.moveParty", { from: selTables[0].label, to: selTables.slice(1).map((x) => x.label).join("+") })}
                </button>
              )}
              {selTables.length === 1 && (
                <div className="row">
                  {selTables[0].status === "dirty" && (
                    <button className="btn small primary" onClick={() => act(`tables/${selTables[0].id}/clean`, {}, t("staff.host.toasts.clean"))}>
                      {t("staff.host.panel.markClean")}
                    </button>
                  )}
                  {selTables[0].status === "free" && selTables[0].splitConfig && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].id}/split`, {}, t("staff.host.toasts.split", { label: selTables[0].label }))}>
                      {t("staff.host.panel.splitInto", { parts: selTables[0].splitConfig.map((p) => p.seats).join(" + ") })}
                    </button>
                  )}
                  {selTables[0].parentId && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].parentId}/unsplit`, {}, t("staff.host.toasts.joined"))}>
                      {t("staff.host.panel.joinBack", { label: tableById.get(selTables[0].parentId)?.label ?? "" })}
                    </button>
                  )}
                  {selTables[0].status === "free" && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].id}/block`, {})}>
                      {t("staff.host.panel.block")}
                    </button>
                  )}
                  {selTables[0].status === "blocked" && (
                    <button className="btn small" onClick={() => act(`tables/${selTables[0].id}/unblock`, {})}>
                      {t("staff.host.panel.unblock")}
                    </button>
                  )}
                </div>
              )}
              <button className="btn ghost small" onClick={() => setSelected([])}>
                {t("staff.host.panel.clear")}
              </button>
            </div>
          )}
        </section>
      </div>

      <SeatModal ticket={seatFor} tables={data?.tables ?? []} suggestion={data?.suggestions.find((x) => x.ticketId === seatFor?.id) ?? null} onClose={() => setSeatFor(null)} onSeat={(tableIds) => seatFor && act(`tickets/${seatFor.id}/seat`, { tableIds }, t("staff.host.toasts.seated", { number: seatFor.number })).then(() => setSeatFor(null))} />
      <WalkInModal open={walkIn} tables={selTables} onClose={() => setWalkIn(false)} onSeat={(partySize) => act("seat", { partySize, tableIds: selTables.map((x) => x.id) }, t("staff.host.toasts.seatedWalkIn")).then(() => setWalkIn(false))} />
      <AddTicketModal open={addTicket} onClose={() => setAddTicket(false)} onAdd={(body) => act("tickets", body, t("staff.host.toasts.added")).then(() => setAddTicket(false))} />
      <Modal open={!!mergeFrom} onClose={() => setMergeFrom(null)} title={t("staff.host.merge.title")}>
        <div className="col">
          <p className="muted">{t("staff.host.merge.help")}</p>
          {data?.seatings
            .filter((x) => x.id !== mergeFrom)
            .map((x) => (
              <button key={x.id} className="btn" onClick={() => act(`seatings/${mergeFrom}/merge`, { fromSeatingId: x.id }, t("staff.host.toasts.merged")).then(() => setMergeFrom(null))}>
                {t("staff.host.merge.option", { tables: labels(x.tableIds), count: x.partySize })}
              </button>
            ))}
          {data && !data.seatings.some((x) => x.id !== mergeFrom) && <div className="muted">{t("staff.host.merge.none")}</div>}
        </div>
      </Modal>
      <Modal open={!!qr} onClose={() => setQr(null)} title={t("staff.host.qr.title", { label: qr?.label ?? "" })}>
        {qr && (
          <div className="col" style={{ alignItems: "center", textAlign: "center" }}>
            <img src={qr.img} alt={t("staff.host.qr.alt")} width={260} height={260} />
            <p className="muted">{t("staff.host.qr.help")}</p>
            <a href={qr.url} target="_blank" rel="noreferrer" data-testid="qr-link">
              {t("staff.host.qr.open")}
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SeatModal({ ticket, tables, suggestion, onClose, onSeat }: { ticket: Ticket | null; tables: Table[]; suggestion: Suggestion | null; onClose: () => void; onSeat: (tableIds: string[]) => void }) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]);
  useEffect(() => setPick(suggestion && suggestion.action !== "split_seat" ? suggestion.tableIds : []), [ticket?.id, suggestion]);
  if (!ticket) return null;
  const free = tables.filter((x) => x.status === "free" || (x.status === "reserved" && ticket.heldTableIds.includes(x.id)));
  const seats = free.filter((x) => pick.includes(x.id)).reduce((n, x) => n + x.seatsMax, 0);
  return (
    <Modal open onClose={onClose} title={t("staff.host.seatModal.title", { number: ticket.number, count: ticket.partySize })}>
      <div className="col">
        {suggestion && (
          <div className="alert sun">
            <ArrowRight size={18} aria-hidden />
            <div>
              <b>{t("staff.host.seatModal.suggested", { tables: suggestion.tableLabels.join(" + ") })}</b>
              <div className="host-reasons">
                {suggestion.reasons.map((r, i) => (
                  <span key={i}>{reasonText(r, t)}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        {free.length ? (
          <div className="floor">
            {free.map((x) => (
              <button key={x.id} type="button" className={`tbl ${x.status} ${pick.includes(x.id) ? "selected" : ""}`} aria-pressed={pick.includes(x.id)} onClick={() => setPick(pick.includes(x.id) ? pick.filter((p) => p !== x.id) : [...pick, x.id])}>
                <b>{x.label}</b>
                <small>{t("staff.host.floor.seats", { count: x.seatsMax })}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="muted">{t("staff.host.seatModal.noFree")}</div>
        )}
        <div className="muted">{t("staff.host.seatModal.selectedSeats", { count: seats })}</div>
        <button className="btn primary big block" disabled={!pick.length} onClick={() => onSeat(pick)}>
          {t("staff.host.seatModal.seatHere")}
        </button>
      </div>
    </Modal>
  );
}

function WalkInModal({ open, tables, onClose, onSeat }: { open: boolean; tables: Table[]; onClose: () => void; onSeat: (n: number) => void }) {
  const { t } = useI18n();
  const [n, setN] = useState(2);
  return (
    <Modal open={open} onClose={onClose} title={t("staff.host.walkIn.title", { tables: tables.map((x) => x.label).join(" + ") })}>
      <div className="col">
        <label>
          {t("staff.host.partySize")}
          <input type="number" min={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <button className="btn primary big block" onClick={() => onSeat(n)}>
          {t("staff.host.seat")}
        </button>
      </div>
    </Modal>
  );
}

function AddTicketModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (b: unknown) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", partySize: 2, priority: 0 });
  return (
    <Modal open={open} onClose={onClose} title={t("staff.host.addToQueue")}>
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(f);
        }}
      >
        <label>
          {t("common.name")}
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </label>
        <label>
          {t("staff.host.partySize")}
          <input type="number" min={1} value={f.partySize} onChange={(e) => setF({ ...f, partySize: Number(e.target.value) })} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={f.priority > 0} onChange={(e) => setF({ ...f, priority: e.target.checked ? 1 : 0 })} /> {t("staff.host.addModal.priority")}
        </label>
        <button className="btn primary big block">{t("common.add")}</button>
      </form>
    </Modal>
  );
}
