// The endpoint's signing secret: GET shows it, POST rotates it (the old one stops working at once).
import { api } from "../../../../../src/server/http";
import { staffTenant } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { fail } from "../../../../../src/server/errors";
import { endpointSecret, getEndpoint, rotateSecret } from "../../../../../src/server/domain/webhooks";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  const e = await getEndpoint(c.env.DB, s.tenantId, c.req.param("id")!);
  return { secret: await endpointSecret(appEnv().TOKEN_SECRET, e.id, e.secret_version) };
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  if (s.via === "token") fail(403, "forbidden", "Rotate secrets from the dashboard");
  const id = c.req.param("id")!;
  await rotateSecret(c.env.DB, s.tenantId, id);
  const e = await getEndpoint(c.env.DB, s.tenantId, id);
  return { secret: await endpointSecret(appEnv().TOKEN_SECRET, e.id, e.secret_version) };
});
