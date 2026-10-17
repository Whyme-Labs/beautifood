import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { staffBranch } from "../../../../../../src/server/routing";
import { currentShift, openShift } from "../../../../../../src/server/domain/orders";

export const GET = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "shift.manage");
  return { current: await currentShift(c.env.DB, ctx.branch.id, staff.userId) };
});

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "shift.manage");
  const { openingFloat } = await body(c, z.object({ openingFloat: z.number().int().min(0) }));
  return c.json({ id: await openShift(c.env.DB, ctx, { id: staff.userId, name: staff.name }, openingFloat) }, 201);
});
