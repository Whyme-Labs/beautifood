// The Qloo demo footage, recorded from the live app (playwright.qloo.config.ts): real Qloo answers
// for Kuala Lumpur through the judge account. Three beats, one recorded browser each:
//   owner  · the Taste page: what people around the branch love, and what to try, with sources
//   guest  · "I love BTS" at the table: dishes fans' places point to, allergies still kept
//   agent  · the owner's own AI over MCP: the taste brief and a Qloo question of its own
// The footage holds Qloo's data, so it is never committed (video/public/qloo is git-ignored).
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { BASE } from "../helpers";
import { beat } from "../evidence/caption";
import { actor, DESKTOP, go, PHONE, signInAs, wrap } from "../evidence/stage";

test.afterEach(wrap);

const EMAIL = process.env.JUDGE_EMAIL ?? "";
const PASSWORD = process.env.JUDGE_PASSWORD ?? "";
const BRANCH = process.env.QLOO_BRANCH ?? "beautifood-demo-kitchen~klcc";

async function judge() {
  const api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE } });
  const r = await api.post("/api/auth/sign-in/email", { data: { email: EMAIL, password: PASSWORD } });
  expect(r.status(), "judge sign-in").toBe(200);
  return api;
}

/** Scroll a page down gently, so the viewer can read as it goes. */
async function glide(page: Page, px: number, steps = 6) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await beat(page, 450);
  }
}

test.beforeAll(() => {
  test.skip(!process.env.E2E_BASE || !EMAIL || !PASSWORD, "records the live app: set E2E_BASE, JUDGE_EMAIL and JUDGE_PASSWORD");
});

test("owner: the Taste page", async ({ browser }, info) => {
  const api = await judge();
  const a = await actor(browser, info, "qloo-owner", "Owner", DESKTOP);
  await signInAs(a, api);
  // warm the brief, so the recording shows it arriving, not the first cold call
  await api.get(`/api/m/branches/${BRANCH}/taste?refresh=1`);
  await go(a.page, "/m/taste");
  await a.say("The owner opens Taste: what do people around the branch love?");
  await expect(a.page.getByTestId("taste-actions")).toBeVisible();
  await beat(a.page, 1200);
  // a fresh brief on screen: the edge cache that answered may hold an older one
  await a.say("Refresh asks Qloo again, live");
  const refresh = a.page.getByRole("button", { name: /Refresh/ });
  await refresh.click();
  await expect(refresh).toBeEnabled({ timeout: 60_000 });
  await expect(a.page.getByTestId("taste-actions")).not.toContainText("Café");
  await beat(a.page, 800);
  await a.say("Things to try this week, each with the Qloo finding behind it");
  await a.page.getByTestId("taste-actions").scrollIntoViewIfNeeded();
  await beat(a.page, 3500);
  await a.say("Restaurants, music and TV loved around Kuala Lumpur, from Qloo's taste graph");
  await glide(a.page, 700);
  await beat(a.page, 2500);
  await a.say("Every finding names its source; tastes are aggregate, never a guess about a guest");
  await glide(a.page, 600);
  await beat(a.page, 2500);
});

test("guest: I love BTS", async ({ browser }, info) => {
  const a = await actor(browser, info, "qloo-guest", "Guest", PHONE);
  await go(a.page, `/r/${BRANCH}`);
  await a.say("A guest at the table opens the menu assistant");
  await a.page.getByRole("button", { name: /Ask what to eat/ }).click();
  await expect(a.page.getByTestId("assistant")).toBeVisible();
  const ask = async (q: string) => {
    const n = await a.page.getByTestId("assistant-answer").count();
    const input = a.page.getByTestId("assistant").getByRole("textbox");
    await input.click();
    await input.pressSequentially(q, { delay: 45 });
    await input.press("Enter");
    await expect(a.page.getByTestId("assistant-answer")).toHaveCount(n + 1, { timeout: 30_000 });
    // the answer from its first line
    await a.page.getByTestId("assistant-answer").last().evaluate((el) => el.scrollIntoView({ block: "start" }));
  };
  await a.say("“I love BTS, what should I get?”");
  await ask("I love BTS, what should I get?");
  await expect(a.page.getByTestId("taste-source").last()).toBeVisible();
  await a.say("Qloo knows what BTS fans around Kuala Lumpur love; the brain maps it onto this menu");
  await beat(a.page, 4500);
  await a.say("“I'm allergic to peanuts”: the allergy filter still comes first");
  await ask("I'm allergic to peanuts. I love BTS, what should I get?");
  await expect(a.page.getByTestId("safety-note").last()).toBeVisible();
  await beat(a.page, 4500);
});

