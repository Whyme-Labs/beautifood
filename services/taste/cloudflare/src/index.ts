// The front door of the taste service on Cloudflare Containers: it checks the caller's secret
// before anything else, so only the app can wake the container (a stranger's request never starts
// one, or costs anything), then hands the request to the one container instance. The container
// sleeps after 10 idle minutes; the app's own cache keeps most questions from waking it at all.
import { Container } from "@cloudflare/containers";

interface Env {
  TASTE: DurableObjectNamespace<TasteContainer>;
  TASTE_SECRET: string;
  QLOO_API_KEY: string;
}

export class TasteContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "10m";

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    // the key lives only here and in the container; it never reaches the app or a browser
    this.envVars = { TASTE_SECRET: env.TASTE_SECRET, QLOO_API_KEY: env.QLOO_API_KEY };
  }
}

async function sameSecret(given: string, want: string) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(want))]);
  // equal-length digests, compared without an early exit
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!env.TASTE_SECRET || env.TASTE_SECRET.length < 32 || !(await sameSecret(token, env.TASTE_SECRET))) return Response.json({ error: "unauthorized" }, { status: 401 });
    return env.TASTE.getByName("taste").fetch(request);
  },
} satisfies ExportedHandler<Env>;
