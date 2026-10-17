// Stateless signed tokens: a customer's queue ticket, dynamic table QR, cart
// link and member login are self-verifying HMAC tokens, so the Worker needs no
// session store to authorize them.
import { b64url, fromB64url } from "./ids";

export type TokenPayload =
  | { k: "ticket"; id: string; b: string }
  | { k: "session"; id: string; b: string; exp?: number }
  | { k: "table"; id: string; b: string }
  | { k: "booking"; id: string; b: string }
  | { k: "member"; t: string; email: string; exp: number }
  | { k: "receipt"; id: string };

const keys = new Map<string, Promise<CryptoKey>>();
function key(secret: string) {
  let k = keys.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    keys.set(secret, k);
  }
  return k;
}

export async function sign(secret: string, payload: TokenPayload): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(body)));
  return `${body}.${b64url(sig.slice(0, 16))}`;
}

export async function verify<K extends TokenPayload["k"]>(secret: string, token: string | null | undefined, kind: K): Promise<Extract<TokenPayload, { k: K }> | null> {
  if (!token || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(body)));
  const given = fromB64url(sig);
  if (given.length !== 16) return null;
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= given[i] ^ expected[i];
  if (diff !== 0) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as TokenPayload;
    if (p.k !== kind) return null;
    if ("exp" in p && p.exp && p.exp < Date.now()) return null;
    return p as Extract<TokenPayload, { k: K }>;
  } catch {
    return null;
  }
}

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