test("agent: the owner's AI over MCP", async ({ browser }, info) => {
  const api = await judge();
  const made = await api.post("/api/m/tokens", { data: { name: "Qloo demo recording" } });
  expect(made.status()).toBe(201);
  const { token } = (await made.json()) as { token: string };
  try {
    const calls: { title: string; request: unknown; response: unknown }[] = [];
    const rpc = async (title: string, method: string, params?: unknown) => {
      const c = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { accept: "application/json, text/event-stream", authorization: `Bearer ${token}` } });
      const body = { jsonrpc: "2.0", id: calls.length + 1, method, ...(params ? { params } : {}) };
      const r = await c.post("/mcp", { data: body });
      expect(r.status(), title).toBe(200);
      const res = await r.json();
      calls.push({ title, request: body, response: res });
      return res as { result?: { tools?: { name: string; title?: string }[]; structuredContent?: unknown; content?: { text: string }[] } };
    };
    const list = await rpc("tools/list: the owner's agent finds the taste tools", "tools/list");
    calls[0].response = { result: { tools: (list.result?.tools ?? []).filter((t) => /taste/.test(t.name)).map((t) => ({ name: t.name, title: t.title })) } };
    const brief = await rpc("merchant_taste_brief: what do people around the branch love?", "tools/call", { name: "merchant_taste_brief", arguments: { branch: BRANCH } });
    const sc = (brief.result?.structuredContent ?? JSON.parse(brief.result?.content?.[0]?.text ?? "{}")) as { location?: string; actions?: { text: string; why: string }[] };
    calls[1].response = { result: { location: sc.location, actions: (sc.actions ?? []).map((x) => ({ try: x.text, why: x.why })) } };
    const q = await rpc("merchant_taste_query: its own question to Qloo", "tools/call", {
      name: "merchant_taste_query",
      arguments: { branch: BRANCH, workflow: "qloo_recommend", args: { target_type: "artist", signal_location: "Kuala Lumpur", limit: 5 } },
    });
    const qs = (q.result?.structuredContent ?? JSON.parse(q.result?.content?.[0]?.text ?? "{}")) as { status?: string; results?: { name: string }[] };
    calls[2].response = { result: { status: qs.status, results: (qs.results ?? []).map((r) => r.name) } };

    const a = await actor(browser, info, "qloo-agent", "AI agent", DESKTOP);
    await a.page.setContent(transcript(calls, BASE));
    await a.say("The owner's own AI agent connects to Beautifood's MCP server with a token");
    await beat(a.page, 3000);
    for (let i = 0; i < calls.length; i++) {
      await a.page.locator(`#c${i}`).scrollIntoViewIfNeeded();
      await a.say([`It finds the Qloo-backed tools`, `It asks for the branch's taste brief, with the reasons`, `And asks Qloo its own question: artists loved around Kuala Lumpur`][i]);
      await beat(a.page, 4000);
    }
  } finally {
    // no token left on the shared judge account
    const list = (await (await api.get("/api/m/tokens")).json()) as { id: string; name: string }[];
    for (const t of list.filter((t) => t.name === "Qloo demo recording")) await api.delete(`/api/m/tokens?id=${t.id}`);
  }
});

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function transcript(calls: { title: string; request: unknown; response: unknown }[], base: string) {
  const cards = calls
    .map(
      (c, i) => `<section class="call" id="c${i}"><h2><span class="n">${i + 1}</span>${esc(c.title)}</h2>
      <div class="cols"><div><div class="lbl">POST /mcp</div><pre>${esc(JSON.stringify(c.request, null, 2))}</pre></div>
      <div><div class="lbl">Response</div><pre>${esc(JSON.stringify(c.response, null, 2))}</pre></div></div></section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  :root{--sun:#ffd12e;--ink:#1a1814;--paper:#fffaf0;--line:#e7dfcc}*{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.45 system-ui,-apple-system,sans-serif;padding-bottom:200px}
  header{background:var(--sun);border-bottom:3px solid var(--ink);padding:18px 32px}header h1{margin:0;font-size:30px;font-weight:900}header p{margin:4px 0 0;font-weight:600}
  main{max-width:1260px;margin:0 auto;padding:18px 32px}
  .call{background:#fff;border:2px solid var(--ink);border-radius:14px;margin:18px 0;box-shadow:4px 4px 0 var(--ink);overflow:hidden}
  .call h2{margin:0;padding:10px 16px;font-size:19px;background:var(--ink);color:var(--sun);display:flex;gap:10px;align-items:center}
  .n{background:var(--sun);color:var(--ink);border-radius:6px;padding:0 8px;font-weight:900}
  .cols{display:grid;grid-template-columns:2fr 3fr}.cols>div{padding:10px 14px;min-width:0}.cols>div+div{border-left:2px dashed var(--line)}
  .lbl{font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.05em;opacity:.7;margin-bottom:4px}
  pre{margin:0;white-space:pre-wrap;word-break:break-word;font:13px/1.4 ui-monospace,Menlo,monospace}
  </style></head><body><header><h1>beautifood · the owner's AI, with Qloo</h1><p>Real JSON-RPC calls to ${esc(base)}/mcp, recorded</p></header><main>${cards}</main></body></html>`;
}
