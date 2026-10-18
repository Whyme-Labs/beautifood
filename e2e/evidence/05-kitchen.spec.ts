// Evidence 05 · The kitchen display: tickets per table and round, filtered per station
// (kitchen / bar / dessert), items bumped preparing → ready, the whole ticket served;
// in 中文 the cook sees Chinese names with the original underneath.
import { expect, test } from "@playwright/test";
import { json, menuItems, seatWalkIn, seed, tableIds } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, go, signInAs, wrap } from "./stage";

test.afterEach(wrap);

test("kitchen display: per-station tickets, bump items cooking → ready, mark served", async ({ browser }, info) => {
  const s = await seed();
  const t = await tableIds(s.owner, s.klcc.id);
  const m = await menuItems(s.owner);
  const order = async (label: string, lines: [string, number, any[]?][]) => {
    const st = await seatWalkIn(s.owner, s.klcc.id, [t[label].id], 2);
    return json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: lines.map(([n, qty, modifiers]) => ({ itemId: m.byName(n).id, qty, modifiers })) } }), 201);
  };
  const o1 = await order("T1", [["Char Kway Teow", 2], ["Teh Tarik", 1, [{ group: "Temperature", option: "Iced" }]], ["Cendol", 1]]);
  await order("T2", [["Nasi Kerabu", 1], ["Kopi O", 2], ["Ais Kacang", 1]]);

  const k = await actor(browser, info, "05-kitchen", "Kitchen · KDS · desktop", DESKTOP);
  const { page, say } = k;
  await signInAs(k, s.owner);
  const ticket = (table: string) => page.getByTestId("kds-ticket").filter({ hasText: `Table ${table}` });

  await test.step("All stations: one ticket per table and round", async () => {
    await go(page, "/m/kitchen");
    await expect(page.getByTestId("kds-ticket")).toHaveCount(2);
    await expect(ticket("T1")).toContainText("Char Kway Teow");
    await expect(ticket("T1")).toContainText("Iced");
    await expect(ticket("T2")).toContainText("Nasi Kerabu");
    await say("Kitchen display: T1 and T2, oldest first, with modifiers (Teh Tarik · Iced)");
    await beat(page);
  });

  await test.step("Filter by station", async () => {
    const stations = page.getByRole("group", { name: "Station" });
    await stations.getByRole("button", { name: "Bar" }).click();
    await expect(ticket("T1")).toContainText("Teh Tarik");
    await expect(ticket("T1")).not.toContainText("Char Kway Teow");
    await expect(ticket("T2")).toContainText("Kopi O");
    await say("Bar station: only drinks (Teh Tarik, Kopi O)");
    await stations.getByRole("button", { name: "Dessert" }).click();
    await expect(ticket("T1")).toContainText("Cendol");
    await expect(ticket("T1")).not.toContainText("Teh Tarik");
    await expect(ticket("T2")).toContainText("Ais Kacang");
    await say("Dessert station: Cendol, Ais Kacang");
    await stations.getByRole("button", { name: "Kitchen" }).click();
    await expect(ticket("T1")).toContainText("Char Kway Teow");
    await expect(ticket("T1")).not.toContainText("Cendol");
    await say("Kitchen station: the hot food");
    await stations.getByRole("button", { name: "All stations" }).click();
    await expect(page.getByTestId("kds-ticket")).toHaveCount(2);
  });

  await test.step("Bump one dish through preparing → ready", async () => {
    const t1 = ticket("T1");
    await t1.getByRole("button", { name: "Char Kway Teow: Cooking" }).click();
    await expect(t1.getByRole("button", { name: "Char Kway Teow: Ready" })).toBeVisible();
    await say("Tap a dish to bump it: Char Kway Teow → Cooking");
    await t1.getByRole("button", { name: "Char Kway Teow: Ready" }).click();
    await expect(t1).toContainText("2 left");
    await say("…→ Ready. The ticket shows 2 dishes left");
  });

  await test.step("All ready → Served", async () => {
    const t1 = ticket("T1");
    await t1.getByRole("button", { name: "All ready", exact: true }).click();
    await expect(t1.getByRole("button", { name: "Served", exact: true })).toBeVisible();
    await say("All ready → the pass calls the runner; then Served");
    await t1.getByRole("button", { name: "Served", exact: true }).click();
    await expect(page.getByTestId("kds-ticket")).toHaveCount(1);
    const after = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${o1.id}`));
    expect(after.items.every((i: any) => i.status === "served")).toBe(true);
    await say("T1 served and cleared from the screen; T2 is still cooking");
  });

  await test.step("The cook reads Chinese; the original name stays underneath", async () => {
    await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "中" }).click();
    await expect(page.getByRole("heading", { name: "厨房" })).toBeVisible();
    const t2 = page.getByTestId("kds-ticket").filter({ hasText: "T2 桌" });
    await expect(t2).toContainText("Nasi Kerabu");
    await expect(t2.locator(".kds-name").first()).toHaveText(/[一-鿿]/);
    await say("中文 KDS: dish names in Chinese, the original (menu) name underneath");
    await beat(page, 2000);
  });
});
