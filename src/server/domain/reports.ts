// Reporting: branch end-of-day (Z) report, live cross-branch overview for owners.
import { localParts } from "../ids";
import { getBranch, type BranchCtx } from "./context";

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

export async function branchReport(db: D1Database, ctx: BranchCtx, day: string) {
  const b = ctx.branch.id;
  const [orders, pays, items, tickets, seatings] = await db.batch([
    db.prepare("SELECT id, type, status, total, paid, refunded, discount_amount, service_charge, tax, covers, closed_at, created_at FROM orders WHERE branch_id = ? AND day = ? AND status <> 'merged'").bind(b, day),
    db.prepare("SELECT method, SUM(amount) AS amount, SUM(refunded) AS refunded, COUNT(*) AS n FROM payments WHERE branch_id = ? AND day = ? GROUP BY method").bind(b, day),
    db
      .prepare(
        `SELECT i.item_id, i.name, i.category, SUM(i.qty) AS qty, SUM((i.unit_price + COALESCE((SELECT SUM(json_extract(m.value, '$.price')) FROM json_each(i.modifiers) m), 0)) * i.qty) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.branch_id = ? AND o.day = ? AND o.status IN ('paid','partially_refunded') AND i.status <> 'void' GROUP BY i.item_id ORDER BY qty DESC`,
      )
      .bind(b, day),
    db.prepare("SELECT category, party_size, status, created_at, seated_at, called_at FROM tickets WHERE branch_id = ? AND day = ?").bind(b, day),
    db.prepare("SELECT party_size, started_at, ended_at FROM seatings WHERE branch_id = ? AND status = 'closed' AND ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 500").bind(b),
  ]);
  type O = { id: string; type: string; status: string; total: number; paid: number; refunded: number; discount_amount: number; service_charge: number; tax: number; covers: number; closed_at: number | null };
  const os = orders.results as unknown as O[];
  const paid = os.filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.status));
  const gross = paid.reduce((s, o) => s + o.total, 0);
  const refunds = os.reduce((s, o) => s + o.refunded, 0);
  const hourly: Record<number, { orders: number; sales: number }> = {};
  for (const o of paid) {
    const h = localParts(o.closed_at ?? 0, ctx.config.timezone).hour;
    hourly[h] ??= { orders: 0, sales: 0 };
    hourly[h].orders++;
    hourly[h].sales += o.total;
  }
  type T = { category: string; party_size: number; status: string; created_at: number; seated_at: number | null };
  const ts = tickets.results as unknown as T[];
  const waits = ts.filter((t) => t.seated_at).map((t) => (t.seated_at! - t.created_at) / 60_000);
  const its = items.results as unknown as { item_id: string; name: string; category: string; qty: number; revenue: number }[];
  const avgQty = its.length ? its.reduce((s, i) => s + i.qty, 0) / its.length : 0;
  const avgRev = its.length ? its.reduce((s, i) => s + i.revenue, 0) / its.length : 0;
  type S = { party_size: number; started_at: number; ended_at: number };
  const ss = (seatings.results as unknown as S[]).filter((s) => localParts(s.ended_at, ctx.config.timezone).day === day);
  return {
    day,
    branch: { id: b, name: ctx.branch.name },
    currency: ctx.config.currency,
    sales: {
      orders: paid.length,
      gross,
      refunds,
      net: gross - refunds,
      discounts: paid.reduce((s, o) => s + o.discount_amount, 0),
      serviceCharge: paid.reduce((s, o) => s + o.service_charge, 0),
      tax: paid.reduce((s, o) => s + o.tax, 0),
      covers: paid.reduce((s, o) => s + o.covers, 0),
      averageCheck: paid.length ? Math.round(gross / paid.length) : 0,
      openOrders: os.filter((o) => o.status === "open").length,
      openValue: os.filter((o) => o.status === "open").reduce((s, o) => s + (o.total - o.paid), 0),
      byType: Object.entries(
        paid.reduce<Record<string, number>>((acc, o) => {
          acc[o.type] = (acc[o.type] ?? 0) + o.total;
          return acc;
        }, {}),
      ).map(([type, total]) => ({ type, total })),
    },
    payments: (pays.results as unknown as { method: string; amount: number; refunded: number; n: number }[]).map((p) => ({ method: p.method, amount: p.amount, refunded: p.refunded, count: p.n })),
    hourly: Object.entries(hourly)
      .map(([h, v]) => ({ hour: Number(h), ...v }))
      .sort((a, b) => a.hour - b.hour),
    items: its.slice(0, 50).map((i) => ({
      ...i,
      // menu engineering on popularity × revenue (no cost data): stars, plowhorses, puzzles, dogs
      class: i.qty >= avgQty ? (i.revenue >= avgRev ? "star" : "plowhorse") : i.revenue >= avgRev ? "puzzle" : "dog",
    })),
    queue: {
      joined: ts.length,
      seated: ts.filter((t) => t.status === "seated").length,
      cancelled: ts.filter((t) => t.status === "cancelled").length,
      noShows: ts.filter((t) => t.status === "no_show").length,
      waiting: ts.filter((t) => t.status === "waiting" || t.status === "called").length,
      avgWaitMinutes: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
      p90WaitMinutes: Math.round(pct(waits, 90)),
      byCategory: [...new Set(ts.map((t) => t.category))].map((c) => ({ category: c, joined: ts.filter((t) => t.category === c).length })),
    },
    tables: {
      turns: ss.length,
      avgTurnMinutes: ss.length ? Math.round(ss.reduce((s, x) => s + (x.ended_at - x.started_at) / 60_000, 0) / ss.length) : 0,
    },
  };
}

