// A bill from the menu assistant, as a card: each line with its add-ons and price, the charges as the
// till adds them, a split, each person's part, and one button to put the whole order in the cart.
// The guest can fix what it read before adding it: a line's count (to nought, which takes it off), its
// add-ons, from the dish's own choices, and on a bill split by who had what, whose it is (all of a
// line, or one of several); the money follows, as the till totals it.
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Minus, Plus, ReceiptText, RotateCcw } from "lucide-react";
import { Money } from "./components";
import { useI18n } from "../i18n/react";

type Option = { group: string; name: string; label: string; price: number };
type Line = {
  id: string;
  name: string;
  label: string;
  count: number;
  options: Option[];
  price: number;
  groups: { name: string; min: number; max: number; options: { name: string; label: string; price: number }[] }[];
  unit: number;
  total: number;
  owner?: string;
};
export interface OrderCardData {
  lines: Line[];
  subtotal: number;
  charges?: { servicePct: number; taxPct: number; taxInclusive: boolean; cashRounding: number; service: number; tax: number; due: number };
  split?: { ways: number; each: number };
  people?: { who: string; total: number; due?: number }[];
  mine?: boolean;
  notes?: string[];
}

/** As the till totals it (crates/core/src/money.rs): service charge on the food, tax on both, cash rounding. */
function till(subtotal: number, c: NonNullable<OrderCardData["charges"]>) {
  const service = Math.round((subtotal * c.servicePct) / 100);
  const tax = c.taxInclusive ? 0 : Math.round(((subtotal + service) * c.taxPct) / 100);
  const step = Math.max(1, c.cashRounding);
  return { service, tax, due: Math.round((subtotal + service + tax) / step) * step };
}
const optionsKey = (l: Line) => l.options.map((o) => `${o.group}:${o.name}`).sort().join("|");
const keyOf = (ls: Line[]) => JSON.stringify(ls.map((l) => [l.id, l.count, optionsKey(l), l.owner ?? ""]));
/** The same dish with the same add-ons for the same person is one line. */
function merged(ls: Line[]): Line[] {
  const out: Line[] = [];
  for (const l of ls) {
    const had = out.find((x) => x.id === l.id && optionsKey(x) === optionsKey(l) && x.owner === l.owner);
    if (had) had.count += l.count;
    else out.push({ ...l });
  }
  return out.map((l) => ({ ...l, total: l.unit * l.count }));
}

