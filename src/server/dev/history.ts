// Trading history for the demo restaurant (dev seed with ?history=1): two weeks of lunch and dinner
// services, so the dashboard, reports and wait-time estimates look like a real, busy place.
//
// What it models, per branch and service:
// - volume by weekday (Friday and Saturday dinners run ~1.5×, Mondays are quiet; Bangsar is smaller)
// - arrivals peaking around 12:30 and 19:30
// - at the peak the floor is full: guests join the queue, wait 15–35 minutes, and the longer the
//   wait the more of them walk away; a few called guests never come back (no-shows)
// - turn times by party size, a realistic dish mix (stars, plowhorses and a dog), mixed payments,
//   regulars who are loyalty members
// Rows go straight into the read models the reports use (orders, items, payments, tickets,
// seatings, turn observations). It is deterministic: the same restaurant gets the same history.
import { newId, zonedTime } from "../ids";
import { categoryFor } from "../../shared/categories";
import { priceOrder } from "../domain/orders";
import type { BranchCtx } from "../domain/context";

type Item = { id: string; name: string; price: number; station: string; category: string };
type Table = { id: string; seatsMax: number };

/** mulberry32: a small seeded random generator, so histories repeat exactly. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// how often each dish is ordered, relative to the others in its course
const POPULARITY: Record<string, number> = {
  "Char Kway Teow": 18,
  "Nasi Lemak Ayam Rempah": 16,
  "Penang Assam Laksa": 12,
  "Hainanese Chicken Rice": 12,
  "Curry Mee": 8,
  "Nasi Kerabu": 6,
  "Vegetarian Mee Goreng": 4,
  "Satay (6 sticks)": 10,
  Rojak: 4,
  "Garden Salad": 1,
  Cendol: 6,
  "Ais Kacang": 4,
  "Teh Tarik": 14,
  "Kopi O": 6,
  "Fresh Lime Juice": 6,
  "Iced Barley": 4,
};

const COURSE = (it: Item) => {
  const c = it.category.toLowerCase();
  if (c.includes("drink")) return "drink";
  if (c.includes("dessert")) return "dessert";
  if (c.includes("side")) return "side";
  return "main";
};

const REGULARS = ["Aisha Rahman", "Ravi Kumar", "Siew Ling Tan", "Daniel Lee", "Priya Nair", "Hafiz Ismail", "Jia Hui Ong", "Marcus Wong", "Farah Aziz", "Kevin Lim", "Nurul Huda", "Arjun Menon", "Mei Ling Chua", "Jason Yap", "Sofia Hassan", "Wei Jie Koh", "Lakshmi Devi", "Amir Hamzah", "Grace Teoh", "Hannah Chong"];

export async function seedHistory(db: D1Database, input: { tenantId: string; branches: { ctx: BranchCtx; tables: Table[]; scale: number }[]; items: Item[]; days?: number; now?: number }) {
  const now = input.now ?? Date.now();
  const days = input.days ?? 14;
  const rand = rng([...input.tenantId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const gauss = (mu: number, sd: number) => mu + sd * Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const weighted = (xs: Item[]) => {
    const total = xs.reduce((s, x) => s + (POPULARITY[x.name] ?? 2), 0);
    let r = rand() * total;
    for (const x of xs) if ((r -= POPULARITY[x.name] ?? 2) <= 0) return x;
    return xs[xs.length - 1];
  };
  const byCourse = (k: string) => input.items.filter((i) => COURSE(i) === k);
  const mains = byCourse("main"), sides = byCourse("side"), desserts = byCourse("dessert"), drinks = byCourse("drink");
  const partySize = () => {
    const r = rand();
    return r < 0.12 ? 1 : r < 0.55 ? 2 : r < 0.68 ? 3 : r < 0.86 ? 4 : r < 0.95 ? 5 + Math.floor(rand() * 2) : 7 + Math.floor(rand() * 4);
  };
  const turnMinutes = (n: number) => Math.max(20, gauss(n <= 2 ? 42 : n <= 4 ? 55 : n <= 8 ? 70 : 88, n <= 2 ? 9 : 12));

  // loyalty members: regulars with visits, spend and points
  const members = REGULARS.map((name, i) => ({ id: newId("mb_"), name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, visits: 0, spend: 0, last: 0, i }));

  const stmts: D1PreparedStatement[] = [];
  const run = (sql: string, ...args: unknown[]) => stmts.push(db.prepare(sql).bind(...args));

  for (const { ctx, tables, scale } of input.branches) {
    const tz = ctx.config.timezone;
    for (let back = days; back >= 0; back--) {
      const dayDate = new Date(now - back * 86_400_000);
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(dayDate);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
      let orderNo = 0;
      const seq: Record<string, number> = {};
      for (const [service, open, peak, close, base] of [
        ["lunch", 11.5, 12.5, 14.5, 26],
        ["dinner", 18, 19.5, weekday === 5 || weekday === 6 ? 22.25 : 21.75, 38],
      ] as const) {
        const startAt = zonedTime(day, Math.floor(open), Math.round((open % 1) * 60), tz);
        // today only has its finished lunch; tonight is played live
        if (back === 0 && (service === "dinner" || now < zonedTime(day, 15, 0, tz))) continue;
        const busy = (service === "dinner" ? [0.85, 0.8, 0.9, 0.95, 1.1, 1.5, 1.6] : [1.25, 0.75, 0.85, 0.85, 0.9, 1.05, 1.2])[weekday];
        const bills = Math.round(base * busy * scale * (0.9 + rand() * 0.2));
        for (let b = 0; b < bills; b++) {
          // arrivals on a triangle from opening, peaking at `peak`, to last seating 45 min before close
          const last = close - 0.75, u = rand();
          const hour = u < (peak - open) / (last - open) ? open + Math.sqrt(u * (last - open) * (peak - open)) : last - Math.sqrt((1 - u) * (last - open) * (last - peak));
          const arrived = startAt + Math.round((hour - open) * 3_600_000) + Math.floor(rand() * 60_000);
          const party = partySize();
          const cat = categoryFor(ctx.config.categories, party) ?? ctx.config.categories[0];
          // at the peak the floor is full: the queue's wait grows with how busy the service is
          const peakness = Math.max(0, 1 - Math.abs(hour - peak) / 1.1) * busy;
          const queued = peakness > 0.35 || rand() < 0.2;
          const wait = queued ? Math.max(2, gauss(6 + 24 * peakness, 6)) : 0;
          let ticketId: string | null = null;
          if (queued) {
            seq[cat.code] = (seq[cat.code] ?? 0) + 1;
            ticketId = newId("tk_");
            const walkAway = rand() < Math.min(0.4, Math.max(0, (wait - 12) / 55));
            const noShow = !walkAway && rand() < 0.025;
            const status = walkAway ? "cancelled" : noShow ? "no_show" : "seated";
            const called = walkAway ? null : arrived + Math.round((wait - 1.5) * 60_000);
            const seated = status === "seated" ? arrived + Math.round(wait * 60_000) : null;
            run(
              `INSERT INTO tickets (id, branch_id, day, category, seq, number, party_size, name, locale, status, created_at, called_at, seated_at, ended_at, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en', ?, ?, ?, ?, ?, 'qr')`,
              ticketId, ctx.branch.id, day, cat.code, seq[cat.code], `${cat.prefix}${String(seq[cat.code]).padStart(3, "0")}`, party, pick(REGULARS).split(" ")[0], status, arrived, called, seated,
              walkAway ? arrived + Math.round(wait * 60_000) : null,
            );
            if (status !== "seated") continue;
          }
          const seatedAt = arrived + Math.round(wait * 60_000);
          const turn = turnMinutes(party);
          const endedAt = seatedAt + Math.round(turn * 60_000);
          // the dishes: a main each, drinks for most, a few sides and desserts to share
          const lines = new Map<Item, number>();
          const add = (it: Item | undefined) => it && lines.set(it, (lines.get(it) ?? 0) + 1);
          for (let p = 0; p < party; p++) {
            add(weighted(mains));
            if (rand() < 0.8) add(weighted(drinks));
            if (rand() < 0.3) add(weighted(sides));
            if (rand() < 0.28) add(weighted(desserts));
          }
          const member = rand() < 0.22 ? pick(members) : null;
          const promo = member && rand() < 0.15;
          const t = priceOrder(ctx, "dine_in", [...lines].map(([it, qty]) => ({ unitPrice: it.price, qty, modifiers: [] })), promo ? { kind: "percent", value: 10 } : null);
          const orderId = newId("or_");
          const seatingId = newId("st_");
          const table = tables.filter((x) => x.seatsMax >= party).sort((a, z) => a.seatsMax - z.seatsMax)[0] ?? tables[tables.length - 1];
          orderNo++;
          run(
            `INSERT INTO orders (id, branch_id, tenant_id, number, type, status, seating_id, ticket_id, member_id, subtotal, discount_amount, service_charge, tax, rounding, total, paid, covers, created_at, closed_at, day)
             VALUES (?, ?, ?, ?, 'dine_in', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            orderId, ctx.branch.id, input.tenantId, String(orderNo).padStart(4, "0"), seatingId, ticketId, member?.id ?? null, t.subtotal, t.discount, t.serviceCharge, t.tax, t.rounding, t.total, t.total, party, seatedAt, endedAt, day,
          );
          for (const [it, qty] of lines)
            run(
              `INSERT INTO order_items (id, order_id, branch_id, round, item_id, name, category, unit_price, qty, status, station, created_at, fired_at, ready_at)
               VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'served', ?, ?, ?, ?)`,
              newId("oi_"), orderId, ctx.branch.id, it.id, it.name, it.category, it.price, qty, it.station, seatedAt + 120_000, seatedAt + 120_000, seatedAt + Math.round(gauss(13, 3) * 60_000),
            );
          const r = rand();
          const method = r < 0.5 ? "card" : r < 0.75 ? "ewallet" : "cash";
          const tendered = method === "cash" ? Math.ceil(t.total / 5000) * 5000 : null;
          run(
            `INSERT INTO payments (id, order_id, branch_id, method, amount, tendered, change, status, created_at, day) VALUES (?, ?, ?, ?, ?, ?, ?, 'captured', ?, ?)`,
            newId("pm_"), orderId, ctx.branch.id, method, t.total, tendered, tendered ? tendered - t.total : 0, endedAt, day,
          );
          run(
            `INSERT INTO seatings (id, branch_id, table_ids, party_size, ticket_id, session_id, order_id, started_at, ended_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed')`,
            seatingId, ctx.branch.id, JSON.stringify([table.id]), party, ticketId, newId("ss_"), orderId, seatedAt, endedAt,
          );
          run("INSERT INTO turn_observations (branch_id, party_size, started_at, minutes) VALUES (?, ?, ?, ?)", ctx.branch.id, party, seatedAt, Math.round(turn * 10) / 10);
          if (member) {
            member.visits++;
            member.spend += t.total;
            member.last = Math.max(member.last, endedAt);
          }
        }
      }
    }
  }
  for (const m of members.filter((x) => x.visits)) {
    const points = Math.floor(m.spend / 100);
    run(
      `INSERT INTO members (id, tenant_id, email, name, points, lifetime_points, tier, opt_in, visits, total_spend, last_visit_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      m.id, input.tenantId, m.email, m.name, points, points, points >= 5000 ? "Gold" : points >= 1000 ? "Silver" : "Bronze", m.visits, m.spend, m.last, now - (40 + m.i) * 86_400_000,
    );
  }
  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200));
  return { rows: stmts.length };
}
