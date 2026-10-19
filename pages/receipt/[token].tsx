import { useEffect } from "react";
import { useParams } from "@void/react";
import { Printer, Star } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Money } from "../../src/ui/components";
import { GuestBar } from "../../src/ui/guest";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import type { ReceiptSnapshot } from "../../src/server/domain/messaging";

export default function ReceiptPage() {
  const { t, f } = useI18n();
  const { token } = useParams<{ token: string }>();
  const { data: r, error } = usePoll(() => api<ReceiptSnapshot>(`/api/public/receipts/${token}`), { interval: 0 });
  // ?print=1: the till's fallback when the browser can't reach a receipt printer
  const autoPrint = useQuery().get("print") === "1";
  useEffect(() => {
    if (r && autoPrint) requestAnimationFrame(() => window.print());
  }, [r, autoPrint]);
  return (
    <>
      <GuestBar
        className="no-print"
        right={
          <button className="btn small" onClick={() => window.print()}>
            <Printer size={15} /> {t("common.print")}
          </button>
        }
      />
      <main className="narrow">
        <ErrorBox error={error} />
        {r && (
          <div className="stub no-tear" data-stock="X" data-testid="receipt" style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }}>
            <h1 style={{ marginBottom: 2 }}>{r.restaurant}</h1>
            <div className="muted">
              {r.branch}
              {r.address ? ` · ${r.address}` : ""}
            </div>
            <div className="row between" style={{ margin: "14px 0 10px", borderTop: "2px dashed var(--line-strong)", borderBottom: "2px dashed var(--line-strong)", padding: "10px 0" }}>
              <b className="serial mid">#{r.orderNumber}</b>
              <span className="muted" style={{ textAlign: "right", fontSize: 13 }}>
                {f.dateTime(r.closedAt, r.timezone)}
                {r.tables.length ? <div>{t("common.table", { label: r.tables.join("+") })}</div> : null}
              </span>
            </div>
            <table>
              <tbody>
                {r.items.map((i, n) => (
                  <tr key={n}>
                    <td>
                      <b className="tabular">{i.qty}×</b> {i.name}
                      {i.modifiers.length ? <div className="muted">{i.modifiers.map((m) => m.option).join(", ")}</div> : null}
                    </td>
                    <td className="num"><Money v={i.lineTotal} c={r.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="kv" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <dt>{t("common.subtotal")}</dt>
              <dd><Money v={r.subtotal} c={r.currency} /></dd>
              {r.discount ? (<><dt>{r.discountLabel ?? t("common.discount")}</dt><dd>-<Money v={r.discount} c={r.currency} /></dd></>) : null}
              {r.serviceCharge ? (<><dt>{t("common.serviceChargePct", { pct: r.serviceChargePct })}</dt><dd><Money v={r.serviceCharge} c={r.currency} /></dd></>) : null}
              {r.tax ? (<><dt>{t("common.taxPct", { pct: r.taxPct })}</dt><dd><Money v={r.tax} c={r.currency} /></dd></>) : null}
              {r.rounding ? (<><dt>{t("common.rounding")}</dt><dd><Money v={r.rounding} c={r.currency} /></dd></>) : null}
              <dt className="total">{t("common.total")}</dt>
              <dd className="total"><Money v={r.total} c={r.currency} /></dd>
              {r.payments.map((p, n) => (
                <span key={n} style={{ display: "contents" }}>
                  <dt>{t("receipt.paidWith", { method: t(`payMethod.${p.method}` as MessageKey) })}{p.splitLabel ? ` (${p.splitLabel})` : ""}</dt>
                  <dd><Money v={p.amount} c={r.currency} /></dd>
                </span>
              ))}
            </dl>
            {r.points && (
              <p className="alert sun" style={{ marginTop: 14 }}>
                <Star size={17} fill="currentColor" /> {t("receipt.points", { earned: r.points.earned, balance: r.points.balance, tier: r.points.tier })}
              </p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
