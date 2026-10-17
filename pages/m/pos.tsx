// POS: open bills, add items, voids, discounts & promo codes, split bill
// (by items or N ways), payments with change, refunds, and the cash drawer shift.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, msgId } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { useBranchApi, useBranchChanges, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Modal, Money, Status, useAction } from "../../src/ui/components";
import type { Menu, MenuItem } from "../../src/shared/types";

interface OrderRow {
  id: string;
  number: string;
  type: string;
  status: string;
  total: number;
  paid: number;
  due: number;
  seatingId: string | null;
  tables: string[];
  createdAt: number;
  parentOrderId: string | null;
}
interface Order {
  id: string;
  number: string;
  type: string;
  status: string;
  seatingId: string | null;
  email: string | null;
  memberId: string | null;
  discountSpec: { kind: string; value: number; reason: string; code?: string } | null;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  rounding: number;
  total: number;
  paid: number;
  refunded: number;
  due: number;
  receiptToken: string | null;
  items: { id: string; round: number; name: string; qty: number; unitPrice: number; modifiers: { option: string; price: number }[]; status: string; addedBy: string; notes: string; voidReason: string | null }[];
  payments: { id: string; method: string; amount: number; change: number; splitLabel: string | null; status: string; refunded: number }[];
}

export default function Pos() {
  const s = useStaff();
  const b = useBranchApi();
  const q = useQuery();
  const cur = s.tenant?.currency ?? "MYR";
  const { run, pending } = useAction();
  const [sel, setSel] = useState<string | null>(null);
  const { data: orders, refresh: refreshList } = usePoll(() => (s.branchId ? api<OrderRow[]>(b("orders?status=open")) : Promise.resolve(null)), { interval: 15_000, deps: [s.branchId] });
  const { data: order, refresh: refreshOrder, error } = usePoll(() => (sel ? api<Order>(b(`orders/${sel}`)) : Promise.resolve(null)), { interval: 0, deps: [sel] });
  const { data: menu } = usePoll(() => (s.branchId ? api<Menu>(`/api/m/menu?branch=${s.branchId}`) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const { data: shift, refresh: refreshShift } = usePoll(() => (s.can("shift.manage") && s.branchId ? api<{ current: { id: string; opened_at: number; opening_float: number } | null }>(b("shifts")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  useBranchChanges(
    useCallback(() => {
      refreshList();
      if (sel) refreshOrder();
    }, [refreshList, refreshOrder, sel]),
  );
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<string[]>([]);
  const [splitIds, setSplitIds] = useState<string[] | null>(null);

  useEffect(() => {
    const seating = q.get("seating");
    if (seating && orders) {
      const o = orders.find((x) => x.seatingId === seating && !x.parentOrderId);
      if (o) setSel(o.id);
    }
  }, [q, orders]);

  const post = (action: string, body: unknown, ok?: string) =>
    run(async () => {
      const r = await api<Order | { order: Order }>(b(`orders/${order!.id}/${action}`), { body });
      await refreshOrder();
      await refreshList();
      return r;
    }, ok);

  const live = order?.items.filter((i) => i.status !== "void") ?? [];
  return (
    <div className="split side">
      <section className="col">
        <div className="row between">
          <h1 style={{ margin: 0 }}>POS</h1>
          <button className="btn primary" onClick={() => (setSel(null), setAdding(true))}>
            + New takeaway
          </button>
        </div>
        <ErrorBox error={error} />
        {order ? (
          <div className="card col" data-testid="bill">
            <div className="row between">
              <h2 style={{ margin: 0 }}>
                Bill #{order.number} <span className="muted">· {order.type.replace("_", " ")}</span>
              </h2>
              <Status s={order.status} />
            </div>
            <table>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} style={{ opacity: i.status === "void" ? 0.45 : 1 }} data-testid="bill-item">
                    <td style={{ width: 28 }}>
                      {order.status === "open" && i.status !== "void" && (
                        <input
                          type="checkbox"
                          checked={(splitIds ?? voiding).includes(i.id)}
                          onChange={(e) => {
                            const set = splitIds ? setSplitIds : setVoiding;
                            const curSel = splitIds ?? voiding;
                            set(e.target.checked ? [...curSel, i.id] : curSel.filter((x) => x !== i.id));
                          }}
                          aria-label={`Select ${i.name}`}
                        />
                      )}
                    </td>
                    <td>
                      {i.qty}× {i.name}
                      {i.modifiers.length ? <span className="muted"> · {i.modifiers.map((m) => m.option).join(", ")}</span> : null}
                      {i.notes ? <span className="muted"> · “{i.notes}”</span> : null}
                      <div className="muted" style={{ fontSize: 12 }}>
                        round {i.round} · {i.addedBy} {i.voidReason ? `· void: ${i.voidReason}` : ""}
                      </div>
                    </td>
                    <td>
                      <Status s={i.status} />
                    </td>
                    <td className="num">
                      <Money v={(i.unitPrice + i.modifiers.reduce((a, m) => a + m.price, 0)) * i.qty} c={cur} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table>
              <tbody>
                <tr><td>Subtotal</td><td className="num"><Money v={order.subtotal} c={cur} /></td></tr>
                {order.discount ? <tr><td>Discount {order.discountSpec ? `(${order.discountSpec.reason})` : ""}</td><td className="num">-<Money v={order.discount} c={cur} /></td></tr> : null}
                {order.serviceCharge ? <tr><td>Service charge</td><td className="num"><Money v={order.serviceCharge} c={cur} /></td></tr> : null}
                {order.tax ? <tr><td>Tax</td><td className="num"><Money v={order.tax} c={cur} /></td></tr> : null}
                {order.rounding ? <tr><td>Rounding</td><td className="num"><Money v={order.rounding} c={cur} /></td></tr> : null}
                <tr><td><b>Total</b></td><td className="num"><b data-testid="bill-total"><Money v={order.total} c={cur} /></b></td></tr>
                <tr><td>Paid</td><td className="num"><Money v={order.paid} c={cur} /></td></tr>
                <tr><td><b>Due</b></td><td className="num"><b data-testid="bill-due"><Money v={order.due} c={cur} /></b></td></tr>
              </tbody>
            </table>
            {order.status === "open" && (
              <>
                <div className="row">
                  <button className="btn small" onClick={() => setAdding(true)}>
                    + Add items
                  </button>
                  {voiding.length > 0 && !splitIds && s.can("order.void") && (
                    <button className="btn small danger" onClick={() => { const reason = prompt("Reason for void?"); if (reason) post("void", { itemIds: voiding, reason }, "Voided").then(() => setVoiding([])); }}>
                      Void {voiding.length}
                    </button>
                  )}
                  {!splitIds ? (
                    <button className="btn small" onClick={() => (setVoiding([]), setSplitIds([]))} disabled={order.paid > 0}>
                      Split by items…
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn small primary"
                        disabled={!splitIds.length}
                        onClick={() =>
                          run(async () => {
                            const r = await api<{ split: Order }>(b(`orders/${order.id}/split`), { body: { itemIds: splitIds } });
                            setSplitIds(null);
                            await refreshList();
                            setSel(r.split.id);
                          }, "Split into a separate bill")
                        }
                      >
                        Move {splitIds.length} to new bill
                      </button>
                      <button className="btn small ghost" onClick={() => setSplitIds(null)}>
                        Cancel split
                      </button>
                    </>
                  )}
                </div>
                <BillTools order={order} cur={cur} canDiscount={s.can("order.discount")} post={post} />
                {s.can("payment.take") && <PayPanel order={order} cur={cur} pending={pending} post={post} />}
              </>
            )}
            {order.payments.length > 0 && (
              <div>
                <h3>Payments</h3>
                <div className="list">
                  {order.payments.map((p) => (
                    <div key={p.id} className="row between" data-testid="payment-row">
                      <span>
                        {p.method}
                        {p.splitLabel ? ` (${p.splitLabel})` : ""} · <Money v={p.amount} c={cur} />
                        {p.change ? <span className="muted"> · change <Money v={p.change} c={cur} /></span> : null}
                        {p.refunded ? <span className="badge bad">refunded <Money v={p.refunded} c={cur} /></span> : null}
                      </span>
                      {s.can("payment.refund") && p.refunded < p.amount && (
                        <button
                          className="btn small danger"
                          onClick={() => {
                            const amt = prompt("Refund amount", ((p.amount - p.refunded) / 100).toFixed(2));
                            const reason = amt ? prompt("Reason?") : null;
                            if (amt && reason) run(async () => (await api(b(`payments/${p.id}/refund`), { body: { amount: Math.round(parseFloat(amt) * 100), reason, msgId: msgId() } }), await refreshOrder()), "Refunded");
                          }}
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {order.receiptToken && (
              <a href={`/receipt/${order.receiptToken}`} target="_blank" rel="noreferrer">
                View e-receipt
              </a>
            )}
          </div>
        ) : (
          <Empty>Pick a bill on the right, or start a takeaway order.</Empty>
        )}
      </section>

      <section className="col">
        {s.can("shift.manage") && (
          <div className="card tight row between" data-testid="shift">
            {shift?.current ? (
              <>
                <span>
                  Drawer open since {new Date(shift.current.opened_at).toLocaleTimeString()} · float <Money v={shift.current.opening_float} c={cur} />
                </span>
                <button
                  className="btn small"
                  onClick={() => {
                    const counted = prompt("Cash counted in drawer?");
                    if (counted) run(async () => {
                      const r = await api<{ expected: number; variance: number }>(b(`shifts/${shift.current!.id}/close`), { body: { counted: Math.round(parseFloat(counted) * 100) } });
                      alert(`Expected ${(r.expected / 100).toFixed(2)} · variance ${(r.variance / 100).toFixed(2)}`);
                      await refreshShift();
                    });
                  }}
                >
                  Close drawer
                </button>
              </>
            ) : (
              <>
                <span className="muted">No cash drawer open</span>
                <button className="btn small" onClick={() => { const f = prompt("Opening float?", "200.00"); if (f) run(async () => (await api(b("shifts"), { body: { openingFloat: Math.round(parseFloat(f) * 100) } }), await refreshShift()), "Drawer opened"); }}>
                  Open drawer
                </button>
              </>
            )}
          </div>
        )}
        <div className="card">
          <h2>Open bills</h2>
          <div className="list" data-testid="open-bills">
            {orders?.map((o) => (
              <button key={o.id} className={`btn ${sel === o.id ? "primary" : ""}`} style={{ justifyContent: "space-between" }} onClick={() => setSel(o.id)}>
                <span>
                  #{o.number} {o.tables.length ? `· ${o.tables.join("+")}` : `· ${o.type.replace("_", " ")}`}
                </span>
                <Money v={o.due} c={cur} />
              </button>
            ))}
            {!orders?.length && <div className="muted">No open bills.</div>}
          </div>
        </div>
      </section>

      <AddItems
        open={adding}
        menu={menu}
        cur={cur}
        onClose={() => setAdding(false)}
        onAdd={(items) =>
          run(async () => {
            const r = await api<Order>(b("orders"), { body: order ? { orderId: order.id, items } : { takeaway: true, items } });
            setAdding(false);
            setSel(r.id);
            await refreshOrder();
            await refreshList();
          }, "Sent to kitchen")
        }
      />
    </div>
  );
}

function BillTools({ order, cur, canDiscount, post }: { order: Order; cur: string; canDiscount: boolean; post: (a: string, b: unknown, ok?: string) => Promise<unknown> }) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState(order.email ?? "");
  const [ways, setWays] = useState(2);
  const [plan, setPlan] = useState<number[] | null>(null);
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      <form className="row" onSubmit={(e) => (e.preventDefault(), post("promo", { code }, "Promo applied"))}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Promo code" style={{ flex: 1 }} aria-label="Promo code" />
        <button className="btn small">Apply</button>
      </form>
      {canDiscount && (
        <div className="row">
          {[5, 10, 20].map((p) => (
            <button key={p} className="btn small" onClick={() => post("discount", { kind: "percent", value: p, reason: `${p}% manager discount` }, "Discount applied")}>
              -{p}%
            </button>
          ))}
          {order.discountSpec && (
            <button className="btn small ghost" onClick={() => post("discount", null, "Discount removed")}>
              Remove
            </button>
          )}
        </div>
      )}
      <form className="row" onSubmit={(e) => (e.preventDefault(), post("contact", { email, joinLoyalty: true }, order.memberId ? "Updated" : "Member attached — they'll earn points and get an e-receipt"))}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Guest email (receipt + points)" style={{ flex: 1 }} aria-label="Guest email" />
        <button className="btn small">{order.memberId ? "✓ Member" : "Attach"}</button>
      </form>
      <div className="row">
        <span className="muted">Split</span>
        <input type="number" min={2} max={30} value={ways} onChange={(e) => setWays(Number(e.target.value))} style={{ width: 64 }} aria-label="Split ways" />
        <button className="btn small" onClick={async () => setPlan(((await post("split_plan", { ways })) as { parts: number[] }).parts)}>
          ways
        </button>
        {plan && <span data-testid="split-plan">{plan.map((p, i) => <span key={i} className="badge"><Money v={p} c={cur} /></span>)}</span>}
      </div>
    </div>
  );
}

function PayPanel({ order, cur, pending, post }: { order: Order; cur: string; pending: boolean; post: (a: string, b: unknown, ok?: string) => Promise<unknown> }) {
  const [amount, setAmount] = useState((order.due / 100).toFixed(2));
  const [tendered, setTendered] = useState("");
  const [label, setLabel] = useState("");
  useEffect(() => setAmount((order.due / 100).toFixed(2)), [order.due]);
  const amt = Math.round(parseFloat(amount || "0") * 100);
  const pay = (method: string) =>
    post("pay", { method, amount: amt, tendered: method === "cash" && tendered ? Math.round(parseFloat(tendered) * 100) : null, splitLabel: label || null, msgId: msgId() }, method === "cash" && tendered ? `Change: ${((Math.round(parseFloat(tendered) * 100) - amt) / 100).toFixed(2)}` : "Payment taken");
  return (
    <div className="card flat col" data-testid="pay-panel">
      <div className="row">
        <label style={{ flex: 1 }}>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Payment amount" />
        </label>
        <label style={{ flex: 1 }}>
          Cash tendered
          <input value={tendered} onChange={(e) => setTendered(e.target.value)} inputMode="decimal" aria-label="Cash tendered" />
        </label>
        <label style={{ flex: 1 }}>
          Split label
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Alice" />
        </label>
      </div>
      <div className="row">
        {["cash", "card", "ewallet"].map((m) => (
          <button key={m} className="btn primary" disabled={pending || amt <= 0} onClick={() => pay(m)}>
            Pay {m}
          </button>
        ))}
        {order.memberId && (
          <button className="btn" disabled={pending || amt <= 0} onClick={() => pay("points")}>
            Pay with points
          </button>
        )}
      </div>
    </div>
  );
}

function AddItems({ open, menu, cur, onClose, onAdd }: { open: boolean; menu: Menu | null; cur: string; onClose: () => void; onAdd: (items: { itemId: string; qty: number; modifiers: { group: string; option: string }[] }[]) => void }) {
  const [lines, setLines] = useState<{ item: MenuItem; qty: number; modifiers: { group: string; option: string }[] }[]>([]);
  const [cat, setCat] = useState("all");
  useEffect(() => setLines([]), [open]);
  const items = useMemo(() => (menu?.items ?? []).filter((i) => i.active && (cat === "all" || i.categoryId === cat)), [menu, cat]);
  const addLine = (it: MenuItem) => {
    // default to the first option of required groups; staff can adjust on the bill notes
    const modifiers = it.modifiers.filter((g) => g.min > 0).map((g) => ({ group: g.name, option: g.options[0].name }));
    const i = lines.findIndex((l) => l.item.id === it.id && JSON.stringify(l.modifiers) === JSON.stringify(modifiers));
    if (i >= 0) setLines(lines.map((l, n) => (n === i ? { ...l, qty: l.qty + 1 } : l)));
    else setLines([...lines, { item: it, qty: 1, modifiers }]);
  };
  return (
    <Modal open={open} onClose={onClose} title="Add items">
      <div className="col">
        <div className="row">
          <button className={`btn small ${cat === "all" ? "primary" : ""}`} onClick={() => setCat("all")}>
            All
          </button>
          {menu?.categories.map((c) => (
            <button key={c.id} className={`btn small ${cat === c.id ? "primary" : ""}`} onClick={() => setCat(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid tight">
          {items.map((it) => (
            <button key={it.id} className="btn" disabled={it.soldOut} onClick={() => addLine(it)} style={{ flexDirection: "column", alignItems: "flex-start" }} aria-label={`Add ${it.name}`}>
              <span>{it.name}</span>
              <small className="muted">
                <Money v={it.price} c={cur} />
                {it.soldOut ? " · sold out" : ""}
              </small>
            </button>
          ))}
        </div>
        {lines.length > 0 && (
          <div className="card flat tight">
            {lines.map((l, n) => (
              <div key={n} className="row between">
                <span>
                  {l.qty}× {l.item.name}
                  {l.modifiers.length ? <span className="muted"> · {l.modifiers.map((m) => m.option).join(", ")}</span> : null}
                </span>
                <button className="btn small ghost" onClick={() => setLines(lines.filter((_, i) => i !== n))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn primary" disabled={!lines.length} onClick={() => onAdd(lines.map((l) => ({ itemId: l.item.id, qty: l.qty, modifiers: l.modifiers })))}>
          Send {lines.reduce((s, l) => s + l.qty, 0)} to kitchen
        </button>
      </div>
    </Modal>
  );
}
