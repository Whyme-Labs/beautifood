import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { actorOf, kick, staffBranch, today } from "../../../../../../src/server/routing";
import { listOrders, orderView, posAddItems } from "../../../../../../src/server/domain/orders";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "order.create");
  const rows = await listOrders(c.env.DB, ctx.branch.id, { status: c.req.query("status") || undefined, day: c.req.query("day") || (c.req.query("status") === "open" ? undefined : today(ctx)) });
  const labels = new Map((await c.env.DB.prepare("SELECT id, label FROM floor_tables WHERE branch_id = ?").bind(ctx.branch.id).all<{ id: string; label: string }>()).results.map((t) => [t.id, t.label]));
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    type: o.type,
    status: o.status,
    total: o.total,
    paid: o.paid,
    due: Math.max(0, o.total - o.paid),
    seatingId: o.seating_id,
    tables: o.table_ids ? (JSON.parse(o.table_ids) as string[]).map((id) => labels.get(id) ?? id) : [],
    createdAt: o.created_at,
    closedAt: o.closed_at,
    parentOrderId: o.parent_order_id,
  }));
});

const Line = z.object({ itemId: z.string(), qty: z.number().int().min(1).max(50), modifiers: z.array(z.object({ group: z.string(), option: z.string() })).optional(), notes: z.string().max(200).optional() });

// POS entry: add items to a seated table, an existing bill, or start a takeaway bill.
export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "order.create");
  const input = await body(c, z.object({ seatingId: z.string().optional(), orderId: z.string().optional(), takeaway: z.boolean().optional(), items: z.array(Line).min(1).max(100) }));
  const r = await posAddItems(c.env.DB, ctx, actorOf(staff), input, input.items);
  kick(c);
  return c.json(await orderView(c.env.DB, r.orderId), 201);
});
