// End-of-day (Z) report: sales, payment mix, hourly sales, best sellers with menu engineering, queue and table KPIs.
import { useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { BarChart } from "../../src/ui/charts";
import { Money, Stat } from "../../src/ui/components";
import { formatMoney } from "../../src/shared/format";

interface Report {
  day: string;
  currency: string;
  sales: { orders: number; gross: number; refunds: number; net: number; discounts: number; serviceCharge: number; tax: number; covers: number; averageCheck: number; openOrders: number; openValue: number; byType: { type: string; total: number }[] };
  payments: { method: string; amount: number; refunded: number; count: number }[];
  hourly: { hour: number; orders: number; sales: number }[];
  items: { item_id: string; name: string; category: string; qty: number; revenue: number; class: string }[];
  queue: { joined: number; seated: number; cancelled: number; noShows: number; waiting: number; avgWaitMinutes: number; p90WaitMinutes: number };
  tables: { turns: number; avgTurnMinutes: number };
}

const CLASS_HINT: Record<string, string> = { star: "⭐ star", plowhorse: "🐎 plowhorse", puzzle: "🧩 puzzle", dog: "🐕 dog" };

export default function Reports() {
  const s = useStaff();
  const b = useBranchApi();
  const tz = s.branch?.config.timezone ?? "Asia/Kuala_Lumpur";
  const [day, setDay] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()));
  const { data: r } = usePoll(() => (s.branchId ? api<Report>(b(`report?day=${day}`)) : Promise.resolve(null)), { interval: 30_000, deps: [s.branchId, day] });
  const cur = r?.currency ?? "MYR";
  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Report · {s.branch?.name}</h1>
        <div className="row no-print">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: "auto" }} aria-label="Day" />
          <button className="btn" onClick={() => window.print()}>
            Print Z-report
          </button>
        </div>
      </div>
      {r && (
        <>
          <section className="card row" style={{ justifyContent: "space-around" }} data-testid="report-sales">
            <Stat label="Gross sales" value={<Money v={r.sales.gross} c={cur} />} />
            <Stat label="Net of refunds" value={<Money v={r.sales.net} c={cur} />} />
            <Stat label="Bills" value={r.sales.orders} />
            <Stat label="Average check" value={<Money v={r.sales.averageCheck} c={cur} />} />
            <Stat label="Covers" value={r.sales.covers} />
          </section>
          <div className="split">
            <section className="card">
              <BarChart title="Sales by hour" data={r.hourly.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}h`, value: h.sales, display: `${formatMoney(h.sales, cur)} · ${h.orders} bills` }))} testId="hourly-chart" />
            </section>
            <section className="card">
              <h3>Takings</h3>
              <table>
                <tbody>
                  {r.payments.map((p) => (
                    <tr key={p.method}>
                      <td>{p.method} ({p.count})</td>
                      <td className="num"><Money v={p.amount - p.refunded} c={cur} /></td>
                    </tr>
                  ))}
                  <tr><td>Discounts given</td><td className="num"><Money v={r.sales.discounts} c={cur} /></td></tr>
                  <tr><td>Service charge</td><td className="num"><Money v={r.sales.serviceCharge} c={cur} /></td></tr>
                  <tr><td>Tax collected</td><td className="num"><Money v={r.sales.tax} c={cur} /></td></tr>
                  <tr><td>Refunds</td><td className="num"><Money v={r.sales.refunds} c={cur} /></td></tr>
                  <tr><td>Still open</td><td className="num">{r.sales.openOrders} bills · <Money v={r.sales.openValue} c={cur} /></td></tr>
                </tbody>
              </table>
            </section>
          </div>
          <div className="split">
            <section className="card">
              <h3>Queue & tables</h3>
              <div className="row" style={{ justifyContent: "space-between" }} data-testid="report-queue">
                <Stat label="joined" value={r.queue.joined} />
                <Stat label="seated" value={r.queue.seated} />
                <Stat label="walked away" value={r.queue.cancelled + r.queue.noShows} />
                <Stat label="avg wait (min)" value={r.queue.avgWaitMinutes} />
                <Stat label="p90 wait" value={r.queue.p90WaitMinutes} />
                <Stat label="table turns" value={r.tables.turns} />
                <Stat label="avg turn (min)" value={r.tables.avgTurnMinutes} />
              </div>
            </section>
            <section className="card">
              <h3>Best sellers & menu engineering</h3>
              <table>
                <tbody>
                  {r.items.slice(0, 10).map((i) => (
                    <tr key={i.item_id}>
                      <td>{i.name}</td>
                      <td className="num">{i.qty}</td>
                      <td className="num"><Money v={i.revenue} c={cur} /></td>
                      <td className="muted">{CLASS_HINT[i.class]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
