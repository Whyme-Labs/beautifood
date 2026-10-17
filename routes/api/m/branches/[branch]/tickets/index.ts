// Host adds a walk-in to the queue (e.g. a guest without a phone).
import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { kick, staffBranch } from "../../../../../../src/server/routing";
import { joinQueue, toTicket } from "../../../../../../src/server/domain/floor";

export const POST = api(async (c) => {
  const { ctx } = await staffBranch(c, "queue.operate");
  const input = await body(c, z.object({ partySize: z.number().int().min(1).max(60), name: z.string().trim().min(1).max(60), phone: z.string().max(30).optional(), email: z.string().email().optional(), priority: z.number().int().min(0).max(3).optional(), preferences: z.array(z.string()).optional() }));
  const { ticket } = await joinQueue(c.env.DB, ctx, { ...input, source: "staff" }, null);
  kick(c);
  return c.json(toTicket(ticket), 201);
});
