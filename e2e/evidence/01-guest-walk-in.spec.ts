// Evidence 01 · A walk-in guest on their phone, in 中文: directory → branch → queue ticket with
// place and ETA → preorder while waiting → called (Web Push + email) → seated → order more from
// the table's shared cart → bill → e-receipt.
import { expect, test } from "@playwright/test";
import { BASE, eventually, guestClient, inbox, join, json, runPipeline, seed, tableIds, uid } from "../helpers";
import { beat } from "./caption";
import { actor, go, PHONE, wrap } from "./stage";

test.afterEach(wrap);

test("guest walk-in: queue from the phone, preorder, get called, order at the table, e-receipt", async ({ browser }, info) => {
  const s = await seed();
  // two parties already in the 1–2 pax line, and one at the other branch
  await join(s.klcc.ref, 2, "Aisha");
  await join(s.klcc.ref, 1, "Ravi");
  await join(s.bangsar.ref, 4, "Bangsar family");
  const t = await tableIds(s.owner, s.klcc.id);
  const email = `${uid("xiaoming")}@example.com`;

  const g = await actor(browser, info, "01-guest-walk-in", "Guest · phone", PHONE);
  const { page, say } = g;

  await test.step("Directory: every restaurant's live queue", async () => {
    await go(page, "/eat");
    await say("Guest opens Beautifood: every branch's live queue at a glance");
    await page.getByLabel("Search restaurants").fill(s.slug.split("-").pop()!);
    const cards = page.getByTestId("branch-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "KLCC" })).toContainText("2 waiting");
    await expect(cards.filter({ hasText: "Bangsar" })).toContainText("1 waiting");
    await say("KLCC: 2 parties waiting · Bangsar: 1 waiting. Tap KLCC");
    await cards.filter({ hasText: "KLCC" }).click();
    await page.waitForURL(/\/r\//);
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByRole("heading", { name: "Queue now" })).toBeVisible();
    await expect(page.getByTestId("queue-status")).toBeVisible();
  });

  await test.step("Switch to 中文 (remembered)", async () => {
    await say("Branch page with live lines per party size. Switch language → 中");
    await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "中" }).click();
    await expect(page.getByRole("heading", { name: "实时排队" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
    await say("切换到中文 · The whole page is now in Simplified Chinese");
  });

  let ticketUrl = "";
  await test.step("Join the queue → ticket with place in line and ETA", async () => {
    await page.getByPlaceholder("我们该怎么称呼你？").fill("小明");
    await page.getByLabel(/电邮/).fill(email);
    await say("取号排队 · Party of 2, name 小明, email for alerts and e-receipts");
    await page.getByRole("button", { name: "取号" }).click();
    await page.waitForURL(/\/ticket\//);
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByTestId("ticket-number")).toHaveText("A003");
    await expect(page.getByTestId("ticket-wait")).toContainText("前面还有 2 组");
    await expect(page.getByTestId("ticket-stub")).toContainText("预计等候");
    ticketUrl = page.url();
    await say("Ticket A003 · 前面还有 2 组 (2 parties ahead) · 预计等候 = ETA");
    await beat(page, 1500);
  });
  const ticketId = new URL(ticketUrl).pathname.split("/").pop()!;
  const ticketToken = new URL(ticketUrl).searchParams.get("k")!;

  // The phone's browser subscribes to Web Push; headless Chromium has no push service, so the
  // subscription points at the dev push sink, which records what the server delivers.
  const endpoint = `${BASE}/api/dev/push-sink?sub=${uid()}`;
  await json((await guestClient()).post(`/api/public/tickets/${ticketId}/push?k=${encodeURIComponent(ticketToken)}`, { data: { endpoint } }));

  await test.step("Preorder while waiting", async () => {
    await say("现在先点 · Preorder while waiting, so food comes as soon as we sit");
    await page.getByTestId("preorder").click();
    await page.waitForURL(/\/s\//);
    await page.locator("html[data-hydrated]").waitFor();
    await page.getByLabel("你的名字").fill("小明");
    await page.getByRole("button", { name: "开始点餐" }).click();
    await expect(page.getByRole("heading", { name: "排队预点" })).toBeVisible();
    const ckt = page.getByTestId("dish").filter({ hasText: "Char Kway Teow" });
    await expect(ckt.locator(".alt")).toHaveText("Char Kway Teow"); // Chinese name, original underneath
    await say("Menu in Chinese with the original dish name underneath");
    await ckt.getByRole("button", { name: /^加入/ }).click();
    await page.getByTestId("dish").filter({ hasText: "Cendol" }).getByRole("button", { name: /^加入/ }).click();
    await expect(page.getByTestId("tab-cart")).toContainText("购物车（2）");
    await page.getByTestId("tab-cart").click();
    await expect(page.getByTestId("cart-line")).toHaveCount(2);
    await expect(page.getByTestId("bill-preview")).toBeVisible();
    await say("Cart: 2 dishes, bill estimate from the same Rust core as the POS");
    await page.getByTestId("send-order").click();
    await expect(page.getByTestId("sent-item")).toHaveCount(2);
    await say("预点已保存 · Preorder saved — it fires to the kitchen when we are seated");
    await beat(page);
  });
  const b0 = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
  expect(b0.tickets.find((x: any) => x.id === ticketId).sessionId).toBeTruthy();

  await test.step("The host calls our number → Web Push + email, ticket turns 'called'", async () => {
    await go(page, ticketUrl);
    await expect(page.getByTestId("ticket-number")).toHaveText("A003");
    await say("Back on the ticket… the host stand calls A003 to table T4");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${ticketId}/call`, { data: { holdTableIds: [t.T4.id] } }));
    await expect(page.getByTestId("ticket-called")).toContainText("T4", { timeout: 20_000 });
    await expect(page.getByTestId("ticket-called")).toContainText("你的桌子准备好了");
    await say("你的桌子准备好了 · Table T4 is ready (the page updates live)");
    await runPipeline(s.owner);
    const push = await eventually(async () => (await json<any[]>(s.owner.get("/api/dev/push-sink"))).find((p) => endpoint.endsWith(p.path.replace("/api/dev/push-sink", ""))), 20_000);
    expect(push.vapid).toBe(true);
    const kinds = await eventually(async () => {
      const k = await inbox(s.owner, email);
      return k.some((e) => e.kind === "ticket_called") ? k : null;
    }, 20_000);
    expect(kinds.map((e) => e.kind).sort()).toEqual(["ticket_called", "ticket_joined"]);
    // the guest queued in Chinese, so their emails are in Chinese
    expect(kinds.find((e) => e.kind === "ticket_called")!.subject).toMatch(/[一-鿿]/);
    await say("Also delivered: a VAPID-signed Web Push and a 'table ready' email in Chinese");
    await beat(page);
  });

  await test.step("Seated → open the table's shared cart and order more", async () => {
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${ticketId}/seat`, { data: { tableIds: [t.T4.id] } }));
    await expect(page.getByTestId("table-link")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("ticket-stub")).toContainText("你已入座 T4");
    await say("Seated at T4 · 打开本桌菜单点餐 opens the table's shared cart");
    await page.getByTestId("table-link").click();
    await page.waitForURL(/\/s\//);
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByRole("heading", { name: "桌边点餐" })).toBeVisible();
    await page.getByTestId("tab-bill").click();
    // the preorder became the table's bill and went to the kitchen on seating
    await expect(page.getByTestId("sent-item")).toHaveCount(2);
    await expect(page.getByTestId("bill")).toContainText("已送厨");
    await say("The preorder is now on the table bill and already fired to the kitchen");
    await page.getByRole("tab", { name: "菜单" }).click();
    await page.getByTestId("dish").filter({ hasText: "Iced Barley" }).getByRole("button", { name: /^加入/ }).click();
    await expect(page.getByTestId("tab-cart")).toContainText("购物车（1）");
    await say("Add a drink from the table menu → 送到厨房 (send to kitchen)");
    await page.getByTestId("send-order").click();
    await expect(page.getByTestId("sent-item")).toHaveCount(3);
    await expect(page.getByTestId("order-total")).toBeVisible();
    await say("Bill: 3 items, subtotal + 10% service + 6% tax, total");
    await beat(page);
  });

  await test.step("Ask for the bill → staff pays it → e-receipt", async () => {
    await page.getByRole("button", { name: "请求结账" }).click();
    await expect(page.getByText("已通知店员你要结账")).toBeVisible();
    const board = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
    expect(board.staffCalls.some((c: any) => c.reason === "bill")).toBe(true);
    await say("请求结账 · The host stand sees 'T4 wants the bill'");
    const seating = board.seatings.find((x: any) => x.tableIds.includes(t.T4.id));
    const order = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${seating.orderId}`));
    expect(order.items).toHaveLength(3);
    const paid = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${order.id}/pay`, { data: { method: "cash", amount: order.due, tendered: Math.ceil(order.due / 5000) * 5000, msgId: uid() } }));
    expect(paid.order.status).toBe("paid");
    await runPipeline(s.owner);
    await go(page, `/receipt/${paid.payment.receiptToken}`);
    const r = page.getByTestId("receipt");
    await expect(r).toContainText("Char Kway Teow");
    await expect(r).toContainText("KLCC");
    await expect(r).toContainText("已付 · 现金");
    await expect(r).toContainText((order.total / 100).toFixed(2));
    await say("E-receipt in Chinese: dishes, service charge, tax, paid in cash");
    await page.mouse.wheel(0, 600);
    await beat(page, 2500);
  });
});
