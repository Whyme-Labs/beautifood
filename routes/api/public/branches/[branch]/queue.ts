// Join the queue (web, kiosk or an AI agent). Returns a signed ticket link: no account needed.
import { z } from "zod";
import { api, body, deviceId } from "../../../../../src/server/http";
import { kick } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { joinQueue, ticketView } from "../../../../../src/server/domain/floor";
import { ensureMember } from "../../../../../src/server/domain/loyalty";
import { sign } from "../../../../../src/server/sign";

const Join = z.object({
  partySize: z.number().int().min(1).max(60),
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  preferences: z.array(z.string().max(30)).max(5).optional(),
  joinLoyalty: z.boolean().optional(),
  source: z.enum(["web", "kiosk", "agent", "staff"]).optional(),
});

export const POST = api(async (c) => {
  const input = await body(c, Join);
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  let memberId: string | null = null;
  if (input.email && input.joinLoyalty && ctx.config.modules.loyalty) memberId = (await ensureMember(c.env.DB, ctx.tenant.id, input.email, { name: input.name, phone: input.phone })).id;
  const { ticket, existing } = await joinQueue(c.env.DB, ctx, { ...input, memberId, source: input.source ?? (c.req.header("x-agent") ? "agent" : "web") }, deviceId(c));
  const token = await sign(appEnv().TOKEN_SECRET, { k: "ticket", id: ticket.id, b: ctx.branch.id });
  kick(c);
  return c.json({ existing, token, url: `/ticket/${ticket.id}?k=${encodeURIComponent(token)}`, ticket: await ticketView(c.env.DB, ctx, ticket.id) }, existing ? 200 : 201);
});
