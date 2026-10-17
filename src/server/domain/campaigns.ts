// Promotional broadcasts to opted-in loyalty members, fanned out through a Queue.
import { fail, notFound } from "../errors";
import { newId } from "../ids";
import { Tx } from "../tx";
import { streams } from "./context";

export interface Segment {
  type: "all" | "tier" | "inactive" | "branch" | "top";
  tier?: string;
  days?: number;
  branchId?: string;
  limit?: number;
}

export interface Recipient {
  memberId: string;
  email: string;
  name: string;
}

export async function recipients(db: D1Database, tenantId: string, seg: Segment): Promise<Recipient[]> {
  let sql = "SELECT id, email, name FROM members m WHERE tenant_id = ? AND opt_in = 1";
  const params: unknown[] = [tenantId];
  if (seg.type === "tier") {
    sql += " AND tier = ?";
    params.push(seg.tier ?? "Gold");
  } else if (seg.type === "inactive") {
    sql += " AND (last_visit_at IS NULL OR last_visit_at < ?)";
    params.push(Date.now() - (seg.days ?? 30) * 86_400_000);
  } else if (seg.type === "branch") {
    sql += " AND EXISTS (SELECT 1 FROM orders o WHERE o.member_id = m.id AND o.branch_id = ?)";
    params.push(seg.branchId ?? "");
  }
  sql += seg.type === "top" ? " ORDER BY total_spend DESC LIMIT ?" : " ORDER BY created_at LIMIT ?";
  params.push(Math.min(seg.limit ?? 50_000, 50_000));
  return (await db.prepare(sql).bind(...params).all<{ id: string; email: string; name: string }>()).results.map((r) => ({ memberId: r.id, email: r.email, name: r.name }));
}

export interface CampaignInput {
  name: string;
  subject: string;
  body: string;
  segment: Segment;
  promoCode?: string | null;
}

export async function createCampaign(db: D1Database, tenantId: string, actor: string, c: CampaignInput) {
  const id = newId("cp_");
  await new Tx(db, { tenantId, actor })
    .run(
      "INSERT INTO campaigns (id, tenant_id, name, subject, body, segment, promo_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)",
      id,
      tenantId,
      c.name,
      c.subject,
      c.body,
      JSON.stringify(c.segment),
      c.promoCode ?? null,
      Date.now(),
    )
    .event({ stream: streams.tenant(tenantId), type: "campaign.created", data: { id, name: c.name } })
    .commit();
  return id;
}

export interface BroadcastMessage {
  tenantId: string;
  campaignId: string;
  recipients: Recipient[];
}

/** Mark a campaign as sending (exactly once) and return its recipient batches for the queue. */
export async function startCampaign(db: D1Database, tenantId: string, actor: string, campaignId: string, batchSize = 50): Promise<BroadcastMessage[]> {
  const c = await db.prepare("SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?").bind(campaignId, tenantId).first<{ segment: string; status: string }>();
  if (!c) notFound("Campaign");
  if (c.status !== "draft") fail(409, "already_sent", "This campaign was already sent");
  const list = await recipients(db, tenantId, JSON.parse(c.segment));
  await new Tx(db, { tenantId, actor })
    .assert("EXISTS (SELECT 1 FROM campaigns WHERE id = ? AND status = 'draft')", [campaignId], 409, "already_sent", "This campaign was already sent")
    .run("UPDATE campaigns SET status = 'sending', recipients = ?, sent_at = ? WHERE id = ?", list.length, Date.now(), campaignId)
    .event({ stream: streams.tenant(tenantId), type: "campaign.started", data: { id: campaignId, recipients: list.length } })
    .commit();
  const batches: BroadcastMessage[] = [];
  for (let i = 0; i < list.length; i += batchSize) batches.push({ tenantId, campaignId, recipients: list.slice(i, i + batchSize) });
  if (!batches.length) await db.prepare("UPDATE campaigns SET status = 'sent' WHERE id = ?").bind(campaignId).run();
  return batches;
}

export async function listCampaigns(db: D1Database, tenantId: string) {
  return (await db.prepare("SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100").bind(tenantId).all()).results;
}
