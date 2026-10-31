// A bill from the menu assistant, as a card: each line with its add-ons and price, the charges as the
// till adds them, a split, each person's part, and one button to put the whole order in the cart.
import { useState } from "react";
import { Check, Plus, ReceiptText } from "lucide-react";
import { Money } from "./components";
import { useI18n } from "../i18n/react";

export interface OrderCardData {
  lines: { id: string; name: string; label: string; count: number; options: { group: string; name: string; label: string; price: number }[]; unit: number; total: number; owner?: string }[];
  subtotal: number;
  charges?: { servicePct: number; taxPct: number; taxInclusive: boolean; service: number; tax: number; due: number };
  split?: { ways: number; each: number };
  people?: { who: string; total: number; due?: number }[];
  mine?: boolean;
  notes?: string[];
}

export function OrderCard({ order, currency, onAddAll }: { order: OrderCardData; currency: string; onAddAll?: (lines: OrderCardData["lines"]) => void }) {
  const { t } = useI18n();
  const [added, setAdded] = useState(false);
  const owners = new Set(order.lines.map((l) => l.owner).filter(Boolean)).size >= 2;
  const due = order.charges?.due ?? order.subtotal;
  return (
    <div className="order-card" data-testid="order-card">
      <div className="order-head">
        <ReceiptText size={15} aria-hidden /> {order.mine ? t("assistant.orderMine") : t("assistant.orderTitle")}
      </div>
      <ul className="order-lines">
        {order.lines.map((l, k) => (
          <li key={k} className="order-line">
            <span className="order-count tabular">{l.count}×</span>
            <span className="order-name">
              {l.label}
              {l.options.length ? <span className="order-opts">{l.options.map((o) => o.label).join(" · ")}</span> : null}
              {owners && l.owner ? <span className="badge order-owner">{l.owner}</span> : null}
            </span>
            <Money v={l.total} c={currency} />
          </li>
        ))}
      </ul>
      <dl className="order-sums tabular">
        {order.charges ? (
          <>
            <div>
              <dt>{t("assistant.orderSubtotal")}</dt>
              <dd><Money v={order.subtotal} c={currency} /></dd>
            </div>
            {order.charges.service ? (
              <div>
                <dt>{t("assistant.orderService", { pct: `${order.charges.servicePct}%` })}</dt>
                <dd><Money v={order.charges.service} c={currency} /></dd>
              </div>
            ) : null}
            <div>
              <dt>{order.charges.taxInclusive ? t("assistant.orderTaxIn") : t("assistant.orderTax", { pct: `${order.charges.taxPct}%` })}</dt>
              <dd>{order.charges.taxInclusive ? null : <Money v={order.charges.tax} c={currency} />}</dd>
            </div>
          </>
        ) : null}
        <div className="order-total">
          <dt>{order.charges ? t("assistant.orderDue") : t("assistant.orderTotal")}</dt>
          <dd><Money v={due} c={currency} /></dd>
        </div>
        {order.split ? (
          <div>
            <dt>{t("assistant.orderEach", { count: order.split.ways })}</dt>
            <dd><Money v={order.split.each} c={currency} /></dd>
          </div>
        ) : null}
        {order.people?.map((p) => (
          <div key={p.who}>
            <dt>{p.who}</dt>
            <dd><Money v={p.due ?? p.total} c={currency} /></dd>
          </div>
        ))}
      </dl>
      {onAddAll && !order.mine && !order.people ? (
        <button
          className={`btn small ${added ? "" : "primary"} order-add`}
          disabled={added}
          onClick={() => {
            onAddAll(order.lines);
            setAdded(true);
          }}
        >
          {added ? <Check size={14} /> : <Plus size={14} />} {added ? t("assistant.orderAdded") : t("assistant.orderAddAll")}
        </button>
      ) : null}
    </div>
  );
}
