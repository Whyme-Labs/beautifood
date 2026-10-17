// Mark a dish sold out / back in stock at this branch.
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../src/server/routing";
import { setAvailability } from "../../../../../src/server/domain/menu";

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "menu.availability");
  const { itemId, soldOut } = await body(c, z.object({ itemId: z.string(), soldOut: z.boolean() }));
  await setAvailability(c.env.DB, ctx.tenant.id, ctx.branch.id, actorOf(staff), itemId, soldOut);
  return { ok: true };
});
