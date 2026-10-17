import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { staffBranch } from "../../../../../../../src/server/routing";
import { closeShift } from "../../../../../../../src/server/domain/orders";

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "shift.manage");
  const { counted } = await body(c, z.object({ counted: z.number().int().min(0) }));
  return closeShift(c.env.DB, ctx, staff.userId, c.req.param("id")!, counted);
});
