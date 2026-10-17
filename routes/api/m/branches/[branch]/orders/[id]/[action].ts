// Bill actions: void | discount | promo | split | split_plan | contact | pay
import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { actorOf, kick, staffBranch } from "../../../../../../../src/server/routing";
import { addPayment, applyDiscount, applyPromo, currentShift, equalSplitPlan, getOrderRow, orderView, setOrderContact, splitOrder, voidItems } from "../../../../../../../src/server/domain/orders";
import { closeSeating } from "../../../../../../../src/server/domain/floor";
import { ensureMember } from "../../../../../../../src/server/domain/loyalty";
import { requirePerm } from "../../../../../../../src/server/http";
import { fail, notFound } from "../../../../../../../src/server/errors";

const Pay = z.object({
  method: z.enum(["cash", "card", "ewallet", "points", "voucher"]),
  amount: z.number().int().min(1),
  tendered: z.number().int().min(0).nullable().optional(),
  ref: z.string().max(60).nullable().optional(),
  splitLabel: z.string().max(30).nullable().optional(),
  msgId: z.string().min(8).max(80),
});

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "order.create");
  const id = c.req.param("id")!;
  const actor = actorOf(staff);
  const o = await getOrderRow(c.env.DB, id);
  if (o.branch_id !== ctx.branch.id) notFound("Order");
  const action = c.req.param("action");
  switch (action) {
    case "void": {
      requirePerm(staff, "order.void", ctx.branch.id);
      const { itemIds, reason } = await body(c, z.object({ itemIds: z.array(z.string()).min(1), reason: z.string().min(2).max(120) }));
      await voidItems(c.env.DB, ctx, actor, id, itemIds, reason);
      break;
    }
    case "discount": {
      requirePerm(staff, "order.discount", ctx.branch.id);
      const spec = await body(c, z.object({ kind: z.enum(["percent", "amount"]), value: z.number().min(0), reason: z.string().min(2).max(60) }).nullable());
      await applyDiscount(c.env.DB, ctx, actor, id, spec);
      break;
    }
    case "promo": {
      const { code } = await body(c, z.object({ code: z.string().min(2).max(30) }));
      await applyPromo(c.env.DB, ctx, actor, id, code);
      break;
    }
    case "split": {
      const { itemIds } = await body(c, z.object({ itemIds: z.array(z.string()).min(1) }));
      const r = await splitOrder(c.env.DB, ctx, actor, id, itemIds);
      return { original: await orderView(c.env.DB, id), split: await orderView(c.env.DB, r.orderId) };
    }
    case "split_plan": {
      const { ways } = await body(c, z.object({ ways: z.number().int().min(2).max(30) }));
      return equalSplitPlan(c.env.DB, id, ways);
    }
    case "contact": {
      const { email, joinLoyalty, name } = await body(c, z.object({ email: z.string().email(), joinLoyalty: z.boolean().default(true), name: z.string().max(60).optional() }));
      const member = joinLoyalty && ctx.config.modules.loyalty ? await ensureMember(c.env.DB, ctx.tenant.id, email, { name }) : null;
      await setOrderContact(c.env.DB, ctx, actor, id, email, member?.id ?? null);
      break;
    }
    case "pay": {
      requirePerm(staff, "payment.take", ctx.branch.id);
      const p = await body(c, Pay);
      const shift = await currentShift(c.env.DB, ctx.branch.id, staff.userId);
      const r = await addPayment(c.env.DB, ctx, actor, { ...p, orderId: id, shiftId: shift?.id ?? null });
      if (r.settled && o.seating_id && ctx.config.autoCloseOnPay) {
        try {
          await closeSeating(c.env.DB, ctx, actor, o.seating_id);
        } catch {
          /* other bills on the table still open */
        }
      }
      kick(c);
      return { payment: r, order: await orderView(c.env.DB, id) };
    }
    default:
      fail(404, "not_found", "Unknown action");
  }
  return orderView(c.env.DB, id);
});
