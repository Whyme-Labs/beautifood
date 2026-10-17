// Subscribe this browser to Web Push for this ticket ("your table is ready" with the phone locked).
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { customerToken } from "../../../../../src/server/routing";
import { newId } from "../../../../../src/server/ids";

const Sub = z.object({ endpoint: z.string().url().max(1000) });

export const POST = api(async (c) => {
  const id = c.req.param("id")!;
  await customerToken(c, "ticket", id);
  const { endpoint } = await body(c, Sub);
  await c.env.DB.prepare("INSERT OR IGNORE INTO push_subscriptions (id, endpoint, topic, created_at) VALUES (?, ?, ?, ?)").bind(newId("ps_"), endpoint, `ticket:${id}`, Date.now()).run();
  return { subscribed: true };
});
