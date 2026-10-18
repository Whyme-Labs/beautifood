// Owner dashboard: every branch live, 7-day trend, setup progress and AI insights.
import { ArrowRight, Check, Circle, Sparkles, Store } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { BarChart } from "../../src/ui/charts";
import { ErrorBox, Money, Stat } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";

interface Overview {
  branches: { branchId: string; name: string; currency: string; queue: { waiting: number; called: number }; tables: { total: number; seated: number; free: number; dirty: number }; occupancy: number; openOrders: { count: number; value: number }; today: { orders: number; sales: number; covers: number } }[];
  totals: { waiting: number; sales: number; orders: number; openValue: number };
  trend: { day: string; branch_id: string; name: string; orders: number; sales: number }[];
}
interface Onboarding {
  progress: number;
  steps: { key: string; label: string; done: boolean; href: string }[];
  next: { key?: string; label: string; href: string } | null;
}
interface Insights {
  facts: string[];
  narrative: string | null;
  engine: string;
}

export default function Dashboard() {
  const s = useStaff();
  const { t, f } = useI18n();
  const cur = s.tenant?.currency ?? "MYR";
  const { data: ov, error } = usePoll(() => api<Overview>("/api/m/overview"), { interval: 5000 });
  const { data: ob } = usePoll(() => api<Onboarding>("/api/m/ai/onboarding"), { interval: 0 });
  const { data: ins } = usePoll(() => (s.branchId && s.can("report.view") ? api<Insights>(`/api/m/branches/${s.branchId}/insights`) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const stepLabel = (st: { key?: string; label: string }) => {
    const k = `staff.boss.setup.steps.${st.key}` as MessageKey;
    const v = t(k);
    return v === k ? st.label : v;
  };
  const days = [...new Set(ov?.trend.map((x) => x.day))].sort();
  const trend = days.map((d) => {
    const v = ov!.trend.filter((x) => x.day === d).reduce((a, x) => a + x.sales, 0);
    const ms = Date.parse(`${d}T12:00:00Z`);
    return { label: f.weekday(ms, "UTC"), long: f.date(ms, "UTC"), value: v, display: f.money(v, cur) };
  });
  const hour = new Date().getHours();
  const greet = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const first = s.user?.name.split(" ")[0] ?? "";
  return (
    <div className="col boss">
      <div className="page-head">
        <h1>{t(`staff.boss.greeting.${greet}`, { name: first })}</h1>
        {ov && <span className="muted">{t("staff.boss.allBranches", { count: ov.branches.length })}</span>}
      </div>
      <ErrorBox error={error} />
      {ob && ob.progress < 100 && (
        <section className="card boss-setup" data-testid="onboarding">
          <div className="row between">
            <h2 style={{ margin: 0 }}>{t("staff.boss.setup.title", { pct: ob.progress })}</h2>
            {ob.next && (
              <a className="btn primary small" href={ob.next.href}>
                {t("staff.boss.setup.next", { step: stepLabel(ob.next) })}
                <ArrowRight size={15} />
              </a>
            )}
          </div>
          <div className="meter" role="progressbar" aria-label={t("staff.boss.setup.progress")} aria-valuenow={ob.progress} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${ob.progress}%` }} />
          </div>
          <div className="row">
            {ob.steps.map((st) => (
              <a key={st.key} href={st.href} className={`badge ${st.done ? "ok" : ""}`}>
                {st.done ? <Check /> : <Circle />} {stepLabel(st)}
              </a>
            ))}
          </div>
        </section>
      )}
      {ov && (
        <>
          <section className="card stats boss-totals" data-testid="totals">
            <Stat label={t("staff.boss.totals.sales")} value={<Money v={ov.totals.sales} c={cur} />} />
            <Stat label={t("staff.boss.totals.bills")} value={f.number(ov.totals.orders)} />
            <Stat label={t("staff.boss.totals.waiting")} value={f.number(ov.totals.waiting)} />
            <Stat label={t("staff.boss.totals.open")} value={<Money v={ov.totals.openValue} c={cur} />} />
          </section>
          <div className="grid wide" data-testid="branch-overview">
            {ov.branches.map((b) => (
              <section key={b.branchId} className="card boss-branch">
                <div className="row between nowrap">
                  <h3 className="row nowrap" style={{ margin: 0, minWidth: 0 }}>
                    <Store size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="boss-name">{b.name}</span>
                  </h3>
                  <button className="btn small" onClick={() => (s.setBranch(b.branchId), (location.href = "/m/host"))}>
                    {t("staff.boss.branch.openHost")}
                  </button>
                </div>
                <div className="stats">
                  <Stat label={t("staff.boss.branch.waiting")} value={f.number(b.queue.waiting)} />
                  <Stat label={t("staff.boss.branch.occupancy")} value={`${b.occupancy}%`} />
                  <Stat label={t("staff.boss.branch.openBills")} value={f.number(b.openOrders.count)} />
                  <Stat label={t("staff.boss.branch.sales")} value={<Money v={b.today.sales} c={b.currency} />} />
                </div>
                <div className="meter" aria-hidden="true">
                  <div style={{ width: `${Math.min(100, b.occupancy)}%` }} />
                </div>
                <div className="muted boss-foot">
                  {[
                    t("staff.boss.branch.seated", { seated: b.tables.seated, total: b.tables.total }),
                    t("staff.boss.branch.dirty", { count: b.tables.dirty }),
                    t("staff.boss.branch.covers", { count: b.today.covers }),
                    b.queue.called ? t("staff.boss.branch.calling", { count: b.queue.called }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </section>
            ))}
          </div>
          {trend.length > 0 && (
            <section className="card">
              <BarChart title={t("staff.boss.trend")} data={trend} testId="trend-chart" tick={(v) => f.number(Math.round(v / 100))} />
            </section>
          )}
        </>
      )}
      {ins && (
        <section className="card boss-insights" data-testid="insights">
          <div className="row between">
            <h2 className="row nowrap" style={{ margin: 0 }}>
              <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />
              {t("staff.boss.insights.title", { branch: s.branch?.name ?? "" })}
            </h2>
            <span className={`badge ${ins.engine === "claude" ? "brand" : ""}`}>{ins.engine === "claude" ? t("staff.boss.insights.engineAi") : t("staff.boss.insights.engineLocal")}</span>
          </div>
          {ins.narrative ? (
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{ins.narrative}</p>
          ) : (
            <ul>
              {ins.facts.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
