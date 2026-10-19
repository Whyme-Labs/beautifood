import { api } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { deleteRole } from "../../../../src/server/domain/roles";

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  await deleteRole(c.env.DB, { ...s, userId: actorOf(s) }, c.req.param("id")!);
  return { ok: true };
});
