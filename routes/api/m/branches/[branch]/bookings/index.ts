import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { actorOf, kick, staffBranch, today } from "../../../../../../src/server/routing";
import { createBooking, listBookings, toBooking } from "../../../../../../src/server/domain/bookings";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "booking.manage");
  return listBookings(c.env.DB, ctx, c.req.query("day") || today(ctx));
});

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "booking.manage");
  const input = await body(c, z.object({ name: z.string().min(1).max(60), phone: z.string().max(30).optional(), email: z.string().email().optional(), partySize: z.number().int().min(1).max(60), slotStart: z.number().int(), notes: z.string().max(300).optional() }));
  const b = await createBooking(c.env.DB, ctx, input, actorOf(staff));
  kick(c);
  return c.json(toBooking(b), 201);
});
