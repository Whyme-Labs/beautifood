// Send a webhook.ping to the endpoint now and report how it answered.
import { api } from "../../../../../src/server/http";
import { staffTenant } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { sendPing } from "../../../../../src/server/domain/webhooks";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  return sendPing(c.env.DB, s.tenantId, c.req.param("id")!, appEnv());
});
