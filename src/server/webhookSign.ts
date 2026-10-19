// Webhook signing: the per-endpoint secret (derived, never stored) and the Stripe-style signature.
// Kept apart from the delivery code so connectors and tests can use it alone.

/** The endpoint's signing secret, derived from the app secret: nothing to store or leak from the database. */
export async function endpointSecret(appSecret: string, id: string, version: number): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`webhook:${id}:${version}`)));
  return `whsec_${[...mac.slice(0, 24)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, the same scheme Stripe uses. */
export async function signature(secret: string, body: string, at: number): Promise<string> {
  const t = Math.floor(at / 1000);
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${body}`)));
  return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
