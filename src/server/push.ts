// Web Push without payloads ("tickles"): we sign a VAPID JWT and POST an empty
// message to the browser vendor's push service; the service worker wakes up and
// fetches the ticket status itself. Free, works with the phone locked, and needs
// no payload encryption. Without VAPID keys configured, push is skipped.
import { b64url, fromB64url } from "./ids";

export interface PushEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT: string;
}

let keyCache: { pub: string; key: Promise<CryptoKey> } | null = null;

function privateKey(env: PushEnv): Promise<CryptoKey> {
  if (keyCache && keyCache.pub === env.VAPID_PUBLIC_KEY) return keyCache.key;
  const pub = fromB64url(env.VAPID_PUBLIC_KEY!);
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d: env.VAPID_PRIVATE_KEY!, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true };
  const key = crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  keyCache = { pub: env.VAPID_PUBLIC_KEY!, key };
  return key;
}

export async function vapidAuthorization(env: PushEnv, endpoint: string, now = Date.now()): Promise<string> {
  const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await privateKey(env), new TextEncoder().encode(unsigned)));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export async function sendPushToTopic(db: D1Database, env: PushEnv, topic: string): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;
  const subs = (await db.prepare("SELECT id, endpoint FROM push_subscriptions WHERE topic = ?").bind(topic).all<{ id: string; endpoint: string }>()).results;
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await fetch(s.endpoint, { method: "POST", headers: { TTL: "600", Urgency: "high", Authorization: await vapidAuthorization(env, s.endpoint), "Content-Length": "0" } });
      if (r.status === 404 || r.status === 410) await db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(s.id).run();
      else if (r.ok) sent++;
    } catch (e) {
      console.warn("push failed", e);
    }
  }
  return sent;
}
