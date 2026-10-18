// Evidence 02 · Two friends at one table order from one shared cart, each on their own phone.
// Ann scans the printed (static) table QR in English; Mei opens the host's per-seating (dynamic)
// QR link in 中文. Both see each other's dishes live, only edit their own, and one sends the round.
import { expect, test } from "@playwright/test";
import { json, seatWalkIn, seed, tableIds } from "../helpers";
import { beat } from "./caption";
import { actor, go, PHONE, wrap } from "./stage";

test.afterEach(wrap);

test("diner group: static + dynamic table QR, one shared cart across two phones, send to kitchen", async ({ browser }, info) => {
  const s = await seed();
  const t = await tableIds(s.owner, s.klcc.id);
  const ann = await actor(browser, info, "02-diner-group-a", "Diner A · Ann · phone", PHONE);
  const mei = await actor(browser, info, "02-diner-group-b", "Diner B · 美美 · phone (中文)", PHONE);

  await test.step("Ann scans the printed QR on a free table → asked to see the host", async () => {
    await go(ann.page, `/t/${t.T5.staticToken}`);
    await expect(ann.page.getByRole("heading")).toContainText("Table T5");
    await expect(ann.page.getByTestId("qr-message")).toBeVisible();
    await ann.say("Static QR on table T5: nobody is seated yet, so the guest is sent to the host");
    await mei.say("Waiting for the host to seat our party…");
  });

  let seatingId = "";
  await test.step("Host seats the party at T5; Ann scans again and lands in the table cart", async () => {
    const st = await seatWalkIn(s.owner, s.klcc.id, [t.T5.id], 2);
    seatingId = st.seatingId;
    await ann.say("The host seats us at T5 → scan the same printed QR again");
    await go(ann.page, `/t/${t.T5.staticToken}`);
    await expect(ann.page).toHaveURL(/\/s\//);
    await ann.page.getByLabel("Your name").fill("Ann");
    await ann.page.getByRole("button", { name: "Start ordering" }).click();
    await expect(ann.page.getByTestId("menu-list")).toBeVisible();
    await ann.say("Table T5 shared cart · each diner adds from their own phone");
  });

  await test.step("Mei opens the host's dynamic QR link, in Chinese", async () => {
    const link = await json<{ url: string }>(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${seatingId}/link`));
    expect(link.url).toMatch(/^\/s\//);
    await go(mei.page, `${link.url}&lang=zh`);
    await mei.say("Dynamic QR from the host stand (expires when the table closes) · 中文");
    await mei.page.getByLabel("你的名字").fill("美美");
    await mei.page.getByRole("button", { name: "开始点餐" }).click();
    await expect(mei.page.getByTestId("menu-list")).toBeVisible();
    await expect(mei.page.getByTestId("dish").filter({ hasText: "Teh Tarik" }).locator(".alt")).toHaveText("Teh Tarik");
    await mei.say("Menu in Chinese, original dish names underneath");
  });

  await test.step("Both add dishes; each phone sees the other's lines live", async () => {
    await ann.page.getByRole("button", { name: "Add Char Kway Teow" }).click();
    await ann.page.getByRole("button", { name: "Add Nasi Lemak Ayam Rempah" }).click();
    await expect(ann.page.getByTestId("tab-cart")).toContainText("Cart (2)");
    await ann.say("Ann adds Char Kway Teow and Nasi Lemak");

    await mei.page.getByTestId("dish").filter({ hasText: "Teh Tarik" }).getByRole("button", { name: /^加入/ }).click();
    const dlg = mei.page.getByRole("dialog");
    await mei.say("美美 adds Teh Tarik (拉茶) → required option: iced");
    await dlg.locator(".chip").nth(3).click(); // Temperature → Iced (+0.50)
    await dlg.getByRole("button", { name: /^加入 ·/ }).click();
    await expect(mei.page.getByTestId("tab-cart")).toContainText("购物车（3）", { timeout: 15_000 });
    await mei.say("Mei's cart already shows 3: Ann's two dishes arrived without a reload");

    await expect(ann.page.getByTestId("tab-cart")).toContainText("Cart (3)", { timeout: 15_000 });
    await expect(ann.page.getByTestId("participants")).toContainText("美美");
    await ann.page.getByTestId("tab-cart").click();
    await expect(ann.page.getByTestId("cart-line")).toHaveCount(3);
    await expect(ann.page.getByTestId("cart")).toContainText("美美");
    // Ann can change her own lines but not Mei's
    await expect(ann.page.getByRole("button", { name: "Add one Char Kway Teow" })).toBeVisible();
    await expect(ann.page.getByRole("button", { name: "Add one Teh Tarik" })).toHaveCount(0);
    await expect(ann.page.getByTestId("bill-preview")).toBeVisible();
    await ann.say("Ann sees 美美's Teh Tarik (iced) · she can edit only her own lines");

    await mei.page.getByTestId("tab-cart").click();
    await expect(mei.page.getByTestId("cart-line")).toHaveCount(3);
    await expect(mei.page.getByTestId("cart")).toContainText("Ann");
    await mei.say("美美's view of the same cart, grouped by person, in Chinese");
  });

  await test.step("Ann sends the round; both phones show the bill", async () => {
    await ann.page.getByTestId("send-order").click();
    await expect(ann.page.getByTestId("sent-item")).toHaveCount(3);
    await ann.say("Send to kitchen · 3 dishes on the bill, marked by who ordered them");
    await mei.page.getByTestId("tab-bill").click();
    await expect(mei.page.getByTestId("sent-item")).toHaveCount(3, { timeout: 15_000 });
    await expect(mei.page.getByTestId("order-total")).toBeVisible();
    await mei.say("美美's phone shows the same bill · 呼叫服务员 (call a waiter)");
    await mei.page.getByRole("button", { name: "呼叫服务员" }).click();
    await expect(mei.page.getByText("服务员马上就来")).toBeVisible();

    const kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    const tk = kds.find((k) => k.tables.includes("T5"));
    expect(tk.items.map((i: any) => i.addedBy).sort()).toEqual(["Ann", "Ann", "美美"]);
    const board = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
    expect(board.staffCalls.some((c: any) => c.reason === "waiter")).toBe(true);
    await ann.say("The kitchen gets one ticket for T5; the host stand sees the waiter call");
    await beat(ann.page, 1500);
  });
});
