import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../src/server/routing";
import { updateBranchConfig } from "../../../../../src/server/domain/tenants";

const Patch = z
  .object({
    name: z.string().min(2).max(60),
    address: z.string().max(200),
    active: z.boolean(),
    categories: z.array(z.object({ code: z.string().min(1).max(4), label: z.string().min(1).max(20), prefix: z.string().min(1).max(2), min: z.number().int(), max: z.number().int() })).min(1).max(8),
    strategy: z.enum(["fifo", "category_fifo", "best_fit", "smart"]),
    weights: z.object({ wait: z.number(), waste: z.number(), merge: z.number(), booking: z.number(), priority: z.number() }).partial(),
    maxSkips: z.number().int().min(0).max(20),
    qrMode: z.enum(["static", "dynamic", "both"]),
    staticQrSelfSeat: z.boolean(),
    serviceChargePct: z.number().min(0).max(30),
    taxPct: z.number().min(0).max(30),
    taxInclusive: z.boolean(),
    cashRounding: z.number().int().min(1).max(100),
    maxWaiting: z.number().int().min(1).max(5000),
    holdCalledMinutes: z.number().int().min(1).max(120),
    autoCloseOnPay: z.boolean(),
    requireStaffConfirmFirstRound: z.boolean(),
    preorderFire: z.enum(["on_seat", "on_call"]),
    booking: z.object({ enabled: z.boolean(), slotMinutes: z.number().int().min(10).max(120), durationMinutes: z.number().int().min(15).max(480), openHour: z.number().int().min(0).max(23), closeHour: z.number().int().min(1).max(24), leadMinutes: z.number().int().min(0) }).partial(),
    modules: z.object({ menuDisplay: z.boolean(), queuePreorder: z.boolean(), tableQr: z.boolean(), bookings: z.boolean(), loyalty: z.boolean(), eReceipt: z.boolean(), campaigns: z.boolean(), aiAssistant: z.boolean(), kiosk: z.boolean() }).partial(),
  })
  .partial()
  .strict();

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, null);
  return { id: ctx.branch.id, name: ctx.branch.name, address: ctx.branch.address, active: !!ctx.branch.active, slug: ctx.branch.slug, ref: `${ctx.tenant.slug}~${ctx.branch.slug}`, config: ctx.config };
});

export const PATCH = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "settings.manage");
  const patch = await body(c, Patch);
  const merged = { ...patch } as Record<string, unknown>;
  if (patch.weights) merged.weights = { ...ctx.config.weights, ...patch.weights };
  if (patch.booking) merged.booking = { ...ctx.config.booking, ...patch.booking };
  if (patch.modules) merged.modules = { ...ctx.config.modules, ...patch.modules };
  return { config: await updateBranchConfig(c.env.DB, ctx, actorOf(staff), merged as never) };
});
