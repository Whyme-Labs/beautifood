// POS: open bills, add items, voids, discounts & promo codes, split bill
// (by items or N ways), payments with change, refunds, the cash drawer shift, and the
// terminal's own receipt printer + cash drawer (WebUSB / Web Serial / Web Bluetooth).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CreditCard, Minus, Plus, Printer, ReceiptText, Search, Send, Smartphone, Star, Wallet, X } from "lucide-react";
import { api, msgId } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { useBranchApi, useBranchChanges, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Money, Status, useAction } from "../../src/ui/components";
import { localizeCategory, localizeItem } from "../../src/shared/menuI18n";
import { useI18n } from "../../src/i18n/react";
import { LOCALES, type MessageKey } from "../../src/i18n/core";
import { receiptLocale } from "../../src/shared/receipt";
import { sampleBill, type Bill, type ReceiptJob } from "../../src/ui/receipt";
import { PrinterControl, usePrinter, useReceiptSettings } from "../../src/ui/receiptPrinter";
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
  /** The guest's language, when they queued or booked online. */
  guestLocale: string | null;
  closedAt: number | null;
  items: { id: string; round: number; name: string; qty: number; unitPrice: number; modifiers: { option: string; price: number }[]; status: string; addedBy: string; notes: string; voidReason: string | null }[];
  payments: { id: string; method: string; amount: number; tendered: number | null; change: number; splitLabel: string | null; status: string; refunded: number }[];
}
type Line = { item: MenuItem; qty: number; modifiers: { group: string; option: string }[] };
type Post = (a: string, b: unknown, ok?: string) => Promise<unknown>;
type Paid = { payment: { settled: boolean; duplicate?: boolean }; order: Order };

const cents = (s: string) => Math.round(parseFloat(s || "0") * 100);
const lineTotal = (i: Order["items"][number]) => (i.unitPrice + i.modifiers.reduce((a, m) => a + m.price, 0)) * i.qty;

