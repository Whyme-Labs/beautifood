// The shared table cart. Every phone at the table sees the same cart (polled by
// version, 204 when unchanged), edits only its own lines, and "Send to kitchen"
// carries the cart version it saw so nobody sends an order they haven't reviewed.
// Totals are previewed with the same Rust/WASM core the server uses.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@void/react";
import { api, ApiError, msgId } from "../../src/ui/api";
import { useLocal, usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Logo, Modal, Money, Status, useAction, useToast } from "../../src/ui/components";
import { MenuList } from "../../src/ui/menuList";
import { AssistantChat } from "../../src/ui/chat";
import { loadCore } from "../../src/core/client";
import type { Core } from "../../src/core/api";
import type { Menu, MenuItem, CartModifier } from "../../src/shared/types";

interface Line {
  id: string;
  participantId: string;
  participantName: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  modifiers: CartModifier[];
  notes: string;
}
interface OrderView {
  id: string;
  number: string;
  type: string;
  status: string;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  rounding: number;
  total: number;
  paid: number;
  due: number;
  items: { id: string; round: number; name: string; qty: number; status: string; addedBy: string; modifiers: CartModifier[]; unitPrice: number }[];
}
interface Cart {
  session: { id: string; kind: string; status: string; version: number; rounds: number };
  lines: Line[];
  participants: { id: string; name: string }[];
  cartTotal: number;
  order: OrderView | null;
  tables?: string[];
  branch?: { id: string; name: string; restaurant: string; currency: string; serviceChargePct: number; taxPct: number; taxInclusive: boolean; cashRounding: number };
  menu?: Menu;
}

const KIND_LABEL: Record<string, string> = { table: "Table order", queue: "Preorder while you wait", booking: "Preorder for your booking", takeaway: "Takeaway", pos: "Order" };

