import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { adjustPoints, getMember, memberHistory, toMember } from "../../../../../src/server/domain/loyalty";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const m = await getMember(c.env.DB, s.tenantId, c.req.param("id")!);
  return { member: toMember(m), ...(await memberHistory(c.env.DB, m.id)) };
});

// Manual points adjustment (goodwill, corrections). Can't take a balance below zero.
export const POST = api(async (c) => {
  const s = await staffTenant(c, "member.manage");
  const { delta, reason } = await body(c, z.object({ delta: z.number().int().min(-100_000).max(100_000), reason: z.string().min(2).max(80) }));
  await adjustPoints(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!, delta, reason);
  return toMember(await getMember(c.env.DB, s.tenantId, c.req.param("id")!));
});
