import { api, body } from "../../../../../src/server/http";
import { staffTenant } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { checkUrl, deleteEndpoint, getEndpoint, toEndpoint, updateEndpoint } from "../../../../../src/server/domain/webhooks";
import { WebhookEndpointInput as Endpoint } from "../../../../../src/server/schemas";

export const PATCH = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  const input = await body(c, Endpoint.partial());
  const id = c.req.param("id")!;
  await updateEndpoint(c.env.DB, s.tenantId, id, { ...input, url: input.url ? checkUrl(input.url, appEnv()) : undefined });
  return toEndpoint(await getEndpoint(c.env.DB, s.tenantId, id));
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  await deleteEndpoint(c.env.DB, s.tenantId, c.req.param("id")!);
  return { ok: true };
});
