import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { inviteStaff, listStaff } from "../../../../src/server/domain/tenants";

// a built-in role, or one of the restaurant's own (rl_…)
const Role = z.union([z.enum(["owner", "admin", "branch_manager", "cashier", "waiter", "kitchen", "marketing"]), z.string().regex(/^rl_[a-z0-9]{6,40}$/)]);

export const GET = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  return listStaff(c.env.DB, s.tenantId);
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  const input = await body(c, z.object({ email: z.string().email(), name: z.string().min(1).max(60), role: Role, branchIds: z.array(z.string()).min(1) }));
  const code = await inviteStaff(c.env.DB, s, input);
  return c.json({ code, url: `/m/join?code=${code}` }, 201);
});
