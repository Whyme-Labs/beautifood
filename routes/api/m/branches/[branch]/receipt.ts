import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../src/server/routing";
import { receiptSettings, saveReceiptSettings } from "../../../../../src/server/domain/receipts";
import { ReceiptConfigSchema } from "../../../../../src/shared/receipt";

// Every staff member of the branch reads the design (the till prints with it); settings managers change it.
export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, null);
  return receiptSettings(c.env.DB, ctx.tenant.id, ctx.branch.id);
});

const Put = z.object({ scope: z.enum(["restaurant", "branch"]), config: ReceiptConfigSchema }).strict();

export const PUT = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "settings.manage");
  const { scope, config } = await body(c, Put);
  return saveReceiptSettings(c.env.DB, ctx, actorOf(staff), scope, config);
});

/** Drop this branch's override: it prints the restaurant's design again. */
export const DELETE = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "settings.manage");
  return saveReceiptSettings(c.env.DB, ctx, actorOf(staff), "branch", null);
});
