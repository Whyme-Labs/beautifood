// Beautifood's taste service: Qloo's own harness (`qloo mcp`, from @qloo/qloo-harness) behind a
// small private HTTPS endpoint. The Worker can't start a local process, and the hackathon kit
// supports only the harness on a server or container, so this runs in a container and the Worker
// calls it. It keeps one MCP connection open, allows only the read-only Qloo workflows, caches
// results (Qloo describes aggregate taste, which moves slowly), and caps calls per day.
//
//   TASTE_SECRET=... QLOO_API_KEY=... node server.mjs
//
// POST /v1/run  { "tool": "qloo_recommend", "args": { ... } }   (Authorization: Bearer TASTE_SECRET)
// GET  /healthz                                                 (is the harness up, is the key set)
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** The Qloo workflows we use: all read-only. */
export const TOOLS = new Set([
  "qloo_find_tags",
  "qloo_describe",
  "qloo_recommend",
  "qloo_rank",
  "qloo_where_popular",
  "qloo_compare_audiences",
  "qloo_entity_tags",
  "qloo_audience_demographics",
  "qloo_trends",
]);

/** Results worth keeping: anything but an error or a question back. */
const CACHEABLE = new Set(["ok", "empty", "partial", "degraded"]);

export function createTasteService(env = process.env) {
  const secret = env.TASTE_SECRET ?? "";
  if (secret.length < 32) throw new Error("TASTE_SECRET must be set (32+ characters)");
  const command = env.QLOO_COMMAND ?? "qloo";
  const args = (env.QLOO_ARGS ?? "mcp").split(" ").filter(Boolean);
  const ttl = Number(env.CACHE_TTL_S ?? 86_400) * 1000;
  const dailyLimit = Number(env.DAILY_CALL_LIMIT ?? 2000);
  const timeoutMs = Number(env.CALL_TIMEOUT_MS ?? 25_000);

  let client = null;
  let connecting = null;
  const cache = new Map();
  let day = "";
  let calls = 0;
  let inFlight = 0;
  const waiting = [];

  async function connect() {
    if (client) return client;
    connecting ??= (async () => {
      // forward the environment, or the SDK drops QLOO_API_KEY on the way to the harness
      const transport = new StdioClientTransport({ command, args, env: process.env, stderr: "inherit" });
      const c = new Client({ name: "beautifood-taste", version: "1.0.0" });
      await c.connect(transport);
      transport.onclose = () => {
        if (client === c) client = null;
      };
      client = c;
      return c;
    })().finally(() => (connecting = null));
    return connecting;
  }

  // a few calls at a time: the harness is one process, and Qloo rate-limits the event key
  async function slot() {
    if (inFlight < 4) return void inFlight++;
    await new Promise((ok) => waiting.push(ok));
    inFlight++;
  }
  const release = () => {
    inFlight--;
    waiting.shift()?.();
  };

  async function call(tool, input) {
    const c = await connect();
    let timer;
    try {
      const r = await Promise.race([
        c.callTool({ name: tool, arguments: input }),
        new Promise((_, no) => (timer = setTimeout(() => no(new Error("timeout")), timeoutMs))),
      ]);
      return r.structuredContent ?? { status: "error", summary: "No structured result from the harness", error: { code: "UNKNOWN", retryable: false, recovery: "" } };
    } catch (e) {
      // a broken connection is replaced on the next call
      client = null;
      await c.close().catch(() => {});
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function run(tool, input) {
    if (!TOOLS.has(tool)) return { code: 400, body: { error: "unknown_tool" } };
    const key = createHash("sha256").update(`${tool}\n${stable(input)}`).digest("hex");
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return { code: 200, body: { ...hit.envelope, cached: true } };
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) [day, calls] = [today, 0];
    if (calls >= dailyLimit) return { code: 429, body: { error: "daily_limit" } };
    calls++;
    await slot();
    try {
      const envelope = await call(tool, input);
      if (CACHEABLE.has(envelope.status)) {
        if (cache.size >= 2000) cache.delete(cache.keys().next().value);
        cache.set(key, { at: Date.now(), envelope });
      }
      return { code: 200, body: envelope };
    } catch (e) {
      return { code: 502, body: { status: "error", summary: "The Qloo harness did not answer", error: { code: e.message === "timeout" ? "TIMEOUT" : "HARNESS", retryable: true, recovery: "Try again shortly." } } };
    } finally {
      release();
    }
  }

  async function health() {
    try {
      const c = await connect();
      const r = await c.callTool({ name: "qloo_capabilities", arguments: {} });
      return { ok: true, credential: r.structuredContent?.adapter?.ready ? "ready" : "missing", callsToday: calls };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  const authorized = (header = "") => {
    const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
    const want = Buffer.from(secret);
    return given.length === want.length && timingSafeEqual(given, want);
  };

  const server = createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && req.url === "/healthz") return send(200, await health());
      if (req.method !== "POST" || req.url !== "/v1/run") return send(404, { error: "not_found" });
      if (!authorized(req.headers.authorization)) return send(401, { error: "unauthorized" });
      const raw = await readBody(req, 16_384);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { error: "invalid_json" });
      }
      if (typeof body?.tool !== "string" || typeof body?.args !== "object" || body.args === null) return send(400, { error: "invalid_input" });
      const t0 = Date.now();
      const r = await run(body.tool, body.args);
      // names of public things only, never the key or the args: they may carry what a guest typed
      console.log(JSON.stringify({ tool: body.tool, status: r.body.status ?? r.body.error, cached: !!r.body.cached, ms: Date.now() - t0 }));
      send(r.code, r.body);
    } catch (e) {
      send(e.message === "too_large" ? 413 : 500, { error: e.message === "too_large" ? "too_large" : "internal" });
    }
  });

  return { server, run, health, close: async () => (server.close(), client?.close()) };
}

/** JSON with sorted keys, so the same question hits the same cache entry. */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

function readBody(req, max) {
  return new Promise((ok, no) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        no(new Error("too_large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", no);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = createTasteService();
  const port = Number(process.env.PORT ?? 8080);
  server.listen(port, () => console.log(`taste service on :${port}`));
}
