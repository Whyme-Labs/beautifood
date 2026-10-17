import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { addBranch, listBranches } from "../../../../src/server/domain/tenants";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  return (await listBranches(c.env.DB, s.tenantId)).filter((b) => s.branches.includes("*") || ["owner", "admin", "marketing"].includes(s.role) || s.branches.includes(b.id));
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "branch.manage");
  const input = await body(c, z.object({ name: z.string().trim().min(2).max(60), address: z.string().max(200).optional() }));
  return c.json(await addBranch(c.env.DB, s.tenantId, actorOf(s), input), 201);
});
