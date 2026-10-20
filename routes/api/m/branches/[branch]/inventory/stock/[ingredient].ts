// An ingredient's low-stock mark at this branch: { lowAt } in its unit.
import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../../../src/server/routing";
import { setLowAt } from "../../../../../../../src/server/domain/inventory";
import { MAX_QTY } from "../../../../../../../src/shared/inventory";

export const PATCH = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "inventory.manage");
  const { lowAt } = await body(c, z.object({ lowAt: z.number().min(0).max(MAX_QTY) }));
  await setLowAt(c.env.DB, ctx, actorOf(staff), c.req.param("ingredient")!, lowAt);
  return { ok: true };
});