export function OrderCard({ order, currency, onAddAll, onEdit }: { order: OrderCardData; currency: string; onAddAll?: (lines: Line[]) => void; onEdit?: (lines: Line[]) => void }) {
  const { t } = useI18n();
  const [lines, setLines] = useState(order.lines);
  const [open, setOpen] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [justOne, setJustOne] = useState(false);
  const [added, setAdded] = useState(false);
  const edited = keyOf(lines) !== keyOf(order.lines);
  useEffect(() => {
    if (edited) onEdit?.(lines);
    // (only when the lines change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyOf(lines)]);

  const sums = useMemo(() => {
    const subtotal = lines.reduce((n, l) => n + l.unit * l.count, 0);
    const ch = order.charges ? { ...order.charges, ...till(subtotal, order.charges) } : undefined;
    const due = ch?.due ?? subtotal;
    const people = order.people?.map((p) => {
      const total = lines.filter((l) => l.owner === p.who).reduce((n, l) => n + l.unit * l.count, 0);
      return { who: p.who, total, due: p.due !== undefined && order.charges ? till(total, order.charges).due : undefined };
    });
    return { subtotal, ch, due, each: order.split ? Math.ceil(due / order.split.ways) : 0, people };
  }, [lines, order]);

  const setCount = (k: number, count: number) => {
    setLines((ls) => (count <= 0 ? ls.filter((_, j) => j !== k) : ls.map((l, j) => (j === k ? { ...l, count } : l))));
    if (count <= 0) {
      setOpen(null);
      setMoving(null);
    }
  };
  // "the lemon tea was my friend's": all of the line to them, or one of several
  const moveTo = (k: number, who: string) => {
    setLines((ls) => {
      const l = ls[k];
      if (!l || l.owner === who) return ls;
      const one = justOne && l.count > 1;
      const rest = ls.map((x, j) => (j === k ? (one ? { ...x, count: x.count - 1 } : { ...x, owner: who }) : x));
      return merged(one ? [...rest, { ...l, count: 1, owner: who }] : rest);
    });
    setMoving(null);
    setJustOne(false);
  };
  const toggle = (k: number, group: Line["groups"][number], o: Line["groups"][number]["options"][number]) =>
    setLines((ls) =>
      ls.map((l, j) => {
        if (j !== k) return l;
        const on = l.options.some((x) => x.group === group.name && x.name === o.name);
        const inGroup = l.options.filter((x) => x.group === group.name);
        let options = l.options;
        if (on) options = inGroup.length > group.min ? l.options.filter((x) => !(x.group === group.name && x.name === o.name)) : l.options;
        else if (group.max <= 1) options = [...l.options.filter((x) => x.group !== group.name), { group: group.name, ...o }];
        else if (inGroup.length < group.max) options = [...l.options, { group: group.name, ...o }];
        const unit = l.price + options.reduce((n, x) => n + x.price, 0);
        return { ...l, options, unit, total: unit * l.count };
      }),
    );

  return (
    <div className="order-card" data-testid="order-card">
      <div className="order-head">
        <ReceiptText size={15} aria-hidden /> {order.mine ? t("assistant.orderMine") : t("assistant.orderTitle")}
        {edited ? (
          <button
            type="button"
            className="order-reset"
            onClick={() => {
              setLines(order.lines);
              setOpen(null);
              setMoving(null);
            }}
          >
            <RotateCcw size={13} aria-hidden /> {t("assistant.orderReset")}
          </button>
        ) : null}
      </div>
      <ul className="order-lines">
        {lines.map((l, k) => (
          <li key={`${l.id}-${k}`} className="order-line" data-testid="order-line">
            <span className="order-step">
              <button type="button" onClick={() => setCount(k, l.count - 1)} aria-label={t("assistant.orderFewer", { dish: l.label })}>
                <Minus size={14} />
              </button>
              <span className="tabular" aria-live="polite">{l.count}</span>
              <button type="button" onClick={() => setCount(k, l.count + 1)} aria-label={t("assistant.orderMore", { dish: l.label })} disabled={l.count >= 50}>
                <Plus size={14} />
              </button>
            </span>
            <span className="order-name">
              {l.groups.length ? (
                <button type="button" className="order-dish" aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>
                  {l.label}
                </button>
              ) : (
                l.label
              )}
              {l.options.length ? <span className="order-opts">{l.options.map((o) => o.label).join(" · ")}</span> : null}
              {l.groups.length && open !== k ? (
                <button type="button" className="order-change" onClick={() => setOpen(k)}>
                  {t("assistant.orderChange")}
                </button>
              ) : null}
              {order.people && l.owner ? (
                <button
                  type="button"
                  className="badge order-owner"
                  aria-expanded={moving === k}
                  aria-label={t("assistant.orderOwnerOf", { dish: l.label, who: l.owner })}
                  onClick={() => {
                    setMoving(moving === k ? null : k);
                    setJustOne(false);
                    setOpen(null);
                  }}
                >
                  {l.owner} <ChevronDown size={12} aria-hidden />
                </button>
              ) : null}
            </span>
            <span className="order-price">
              <Money v={l.unit * l.count} c={currency} />
            </span>
            {moving === k && order.people ? (
              <div className="order-choices" data-testid="order-move">
                <fieldset>
                  <legend>{t("assistant.orderWhose")}</legend>
                  <div className="chips">
                    {order.people.map((p) => (
                      <button key={p.who} type="button" className="chip" aria-pressed={l.owner === p.who} onClick={() => moveTo(k, p.who)}>
                        {p.who}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {l.count > 1 ? (
                  <label className="order-one">
                    <input type="checkbox" checked={justOne} onChange={(e) => setJustOne(e.target.checked)} /> {t("assistant.orderMoveOne")}
                  </label>
                ) : null}
              </div>
            ) : null}
            {open === k ? (
              <div className="order-choices">
                {l.groups.map((g) => (
                  <fieldset key={g.name}>
                    <legend>{g.name}</legend>
                    <div className="chips">
                      {g.options.map((o) => (
                        <button key={o.name} type="button" className="chip" aria-pressed={l.options.some((x) => x.group === g.name && x.name === o.name)} onClick={() => toggle(k, g, o)}>
                          {o.label}
                          {o.price ? <span className="muted"> +<Money v={o.price} c={currency} /></span> : null}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <button type="button" className="btn small order-done" onClick={() => setOpen(null)}>
                  <Check size={14} /> {t("assistant.orderDone")}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <dl className="order-sums tabular">
        {sums.ch ? (
          <>
            <div>
              <dt>{t("assistant.orderSubtotal")}</dt>
              <dd><Money v={sums.subtotal} c={currency} /></dd>
            </div>
            {sums.ch.service ? (
              <div>
                <dt>{t("assistant.orderService", { pct: `${sums.ch.servicePct}%` })}</dt>
                <dd><Money v={sums.ch.service} c={currency} /></dd>
              </div>
            ) : null}
            <div>
              <dt>{sums.ch.taxInclusive ? t("assistant.orderTaxIn") : t("assistant.orderTax", { pct: `${sums.ch.taxPct}%` })}</dt>
              <dd>{sums.ch.taxInclusive ? null : <Money v={sums.ch.tax} c={currency} />}</dd>
            </div>
          </>
        ) : null}
        <div className="order-total">
          <dt>{sums.ch ? t("assistant.orderDue") : t("assistant.orderTotal")}</dt>
          <dd><Money v={sums.due} c={currency} /></dd>
        </div>
        {order.split ? (
          <div>
            <dt>{t("assistant.orderEach", { count: order.split.ways })}</dt>
            <dd><Money v={sums.each} c={currency} /></dd>
          </div>
        ) : null}
        {sums.people?.map((p) => (
          <div key={p.who}>
            <dt>{p.who}</dt>
            <dd><Money v={p.due ?? p.total} c={currency} /></dd>
          </div>
        ))}
      </dl>
      {onAddAll && !order.mine && !order.people && lines.length ? (
        <button
          className={`btn small ${added ? "" : "primary"} order-add`}
          disabled={added}
          onClick={() => {
            onAddAll(lines);
            setAdded(true);
          }}
        >
          {added ? <Check size={14} /> : <Plus size={14} />} {added ? t("assistant.orderAdded") : t("assistant.orderAddAll")}
        </button>
      ) : null}
    </div>
  );
}
