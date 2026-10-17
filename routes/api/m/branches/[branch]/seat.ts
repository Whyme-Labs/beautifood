// Seat a walk-in directly (no queue ticket), on one table, merged tables, or half of a split table.
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../src/server/routing";
import { seatWalkIn } from "../../../../../src/server/domain/floor";
import { appEnv } from "../../../../../src/server/appenv";
import { sign } from "../../../../../src/server/sign";

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "queue.operate");
  const input = await body(c, z.object({ partySize: z.number().int().min(1).max(60), tableIds: z.array(z.string()).min(1).max(8), split: z.object({ parentId: z.string(), childSuffixes: z.array(z.string()).min(1) }).nullable().optional() }));
  const res = await seatWalkIn(c.env.DB, ctx, actorOf(staff), input.partySize, input);
  const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: res.sessionId, b: ctx.branch.id });
  return c.json({ ...res, sessionUrl: `/s/${res.sessionId}?k=${encodeURIComponent(token)}` }, 201);
});
