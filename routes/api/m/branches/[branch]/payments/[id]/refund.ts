import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../../../src/server/routing";
import { refundPayment } from "../../../../../../../src/server/domain/orders";

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "payment.refund");
  const { amount, reason, msgId } = await body(c, z.object({ amount: z.number().int().min(1), reason: z.string().min(2).max(120), msgId: z.string().min(8).max(80) }));
  return refundPayment(c.env.DB, ctx, actorOf(staff), c.req.param("id")!, amount, reason, msgId);
});
