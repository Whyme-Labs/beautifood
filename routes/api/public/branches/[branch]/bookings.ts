import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { appEnv } from "../../../../../src/server/appenv";
import { kick } from "../../../../../src/server/routing";
import { getBranch } from "../../../../../src/server/domain/context";
import { createBooking, toBooking } from "../../../../../src/server/domain/bookings";
import { ensureMember } from "../../../../../src/server/domain/loyalty";
import { sign } from "../../../../../src/server/sign";

const Book = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  partySize: z.number().int().min(1).max(60),
  slotStart: z.number().int(),
  notes: z.string().max(300).optional(),
  joinLoyalty: z.boolean().optional(),
});

export const POST = api(async (c) => {
  const input = await body(c, Book);
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  const memberId = input.email && input.joinLoyalty ? (await ensureMember(c.env.DB, ctx.tenant.id, input.email, { name: input.name })).id : null;
  const b = await createBooking(c.env.DB, ctx, { ...input, memberId }, c.req.header("x-agent") ? "agent" : "guest");
  const token = await sign(appEnv().TOKEN_SECRET, { k: "booking", id: b.id, b: ctx.branch.id });
  kick(c);
  return c.json({ booking: toBooking(b), token, url: `/booking/${b.id}?k=${encodeURIComponent(token)}` }, 201);
});
