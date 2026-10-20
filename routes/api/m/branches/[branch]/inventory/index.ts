// Stock at this branch: GET every ingredient with on hand, low mark and status (and the dishes using
// it); POST a delivery or wastage (inventory.stock), or a correction or count (inventory.manage).
import { z } from "zod";
import { api, body, requirePerm } from "../../../../../../src/server/http";
import { actorOf, kick, staffBranch } from "../../../../../../src/server/routing";
import { branchStock, recordEntry, requireStockAccess } from "../../../../../../src/server/domain/inventory";
import { ENTRY_KINDS, MAX_QTY } from "../../../../../../src/shared/inventory";
import { can } from "../../../../../../src/shared/rbac";

export const GET = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, null);
  requireStockAccess(staff);
  return branchStock(c.env.DB, ctx);
});

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, null);
  const e = await body(
    c,
    z.object({
      ingredientId: z.string().max(40),
      kind: z.enum(ENTRY_KINDS),
      qty: z.number().min(-MAX_QTY).max(MAX_QTY),
      reason: z.string().max(120).optional(),
      cost: z.number().int().min(0).nullable().optional(),
    }),
  );
  // the kitchen records what came in and what was thrown away; corrections and counts are for managers
  if (e.kind === "received" || e.kind === "wastage") {
    if (!can(staff, "inventory.stock")) requirePerm(staff, "inventory.manage", ctx.branch.id);
  } else requirePerm(staff, "inventory.manage", ctx.branch.id);
  const r = await recordEntry(c.env.DB, ctx, actorOf(staff), e);
  kick(c);
  return c.json(r, 201);
});