export default function CartPage() {
  const { id } = useParams<{ id: string }>();
  const k = useQuery().get("k") ?? "";
  const toast = useToast();
  const { run, pending } = useAction();
  const [me, setMe] = useLocal<{ id: string; name: string } | null>("bf.participant", null);
  const [nameDraft, setNameDraft] = useState("");
  const [meta, setMeta] = useState<Pick<Cart, "branch" | "menu" | "tables"> | null>(null);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [tab, setTab] = useState<"menu" | "cart" | "bill">("menu");
  const [chat, setChat] = useState(false);
  const [core, setCore] = useState<Core | null>(null);
  const qs = `k=${encodeURIComponent(k)}`;

  const { data: cart, setData: setCart, error, refresh } = usePoll<Cart>(
    async (): Promise<Cart | null> => {
      if (!k) return null;
      if (!meta) {
        const full = await api<Cart>(`/api/public/sessions/${id}?${qs}&menu=1`);
        setMeta({ branch: full.branch, menu: full.menu, tables: full.tables });
        return full;
      }
      return api<Cart | null>(`/api/public/sessions/${id}?${qs}&since=${cart?.session.version ?? ""}`);
    },
    { interval: 2000, maxInterval: 8000, deps: [k, !!meta] },
  );

  useEffect(() => {
    loadCore().then(setCore).catch(() => setCore(null));
  }, []);

  const cur = meta?.branch?.currency ?? "MYR";
  const mine = (l: Line) => me && l.participantId === me.id;

  // Bill preview with the shared Rust core (identical math to the server)
  const preview = useMemo(() => {
    if (!core || !cart || !meta?.branch) return null;
    const sent = cart.order?.items.filter((i) => i.status !== "void").map((i) => ({ unitPrice: i.unitPrice, qty: i.qty, modifiers: i.modifiers })) ?? [];
    const pendingLines = cart.lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, modifiers: l.modifiers }));
    const b = meta.branch;
    return core.computeTotals({ lines: [...sent, ...pendingLines], serviceChargePct: cart.session.kind === "takeaway" ? 0 : b.serviceChargePct, taxPct: b.taxPct, taxInclusive: b.taxInclusive, cashRounding: b.cashRounding });
  }, [core, cart, meta]);

  const add = (item: MenuItem, qty = 1, modifiers: { group: string; option: string }[] = [], notes = "") =>
    run(async () => {
      if (!me) return;
      const r = await api<{ cart: Cart }>(`/api/public/sessions/${id}/lines?${qs}`, { body: { participant: me, itemId: item.id, qty, modifiers, notes } });
      setCart(r.cart);
      setPicking(null);
    }, `Added ${item.name}`);

  const setQty = (l: Line, qty: number) =>
    run(async () => {
      const r = await api<Cart>(`/api/public/sessions/${id}/lines/${l.id}?${qs}`, { method: "PATCH", body: { participant: me, qty } });
      setCart({ ...r });
    });

  const submit = async () => {
    if (!cart || !me) return;
    try {
      const r = await api<{ round: number; items: number; cart: Cart }>(`/api/public/sessions/${id}/submit?${qs}`, { body: { participant: me, expectedVersion: cart.session.version, msgId: msgId() } });
      setCart(r.cart);
      toast(cart.session.kind === "table" || cart.session.kind === "takeaway" ? `Sent to the kitchen (round ${r.round})` : "Preorder saved — we'll start cooking when you're seated");
      setTab("bill");
    } catch (e) {
      if (e instanceof ApiError && (e.code === "version_conflict" || e.code === "already_sent")) {
        const fresh = e.data as Cart | undefined;
        if (fresh) setCart(fresh);
        else await refresh();
        toast(e.code === "already_sent" ? "Someone at your table just sent the order." : "The cart changed while you were looking — please review and send again.", true);
      } else toast((e as Error).message, true);
    }
  };

  const callStaff = (reason: string) => run(() => api(`/api/public/sessions/${id}/call-staff?${qs}`, { body: { reason } }), reason === "bill" ? "We've let the staff know you'd like the bill" : "Staff are on their way");

  if (!k) return <main className="narrow">This link is missing its access code.</main>;
  const open = cart?.session.status === "open";
  const byPerson = new Map<string, Line[]>();
  for (const l of cart?.lines ?? []) byPerson.set(l.participantName + "|" + l.participantId, [...(byPerson.get(l.participantName + "|" + l.participantId) ?? []), l]);
  const myCount = cart?.lines.filter((l) => mine(l)).reduce((s, l) => s + l.qty, 0) ?? 0;
  const allCount = cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <span className="muted">
            {meta?.branch?.restaurant} {meta?.branch?.name}
            {meta?.tables?.length ? ` · Table ${meta.tables.join(" + ")}` : ""}
          </span>
        </div>
      </header>
      <main className="narrow" style={{ paddingBottom: 90 }}>
        <ErrorBox error={error} />
        {cart && (
          <>
            <div className="row between">
              <h1 style={{ margin: 0 }}>{KIND_LABEL[cart.session.kind]}</h1>
              {!open && <Status s={cart.session.status} />}
            </div>
            {cart.participants.length > 0 && (
              <p className="muted" data-testid="participants">
                Ordering together: {cart.participants.map((p) => p.name).join(", ")}
              </p>
            )}
            <div className="row" role="tablist" style={{ margin: "10px 0" }}>
              <button className={`btn small ${tab === "menu" ? "primary" : ""}`} onClick={() => setTab("menu")}>
                Menu
              </button>
              <button className={`btn small ${tab === "cart" ? "primary" : ""}`} onClick={() => setTab("cart")} data-testid="tab-cart">
                Cart ({allCount})
              </button>
              <button className={`btn small ${tab === "bill" ? "primary" : ""}`} onClick={() => setTab("bill")} data-testid="tab-bill">
                Sent & bill
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn small" onClick={() => setChat(true)}>
                💬 Ask
              </button>
            </div>

            {tab === "menu" && meta?.menu && <MenuList menu={meta.menu} currency={cur} onPick={(i) => (open ? (i.modifiers.length ? setPicking(i) : add(i)) : toast("Ordering is closed", true))} />}

            {tab === "cart" && (
              <section className="col" data-testid="cart">
                {!cart.lines.length && <p className="muted">Nothing in the cart yet. Everyone at the table can add dishes from their own phone.</p>}
                {[...byPerson.entries()].map(([key, lines]) => (
                  <div key={key} className="card tight">
                    <b>{key.split("|")[0]}</b>
                    {lines.map((l) => (
                      <div key={l.id} className="row between" style={{ padding: "6px 0" }} data-testid="cart-line">
                        <span>
                          {l.qty}× {l.name}
                          {l.modifiers.length ? <span className="muted"> · {l.modifiers.map((m) => m.option).join(", ")}</span> : null}
                          {l.notes ? <span className="muted"> · “{l.notes}”</span> : null}
                        </span>
                        <span className="row" style={{ gap: 6 }}>
                          <Money v={(l.unitPrice + l.modifiers.reduce((s, m) => s + m.price, 0)) * l.qty} c={cur} />
                          {mine(l) && open && (
                            <>
                              <button className="btn small" onClick={() => setQty(l, l.qty - 1)} aria-label={`Remove one ${l.name}`}>
                                −
                              </button>
                              <button className="btn small" onClick={() => setQty(l, l.qty + 1)} aria-label={`Add one ${l.name}`}>
                                +
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
                {preview && (
                  <div className="card flat tight" data-testid="bill-preview">
                    <div className="row between">
                      <span className="muted">Estimated bill incl. what's already sent</span>
                      <b>
                        <Money v={preview.total} c={cur} />
                      </b>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Subtotal <Money v={preview.subtotal} c={cur} /> · service <Money v={preview.serviceCharge} c={cur} /> · tax <Money v={preview.tax} c={cur} /> (computed on your phone by the same engine as the till)
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === "bill" && (
              <section className="col" data-testid="bill">
                {!cart.order && <p className="muted">Nothing sent yet.</p>}
                {cart.order && (
                  <div className="card">
                    <div className="row between">
                      <b>Order #{cart.order.number}</b>
                      <Status s={cart.order.status} />
                    </div>
                    <div className="list">
                      {cart.order.items.map((i) => (
                        <div key={i.id} className="row between" data-testid="sent-item">
                          <span>
                            {i.qty}× {i.name} <span className="muted">· {i.addedBy}</span>
                          </span>
                          <Status s={i.status} />
                        </div>
                      ))}
                    </div>
                    <table style={{ marginTop: 10 }}>
                      <tbody>
                        <tr><td>Subtotal</td><td className="num"><Money v={cart.order.subtotal} c={cur} /></td></tr>
                        {cart.order.discount ? <tr><td>Discount</td><td className="num">-<Money v={cart.order.discount} c={cur} /></td></tr> : null}
                        {cart.order.serviceCharge ? <tr><td>Service charge</td><td className="num"><Money v={cart.order.serviceCharge} c={cur} /></td></tr> : null}
                        {cart.order.tax ? <tr><td>Tax</td><td className="num"><Money v={cart.order.tax} c={cur} /></td></tr> : null}
                        {cart.order.rounding ? <tr><td>Rounding</td><td className="num"><Money v={cart.order.rounding} c={cur} /></td></tr> : null}
                        <tr><td><b>Total</b></td><td className="num"><b data-testid="order-total"><Money v={cart.order.total} c={cur} /></b></td></tr>
                        {cart.order.paid ? <tr><td>Paid</td><td className="num"><Money v={cart.order.paid} c={cur} /></td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                )}
                {cart.session.kind === "table" && open && (
                  <div className="row">
                    <button className="btn" onClick={() => callStaff("bill")} disabled={pending}>
                      🧾 Request the bill
                    </button>
                    <button className="btn" onClick={() => callStaff("waiter")} disabled={pending}>
                      🙋 Call a waiter
                    </button>
                  </div>
                )}
              </section>
            )}

            {open && cart.lines.length > 0 && (
              <div className="sticky-bottom" style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 12 }}>
                <div className="narrow" style={{ padding: 0 }}>
                  <button className="btn primary big block" onClick={submit} disabled={pending} data-testid="send-order">
                    {cart.session.kind === "queue" || cart.session.kind === "booking" ? "Save preorder" : "Send to kitchen"} · {allCount} item{allCount === 1 ? "" : "s"}
                    {myCount && myCount !== allCount ? ` (${myCount} yours)` : ""}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Modal open={!me} onClose={() => {}} title="Who's ordering?">
        <form
          className="col"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameDraft.trim()) setMe({ id: `p-${crypto.randomUUID()}`, name: nameDraft.trim() });
          }}
        >
          <p className="muted">So your table knows who added what.</p>
          <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={40} />
          <button className="btn primary" disabled={!nameDraft.trim()}>
            Start ordering
          </button>
        </form>
      </Modal>

      <PickModal item={picking} currency={cur} onClose={() => setPicking(null)} onAdd={(qty, mods, notes) => picking && add(picking, qty, mods, notes)} />

      <Modal open={chat} onClose={() => setChat(false)} title="Menu assistant">
        {meta?.branch && (
          <AssistantChat
            branch={meta.branch.id}
            currency={cur}
            onAdd={(itemId) => {
              const it = meta.menu?.items.find((x) => x.id === itemId);
              if (it) (it.modifiers.length ? setPicking(it) : add(it));
              setChat(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function PickModal({ item, currency, onClose, onAdd }: { item: MenuItem | null; currency: string; onClose: () => void; onAdd: (qty: number, mods: { group: string; option: string }[], notes: string) => void }) {
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setQty(1);
    setSel({});
    setNotes("");
  }, [item?.id]);
  if (!item) return null;
  const missing = item.modifiers.filter((g) => (sel[g.name]?.length ?? 0) < g.min);
  const price = (item.price + item.modifiers.flatMap((g) => g.options.filter((o) => sel[g.name]?.includes(o.name))).reduce((s, o) => s + o.price, 0)) * qty;
  return (
    <Modal open onClose={onClose} title={item.name}>
      <div className="col">
        {item.description && <p className="muted">{item.description}</p>}
        {item.modifiers.map((g) => (
          <fieldset key={g.name} style={{ border: "none", padding: 0 }}>
            <legend>
              <b>{g.name}</b> <span className="muted">{g.min ? "required" : "optional"}</span>
            </legend>
            <div className="row">
              {g.options.map((o) => {
                const on = sel[g.name]?.includes(o.name);
                return (
                  <button
                    key={o.name}
                    type="button"
                    className={`btn small ${on ? "primary" : ""}`}
                    onClick={() => {
                      const cur = sel[g.name] ?? [];
                      const next = on ? cur.filter((x) => x !== o.name) : g.max === 1 ? [o.name] : [...cur, o.name].slice(-Math.max(1, g.max));
                      setSel({ ...sel, [g.name]: next });
                    }}
                  >
                    {o.name}
                    {o.price ? <> +<Money v={o.price} c={currency} /></> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <label>
          Notes for the kitchen
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. less spicy" maxLength={200} />
        </label>
        <div className="row between">
          <div className="row">
            <button className="btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less">
              −
            </button>
            <b>{qty}</b>
            <button className="btn" onClick={() => setQty(qty + 1)} aria-label="More">
              +
            </button>
          </div>
          <button className="btn primary" disabled={missing.length > 0} onClick={() => onAdd(qty, Object.entries(sel).flatMap(([group, opts]) => opts.map((option) => ({ group, option }))), notes)}>
            Add · <Money v={price} c={currency} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