export default function Pos() {
  const s = useStaff();
  const b = useBranchApi();
  const q = useQuery();
  const { t, f, locale } = useI18n();
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
  const [lines, setLines] = useState<Line[]>([]);
  const [voiding, setVoiding] = useState<string[]>([]);
  const [splitIds, setSplitIds] = useState<string[] | null>(null);
  const printer = usePrinter();
  // a settled bill leaves the open list, so remember each bill's tables for its receipt
  const tablesOf = useRef(new Map<string, string[]>());
  orders?.forEach((o) => tablesOf.current.set(o.id, o.tables));

  useEffect(() => {
    const seating = q.get("seating");
    if (seating && orders) {
      const o = orders.find((x) => x.seatingId === seating && !x.parentOrderId);
      if (o) setSel(o.id);
    }
  }, [q, orders]);
  useEffect(() => (setLines([]), setVoiding([]), setSplitIds(null)), [sel]);

  const lang = menu?.language ?? "en";
  const byName = useMemo(() => new Map((menu?.items ?? []).map((i) => [i.name, i])), [menu]);
  const dishName = (name: string) => {
    const it = byName.get(name);
    return it ? localizeItem(it, locale, lang).name : name;
  };
  const typeLabel = (type: string) => {
    const k = `orderType.${type}` as MessageKey;
    const v = t(k);
    return v === k ? type.replace(/_/g, " ") : v;
  };

  const post: Post = (action, body, ok) =>
    run(async () => {
      const r = await api<Order | { order: Order }>(b(`orders/${order!.id}/${action}`), { body });
      await refreshOrder();
      await refreshList();
      return r;
    }, ok);

  const addLine = (it: MenuItem) => {
    // default to the first option of required groups; staff can adjust on the bill notes
    const modifiers = it.modifiers.filter((g) => g.min > 0).map((g) => ({ group: g.name, option: g.options[0].name }));
    const i = lines.findIndex((l) => l.item.id === it.id && JSON.stringify(l.modifiers) === JSON.stringify(modifiers));
    if (i >= 0) setLines(lines.map((l, n) => (n === i ? { ...l, qty: l.qty + 1 } : l)));
    else setLines([...lines, { item: it, qty: 1, modifiers }]);
  };
  const lessLine = (n: number) => setLines(lines.flatMap((l, i) => (i !== n ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])));
  const draftCount = lines.reduce((a, l) => a + l.qty, 0);
  const draftTotal = lines.reduce((a, l) => a + l.item.price * l.qty, 0);
  const canEdit = !order || order.status === "open";
  const send = () =>
    run(async () => {
      const items = lines.map((l) => ({ itemId: l.item.id, qty: l.qty, modifiers: l.modifiers }));
      const r = await api<Order>(b("orders"), { body: order ? { orderId: order.id, items } : { takeaway: true, items } });
      setLines([]);
      setSel(r.id);
      await refreshOrder();
      await refreshList();
    }, t("staff.pos.sentToKitchen"));

  const ask = (key: MessageKey, def?: string) => prompt(t(key), def);

  const { design } = useReceiptSettings();
  /** The bill as printed, in the restaurant's receipt design and language. */
  const receiptFor = (o: Order): ReceiptJob => {
    const tables = tablesOf.current.get(o.id) ?? [];
    const bill: Bill = {
      restaurant: s.tenant?.name ?? "",
      branch: s.branch?.name,
      address: s.branch?.address || undefined,
      number: o.number,
      tables,
      cashier: s.tenant?.me.name,
      closedAt: o.closedAt ?? Date.now(),
      timezone: s.tenant?.timezone,
      currency: cur,
      items: o.items
        .filter((i) => i.status !== "void")
        .map((i) => {
          const it = byName.get(i.name);
          const names = Object.fromEntries(LOCALES.map((l) => [l.code, it ? localizeItem(it, l.code, lang).name : i.name]));
          return { names, original: i.name, qty: i.qty, amount: lineTotal(i), options: i.modifiers.map((m) => m.option), notes: i.notes || undefined };
        }),
      subtotal: o.subtotal,
      discount: o.discount,
      discountReason: o.discountSpec?.reason,
      serviceCharge: o.serviceCharge,
      tax: o.tax,
      rounding: o.rounding,
      total: o.total,
      payments: o.payments.map((p) => ({ method: p.method, label: p.splitLabel, amount: p.amount, tendered: p.method === "cash" ? p.tendered : null, change: p.change })),
      receiptUrl: o.receiptToken ? `${location.origin}/receipt/${encodeURIComponent(o.receiptToken)}` : undefined,
      joinUrl: s.tenant ? `${location.origin}/me?tenant=${encodeURIComponent(s.tenant.slug)}` : undefined,
    };
    return { bill, config: design, locale: receiptLocale(design.language, locale, o.guestLocale) };
  };
  /** What "Test print" prints: a sample bill of this restaurant's dishes in its receipt design. */
  const sample = (): ReceiptJob => ({
    bill: sampleBill({ restaurant: s.tenant?.name ?? "", branch: s.branch?.name, address: s.branch?.address, currency: cur, timezone: s.tenant?.timezone, cashier: s.tenant?.me.name, menu, serviceChargePct: s.branch?.config.serviceChargePct, taxPct: s.branch?.config.taxPct, cashRounding: s.branch?.config.cashRounding, origin: location.origin, tenantSlug: s.tenant?.slug }),
    config: design,
    locale: receiptLocale(design.language, locale),
  });
  // after the payment is saved: print and kick the drawer, never blocking or undoing it
  const onPaid = (method: string, r: Paid) => {
    if (r.payment.duplicate) return;
    printer.afterPayment(method === "cash", r.payment.settled ? () => receiptFor(r.order) : null, r.order.receiptToken);
  };

  return (
    <div className="col">
      <div className="page-head">
        <h1>{t("staff.pos.title")}</h1>
        <div className="row">
          {s.can("shift.manage") && (
            <div className="pos-drawer" data-testid="shift">
              <Wallet size={16} aria-hidden />
              {shift?.current ? (
                <>
                  <span>
                    {t("staff.pos.drawerOpenSince", { time: f.time(shift.current.opened_at) })} · {t("staff.pos.float", { amount: f.money(shift.current.opening_float, cur) })}
                  </span>
                  <button
                    className="btn small"
                    onClick={() => {
                      const counted = ask("staff.pos.countedPrompt");
                      if (counted)
                        run(async () => {
                          const r = await api<{ expected: number; variance: number }>(b(`shifts/${shift.current!.id}/close`), { body: { counted: cents(counted) } });
                          alert(t("staff.pos.drawerResult", { expected: f.money(r.expected, cur), variance: f.money(r.variance, cur) }));
                          await refreshShift();
                        });
                    }}
                  >
                    {t("staff.pos.closeDrawer")}
                  </button>
                </>
              ) : (
                <>
                  <span className="muted">{t("staff.pos.noDrawer")}</span>
                  <button
                    className="btn small"
                    onClick={() => {
                      const fl = ask("staff.pos.openingFloat", "200.00");
                      if (fl) run(async () => (await api(b("shifts"), { body: { openingFloat: cents(fl) } }), await refreshShift()), t("staff.pos.drawerOpened"));
                    }}
                  >
                    {t("staff.pos.openDrawer")}
                  </button>
                </>
              )}
            </div>
          )}
          <PrinterControl p={printer} sample={sample} />
          <button className="btn primary" onClick={() => setSel(null)}>
            <Plus size={18} aria-hidden /> {t("staff.pos.newTakeaway")}
          </button>
        </div>
      </div>

      <section aria-labelledby="pos-bills-h">
        <h2 id="pos-bills-h" className="sr-only">
          {t("staff.pos.openBills")}
        </h2>
        <div className="pos-bills" data-testid="open-bills">
          {orders?.map((o) => (
            <button key={o.id} className="pos-bill" aria-pressed={sel === o.id} onClick={() => setSel(o.id)}>
              <span className="serial sm">#{o.number}</span>
              <span className="pb-meta">{o.tables.length ? o.tables.join("+") : typeLabel(o.type)}</span>
              <span className="pb-due">
                <Money v={o.due} c={cur} />
              </span>
            </button>
          ))}
          {orders && !orders.length && <div className="muted pos-bills-empty">{t("staff.pos.noOpenBills")}</div>}
        </div>
      </section>

      <div className="pos">
        <MenuGrid menu={menu} cur={cur} lines={lines} disabled={!canEdit} onAdd={addLine} />

        <section className="col pos-side">
          <ErrorBox error={error} />
          {canEdit && lines.length > 0 && (
            <div className="card tight pos-round" data-testid="draft-round">
              <div className="row between nowrap">
                <h3 style={{ margin: 0 }}>{order ? t("staff.pos.newRound") : t("staff.pos.takeaway")}</h3>
                <button className="btn small ghost" onClick={() => setLines([])}>
                  {t("staff.pos.clearRound")}
                </button>
              </div>
              <div className="list">
                {lines.map((l, n) => {
                  const loc = localizeItem(l.item, locale, lang);
                  return (
                    <div key={n} className="row between nowrap">
                      <span className="grow">
                        <b className="tabular">{l.qty}×</b> {loc.name}
                        {l.modifiers.length ? <span className="muted"> · {l.modifiers.map((m) => loc.option(m.group, m.option)).join(", ")}</span> : null}
                      </span>
                      <button className="btn small icon ghost" onClick={() => lessLine(n)} aria-label={t("staff.pos.lessOne", { name: loc.name })}>
                        {l.qty > 1 ? <Minus size={16} /> : <X size={16} />}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className="btn primary block" disabled={pending} onClick={send}>
                <Send size={16} aria-hidden /> {t("staff.pos.sendToKitchen", { count: draftCount })} · <Money v={draftTotal} c={cur} />
              </button>
            </div>
          )}

          {order ? (
            <div className="card col pos-billcard" data-testid="bill">
              <div className="row between nowrap">
                <div>
                  <div className="muted pos-cap">{t("staff.pos.bill")}</div>
                  <div className="serial mid">#{order.number}</div>
                </div>
                <div className="col tight" style={{ alignItems: "flex-end" }}>
                  <Status s={order.status} />
                  <span className="muted" style={{ fontSize: 13 }}>
                    {typeLabel(order.type)}
                  </span>
                </div>
              </div>

              {splitIds && <div className="alert info">{t("staff.pos.splitHint")}</div>}
              <div className="list pos-items">
                {order.items.map((i) => (
                  <div key={i.id} className={`pos-line ${i.status === "void" ? "void" : ""}`} data-testid="bill-item">
                    <span>
                      {order.status === "open" && i.status !== "void" && (
                        <input
                          type="checkbox"
                          checked={(splitIds ?? voiding).includes(i.id)}
                          onChange={(e) => {
                            const set = splitIds ? setSplitIds : setVoiding;
                            const curSel = splitIds ?? voiding;
                            set(e.target.checked ? [...curSel, i.id] : curSel.filter((x) => x !== i.id));
                          }}
                          aria-label={t("staff.pos.selectItem", { name: dishName(i.name) })}
                        />
                      )}
                    </span>
                    <span className="grow">
                      <b className="tabular">{i.qty}×</b> {dishName(i.name)}
                      {i.modifiers.length ? <span className="muted"> · {i.modifiers.map((m) => m.option).join(", ")}</span> : null}
                      {i.notes ? <span className="muted"> · “{i.notes}”</span> : null}
                      <span className="hint pos-sub">
                        {t("staff.pos.round", { n: i.round })} · {i.addedBy}
                        {i.voidReason ? ` · ${t("staff.pos.voidNote", { reason: i.voidReason })}` : ""}
                      </span>
                    </span>
                    <Status s={i.status} />
                    <span className="num pos-amt">
                      <Money v={(i.unitPrice + i.modifiers.reduce((a, m) => a + m.price, 0)) * i.qty} c={cur} />
                    </span>
                  </div>
                ))}
              </div>

              <dl className="kv">
                <dt>{t("common.subtotal")}</dt>
                <dd><Money v={order.subtotal} c={cur} /></dd>
                {order.discount ? (
                  <>
                    <dt>{order.discountSpec ? t("staff.pos.discountReason", { reason: order.discountSpec.reason }) : t("common.discount")}</dt>
                    <dd>-<Money v={order.discount} c={cur} /></dd>
                  </>
                ) : null}
                {order.serviceCharge ? (<><dt>{t("common.serviceCharge")}</dt><dd><Money v={order.serviceCharge} c={cur} /></dd></>) : null}
                {order.tax ? (<><dt>{t("common.tax")}</dt><dd><Money v={order.tax} c={cur} /></dd></>) : null}
                {order.rounding ? (<><dt>{t("common.rounding")}</dt><dd><Money v={order.rounding} c={cur} /></dd></>) : null}
                <dt className="total">{t("common.total")}</dt>
                <dd className="total" data-testid="bill-total"><Money v={order.total} c={cur} /></dd>
                <dt>{t("common.paid")}</dt>
                <dd><Money v={order.paid} c={cur} /></dd>
                <dt className="total">{t("common.due")}</dt>
                <dd className="total pos-due" data-testid="bill-due"><Money v={order.due} c={cur} /></dd>
              </dl>

              {order.status === "open" && (
                <>
                  <div className="row">
                    {voiding.length > 0 && !splitIds && s.can("order.void") && (
                      <button
                        className="btn small danger"
                        onClick={() => {
                          const reason = ask("staff.pos.voidReason");
                          if (reason) post("void", { itemIds: voiding, reason }, t("staff.pos.voided")).then(() => setVoiding([]));
                        }}
                      >
                        {t("staff.pos.voidCount", { count: voiding.length })}
                      </button>
                    )}
                    {!splitIds ? (
                      <button className="btn small" onClick={() => (setVoiding([]), setSplitIds([]))} disabled={order.paid > 0}>
                        {t("staff.pos.splitByItems")}
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
                            }, t("staff.pos.splitDone"))
                          }
                        >
                          {t("staff.pos.moveToNewBill", { count: splitIds.length })}
                        </button>
                        <button className="btn small ghost" onClick={() => setSplitIds(null)}>
                          {t("staff.pos.cancelSplit")}
                        </button>
                      </>
                    )}
                  </div>
                  <BillTools order={order} cur={cur} canDiscount={s.can("order.discount")} post={post} />
                  {s.can("payment.take") && <PayPanel order={order} cur={cur} pending={pending} post={post} onPaid={onPaid} />}
                </>
              )}

              {order.payments.length > 0 && (
                <div>
                  <h3>{t("staff.pos.payments")}</h3>
                  <div className="list">
                    {order.payments.map((p) => (
                      <div key={p.id} className="row between" data-testid="payment-row">
                        <span>
                          <b>{t(`payMethod.${p.method}` as MessageKey)}</b>
                          {p.splitLabel ? ` (${p.splitLabel})` : ""} · <Money v={p.amount} c={cur} />
                          {p.change ? <span className="muted"> · {t("staff.pos.paymentChange", { amount: f.money(p.change, cur) })}</span> : null}{" "}
                          {p.refunded ? <span className="badge bad">{t("staff.pos.refundedAmount", { amount: f.money(p.refunded, cur) })}</span> : null}
                        </span>
                        {s.can("payment.refund") && p.refunded < p.amount && (
                          <button
                            className="btn small danger"
                            onClick={() => {
                              const amt = ask("staff.pos.refundAmount", ((p.amount - p.refunded) / 100).toFixed(2));
                              const reason = amt ? ask("staff.pos.refundReason") : null;
                              if (amt && reason) run(async () => (await api(b(`payments/${p.id}/refund`), { body: { amount: cents(amt), reason, msgId: msgId() } }), await refreshOrder()), t("staff.pos.refunded"));
                            }}
                          >
                            {t("staff.pos.refund")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {order.receiptToken && (
                <div className="row">
                  <a className="btn small ghost" href={`/receipt/${order.receiptToken}`} target="_blank" rel="noreferrer">
                    <ReceiptText size={16} aria-hidden /> {t("staff.pos.viewReceipt")}
                  </a>
                  <button className="btn small ghost" onClick={() => printer.printReceipt(() => receiptFor(order), order.receiptToken!)} data-testid="print-receipt">
                    <Printer size={16} aria-hidden /> {t("staff.pos.printReceipt")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            !lines.length && (
              <div className="card flat">
                <Empty icon={<ReceiptText size={28} strokeWidth={1.5} />}>{t("staff.pos.pickBill")}</Empty>
              </div>
            )
          )}
        </section>
      </div>

      {canEdit && lines.length > 0 && (
        <div className="pos-dock">
          <button className="btn primary block" disabled={pending} onClick={send}>
            <Send size={16} aria-hidden /> {t("staff.pos.sendToKitchen", { count: draftCount })} · <Money v={draftTotal} c={cur} />
          </button>
        </div>
      )}
    </div>
  );
}

function MenuGrid({ menu, cur, lines, disabled, onAdd }: { menu: Menu | null; cur: string; lines: Line[]; disabled: boolean; onAdd: (it: MenuItem) => void }) {
  const { t, locale } = useI18n();
  const [cat, setCat] = useState("all");
  const [find, setFind] = useState("");
  const lang = menu?.language ?? "en";
  const items = useMemo(() => {
    const needle = find.trim().toLowerCase();
    return (menu?.items ?? [])
      .filter((i) => i.active && (cat === "all" || i.categoryId === cat))
      .map((i) => ({ it: i, loc: localizeItem(i, locale, lang) }))
      .filter(({ it, loc }) => !needle || loc.name.toLowerCase().includes(needle) || it.name.toLowerCase().includes(needle));
  }, [menu, cat, find, locale, lang]);
  const qty = (id: string) => lines.reduce((a, l) => a + (l.item.id === id ? l.qty : 0), 0);
  return (
    <section className="col" aria-labelledby="pos-menu-h">
      <div className="row between nowrap">
        <h2 id="pos-menu-h" style={{ margin: 0 }}>
          {t("staff.pos.menu")}
        </h2>
        <label className="pos-find">
          <Search size={16} aria-hidden />
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder={t("staff.pos.findDish")} aria-label={t("staff.pos.findDish")} />
        </label>
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
          {t("common.all")}
        </button>
        {menu?.categories.map((c) => (
          <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {localizeCategory(c, locale, lang)}
          </button>
        ))}
      </div>
      {!menu ? (
        <div className="muted">{t("common.loading")}</div>
      ) : items.length ? (
        <div className="pos-menu">
          {items.map(({ it, loc }) => {
            const n = qty(it.id);
            return (
              <button key={it.id} className="pos-item" disabled={disabled || it.soldOut} onClick={() => onAdd(it)} aria-label={t("staff.pos.addItem", { name: loc.name })}>
                <span className="pi-name">{loc.name}</span>
                {loc.original && <span className="pi-alt">{loc.original}</span>}
                <span className="pi-foot">
                  <span className="pi-price">
                    <Money v={it.price} c={cur} />
                  </span>
                  {it.soldOut && <span className="badge bad">{t("menu.soldOut")}</span>}
                </span>
                {n > 0 && (
                  <span className="pi-qty" aria-label={t("staff.pos.inDraft", { count: n })}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty>{t("staff.pos.noDishes")}</Empty>
      )}
    </section>
  );
}

function BillTools({ order, cur, canDiscount, post }: { order: Order; cur: string; canDiscount: boolean; post: Post }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState(order.email ?? "");
  const [ways, setWays] = useState(2);
  const [plan, setPlan] = useState<number[] | null>(null);
  return (
    <div className="pos-tools">
      <form className="row nowrap" onSubmit={(e) => (e.preventDefault(), post("promo", { code }, t("staff.pos.promoApplied")))}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("staff.pos.promoCode")} className="grow" aria-label={t("staff.pos.promoCode")} />
        <button className="btn small">{t("staff.pos.apply")}</button>
      </form>
      {canDiscount && (
        <div className="row">
          {[5, 10, 20].map((p) => (
            <button key={p} className="btn small" onClick={() => post("discount", { kind: "percent", value: p, reason: `${p}% manager discount` }, t("staff.pos.discountApplied"))}>
              -{p}%
            </button>
          ))}
          {order.discountSpec && (
            <button className="btn small ghost" onClick={() => post("discount", null, t("staff.pos.discountRemoved"))}>
              {t("staff.pos.removeDiscount")}
            </button>
          )}
        </div>
      )}
      <form className="row nowrap" onSubmit={(e) => (e.preventDefault(), post("contact", { email, joinLoyalty: true }, order.memberId ? t("staff.pos.updated") : t("staff.pos.memberAttached")))}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("staff.pos.guestEmailHint")} className="grow" aria-label={t("staff.pos.guestEmail")} />
        <button className="btn small">
          {order.memberId ? (
            <>
              <Star size={14} aria-hidden /> {t("staff.pos.member")}
            </>
          ) : (
            t("staff.pos.attach")
          )}
        </button>
      </form>
      <div className="row">
        <span className="muted">{t("staff.pos.splitEvenly")}</span>
        <input type="number" inputMode="numeric" min={2} max={30} value={ways} onChange={(e) => setWays(Number(e.target.value))} style={{ width: 64 }} aria-label={t("staff.pos.splitWays")} />
        <button className="btn small" onClick={async () => setPlan(((await post("split_plan", { ways })) as { parts: number[] }).parts)}>
          {t("staff.pos.showShares")}
        </button>
        {plan && (
          <span className="row" data-testid="split-plan">
            {plan.map((p, i) => (
              <span key={i} className="badge">
                <Money v={p} c={cur} />
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

const METHODS = [
  { m: "cash", key: "staff.pos.payCash", Icon: Banknote },
  { m: "card", key: "staff.pos.payCard", Icon: CreditCard },
  { m: "ewallet", key: "staff.pos.payEwallet", Icon: Smartphone },
] as const;

function PayPanel({ order, cur, pending, post, onPaid }: { order: Order; cur: string; pending: boolean; post: Post; onPaid: (method: string, r: Paid) => void }) {
  const { t, f } = useI18n();
  const [amount, setAmount] = useState((order.due / 100).toFixed(2));
  const [tendered, setTendered] = useState("");
  const [label, setLabel] = useState("");
  useEffect(() => setAmount((order.due / 100).toFixed(2)), [order.due]);
  const amt = cents(amount);
  const given = tendered ? cents(tendered) : 0;
  const quick = [...new Set([amt, Math.ceil(amt / 1000) * 1000, Math.ceil(amt / 5000) * 5000, Math.ceil(amt / 10000) * 10000])].filter((v) => v > 0).slice(0, 4);
  const pay = (method: string) =>
    post(
      "pay",
      { method, amount: amt, tendered: method === "cash" && tendered ? given : null, splitLabel: label || null, msgId: msgId() },
      method === "cash" && tendered ? t("staff.pos.changeToast", { amount: ((given - amt) / 100).toFixed(2) }) : t("staff.pos.paymentTaken"),
    ).then((r) => {
      if (!r) return;
      setTendered("");
      onPaid(method, r as Paid);
    });
  return (
    <div className="card flat col pos-pay" data-testid="pay-panel">
      <div className="pos-pay-fields">
        <label>
          {t("staff.pos.amount")}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label={t("staff.pos.paymentAmount")} />
        </label>
        <label>
          {t("staff.pos.cashTendered")}
          <input value={tendered} onChange={(e) => setTendered(e.target.value)} inputMode="decimal" aria-label={t("staff.pos.cashTendered")} className="pos-tender" />
        </label>
        <label>
          {t("staff.pos.splitLabel")}
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("staff.pos.splitLabelHint")} />
        </label>
      </div>
      <div className="row" role="group" aria-label={t("staff.pos.quickCash")}>
        {quick.map((v, i) => (
          <button key={v} type="button" className="btn small" onClick={() => setTendered((v / 100).toFixed(2))}>
            {i === 0 ? t("staff.pos.exact") : f.money(v, cur)}
          </button>
        ))}
      </div>
      {tendered && amt > 0 && (
        <div className={`pos-change ${given < amt ? "short" : ""}`} aria-live="polite">
          <span>{given < amt ? t("staff.pos.short") : t("common.change")}</span>
          <b>
            <Money v={Math.abs(given - amt)} c={cur} />
          </b>
        </div>
      )}
      <div className="pos-pay-btns">
        {METHODS.map(({ m, key, Icon }) => (
          <button key={m} className="btn primary big" disabled={pending || amt <= 0} onClick={() => pay(m)}>
            <Icon size={18} aria-hidden /> {t(key)}
          </button>
        ))}
        {order.memberId && (
          <button className="btn big" disabled={pending || amt <= 0} onClick={() => pay("points")}>
            <Star size={18} aria-hidden /> {t("staff.pos.payPoints")}
          </button>
        )}
      </div>
    </div>
  );
}
