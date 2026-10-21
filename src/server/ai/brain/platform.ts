// The platform's pairing table: which dish concepts guests order together across every restaurant.
// Rebuilt daily (crons/daily.ts) from the last 90 days of orders. Only aggregates leave a
// restaurant: a concept or pair is stored once at least MIN_TENANTS restaurants and MIN_ORDERS
// orders back it, so no single restaurant's sales can be read back from the table.
import { conceptsOf, type ConceptId, type PlatformPairs } from "./concepts";

export const MIN_TENANTS = 3;
export const MIN_ORDERS = 20;

export interface OrderLine {
  orderId: string;
  tenantId: string;
  name: string;
  category: string;
  description: string;
}

interface Tally {
  orders: number;
  tenants: Set<string>;
}

export interface ConceptTable {
  totalOrders: number;
  concepts: { concept: ConceptId; orders: number; tenants: number }[];
  pairs: { a: ConceptId; b: ConceptId; orders: number; tenants: number }[];
}

/** Count concepts and concept pairs per order, then keep only what enough restaurants share. */
export function aggregateConcepts(lines: OrderLine[]): ConceptTable {
  const orders = new Map<string, { tenantId: string; concepts: Set<ConceptId> }>();
  const memo = new Map<string, ConceptId[]>();
  for (const l of lines) {
    const key = `${l.name}\u0000${l.category}\u0000${l.description}`;
    let cs = memo.get(key);
    if (!cs) memo.set(key, (cs = conceptsOf({ name: l.name, category: l.category, description: l.description })));
    let o = orders.get(l.orderId);
    if (!o) orders.set(l.orderId, (o = { tenantId: l.tenantId, concepts: new Set() }));
    for (const c of cs) o.concepts.add(c);
  }
  const single = new Map<ConceptId, Tally>();
  const pair = new Map<string, Tally>();
  const bump = (m: Map<string, Tally>, k: string, tenant: string) => {
    let t = m.get(k);
    if (!t) m.set(k, (t = { orders: 0, tenants: new Set() }));
    t.orders++;
    t.tenants.add(tenant);
  };
  for (const o of orders.values()) {
    const cs = [...o.concepts].sort();
    for (const c of cs) bump(single, c, o.tenantId);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) bump(pair, `${cs[i]}|${cs[j]}`, o.tenantId);
  }
  // with too few restaurants on the platform, even the total would describe one of them
  const restaurants = new Set([...orders.values()].map((o) => o.tenantId)).size;
  const shared = (t: Tally) => t.tenants.size >= MIN_TENANTS && t.orders >= MIN_ORDERS;
  return {
    totalOrders: restaurants >= MIN_TENANTS ? orders.size : 0,
    concepts: [...single].filter(([, t]) => shared(t)).map(([concept, t]) => ({ concept, orders: t.orders, tenants: t.tenants.size })),
    pairs: [...pair].filter(([, t]) => shared(t)).map(([k, t]) => {
      const [a, b] = k.split("|");
      return { a, b, orders: t.orders, tenants: t.tenants.size };
    }),
  };
}

/** Rebuild the table from the last 90 days of orders (paged, up to 200,000 order lines). */
export async function rebuildConceptPairs(db: D1Database, now = Date.now()) {
  const since = now - 90 * 86_400_000;
  const lines: OrderLine[] = [];
  let cursor = "";
  for (let page = 0; page < 40; page++) {
    const rows = (
      await db
        .prepare(
          `SELECT oi.id, oi.order_id, b.tenant_id, oi.name, oi.category, COALESCE(mi.description, '') AS description
           FROM order_items oi JOIN branches b ON b.id = oi.branch_id LEFT JOIN menu_items mi ON mi.id = oi.item_id
           WHERE oi.created_at > ? AND oi.status <> 'void' AND oi.id > ? ORDER BY oi.id LIMIT 5000`,
        )
        .bind(since, cursor)
        .all<{ id: string; order_id: string; tenant_id: string; name: string; category: string; description: string }>()
    ).results;
    for (const r of rows) lines.push({ orderId: r.order_id, tenantId: r.tenant_id, name: r.name, category: r.category, description: r.description });
    if (rows.length < 5000) break;
    cursor = rows[rows.length - 1].id;
  }
  const t = aggregateConcepts(lines);
  const at = now;
  await db.batch([
    db.prepare("DELETE FROM concept_orders"),
    db.prepare("DELETE FROM concept_pairs"),
    db.prepare("INSERT INTO concept_orders (concept, orders, tenants, updated_at) VALUES ('*', ?, 0, ?)").bind(t.totalOrders, at),
    ...t.concepts.map((c) => db.prepare("INSERT INTO concept_orders (concept, orders, tenants, updated_at) VALUES (?, ?, ?, ?)").bind(c.concept, c.orders, c.tenants, at)),
    ...t.pairs.map((p) => db.prepare("INSERT INTO concept_pairs (a, b, orders, tenants) VALUES (?, ?, ?, ?)").bind(p.a, p.b, p.orders, p.tenants)),
  ]);
  return { orders: t.totalOrders, concepts: t.concepts.length, pairs: t.pairs.length };
}

let cache: { at: number; value: PlatformPairs } | null = null;

/** The pairing table, per isolate for an hour (it changes once a day). */
export async function platformPairs(db: D1Database): Promise<PlatformPairs> {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.value;
  const [orders, pairs] = await db.batch([db.prepare("SELECT concept, orders FROM concept_orders"), db.prepare("SELECT a, b, orders FROM concept_pairs")]);
  const value: PlatformPairs = { totalOrders: 0, orders: {}, pairs: {} };
  for (const r of orders.results as { concept: string; orders: number }[]) {
    if (r.concept === "*") value.totalOrders = r.orders;
    else value.orders[r.concept] = r.orders;
  }
  for (const r of pairs.results as { a: string; b: string; orders: number }[]) value.pairs[`${r.a}|${r.b}`] = value.pairs[`${r.b}|${r.a}`] = r.orders;
  cache = { at: Date.now(), value };
  return value;
}
