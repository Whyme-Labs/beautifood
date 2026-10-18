// Evidence 11 · For AI agents: the stateless MCP server at /mcp (JSON-RPC over HTTP). An agent
// discovers the tools, finds restaurants, reads the menu in 中文 without peanuts, asks the menu
// assistant, checks the queue, joins it and checks its ticket, looks up booking slots; with a
// personal access token it unlocks merchant tools. The real requests and responses are rendered
// as a transcript page and scrolled through; then /llms.txt and /openapi.json.
import { expect, request as pwRequest, test } from "@playwright/test";
import { BASE, json, seed } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, wrap } from "./stage";

test.afterEach(wrap);

interface Call {
  title: string;
  request: unknown;
  status: number;
  response: unknown;
  auth?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pretty = (v: unknown, maxLines = 34) => {
  const lines = JSON.stringify(v, null, 2).split("\n");
  return lines.length > maxLines ? [...lines.slice(0, maxLines), `  … ${lines.length - maxLines} more lines`].join("\n") : lines.join("\n");
};

function transcript(calls: Call[]) {
  const cards = calls
    .map(
      (c, i) => `
  <section class="call" id="c${i}">
    <h2><span class="n">${i + 1}</span>${esc(c.title)}</h2>
    <div class="cols">
      <div><div class="lbl">POST /mcp${c.auth ? ` · Authorization: Bearer ${esc(c.auth)}` : ""}</div><pre class="req">${esc(pretty(c.request, 20))}</pre></div>
      <div><div class="lbl">HTTP ${c.status}</div><pre class="res">${esc(pretty(c.response))}</pre></div>
    </div>
  </section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>MCP transcript</title><style>
  :root{--sun:#ffd12e;--ink:#1a1814;--paper:#fffaf0;--line:#e7dfcc}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.45 system-ui,-apple-system,'PingFang SC','Noto Sans CJK SC',sans-serif;padding-bottom:140px}
  header{background:var(--sun);border-bottom:3px solid var(--ink);padding:18px 32px}
  header h1{margin:0;font-size:30px;font-weight:900;letter-spacing:-.01em}
  header p{margin:4px 0 0;font-weight:600}
  main{max-width:1260px;margin:0 auto;padding:18px 32px}
  .call{background:#fff;border:2px solid var(--ink);border-radius:14px;margin:18px 0;box-shadow:4px 4px 0 var(--ink);overflow:hidden}
  .call h2{margin:0;padding:10px 16px;font-size:19px;background:var(--ink);color:var(--sun);display:flex;gap:10px;align-items:center}
  .n{background:var(--sun);color:var(--ink);border-radius:6px;padding:0 8px;font-weight:900}
  .cols{display:grid;grid-template-columns:2fr 3fr;gap:0}
  .cols>div{padding:10px 14px;min-width:0}
  .cols>div+div{border-left:2px dashed var(--line)}
  .lbl{font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.05em;opacity:.7;margin-bottom:4px}
  pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
  .req{color:#5a3e00}
</style></head><body><header><h1>beautifood · MCP agent transcript</h1><p>Real JSON-RPC requests to ${esc(BASE)}/mcp and the server's responses, recorded by the test</p></header><main>${cards}</main></body></html>`;
}

test("AI agents: MCP tools over JSON-RPC (guest + merchant), llms.txt and OpenAPI", async ({ browser }, info) => {
  const s = await seed();
  const calls: Call[] = [];
  let id = 0;
  const rpc = async (title: string, method: string, params?: unknown, token?: string) => {
    const c = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) } });
    const body = { jsonrpc: "2.0", id: ++id, method, ...(params ? { params } : {}) };
    const r = await c.post("/mcp", { data: body });
    const res = r.status() === 202 ? null : await r.json();
    calls.push({ title, request: body, status: r.status(), response: res, auth: token ? `${token.slice(0, 12)}…` : undefined });
    return { status: r.status(), body: res };
  };
  const tool = async (title: string, name: string, args: Record<string, unknown>, token?: string) => {
    const r = await rpc(title, "tools/call", { name, arguments: args }, token);
    const res = r.body.result;
    const data = res.isError ? res.content[0].text : JSON.parse(res.content[0].text);
    // show the tool's JSON payload decoded in the transcript
    calls[calls.length - 1].response = { result: { isError: !!res.isError, content: [{ type: "text", json: data }] } };
    return { isError: !!res.isError, data };
  };

  // ---- guest agent, no auth ----
  const init = await rpc("initialize", "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "evidence-agent", version: "1" } });
  expect(init.body.result.serverInfo.name).toBe("beautifood");
  const list = await rpc("tools/list (no token: guest tools only)", "tools/list");
  const names = list.body.result.tools.map((x: any) => x.name);
  expect(names).toEqual(expect.arrayContaining(["find_restaurants", "get_menu", "ask_menu_assistant", "queue_status", "join_queue", "check_ticket", "cancel_ticket", "booking_availability", "create_booking"]));
  expect(names.some((n: string) => n.startsWith("merchant_"))).toBe(false);
  calls[calls.length - 1].response = { result: { tools: list.body.result.tools.map((x: any) => ({ name: x.name, description: x.description.slice(0, 90) + "…" })) } };

  const found = await tool("find_restaurants", "find_restaurants", { query: s.slug.split("-").pop() });
  expect(found.data.map((r: any) => r.branch).sort()).toEqual([s.bangsar.ref, s.klcc.ref].sort());
  const menu = await tool("get_menu in 中文, no peanuts", "get_menu", { branch: s.klcc.ref, lang: "zh", exclude_allergens: ["peanuts"] });
  expect(menu.data.language).toBe("zh");
  expect(menu.data.items.some((i: any) => i.allergens.includes("peanuts"))).toBe(false);
  const ckt = menu.data.items.find((i: any) => i.original_name === "Char Kway Teow");
  expect(ckt.name).toBe("炒粿条");
  expect(menu.data.allergenNote).toMatch(/confirm with staff|店员/);
  const askd = await tool("ask_menu_assistant", "ask_menu_assistant", { branch: s.klcc.ref, question: "What are your signatures?" });
  expect(JSON.stringify(askd.data)).toContain("Char Kway Teow");
  const qs = await tool("queue_status", "queue_status", { branch: s.klcc.ref });
  expect(JSON.stringify(qs.data)).toContain("A");
  const joined = await tool("join_queue (party of 3)", "join_queue", { branch: s.klcc.ref, party_size: 3, name: "Agent Smith" });
  expect(joined.data.number).toBe("B001");
  const chk = await tool("check_ticket", "check_ticket", { ticket_id: joined.data.ticketId, token: joined.data.token });
  expect(chk.data.status).toBe("waiting");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(Date.now() + 86_400_000));
  const av = await tool("booking_availability", "booking_availability", { branch: s.klcc.ref, date: day, party_size: 2 });
  expect(JSON.stringify(av.data)).toContain("19:00");
  const bad = await tool("join_queue with bad arguments → tool error", "join_queue", { branch: s.klcc.ref, party_size: 0, name: "" });
  expect(bad.isError).toBe(true);

  // ---- merchant agent, with a personal access token ----
  const wrong = await rpc("tools/list with a wrong token → 401", "tools/list", undefined, "bf_pat_wrong");
  expect(wrong.status).toBe(401);
  const { token } = await json(s.owner.post("/api/m/tokens", { data: { name: "Claude" } }), 201);
  const priv = await rpc("tools/list with the owner's token: merchant tools unlocked", "tools/list", undefined, token);
  const privNames = priv.body.result.tools.map((x: any) => x.name);
  expect(privNames).toEqual(expect.arrayContaining(["merchant_overview", "merchant_queue", "merchant_sales_report", "merchant_set_sold_out"]));
  calls[calls.length - 1].response = { result: { tools: privNames } };
  const ov = await tool("merchant_overview", "merchant_overview", {}, token);
  expect(ov.data.branches).toHaveLength(2);
  const mq = await tool("merchant_queue (with the engine's suggestions)", "merchant_queue", { branch: s.klcc.ref }, token);
  expect(JSON.stringify(mq.data)).toContain("B001");

  const a = await actor(browser, info, "11-ai-agent", "AI agent · MCP · desktop", DESKTOP);
  const { page, say } = a;

  await test.step("Render the real MCP transcript and scroll through it", async () => {
    await page.setContent(transcript(calls));
    await expect(page.locator(".call")).toHaveCount(calls.length);
    await expect(page.locator("#c0")).toContainText('"name": "beautifood"');
    await say("An AI agent talks to Beautifood over MCP: POST /mcp, JSON-RPC, no auth for guest tools");
    const notes: Record<number, string> = {
      1: "tools/list: 9 guest tools (no merchant tools without a token)",
      2: "find_restaurants: both branches with live queue and wait",
      3: "get_menu lang=zh, exclude peanuts: Chinese names + original_name, allergen note",
      4: "ask_menu_assistant: the restaurant's own assistant recommends its signatures",
      5: "queue_status: waiting parties per party size and ETA",
      6: "join_queue: number B001, private tracking link + token",
      7: "check_ticket: still waiting, parties ahead, ETA",
      8: "booking_availability: tomorrow's free slots for 2",
      9: "Invalid arguments are a tool error the agent can read, not a crash",
      10: "A wrong personal access token → HTTP 401",
      11: "With the owner's token: merchant tools unlocked",
      12: "merchant_overview: every branch live (queue, occupancy, sales)",
      13: "merchant_queue: waiting parties and the seating engine's suggestions",
    };
    for (let i = 1; i < calls.length; i++) {
      await page.locator(`#c${i}`).evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
      await say(notes[i] ?? calls[i].title);
      await beat(page, 900);
    }
    await expect(page.locator("#c3")).toContainText("炒粿条");
    await expect(page.locator("#c6")).toContainText("B001");
  });

  await test.step("Discovery docs: /llms.txt and /openapi.json", async () => {
    const r = await page.goto("/llms.txt");
    expect(r!.status()).toBe(200);
    await expect(page.locator("body")).toContainText("POST /mcp");
    await expect(page.locator("body")).toContainText("merchant_overview");
    await say("/llms.txt: how an agent should use Beautifood (MCP, tools, rules, REST endpoints)");
    await beat(page, 2000);
    const spec = await json((await pwRequest.newContext({ baseURL: BASE })).get("/openapi.json"));
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(["/api/public/branches/{branch}/queue"]));
    await page.goto("/openapi.json");
    await expect(page.locator("body")).toContainText("/api/public/branches/{branch}/queue");
    await say(`/openapi.json: OpenAPI ${spec.openapi} with ${Object.keys(spec.paths).length} paths`);
    await beat(page, 2000);
  });
});
