import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { updateStaff } from "../../../../src/server/domain/tenants";

const Role = z.enum(["owner", "admin", "branch_manager", "cashier", "waiter", "kitchen", "marketing"]);

export const PATCH = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  await updateStaff(c.env.DB, s, c.req.param("user")!, await body(c, z.object({ role: Role, branchIds: z.array(z.string()).min(1) })));
  return { ok: true };
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  await updateStaff(c.env.DB, s, c.req.param("user")!, null);
  return { ok: true };
});
