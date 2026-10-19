// The shared table cart. Every phone at the table sees the same cart (polled by
// version, 204 when unchanged), edits only its own lines, and "Send to kitchen"
// carries the cart version it saw so nobody sends an order they haven't reviewed.
// Totals are previewed with the same Rust/WASM core the server uses.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@void/react";
import { BellRing, ChefHat, Minus, Plus, Receipt, Send, Sparkles, Users } from "lucide-react";
import { api, ApiError, msgId } from "../../src/ui/api";
import { useLocal, usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Modal, Money, Status, errorText, useAction, useToast } from "../../src/ui/components";
import { MenuList } from "../../src/ui/menuList";
import { AssistantChat } from "../../src/ui/chat";
import { GuestBar } from "../../src/ui/guest";
import { loadCore } from "../../src/core/client";
import { localizeItem } from "../../src/shared/menuI18n";
import { useI18n } from "../../src/i18n/react";
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
  items: { id: string; itemId?: string; round: number; name: string; qty: number; status: string; addedBy: string; modifiers: CartModifier[]; unitPrice: number }[];
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

type Tab = "menu" | "cart" | "bill";

export default function CartPage() {
  const { t, locale, f } = useI18n();
  const { id } = useParams<{ id: string }>();
  const k = useQuery().get("k") ?? "";
  const toast = useToast();
  const { run, pending } = useAction();
  const [me, setMe] = useLocal<{ id: string; name: string } | null>("bf.participant", null);
  const [nameDraft, setNameDraft] = useState("");
  const [meta, setMeta] = useState<Pick<Cart, "branch" | "menu" | "tables"> | null>(null);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [tab, setTab] = useState<Tab>("menu");
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
  const menuLang = meta?.menu?.language ?? "en";
  const itemById = useMemo(() => new Map((meta?.menu?.items ?? []).map((i) => [i.id, i])), [meta]);
  const local = (itemId: string | undefined, name: string) => {
    const it = itemId ? itemById.get(itemId) : undefined;
    return it ? localizeItem(it, locale, menuLang) : { name, option: (_g: string, o: string) => o, group: (g: string) => g, original: null };
  };
  const findByName = (name: string) => meta?.menu?.items.find((i) => i.name === name);

  // Bill preview with the shared Rust core (identical math to the server)
  const preview = useMemo(() => {
    if (!core || !cart || !meta?.branch) return null;
    const sent = cart.order?.items.filter((i) => i.status !== "void").map((i) => ({ unitPrice: i.unitPrice, qty: i.qty, modifiers: i.modifiers })) ?? [];
    // unsent lines are charged at the price when they're sent: the menu's price now (a happy hour may have started or ended)
    const pendingLines = cart.lines.map((l) => ({ unitPrice: itemById.get(l.itemId)?.price ?? l.unitPrice, qty: l.qty, modifiers: l.modifiers }));
    const b = meta.branch;
    return core.computeTotals({ lines: [...sent, ...pendingLines], serviceChargePct: cart.session.kind === "takeaway" ? 0 : b.serviceChargePct, taxPct: b.taxPct, taxInclusive: b.taxInclusive, cashRounding: b.cashRounding });
  }, [core, cart, meta, itemById]);

  const add = (item: MenuItem, qty = 1, modifiers: { group: string; option: string }[] = [], notes = "") =>
    run(async () => {
      if (!me) return;
      const r = await api<{ cart: Cart }>(`/api/public/sessions/${id}/lines?${qs}`, { body: { participant: me, itemId: item.id, qty, modifiers, notes } });
      setCart(r.cart);
      setPicking(null);
    }, t("cart.added", { name: localizeItem(item, locale, menuLang).name }));

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
      toast(cart.session.kind === "table" || cart.session.kind === "takeaway" ? t("cart.sent", { round: r.round }) : t("cart.preorderSaved"));
      setTab("bill");
    } catch (e) {
      if (e instanceof ApiError && (e.code === "version_conflict" || e.code === "already_sent")) {
        const fresh = e.data as Cart | undefined;
        if (fresh) setCart(fresh);
        else await refresh();
        toast(e.code === "already_sent" ? t("errors.already_sent") : t("errors.version_conflict"), true);
      } else toast(errorText(e, locale), true);
    }
  };

  const callStaff = (reason: string) => run(() => api(`/api/public/sessions/${id}/call-staff?${qs}`, { body: { reason } }), reason === "bill" ? t("cart.billRequested") : t("cart.waiterComing"));

  if (!k) return <main className="narrow">{t("common.missingLink")}</main>;
  const open = cart?.session.status === "open";
  const byPerson = new Map<string, Line[]>();
  for (const l of cart?.lines ?? []) byPerson.set(l.participantName + "|" + l.participantId, [...(byPerson.get(l.participantName + "|" + l.participantId) ?? []), l]);
  const myCount = cart?.lines.filter((l) => mine(l)).reduce((s, l) => s + l.qty, 0) ?? 0;
  const allCount = cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
  const kind = cart?.session.kind ?? "table";
  const kindLabel = t(`cart.kind.${kind}` as "cart.kind.table");
  const modsText = (itemId: string | undefined, name: string, mods: CartModifier[]) => {
    const l = local(itemId ?? findByName(name)?.id, name);
    return mods.map((m) => l.option(m.group, m.option)).join(", ");
  };

  return (
    <>
      <GuestBar>
        {meta?.branch?.restaurant} {meta?.branch?.name}
        {meta?.tables?.length ? ` · ${t("common.table", { label: meta.tables.join(" + ") })}` : ""}
      </GuestBar>
      <main className="narrow" style={{ paddingBottom: 110 }}>
        <ErrorBox error={error} />
        {cart && (
          <>
            <div className="row between nowrap" style={{ marginBottom: 6 }}>
              <h1 style={{ margin: 0 }}>{kindLabel}</h1>
              {!open && <Status s={cart.session.status === "seated" ? "seated_session" : cart.session.status} />}
            </div>
            {cart.participants.length > 0 && (
              <p className="muted row" data-testid="participants" style={{ gap: 6 }}>
                <Users size={16} /> {t("cart.together", { names: cart.participants.map((p) => p.name).join(", ") })}
              </p>
            )}
            <div className="row nowrap" style={{ margin: "12px 0" }}>
              <div className="segmented" role="tablist">
                <button role="tab" aria-selected={tab === "menu"} onClick={() => setTab("menu")}>
                  {t("cart.tabMenu")}
                </button>
                <button role="tab" aria-selected={tab === "cart"} onClick={() => setTab("cart")} data-testid="tab-cart">
                  {t("cart.tabCart", { count: allCount })}
                </button>
                <button role="tab" aria-selected={tab === "bill"} onClick={() => setTab("bill")} data-testid="tab-bill">
                  {t("cart.tabBill")}
                </button>
              </div>
              <span className="grow" />
              <button className="btn small" onClick={() => setChat(true)}>
                <Sparkles size={15} /> {t("assistant.openShort")}
              </button>
            </div>

            {tab === "menu" && meta?.menu && <MenuList menu={meta.menu} currency={cur} onPick={(i) => (open ? (i.modifiers.length ? setPicking(i) : add(i)) : toast(t("cart.closed"), true))} />}

            {tab === "cart" && (
              <section className="col" data-testid="cart">
                {!cart.lines.length && <p className="muted">{t("cart.emptyCart")}</p>}
                {[...byPerson.entries()].map(([key, lines]) => (
                  <div key={key} className="card tight">
                    <b className="row" style={{ gap: 6 }}>
                      {key.split("|")[0]}
                    </b>
                    {lines.map((l) => {
                      const ln = local(l.itemId, l.name);
                      return (
                        <div key={l.id} className="row between nowrap" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }} data-testid="cart-line">
                          <span className="grow">
                            <b className="tabular">{l.qty}×</b> {ln.name}
                            {l.modifiers.length ? <span className="muted"> · {l.modifiers.map((m) => ln.option(m.group, m.option)).join(", ")}</span> : null}
                            {l.notes ? <span className="muted"> · “{l.notes}”</span> : null}
                          </span>
                          <span className="row nowrap" style={{ gap: 6 }}>
                            <Money v={((itemById.get(l.itemId)?.price ?? l.unitPrice) + l.modifiers.reduce((s, m) => s + m.price, 0)) * l.qty} c={cur} />
                            {mine(l) && open && (
                              <>
                                <button className="btn small icon" onClick={() => setQty(l, l.qty - 1)} aria-label={t("cart.removeOne", { name: ln.name })}>
                                  <Minus size={15} />
                                </button>
                                <button className="btn small icon" onClick={() => setQty(l, l.qty + 1)} aria-label={t("cart.addOne", { name: ln.name })}>
                                  <Plus size={15} />
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {preview && (
                  <div className="card sunk tight" data-testid="bill-preview">
                    <div className="row between">
                      <span className="muted">{t("cart.estimate")}</span>
                      <b className="serial sm">
                        <Money v={preview.total} c={cur} />
                      </b>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t("cart.estimateDetail", { subtotal: f.money(preview.subtotal, cur), service: f.money(preview.serviceCharge, cur), tax: f.money(preview.tax, cur) })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === "bill" && (
              <section className="col" data-testid="bill">
                {!cart.order && <p className="muted">{t("cart.nothingSent")}</p>}
                {cart.order && (
                  <div className="stub no-tear" data-stock="X" style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", filter: "none" }}>
                    <div className="row between">
                      <b>{t("cart.orderNo", { number: cart.order.number })}</b>
                      <Status s={cart.order.status} />
                    </div>
                    <div className="list" style={{ marginTop: 6 }}>
                      {cart.order.items.map((i) => {
                        const ln = local(i.itemId ?? findByName(i.name)?.id, i.name);
                        return (
                          <div key={i.id} className="row between nowrap" data-testid="sent-item">
                            <span className="grow">
                              <b className="tabular">{i.qty}×</b> {ln.name} <span className="muted">· {t("cart.by", { name: i.addedBy })}</span>
                              {i.modifiers.length ? <div className="muted" style={{ fontSize: 12.5 }}>{modsText(i.itemId, i.name, i.modifiers)}</div> : null}
                            </span>
                            <Status s={i.status} />
                          </div>
                        );
                      })}
                    </div>
                    <dl className="kv" style={{ marginTop: 12 }}>
                      <dt>{t("common.subtotal")}</dt>
                      <dd><Money v={cart.order.subtotal} c={cur} /></dd>
                      {cart.order.discount ? (<><dt>{t("common.discount")}</dt><dd>-<Money v={cart.order.discount} c={cur} /></dd></>) : null}
                      {cart.order.serviceCharge ? (<><dt>{t("common.serviceCharge")}</dt><dd><Money v={cart.order.serviceCharge} c={cur} /></dd></>) : null}
                      {cart.order.tax ? (<><dt>{t("common.tax")}</dt><dd><Money v={cart.order.tax} c={cur} /></dd></>) : null}
                      {cart.order.rounding ? (<><dt>{t("common.rounding")}</dt><dd><Money v={cart.order.rounding} c={cur} /></dd></>) : null}
                      <dt className="total">{t("common.total")}</dt>
                      <dd className="total"><b data-testid="order-total"><Money v={cart.order.total} c={cur} /></b></dd>
                      {cart.order.paid ? (<><dt>{t("common.paid")}</dt><dd><Money v={cart.order.paid} c={cur} /></dd></>) : null}
                    </dl>
                  </div>
                )}
                {cart.session.kind === "table" && open && (
                  <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button className="btn" onClick={() => callStaff("bill")} disabled={pending}>
                      <Receipt size={17} /> {t("cart.requestBill")}
                    </button>
                    <button className="btn" onClick={() => callStaff("waiter")} disabled={pending}>
                      <BellRing size={17} /> {t("cart.callWaiter")}
                    </button>
                  </div>
                )}
              </section>
            )}

            {open && cart.lines.length > 0 && (
              <div className="dock">
                <div>
                  <button className="btn primary big block" onClick={submit} disabled={pending} data-testid="send-order">
                    {kind === "queue" || kind === "booking" ? <ChefHat size={19} /> : <Send size={19} />}
                    {kind === "queue" || kind === "booking" ? t("cart.savePreorder", { count: allCount }) : t("cart.sendKitchen", { count: allCount })}
                    {myCount && myCount !== allCount ? ` ${t("cart.yours", { count: myCount })}` : ""}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Modal open={!me} onClose={() => {}} title={t("cart.whoTitle")}>
        <form
          className="col"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameDraft.trim()) setMe({ id: `p-${crypto.randomUUID()}`, name: nameDraft.trim() });
          }}
        >
          <p className="muted">{t("cart.whoLead")}</p>
          <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder={t("cart.yourName")} aria-label={t("cart.yourName")} maxLength={40} />
          <button className="btn primary big" disabled={!nameDraft.trim()}>
            {t("cart.start")}
          </button>
        </form>
      </Modal>

      <PickModal item={picking} currency={cur} menuLang={menuLang} onClose={() => setPicking(null)} onAdd={(qty, mods, notes) => picking && add(picking, qty, mods, notes)} />

      <Modal open={chat} onClose={() => setChat(false)} title={t("assistant.title")}>
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

function PickModal({ item, currency, menuLang, onClose, onAdd }: { item: MenuItem | null; currency: string; menuLang: string; onClose: () => void; onAdd: (qty: number, mods: { group: string; option: string }[], notes: string) => void }) {
  const { t, locale, f } = useI18n();
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setQty(1);
    setSel({});
    setNotes("");
  }, [item?.id]);
  if (!item) return null;
  const l = localizeItem(item, locale, menuLang);
  const missing = item.modifiers.filter((g) => (sel[g.name]?.length ?? 0) < g.min);
  const price = (item.price + item.modifiers.flatMap((g) => g.options.filter((o) => sel[g.name]?.includes(o.name))).reduce((s, o) => s + o.price, 0)) * qty;
  return (
    <Modal open onClose={onClose} title={l.name}>
      <div className="col">
        {l.description && <p className="muted">{l.description}</p>}
        {item.modifiers.map((g) => (
          <fieldset key={g.name} style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>
              <b>{l.group(g.name)}</b> <span className={`badge ${g.min ? "brand" : ""}`}>{g.min ? t("menu.required") : t("menu.optionalGroup")}</span>
            </legend>
            <div className="row">
              {g.options.map((o) => {
                const on = sel[g.name]?.includes(o.name);
                return (
                  <button
                    key={o.name}
                    type="button"
                    className="chip"
                    aria-pressed={!!on}
                    onClick={() => {
                      const cur = sel[g.name] ?? [];
                      const next = on ? cur.filter((x) => x !== o.name) : g.max === 1 ? [o.name] : [...cur, o.name].slice(-Math.max(1, g.max));
                      setSel({ ...sel, [g.name]: next });
                    }}
                  >
                    {l.option(g.name, o.name)}
                    {o.price ? <> +<Money v={o.price} c={currency} /></> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <label>
          {t("menu.kitchenNotes")}
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("menu.kitchenNotesHint")} maxLength={200} />
        </label>
        <div className="row between nowrap">
          <div className="stepper">
            <button type="button" className="btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label={t("menu.less")}>
              <Minus size={18} />
            </button>
            <input readOnly value={qty} aria-label={t("common.party", { count: qty })} />
            <button type="button" className="btn" onClick={() => setQty(qty + 1)} aria-label={t("menu.more")}>
              <Plus size={18} />
            </button>
          </div>
          <button className="btn primary big" disabled={missing.length > 0} onClick={() => onAdd(qty, Object.entries(sel).flatMap(([group, opts]) => opts.map((option) => ({ group, option }))), notes)}>
            {t("menu.addWithPrice", { price: f.money(price, currency) })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
