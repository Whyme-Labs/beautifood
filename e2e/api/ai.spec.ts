import { expect, test, request as pwRequest } from "@playwright/test";
import { BASE, errorOf, guestClient, hire, json, menuItems, seatWalkIn, seed, staffClient, tableIds, uid } from "../helpers";

const ask = async (ref: string, content: string) => json((await guestClient()).post(`/api/public/branches/${ref}/assistant`, { data: { messages: [{ role: "user", content }] } }));

async function mcp(body: unknown, token?: string) {
  const c = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  const r = await c.post("/mcp", { data: body });
  return { status: r.status(), body: r.status() === 202 ? null : await r.json() };
}
const call = async (name: string, args: Record<string, unknown>, token?: string) => {
  const r = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, token);
  const res = r.body.result;
  return { isError: res.isError as boolean, data: res.isError ? res.content[0].text : JSON.parse(res.content[0].text) };
};

test.describe("AI for guests and merchants", () => {
  test("menu assistant: signatures, allergen-safe picks with a safety note, dish stories, budget", async () => {
    const s = await seed();
    const sig = await ask(s.klcc.ref, "What are your signature dishes?");
    expect(sig.items.length).toBeGreaterThan(0);
    const m = await menuItems(s.owner);
    for (const it of sig.items) expect(m.items.find((x) => x.id === it.id)).toBeTruthy();

    const nuts = await ask(s.klcc.ref, "I'm allergic to peanuts, what can I eat?");
    expect(nuts.safetyNote).toMatch(/confirm with staff/);
    expect(nuts.items.length).toBeGreaterThan(0);
    for (const it of nuts.items) expect(m.items.find((x) => x.id === it.id)!.allergens).not.toContain("peanuts");
    expect(nuts.items.map((i: any) => i.name)).not.toContain("Satay (6 sticks)");

    const cheap = await ask(s.klcc.ref, "Something under RM8?");
    for (const it of cheap.items) expect(it.price).toBeLessThanOrEqual(800);
    expect(cheap.items.length).toBeGreaterThan(0);

    const story = await ask(s.klcc.ref, "What's the story behind the char kway teow?");
    expect(story.answer.toLowerCase()).toContain("char kway teow");
    expect(["local", "claude"]).toContain(story.engine);

    await json(s.owner.patch(`/api/m/branches/${s.bangsar.id}/settings`, { data: { modules: { aiAssistant: false } } }));
    expect((await errorOf((await guestClient()).post(`/api/public/branches/${s.bangsar.ref}/assistant`, { data: { messages: [{ role: "user", content: "hi" }] } }), 409)).code).toBe("assistant_off");
  });

  test("menu brain: remembers an allergy across the chat, pairs a drink, plans for a group, follows up", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const chat = async (messages: { role: "user" | "assistant"; content: string }[]) => json((await guestClient()).post(`/api/public/branches/${s.klcc.ref}/assistant`, { data: { messages } }));
    const first = "my son is allergic to peanuts";
    const opener = await chat([{ role: "user", content: first }]);
    const group = await chat([{ role: "user", content: first }, { role: "assistant", content: opener.answer }, { role: "user", content: "we are 4, what should we share?" }]);
    expect(group.items.length).toBeGreaterThanOrEqual(3);
    for (const it of group.items) expect(m.items.find((x) => x.id === it.id)!.allergens).not.toContain("peanuts");
    expect(group.safetyNote).toMatch(/confirm with staff/);

    const pair = await chat([{ role: "user", content: "what drink goes well with curry mee?" }]);
    expect(pair.items.some((it: any) => /drink/i.test(m.categories.find((c) => c.id === (m.items.find((x) => x.id === it.id) as any).categoryId)?.name ?? ""))).toBe(true);

    const noodles = await chat([{ role: "user", content: "what noodles do you have?" }]);
    const cheapest = await chat([{ role: "user", content: "what noodles do you have?" }, { role: "assistant", content: noodles.answer }, { role: "user", content: "which of those is the cheapest?" }]);
    expect(cheapest.items).toHaveLength(1);
    const shown = noodles.items.map((i: any) => i.price);
    expect(cheapest.items[0].price).toBe(Math.min(...shown));

    // the learning loop: each answer is logged, and adding a dish it showed is counted once
    expect(cheapest.turn).toBeTruthy();
    const added = async (item: string) => json((await guestClient()).post(`/api/public/branches/${s.klcc.ref}/assistant/added`, { data: { turn: cheapest.turn, item } }));
    expect((await added(cheapest.items[0].id)).counted).toBe(true);
    expect((await added(cheapest.items[0].id)).counted).toBe(false);
    expect((await added(m.items.find((x) => x.id !== cheapest.items[0].id)!.id)).counted).toBe(false);

    // a bill comes back as an order card, and the guest's edit of it is kept beside what was read
    const bill = await chat([{ role: "user", content: "2 char kway teow, total with service and tax?" }]);
    expect(bill.order.lines[0]).toMatchObject({ name: "Char Kway Teow", count: 2 });
    expect(bill.order.charges.due).toBeGreaterThan(bill.order.subtotal);
    const corrected = async (turn: string, lines: unknown) => json((await guestClient()).post(`/api/public/branches/${s.klcc.ref}/assistant/corrected`, { data: { turn, lines } }));
    const ckt = bill.order.lines[0].id;
    expect((await corrected(bill.turn, [{ id: ckt, count: 1, options: [] }])).kept).toBe(true);
    // (not for a turn without a bill, nor a dish off this menu)
    expect((await corrected(cheapest.turn, [{ id: ckt, count: 1, options: [] }])).kept).toBe(false);
    expect((await corrected(bill.turn, [{ id: "mi_not_on_menu", count: 1, options: [] }])).kept).toBe(false);
  });

  test("merchant onboarding copilot: paste a menu and describe the floor → reviewable draft → apply → checklist progresses", async () => {
    const owner = await staffClient(`${uid("new")}@test.co`, "New Owner");
    const t = await json(owner.api.post("/api/m/tenants", { data: { name: `Kopi Corner ${uid("")}`, branchName: "Main" } }), 201);
    const before = await json(owner.api.get("/api/m/ai/onboarding"));
    expect(before.steps.find((x: any) => x.key === "menu").done).toBe(false);
    await errorOf(owner.api.post("/api/m/ai/onboarding", { data: {} }), 400);
    const draft = await json(
      owner.api.post("/api/m/ai/onboarding", {
        data: {
          about: "Family kopitiam since 1968, famous for our kaya toast.",
          menuText: "BREAKFAST\n★ Kaya Butter Toast - RM4.50 - house-made pandan kaya, butter\nHalf-boiled Eggs - 3.80\nDRINKS\nKopi C - RM3.20\nMilo Dinosaur 6.50 - iced milo heaped with milo powder",
          floorText: "6 two-seaters and 3 tables of 4 that can be pushed together",
        },
      }),
    );
    expect(draft.items.map((i: any) => i.name)).toEqual(["Kaya Butter Toast", "Half-boiled Eggs", "Kopi C", "Milo Dinosaur"]);
    expect(draft.items[0]).toMatchObject({ price: 450, category: "Breakfast", isSignature: true });
    expect(draft.items.find((i: any) => i.name === "Half-boiled Eggs").allergens).toContain("egg");
    expect(draft.items.find((i: any) => i.name === "Kaya Butter Toast").allergens).toEqual(expect.arrayContaining(["gluten", "milk"]));
    expect(draft.tables).toHaveLength(9);
    expect(draft.tables.filter((x: any) => x.mergeGroup)).toHaveLength(3);
    // nothing saved yet
    expect((await json(owner.api.get("/api/m/menu"))).items).toHaveLength(0);
    const applied = await json(owner.api.put("/api/m/ai/onboarding", { data: { branchId: t.branchId, cuisine: draft.cuisine, story: draft.story, items: draft.items, tables: draft.tables } }));
    expect(applied.status.steps.find((x: any) => x.key === "menu").done).toBe(true);
    expect(applied.status.steps.find((x: any) => x.key === "tables").done).toBe(true);
    expect(applied.status.steps.find((x: any) => x.key === "profile").done).toBe(true);
    expect((await json(owner.api.get("/api/m/menu"))).items).toHaveLength(4);
    expect(Object.keys(await tableIds(owner.api, t.branchId))).toHaveLength(9);
  });

  test("insights narrate the day's report from computed facts", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const m = await menuItems(s.owner);
    for (const [label, dish, qty] of [["T1", "Char Kway Teow", 3], ["T2", "Cendol", 1]] as const) {
      const st = await seatWalkIn(s.owner, s.klcc.id, [t[label].id], 2);
      const o = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: m.byName(dish).id, qty }] } }), 201);
      await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${o.id}/pay`, { data: { method: "card", amount: o.total, msgId: uid() } }));
    }
    const report = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/report`));
    expect(report.sales.orders).toBe(2);
    expect(report.items[0].name).toBe("Char Kway Teow");
    expect(report.items[0].qty).toBe(3);
    const ins = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/insights`));
    expect(JSON.stringify(ins)).toContain("Char Kway Teow");
  });

  test("MCP: any guest's AI agent can browse, check queues, join and cancel; merchant tools need a token and respect RBAC", async () => {
    const s = await seed();
    const init = await mcp({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
    expect(init.body.result.serverInfo.name).toBe("beautifood");
    expect(init.body.result.protocolVersion).toBe("2025-06-18");
    expect((await mcp({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    const pub = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = pub.body.result.tools.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(["find_restaurants", "get_menu", "queue_status", "join_queue", "check_ticket", "cancel_ticket", "booking_availability", "create_booking"]));
    expect(names.some((n: string) => n.startsWith("merchant_"))).toBe(false);

    const found = await call("find_restaurants", { query: s.slug.split("-").pop() });
    expect(found.data.map((r: any) => r.branch).sort()).toEqual([s.bangsar.ref, s.klcc.ref].sort());
    const menu = await call("get_menu", { branch: s.klcc.ref, exclude_allergens: ["peanuts"] });
    expect(menu.data.items.length).toBeGreaterThan(5);
    expect(menu.data.items.some((i: any) => i.allergens.includes("peanuts"))).toBe(false);
    expect(menu.data.allergenNote).toMatch(/confirm with staff/);

    const joined = await call("join_queue", { branch: s.klcc.ref, party_size: 3, name: "Agent Smith" });
    expect(joined.data.number).toBe("B001");
    expect(joined.data.trackingUrl).toContain(`/ticket/${joined.data.ticketId}`);
    const chk = await call("check_ticket", { ticket_id: joined.data.ticketId, token: joined.data.token });
    expect(chk.data.status).toBe("waiting");
    const bad = await call("join_queue", { branch: s.klcc.ref, party_size: 0, name: "" });
    expect(bad.isError).toBe(true);
    expect(bad.data).toMatch(/Invalid arguments/);
    const board = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
    expect(board.tickets.find((x: any) => x.id === joined.data.ticketId).source).toBe("agent");
    await call("cancel_ticket", { ticket_id: joined.data.ticketId, token: joined.data.token });
    expect((await call("check_ticket", { ticket_id: joined.data.ticketId, token: joined.data.token })).data.status).toBe("cancelled");

    expect((await mcp({ jsonrpc: "2.0", id: 3, method: "tools/list" }, "bf_pat_wrong")).status).toBe(401);
    const { token } = await json(s.owner.post("/api/m/tokens", { data: { name: "Claude" } }), 201);
    const priv = await mcp({ jsonrpc: "2.0", id: 4, method: "tools/list" }, token);
    expect(priv.body.result.tools.map((t: any) => t.name)).toEqual(expect.arrayContaining(["merchant_overview", "merchant_queue", "merchant_sales_report", "merchant_set_sold_out"]));
    const ov = await call("merchant_overview", {}, token);
    expect(ov.data.branches).toHaveLength(2);
    const m = await menuItems(s.owner);
    const cendol = m.byName("Cendol");
    expect((await call("merchant_set_sold_out", { branch: s.klcc.ref, item_id: cendol.id, sold_out: true }, token)).isError).toBe(false);
    const after = await call("get_menu", { branch: s.klcc.ref });
    expect(after.data.items.map((i: any) => i.name)).not.toContain("Cendol");

    // a waiter's token can't pull sales reports
    const waiter = await hire(s.owner, "waiter", [s.klcc.id]);
    const wt = (await json(waiter.api.post("/api/m/tokens", { data: { name: "w" } }), 201)).token;
    const denied = await call("merchant_sales_report", { branch: s.klcc.ref }, wt);
    expect(denied.isError).toBe(true);
    expect(denied.data).toMatch(/waiter/);
  });

  test("agent discovery docs are published: llms.txt and OpenAPI", async () => {
    const g = await guestClient();
    const llms = await g.get("/llms.txt");
    expect(llms.status()).toBe(200);
    const text = await llms.text();
    expect(text).toContain("/mcp");
    const spec = await json(g.get("/openapi.json"));
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(["/api/public/branches/{branch}/queue"]));
  });
});
