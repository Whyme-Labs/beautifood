// Owner dashboard: every branch live, 7-day trend, setup progress and AI insights.
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { BarChart } from "../../src/ui/charts";
import { ErrorBox, Money, Stat } from "../../src/ui/components";
import { formatMoney } from "../../src/shared/format";

interface Overview {
  branches: { branchId: string; name: string; currency: string; queue: { waiting: number; called: number }; tables: { total: number; seated: number; free: number; dirty: number }; occupancy: number; openOrders: { count: number; value: number }; today: { orders: number; sales: number; covers: number } }[];
  totals: { waiting: number; sales: number; orders: number; openValue: number };
  trend: { day: string; branch_id: string; name: string; orders: number; sales: number }[];
}
interface Onboarding {
  progress: number;
  steps: { key: string; label: string; done: boolean; href: string }[];
  next: { label: string; href: string } | null;
}
interface Insights {
  facts: string[];
  narrative: string | null;
  engine: string;
}

export default function Dashboard() {
  const s = useStaff();
  const cur = s.tenant?.currency ?? "MYR";
  const { data: ov, error } = usePoll(() => api<Overview>("/api/m/overview"), { interval: 5000 });
  const { data: ob } = usePoll(() => api<Onboarding>("/api/m/ai/onboarding"), { interval: 0 });
  const { data: ins } = usePoll(() => (s.branchId && s.can("report.view") ? api<Insights>(`/api/m/branches/${s.branchId}/insights`) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const days = [...new Set(ov?.trend.map((t) => t.day))].sort();
  const trend = days.map((d) => {
    const v = ov!.trend.filter((t) => t.day === d).reduce((a, t) => a + t.sales, 0);
    return { label: d.slice(5), value: v, display: formatMoney(v, cur) };
  });
  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {s.user?.name.split(" ")[0]}</h1>
      </div>
      <ErrorBox error={error} />
      {ob && ob.progress < 100 && (
        <section className="card" data-testid="onboarding">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Setup {ob.progress}% done</h2>
            {ob.next && (
              <a className="btn primary small" href={ob.next.href}>
                Next: {ob.next.label}
              </a>
            )}
          </div>
          <div className="progress" style={{ margin: "10px 0" }}>
            <div style={{ width: `${ob.progress}%` }} />
          </div>
          <div className="row">
            {ob.steps.map((st) => (
              <a key={st.key} href={st.href} className={`badge ${st.done ? "ok" : ""}`}>
                {st.done ? "✓" : "○"} {st.label}
              </a>
            ))}
          </div>
        </section>
      )}
      {ov && (
        <>
          <section className="card row" style={{ justifyContent: "space-around" }} data-testid="totals">
            <Stat label="Sales today (all branches)" value={<Money v={ov.totals.sales} c={cur} />} />
            <Stat label="Bills paid today" value={ov.totals.orders} />
            <Stat label="Waiting in queues" value={ov.totals.waiting} />
            <Stat label="Open bills" value={<Money v={ov.totals.openValue} c={cur} />} />
          </section>
          <div className="grid wide" data-testid="branch-overview">
            {ov.branches.map((b) => (
              <section key={b.branchId} className="card">
                <div className="row between">
                  <h3 style={{ margin: 0 }}>{b.name}</h3>
                  <button className="btn small" onClick={() => (s.setBranch(b.branchId), (location.href = "/m/host"))}>
                    Open host stand
                  </button>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                  <Stat label="waiting" value={b.queue.waiting} />
                  <Stat label="occupancy" value={`${b.occupancy}%`} />
                  <Stat label="open bills" value={b.openOrders.count} />
                  <Stat label="sales today" value={<Money v={b.today.sales} c={b.currency} />} />
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {b.tables.seated}/{b.tables.total} tables seated · {b.tables.dirty} to clean · {b.today.covers} covers
                </div>
              </section>
            ))}
          </div>
          {trend.length > 0 && (
            <section className="card">
              <BarChart title="Sales, last 7 days (all branches)" data={trend} testId="trend-chart" />
            </section>
          )}
        </>
      )}
      {ins && (
        <section className="card" data-testid="insights">
          <h2>✨ Insights for {s.branch?.name}</h2>
          {ins.narrative ? <p style={{ whiteSpace: "pre-wrap" }}>{ins.narrative}</p> : (
            <ul>
              {ins.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
