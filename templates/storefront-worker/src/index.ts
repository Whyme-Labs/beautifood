// Your storefront on your own Cloudflare account. It reads your published design and what's on
// now from Beautifood (GET /api/public/storefronts/<slug>), renders the page here, and sends guests
// to Beautifood to join the queue, order and book. Change anything: it's your code.
import { render, type StorefrontPayload } from "./render";

export interface Env {
  RESTAURANT: string;
  BEAUTIFOOD_URL: string;
}

const CACHE_SECONDS = 30;

export default {
  async fetch(req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(req.url);
    const base = env.BEAUTIFOOD_URL.replace(/\/$/, "");
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" } });
    // queue, menu, booking and ticket pages live on Beautifood: send guests there
    const m = url.pathname.match(/^\/(r|ticket|booking|s|receipt|me)\/(.+)$/);
    if (m) return Response.redirect(`${base}${url.pathname}${url.search}`, 302);
    if (url.pathname !== "/") return new Response("Not found", { status: 404 });

    const locale = pickLocale(url.searchParams.get("lang"), req.headers.get("accept-language"));
    const cache = (caches as unknown as { default: Cache }).default;
    const key = new Request(`${url.origin}/?lang=${locale}`);
    const hit = await cache.match(key);
    if (hit) return hit;

    const r = await fetch(`${base}/api/public/storefronts/${encodeURIComponent(env.RESTAURANT)}`, { headers: { accept: "application/json" } });
    if (!r.ok) return new Response(`Couldn't load the storefront for “${env.RESTAURANT}” (${r.status}). Check RESTAURANT in wrangler.jsonc.`, { status: 502 });
    const data = (await r.json()) as StorefrontPayload;
    const res = new Response(render(data, { locale, base }), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${CACHE_SECONDS}` },
    });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};

function pickLocale(param: string | null, accept: string | null): string {
  if (param === "en" || param === "zh") return param;
  return /^zh|,\s*zh/i.test(accept ?? "") ? "zh" : "en";
}
