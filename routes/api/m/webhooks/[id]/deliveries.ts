// The endpoint's delivery log: the last 50 deliveries with each payload and how the receiver answered.
import { api } from "../../../../../src/server/http";
import { staffTenant } from "../../../../../src/server/routing";
import { listDeliveries } from "../../../../../src/server/domain/webhooks";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  return listDeliveries(c.env.DB, s.tenantId, c.req.param("id")!, Math.min(200, Number(c.req.query("limit")) || 50));
});
