// A restaurant's webhooks: list them (with a week of delivery counts) and add one.
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { appEnv } from "../../../../src/server/appenv";
import { WebhookEndpointInput as Endpoint } from "../../../../src/server/schemas";
import { checkUrl, createEndpoint, endpointSecret, getEndpoint, listEndpoints, toEndpoint } from "../../../../src/server/domain/webhooks";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  return listEndpoints(c.env.DB, s.tenantId);
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  const input = await body(c, Endpoint);
  const env = appEnv();
  const id = await createEndpoint(c.env.DB, s.tenantId, actorOf(s), { ...input, url: checkUrl(input.url, env) });
  const row = await getEndpoint(c.env.DB, s.tenantId, id);
  // the secret is shown here and on demand (it is derived, never stored)
  return c.json({ ...toEndpoint(row), secret: await endpointSecret(env.TOKEN_SECRET, id, row.secret_version) }, 201);
});
