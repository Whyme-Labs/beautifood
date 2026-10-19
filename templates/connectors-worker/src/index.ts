// The connectors kit: one Worker, one Beautifood webhook (POST /hooks), and each connector runs
// when its secrets are set. Add your own next to the examples in src/connectors/ and list it below;
// that's the whole pattern a coding agent needs to follow.
import { once, verify, type BeautifoodEvent, type Connector, type Env } from "./beautifood";
import { slack } from "./connectors/slack";
import { whatsapp } from "./connectors/whatsapp";
import { xero } from "./connectors/xero";
import { handleDeliveryOrder } from "./connectors/delivery";

export const CONNECTORS: Connector[] = [slack, whatsapp, xero];

export async function handleHook(req: Request, env: Env): Promise<Response> {
  if (!env.BEAUTIFOOD_WEBHOOK_SECRET) return new Response("Set BEAUTIFOOD_WEBHOOK_SECRET", { status: 500 });
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("x-beautifood-signature"), env.BEAUTIFOOD_WEBHOOK_SECRET))) return new Response("Bad signature", { status: 401 });
  const e = JSON.parse(raw) as BeautifoodEvent;
  const delivery = req.headers.get("x-beautifood-delivery") ?? e.id;
  const results: Record<string, string> = {};
  const errors: string[] = [];
  // each connector once per delivery; a failure answers 500 so Beautifood retries, and the ones that worked are skipped next time
  for (const c of CONNECTORS.filter((c) => c.enabled(env) && c.events.includes(e.type))) {
    try {
      results[c.name] = await once(env, `${delivery}:${c.name}`, () => c.handle(e, env));
    } catch (err) {
      results[c.name] = "failed";
      errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return Response.json({ event: e.type, results, errors }, { status: errors.length ? 500 : 200 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method === "POST" && pathname === "/hooks") return handleHook(req, env);
    if (req.method === "POST" && pathname === "/delivery/orders") return handleDeliveryOrder(req, env);
    if (req.method === "GET" && pathname === "/")
      return Response.json({
        connectors: Object.fromEntries(CONNECTORS.map((c) => [c.name, { on: c.enabled(env), events: c.events }])),
        delivery: { on: !!(env.DELIVERY_SECRET && env.BEAUTIFOOD_TOKEN) },
        webhook: { url: "/hooks", secretSet: !!env.BEAUTIFOOD_WEBHOOK_SECRET },
      });
    return new Response("Not found", { status: 404 });
  },
};
