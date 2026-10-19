// Printed-receipt design: the restaurant's default and per-branch overrides (receipt_settings).
// The till reads the design in force for its branch; settings managers change either level.
import { resolveReceipt, type ReceiptConfig } from "../../shared/receipt";
import { Tx } from "../tx";
import { streams, type BranchCtx } from "./context";

export type ReceiptScope = "restaurant" | "branch";

/** The restaurant's design, this branch's override (null when it prints the restaurant's), and the one in force. */
export async function receiptSettings(db: D1Database, tenantId: string, branchId: string) {
  const rows = (await db.prepare("SELECT branch_id, config FROM receipt_settings WHERE tenant_id = ? AND branch_id IN ('', ?)").bind(tenantId, branchId).all<{ branch_id: string; config: string }>()).results;
  const parse = (id: string) => {
    const r = rows.find((x) => x.branch_id === id);
    return r ? (JSON.parse(r.config || "{}") as Partial<ReceiptConfig>) : null;
  };
  const restaurant = parse("");
  const branch = parse(branchId);
  return { restaurant: resolveReceipt(restaurant), branch: branch ? resolveReceipt(restaurant, branch) : null, effective: resolveReceipt(restaurant, branch) };
}

/** Save a validated design for the whole restaurant or for this branch only; null drops the branch's override. */
export async function saveReceiptSettings(db: D1Database, ctx: BranchCtx, actor: string, scope: ReceiptScope, config: ReceiptConfig | null) {
  const branchId = scope === "branch" ? ctx.branch.id : "";
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  if (config)
    tx.run(
      "INSERT INTO receipt_settings (tenant_id, branch_id, config, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id, branch_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at",
      ctx.tenant.id,
      branchId,
      JSON.stringify(config),
      tx.at,
    );
  else tx.run("DELETE FROM receipt_settings WHERE tenant_id = ? AND branch_id = ?", ctx.tenant.id, branchId);
  tx.event({
    stream: scope === "branch" ? streams.branch(ctx.branch.id) : streams.tenant(ctx.tenant.id),
    type: config ? "receipt.updated" : "receipt.reset",
    data: { scope, template: config?.template ?? null, logo: !!config?.logo },
  });
  await tx.commit();
  return receiptSettings(db, ctx.tenant.id, ctx.branch.id);
}
