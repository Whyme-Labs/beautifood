// Loyalty members, points accrual (idempotent per order) and tiers.
import { notFound } from "../errors";
import { newId } from "../ids";
import { Tx } from "../tx";
import { loyaltyConfig, streams, type TenantRow } from "./context";

export interface MemberRow {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  phone: string | null;
  points: number;
  lifetime_points: number;
  tier: string;
  opt_in: number;
  visits: number;
  total_spend: number;
  last_visit_at: number | null;
  created_at: number;
}

export const toMember = (m: MemberRow) => ({
  id: m.id,
  email: m.email,
  name: m.name,
  phone: m.phone,
  points: m.points,
  lifetimePoints: m.lifetime_points,
  tier: m.tier,
  optIn: !!m.opt_in,
  visits: m.visits,
  totalSpend: m.total_spend,
  lastVisitAt: m.last_visit_at,
  createdAt: m.created_at,
});

/** Find or create a member by email (members are per restaurant brand). */
export async function ensureMember(db: D1Database, tenantId: string, email: string, info: { name?: string; phone?: string | null; optIn?: boolean } = {}) {
  const e = email.trim().toLowerCase();
  await db
    .prepare(
      `INSERT INTO members (id, tenant_id, email, name, phone, opt_in, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, email) DO UPDATE SET name = CASE WHEN members.name = '' THEN excluded.name ELSE members.name END,
         phone = COALESCE(members.phone, excluded.phone)`,
    )
    .bind(newId("mb_"), tenantId, e, info.name ?? "", info.phone ?? null, info.optIn === false ? 0 : 1, Date.now())
    .run();
  return (await db.prepare("SELECT * FROM members WHERE tenant_id = ? AND email = ?").bind(tenantId, e).first<MemberRow>())!;
}

export async function getMember(db: D1Database, tenantId: string, id: string) {
  return (await db.prepare("SELECT * FROM members WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<MemberRow>()) ?? notFound("Member");
}

export function tierFor(tenant: Pick<TenantRow, "loyalty">, lifetime: number) {
  const tiers = [...loyaltyConfig(tenant).tiers].sort((a, b) => b.minLifetime - a.minLifetime);
  return tiers.find((t) => lifetime >= t.minLifetime) ?? tiers[tiers.length - 1];
}

/**
 * Credit points for a settled bill. Exactly-once per (member, order) via the
 * ledger's unique key, so the at-least-once event pipeline can retry freely.
 */
export async function earnForOrder(db: D1Database, tenant: TenantRow, memberId: string, orderId: string, spend: number, branchId: string | null) {
  const cfg = loyaltyConfig(tenant);
  if (!cfg.enabled) return { points: 0, skipped: true };
  const m = await getMember(db, tenant.id, memberId);
  const multiplier = tierFor(tenant, m.lifetime_points).multiplier;
  const points = Math.floor((spend / 100) * cfg.earnPerUnit * multiplier);
  const already = await db.prepare("SELECT 1 FROM points_ledger WHERE member_id = ? AND kind = 'earn' AND ref = ?").bind(memberId, orderId).first();
  if (already) return { points: 0, duplicate: true };
  const newTier = tierFor(tenant, m.lifetime_points + points).name;
  const tx = new Tx(db, { tenantId: tenant.id, branchId, actor: "loyalty" });
  tx.run("INSERT INTO points_ledger (id, member_id, tenant_id, delta, kind, ref, created_at) VALUES (?, ?, ?, ?, 'earn', ?, ?)", newId("pl_"), memberId, tenant.id, points, orderId, tx.at);
  tx.run(
    "UPDATE members SET points = points + ?, lifetime_points = lifetime_points + ?, tier = ?, visits = visits + 1, total_spend = total_spend + ?, last_visit_at = ?, version = version + 1 WHERE id = ?",
    points,
    points,
    newTier,
    spend,
    tx.at,
    memberId,
  );
  tx.event({ stream: streams.member(memberId), type: "points.earned", data: { points, orderId, tier: newTier } });
  try {
    await tx.commit();
  } catch (e) {
    if (String((e as Error).message).includes("conflict")) return { points: 0, duplicate: true };
    throw e;
  }
  return { points, tier: newTier };
}

export async function adjustPoints(db: D1Database, tenantId: string, actor: string, memberId: string, delta: number, reason: string) {
  await new Tx(db, { tenantId, actor })
    .run("UPDATE members SET points = points + ?, version = version + 1 WHERE id = ? AND tenant_id = ?", delta, memberId, tenantId)
    .run("INSERT INTO points_ledger (id, member_id, tenant_id, delta, kind, ref, created_at) VALUES (?, ?, ?, ?, 'adjust', ?, ?)", newId("pl_"), memberId, tenantId, delta, `${reason}:${newId()}`, Date.now())
    .event({ stream: streams.member(memberId), type: "points.adjusted", data: { delta, reason } })
    .commit();
}

export async function memberHistory(db: D1Database, memberId: string) {
  const [ledger, orders] = await db.batch([
    db.prepare("SELECT delta, kind, ref, created_at FROM points_ledger WHERE member_id = ? ORDER BY created_at DESC LIMIT 50").bind(memberId),
    db
      .prepare(
        "SELECT o.id, o.number, o.total, o.closed_at, o.receipt_token, b.name AS branch FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.member_id = ? AND o.status IN ('paid','refunded','partially_refunded') ORDER BY o.closed_at DESC LIMIT 30",
      )
      .bind(memberId),
  ]);
  return { ledger: ledger.results, orders: orders.results };
}
