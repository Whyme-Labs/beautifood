// Evidence 06 · The POS, run by a branch manager: cash drawer shift, open bill, add a round, void,
// discount and promo code, N-way split preview, split by items, a member pays partly with points,
// multi-tender (points + card + cash with change), refund, e-receipt, close the drawer.
import { expect, test } from "@playwright/test";
import { eventually, hire, inbox, json, menuItems, runPipeline, seatWalkIn, seed, tableIds } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, go, signInAs, wrap } from "./stage";

test.afterEach(wrap);

test("cashier POS: drawer, discount, promo, splits, points + card + cash with change, refund", async ({ browser }, info) => {
  const s = await seed();
  const t = await tableIds(s.owner, s.klcc.id);
  const m = await menuItems(s.owner);
  const st = await seatWalkIn(s.owner, s.klcc.id, [t.T1.id], 3);
  const o = await json(
    s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, {
      data: { seatingId: st.seatingId, items: [["Char Kway Teow", 2], ["Rojak", 1], ["Cendol", 1], ["Nasi Kerabu", 1]].map(([n, qty]) => ({ itemId: m.byName(n as string).id, qty })) },
    }),
    201,
  );
  // Ali is a loyalty member with points to spend
  const ali = (await json(s.owner.get("/api/m/members?q=ali%40example.com"))).members[0];
  await json(s.owner.post(`/api/m/members/${ali.id}`, { data: { delta: 500, reason: "Welcome gift" } }));
  const mgr = await hire(s.owner, "branch_manager", [s.klcc.id], "Farah (manager)");

  const c = await actor(browser, info, "06-cashier", "Cashier · POS · desktop", DESKTOP);
  const { page, say } = c;
  await signInAs(c, mgr.api);
  const orderUrl = (id: string) => `/api/m/branches/${s.klcc.id}/orders/${id}`;
  const bill = page.getByTestId("bill");

  await test.step("Open the cash drawer shift", async () => {
    await go(page, "/m/pos");
    await expect(page.getByTestId("shift")).toContainText("No cash drawer open");
    await say("Start of shift: open the cash drawer with a RM200 float");
    c.answers.push("200.00");
    await page.getByRole("button", { name: "Open drawer" }).click();
    await expect(page.getByTestId("shift")).toContainText("Open since");
    await expect(page.getByTestId("shift")).toContainText("200.00");
  });

  await test.step("Open T1's bill and add a round", async () => {
    await page.getByTestId("open-bills").getByRole("button").filter({ hasText: o.number }).click();
    await expect(page.getByTestId("bill-item")).toHaveCount(4);
    await say(`Open bill #${o.number} for T1 (4 dishes)`);
    await page.getByRole("button", { name: "Add Iced Barley" }).click();
    await expect(page.getByTestId("draft-round")).toContainText("Iced Barley");
    await page.getByTestId("draft-round").getByRole("button", { name: /Send 1 to kitchen/ }).click();
    await expect(page.getByTestId("bill-item")).toHaveCount(5);
    await say("Add a round from the POS menu → sent to the kitchen, on the same bill");
  });

  await test.step("Void with a reason", async () => {
    await page.getByLabel("Select Rojak").check();
    c.answers.push("Guest changed their mind");
    await page.getByRole("button", { name: "Void 1" }).click();
    await expect(page.getByTestId("bill-item").filter({ hasText: "Rojak" })).toContainText("voided: Guest changed their mind");
    await say("Void Rojak (reason required) → the bill reprices");
  });

  await test.step("Manager discount, then a promo code instead", async () => {
    await bill.getByRole("button", { name: "-10%" }).click();
    await expect(bill).toContainText("Discount (10% manager discount)");
    await say("-10% manager discount: service charge and tax recompute on the discounted subtotal");
    await bill.getByRole("button", { name: "Remove discount" }).click();
    await expect(bill).not.toContainText("10% manager discount");
    await bill.getByLabel("Promo code").fill("WELCOME10");
    await bill.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Promo applied")).toBeVisible();
    const after = await json(s.owner.get(orderUrl(o.id)));
    expect(after.discountSpec.code).toBe("WELCOME10");
    expect(after.discount).toBeGreaterThan(0);
    await say("Promo code WELCOME10 (10% off, min spend RM30) applied instead");
  });

  await test.step("Preview an equal 3-way split", async () => {
    await bill.getByLabel("Split ways").fill("3");
    await bill.getByRole("button", { name: "Show shares" }).click();
    await expect(page.getByTestId("split-plan").locator(".badge")).toHaveCount(3);
    const plan = await json(s.owner.post(`${orderUrl(o.id)}/split_plan`, { data: { ways: 3 } }));
    const now = await json(s.owner.get(orderUrl(o.id)));
    expect(plan.parts.reduce((a: number, b: number) => a + b, 0)).toBe(now.total);
    await say("Split evenly 3 ways: shares that add up to the cent");
    await beat(page);
  });

  let splitNumber = "";
  await test.step("Split by items: Cendol goes on its own bill and is paid by card", async () => {
    await bill.getByRole("button", { name: "Split by items" }).click();
    await page.getByLabel("Select Cendol").check();
    await say("Split by items: tick Cendol → move it to a new bill on the same table");
    await page.getByRole("button", { name: "Move 1 to new bill" }).click();
    await expect(bill).toContainText(`#${o.number}-A`);
    await expect(page.getByTestId("bill-item")).toHaveCount(1);
    splitNumber = `${o.number}-A`;
    await page.getByTestId("pay-panel").getByRole("button", { name: "Pay card" }).click();
    await expect(page.getByTestId("payment-row")).toHaveCount(1);
    await expect(bill).toContainText("Paid");
    await say(`Bill #${splitNumber} paid by card`);
  });

  await test.step("Multi-tender: member points + card + cash with change", async () => {
    await page.getByTestId("open-bills").getByRole("button").filter({ hasText: new RegExp(`#${o.number}(?!-)`) }).click();
    await expect(page.getByTestId("bill-item")).toHaveCount(4);
    await bill.getByLabel("Guest email").fill("ali@example.com");
    await bill.getByRole("button", { name: "Attach" }).click();
    await expect(bill.getByRole("button", { name: "Pay with points" })).toBeVisible();
    await say("Attach member ali@example.com → he earns points, gets an e-receipt, can pay with points");
    const pay = page.getByTestId("pay-panel");
    await pay.getByLabel("Payment amount").fill("2.00");
    await pay.getByRole("button", { name: "Pay with points" }).click();
    await expect(page.getByTestId("payment-row")).toHaveCount(1);
    await say("RM2.00 paid with 200 loyalty points");
    await pay.getByLabel("Payment amount").fill("10.00");
    await pay.getByLabel("Split label").fill("Alice");
    await pay.getByRole("button", { name: "Pay card" }).click();
    await expect(page.getByTestId("payment-row")).toHaveCount(2);
    await say("RM10.00 on Alice's card");
    await pay.getByLabel("Split label").fill("");
    await pay.getByLabel("Cash tendered").fill("100");
    await expect(pay.locator(".pos-change")).toContainText("Change");
    await say("The rest in cash: RM100 tendered, change shown before paying");
    await pay.getByRole("button", { name: "Pay cash" }).click();
    await expect(page.getByTestId("payment-row")).toHaveCount(3);
    await expect(page.getByTestId("payment-row").filter({ hasText: "Cash" })).toContainText("change");
    await expect(bill).toContainText("Paid");
    const paid = await json(s.owner.get(orderUrl(o.id)));
    expect(paid.status).toBe("paid");
    expect(paid.payments.map((p: any) => p.method).sort()).toEqual(["card", "cash", "points"]);
    await say("Settled with three tenders: points + card + cash (with change)");
    await beat(page);
  });

  await test.step("Refund part of the card payment", async () => {
    c.answers.push("5.00", "Cold noodles");
    await page.getByTestId("payment-row").filter({ hasText: "Card (Alice)" }).getByRole("button", { name: "Refund" }).click();
    await expect(page.getByTestId("payment-row").filter({ hasText: "Card (Alice)" })).toContainText("refunded");
    const r = await json(s.owner.get(orderUrl(o.id)));
    expect(r.refunded).toBe(500);
    await say("Refund RM5.00 of Alice's card payment (reason: cold noodles)");
    await expect(bill.getByRole("link", { name: "View e-receipt" })).toBeVisible();
  });

  await test.step("E-receipt and points for the member", async () => {
    const receiptHref = await bill.getByRole("link", { name: "View e-receipt" }).getAttribute("href");
    await runPipeline(s.owner);
    await go(page, receiptHref!);
    const rc = page.getByTestId("receipt");
    await expect(rc).toContainText("Char Kway Teow");
    await expect(rc).toContainText("Paid · Points");
    await expect(rc).toContainText("Paid · Cash");
    await say("The e-receipt: every tender, plus the points Ali earned");
    const mail = await eventually(async () => (await inbox(s.owner, "ali@example.com", "receipt"))[0], 20_000);
    expect(mail.subject).toContain("Your receipt from");
    await beat(page, 1500);
  });

  await test.step("Close the drawer: expected vs counted", async () => {
    const paid = await json(s.owner.get(orderUrl(o.id)));
    const cash = paid.payments.find((p: any) => p.method === "cash").amount;
    await go(page, "/m/pos");
    c.answers.push(((20000 + cash - 50) / 100).toFixed(2)); // 50 sen short
    await say("End of shift: count the drawer (50 sen short)");
    await page.getByRole("button", { name: "Close drawer" }).click();
    await expect(page.getByTestId("shift")).toContainText("No cash drawer open");
    expect(c.alerts.at(-1)).toMatch(/^Expected .*variance .*-.*0\.50/);
    await say(`Drawer closed · ${c.alerts.at(-1)}`);
    await beat(page, 2000);
  });
});
