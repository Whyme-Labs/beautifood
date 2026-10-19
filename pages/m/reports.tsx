// End-of-day (Z) report: sales, payment mix, hourly sales, best sellers with menu engineering, queue and table KPIs.
import { useState } from "react";
import { Printer } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { BarChart } from "../../src/ui/charts";
import { Empty, ErrorBox, Money, Stat } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import { localName } from "../../src/shared/menuI18n";
import type { Menu } from "../../src/shared/types";

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

const CLASS_TONE: Record<string, string> = { star: "brand", plowhorse: "info", puzzle: "warn", dog: "" };

export default function Reports() {
  const s = useStaff();
  const b = useBranchApi();
  const { t, f, locale } = useI18n();
  // dish names in the reader's language (the kitchen does the same)
  const { data: menu } = usePoll(() => api<Menu>("/api/m/menu"), { interval: 0, deps: [s.tenant?.id] });
  const tz = s.branch?.config.timezone ?? "Asia/Kuala_Lumpur";
  const [day, setDay] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()));
  const { data: r, error } = usePoll(() => (s.branchId ? api<Report>(b(`report?day=${day}`)) : Promise.resolve(null)), { interval: 30_000, deps: [s.branchId, day] });
  const cur = r?.currency ?? "MYR";
  const tr = (key: string, fallback: string) => {
    const v = t(key as MessageKey);
    return v === key ? fallback : v;
  };
  const dayMs = Date.parse(`${day}T12:00:00Z`);
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.boss.reports.title", { branch: s.branch?.name ?? "" })}</h1>
          {!Number.isNaN(dayMs) && <div className="muted">{f.date(dayMs, "UTC")}</div>}
        </div>
        <div className="row no-print">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: "auto" }} aria-label={t("staff.boss.reports.day")} />
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} /> {t("staff.boss.reports.print")}
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {r && (
        <>
          <section className="card stats boss-totals" data-testid="report-sales">
            <Stat label={t("staff.boss.reports.gross")} value={<Money v={r.sales.gross} c={cur} />} />
            <Stat label={t("staff.boss.reports.net")} value={<Money v={r.sales.net} c={cur} />} />
            <Stat label={t("staff.boss.reports.bills")} value={f.number(r.sales.orders)} />
            <Stat label={t("staff.boss.reports.averageCheck")} value={<Money v={r.sales.averageCheck} c={cur} />} />
            <Stat label={t("staff.boss.reports.covers")} value={f.number(r.sales.covers)} />
          </section>
          <div className="split">
            <section className="card">
              <BarChart
                title={t("staff.boss.reports.hourly")}
                data={r.hourly.map((h) => ({
                  label: f.time(Date.UTC(2000, 0, 1, h.hour), "UTC"),
                  value: h.sales,
                  display: t("staff.boss.reports.hourlyValue", { money: f.money(h.sales, cur), count: h.orders }),
                }))}
                tick={(v) => f.number(Math.round(v / 100))}
                testId="hourly-chart"
              />
            </section>
            <section className="card">
              <h3>{t("staff.boss.reports.takings")}</h3>
              <table>
                <thead>
                  <tr>
                    <th>{t("staff.boss.reports.method")}</th>
                    <th className="num">{t("staff.boss.reports.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.payments.map((p) => (
                    <tr key={p.method}>
                      <td>{t("staff.boss.reports.methodCount", { method: tr(`payMethod.${p.method}`, p.method), count: p.count })}</td>
                      <td className="num"><Money v={p.amount - p.refunded} c={cur} /></td>
                    </tr>
                  ))}
                  <tr><td>{t("staff.boss.reports.discounts")}</td><td className="num"><Money v={r.sales.discounts} c={cur} /></td></tr>
                  <tr><td>{t("common.serviceCharge")}</td><td className="num"><Money v={r.sales.serviceCharge} c={cur} /></td></tr>
                  <tr><td>{t("common.tax")}</td><td className="num"><Money v={r.sales.tax} c={cur} /></td></tr>
                  <tr><td>{t("staff.boss.reports.refunds")}</td><td className="num"><Money v={r.sales.refunds} c={cur} /></td></tr>
                  <tr><td>{t("staff.boss.reports.stillOpenLabel")}</td><td className="num">{t("staff.boss.reports.stillOpen", { count: r.sales.openOrders, money: f.money(r.sales.openValue, cur) })}</td></tr>
                </tbody>
              </table>
            </section>
          </div>
          <div className="split">
            <section className="card">
              <h3>{t("staff.boss.reports.queueTables")}</h3>
              <div className="stats report-kpis" data-testid="report-queue">
                <Stat label={t("staff.boss.reports.joined")} value={r.queue.joined} />
                <Stat label={t("staff.boss.reports.seated")} value={r.queue.seated} />
                <Stat label={t("staff.boss.reports.walkedAway")} value={r.queue.cancelled + r.queue.noShows} />
                <Stat label={t("staff.boss.reports.avgWait")} value={r.queue.avgWaitMinutes} />
                <Stat label={t("staff.boss.reports.p90Wait")} value={r.queue.p90WaitMinutes} />
                <Stat label={t("staff.boss.reports.turns")} value={r.tables.turns} />
                <Stat label={t("staff.boss.reports.avgTurn")} value={r.tables.avgTurnMinutes} />
              </div>
            </section>
            <section className="card">
              <h3>{t("staff.boss.reports.bestSellers")}</h3>
              {r.items.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>{t("staff.boss.reports.dish")}</th>
                      <th className="num">{t("staff.boss.reports.qty")}</th>
                      <th className="num">{t("staff.boss.reports.revenue")}</th>
                      <th>{t("staff.boss.reports.class")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.slice(0, 10).map((i) => (
                      <tr key={i.item_id}>
                        <td>{localName(menu, i.item_id, i.name, locale)}</td>
                        <td className="num">{f.number(i.qty)}</td>
                        <td className="num"><Money v={i.revenue} c={cur} /></td>
                        <td>
                          {i.class && (
                            <span className={`badge ${CLASS_TONE[i.class] ?? ""}`} title={tr(`staff.boss.reports.classHint.${i.class}`, "")}>
                              {tr(`staff.boss.reports.classes.${i.class}`, i.class)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty>{t("staff.boss.reports.noSales")}</Empty>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
