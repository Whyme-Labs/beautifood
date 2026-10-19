// Delivery platforms → the kitchen: your delivery middleware (or the platform's webhook, through a
// small adapter) POSTs orders to /delivery/orders; they arrive in Beautifood as takeaway bills on
// the kitchen screen, matched to your menu by name. Needs BEAUTIFOOD_TOKEN and DELIVERY_SECRET.
import { beautifood, type Env } from "../beautifood";

export interface DeliveryOrder {
  platform: string;
  externalId: string;
  /** Beautifood branch id. */
  branch: string;
  customer?: string;
  items: { name?: string; itemId?: string; qty: number; notes?: string }[];
}

interface MenuItem {
  id: string;
  name: string;
  active: boolean;
  soldOut?: boolean;
  translations?: Record<string, { name?: string }>;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Match platform lines to menu items: by id, else by name in any language. Unmatched lines are reported, not guessed. */
export function matchItems(order: DeliveryOrder, menu: MenuItem[]) {
  const live = menu.filter((i) => i.active);
  const out: { itemId: string; qty: number; notes?: string }[] = [];
  const missing: string[] = [];
  for (const l of order.items) {
    const hit = l.itemId ? live.find((i) => i.id === l.itemId) : live.find((i) => [i.name, ...Object.values(i.translations ?? {}).map((t) => t.name ?? "")].some((n) => n && norm(n) === norm(l.name ?? "")));
    if (!hit) missing.push(l.name ?? l.itemId ?? "?");
    else out.push({ itemId: hit.id, qty: l.qty, notes: [`${order.platform} ${order.externalId}`, order.customer, l.notes].filter(Boolean).join(" · ").slice(0, 200) });
  }
  return { items: out, missing };
}

export async function handleDeliveryOrder(req: Request, env: Env): Promise<Response> {
  if (!env.DELIVERY_SECRET || req.headers.get("x-delivery-secret") !== env.DELIVERY_SECRET) return new Response("Unauthorized", { status: 401 });
  const order = (await req.json()) as DeliveryOrder;
  if (!order?.branch || !order.items?.length) return Response.json({ error: "branch and items are required" }, { status: 400 });
  const key = `delivery:${order.platform}:${order.externalId}`;
  const done = await env.STATE?.get(key);
  if (done) return Response.json(JSON.parse(done));
  const menu = await beautifood<{ items: MenuItem[] }>(env, `/api/m/menu?branch=${encodeURIComponent(order.branch)}&now=1`);
  const { items, missing } = matchItems(order, menu.items);
  if (missing.length) return Response.json({ error: "Some dishes aren't on the menu", missing }, { status: 422 });
  const bill = await beautifood<{ id: string; number: string; total: number }>(env, `/api/m/branches/${encodeURIComponent(order.branch)}/orders`, { body: { takeaway: true, items } });
  const result = { orderId: bill.id, number: bill.number, total: bill.total };
  await env.STATE?.put(key, JSON.stringify(result), { expirationTtl: 7 * 86_400 });
  return Response.json(result, { status: 201 });
}