/** Live status of every branch the caller can see: the owner's "all branches" dashboard. */
export async function tenantOverview(db: D1Database, tenantId: string, branchIds: string[] | "*") {
  const all = (await db.prepare("SELECT id FROM branches WHERE tenant_id = ? AND active = 1 ORDER BY name").bind(tenantId).all<{ id: string }>()).results.map((b) => b.id);
  const ids = branchIds === "*" ? all : all.filter((b) => branchIds.includes(b));
  const rows = await Promise.all(
    ids.map(async (id) => {
      const ctx = await getBranch(db, id);
      const day = localParts(Date.now(), ctx.config.timezone).day;
      const [q, t, o, s] = await db.batch([
        db.prepare("SELECT status, COUNT(*) AS n FROM tickets WHERE branch_id = ? AND status IN ('waiting','called') GROUP BY status").bind(id),
        db.prepare("SELECT status, COUNT(*) AS n FROM floor_tables WHERE branch_id = ? AND active = 1 AND status <> 'split' GROUP BY status").bind(id),
        db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total - paid), 0) AS v FROM orders WHERE branch_id = ? AND status = 'open'").bind(id),
        db
          .prepare(
            "SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS v, COALESCE(SUM(covers), 0) AS c FROM orders WHERE branch_id = ? AND day = ? AND status IN ('paid','partially_refunded','refunded')",
          )
          .bind(id, day),
      ]);
      const count = (r: D1Result, status: string) => ((r.results as { status: string; n: number }[]).find((x) => x.status === status)?.n ?? 0) as number;
      const tablesTotal = (t.results as { n: number }[]).reduce((a, x) => a + x.n, 0);
      const sales = s.results[0] as { n: number; v: number; c: number };
      const open = o.results[0] as { n: number; v: number };
      return {
        branchId: id,
        name: ctx.branch.name,
        slug: ctx.branch.slug,
        currency: ctx.config.currency,
        queue: { waiting: count(q, "waiting"), called: count(q, "called") },
        tables: { total: tablesTotal, seated: count(t, "seated"), free: count(t, "free"), dirty: count(t, "dirty"), reserved: count(t, "reserved") },
        occupancy: tablesTotal ? Math.round((count(t, "seated") / tablesTotal) * 100) : 0,
        openOrders: { count: open.n, value: open.v },
        today: { orders: sales.n, sales: sales.v, covers: sales.c },
      };
    }),
  );
  return {
    branches: rows,
    totals: {
      waiting: rows.reduce((s, r) => s + r.queue.waiting, 0),
      sales: rows.reduce((s, r) => s + r.today.sales, 0),
      orders: rows.reduce((s, r) => s + r.today.orders, 0),
      openValue: rows.reduce((s, r) => s + r.openOrders.value, 0),
    },
  };
}

/** Cross-branch sales trend for the last N days (boss view). */
export async function tenantTrend(db: D1Database, tenantId: string, days: string[]) {
  if (!days.length) return [];
  const rows = (
    await db
      .prepare(
        `SELECT o.day, o.branch_id, b.name, COUNT(*) AS orders, SUM(o.total) AS sales FROM orders o JOIN branches b ON b.id = o.branch_id
         WHERE o.tenant_id = ? AND o.day IN (${days.map(() => "?").join(",")}) AND o.status IN ('paid','partially_refunded','refunded') GROUP BY o.day, o.branch_id`,
      )
      .bind(tenantId, ...days)
      .all<{ day: string; branch_id: string; name: string; orders: number; sales: number }>()
  ).results;
  return rows;
}
