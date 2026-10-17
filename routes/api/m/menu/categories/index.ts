import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { upsertCategory } from "../../../../../src/server/domain/menu";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  const input = await body(c, z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(40), sort: z.number().int().optional() }));
  return c.json(await upsertCategory(c.env.DB, s.tenantId, actorOf(s), input), 201);
});
