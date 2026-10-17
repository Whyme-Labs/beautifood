import { useParams } from "@void/react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { ErrorBox, Logo, Money } from "../../src/ui/components";
import type { ReceiptSnapshot } from "../../src/server/domain/messaging";

export default function ReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const { data: r, error } = usePoll(() => api<ReceiptSnapshot>(`/api/public/receipts/${token}`), { interval: 0 });
  return (
    <>
      <header className="topbar no-print">
        <div className="wrap">
          <Logo />
          <button className="btn small" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>
      <main className="narrow">
        <ErrorBox error={error} />
        {r && (
          <div className="card" data-testid="receipt">
            <h1 style={{ marginBottom: 0 }}>{r.restaurant}</h1>
            <div className="muted">
              {r.branch}
              {r.address ? ` · ${r.address}` : ""}
            </div>
            <p className="muted">
              Receipt #{r.orderNumber} · {new Intl.DateTimeFormat("en-MY", { timeZone: r.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(r.closedAt))}
              {r.tables.length ? ` · Table ${r.tables.join("+")}` : ""}
            </p>
            <table>
              <tbody>
                {r.items.map((i, n) => (
                  <tr key={n}>
                    <td>
                      {i.qty}× {i.name}
                      {i.modifiers.length ? <div className="muted">{i.modifiers.map((m) => m.option).join(", ")}</div> : null}
                    </td>
                    <td className="num"><Money v={i.lineTotal} c={r.currency} /></td>
                  </tr>
                ))}
                <tr><td>Subtotal</td><td className="num"><Money v={r.subtotal} c={r.currency} /></td></tr>
                {r.discount ? <tr><td>{r.discountLabel ?? "Discount"}</td><td className="num">-<Money v={r.discount} c={r.currency} /></td></tr> : null}
                {r.serviceCharge ? <tr><td>Service ({r.serviceChargePct}%)</td><td className="num"><Money v={r.serviceCharge} c={r.currency} /></td></tr> : null}
                {r.tax ? <tr><td>Tax ({r.taxPct}%)</td><td className="num"><Money v={r.tax} c={r.currency} /></td></tr> : null}
                {r.rounding ? <tr><td>Rounding</td><td className="num"><Money v={r.rounding} c={r.currency} /></td></tr> : null}
                <tr><td><b>Total</b></td><td className="num"><b><Money v={r.total} c={r.currency} /></b></td></tr>
                {r.payments.map((p, n) => (
                  <tr key={`p${n}`}><td className="muted">Paid · {p.method}{p.splitLabel ? ` (${p.splitLabel})` : ""}</td><td className="num muted"><Money v={p.amount} c={r.currency} /></td></tr>
                ))}
              </tbody>
            </table>
            {r.points && <p style={{ marginTop: 12 }} className="badge brand">⭐ +{r.points.earned} points · balance {r.points.balance} · {r.points.tier}</p>}
          </div>
        )}
      </main>
    </>
  );
}
