import { api } from "../../../../../../../src/server/http";
import { staffBranch } from "../../../../../../../src/server/routing";
import { orderView } from "../../../../../../../src/server/domain/orders";
import { notFound } from "../../../../../../../src/server/errors";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "order.create");
  const o = await orderView(c.env.DB, c.req.param("id")!);
  const row = await c.env.DB.prepare("SELECT branch_id FROM orders WHERE id = ?").bind(o.id).first<{ branch_id: string }>();
  if (row?.branch_id !== ctx.branch.id) notFound("Order");
  return o;
});
