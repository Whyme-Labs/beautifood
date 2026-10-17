import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../../src/server/routing";
import { setItemStatus } from "../../../../../../src/server/domain/orders";

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "kds.operate");
  const { itemIds, status } = await body(c, z.object({ itemIds: z.array(z.string()).min(1).max(100), status: z.enum(["fired", "preparing", "ready", "served"]) }));
  await setItemStatus(c.env.DB, ctx, actorOf(staff), itemIds, status);
  return { ok: true };
});
