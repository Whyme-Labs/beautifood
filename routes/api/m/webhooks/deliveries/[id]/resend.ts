import { api } from "../../../../../../src/server/http";
import { staffTenant } from "../../../../../../src/server/routing";
import { appEnv } from "../../../../../../src/server/appenv";
import { resend } from "../../../../../../src/server/domain/webhooks";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  return resend(c.env.DB, s.tenantId, c.req.param("id")!, appEnv());
});
