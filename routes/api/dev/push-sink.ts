// Development stand-in for a browser push service: records VAPID-signed pushes so tests can assert them.
import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { fail } from "../../../src/server/errors";

export const POST = api(async (c) => {
  if (appEnv().APP_ENV === "production") fail(404, "not_found", "Not found");
  const auth = c.req.header("authorization") ?? "";
  await c.env.DB.prepare("INSERT INTO events (tenant_id, stream, type, data, at) VALUES ('dev', 'dev:push', 'dev.push_received', ?, ?)")
    .bind(JSON.stringify({ path: new URL(c.req.url).pathname + new URL(c.req.url).search, vapid: auth.startsWith("vapid t="), ttl: c.req.header("ttl") }), Date.now())
    .run();
  return new Response(null, { status: 201 });
});

export const GET = api(async (c) => {
  if (appEnv().APP_ENV === "production") fail(404, "not_found", "Not found");
  return (await c.env.DB.prepare("SELECT data, at FROM events WHERE type = 'dev.push_received' ORDER BY id DESC LIMIT 50").all<{ data: string; at: number }>()).results.map((r) => ({ ...JSON.parse(r.data), at: r.at }));
});
