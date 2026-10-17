import { expect, test } from "@playwright/test";
import { hire, json, menuItems, runPipeline, seatWalkIn, seed, tableIds, uid } from "../helpers";

test.describe("QR, receipts and role-aware console (browser)", () => {
  test("static table QR: free table asks for staff; once seated, scanning lands in that table's shared cart", async ({ page }) => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    await page.goto(`/t/${t.T5.staticToken}`);
    await expect(page.getByRole("heading")).toContainText("Table T5");
    await expect(page.getByTestId("qr-message")).toBeVisible();
    await seatWalkIn(s.owner, s.klcc.id, [t.T5.id], 2);
    await page.goto(`/t/${t.T5.staticToken}`);
    await expect(page).toHaveURL(/\/s\//);
    await page.getByLabel("Your name").fill("Scanner");
    await page.getByRole("button", { name: "Start ordering" }).click();
    await expect(page.getByTestId("menu-list")).toBeVisible();
  });

  test("e-receipt page renders the paid bill", async ({ page }) => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const m = await menuItems(s.owner);
    const st = await seatWalkIn(s.owner, s.klcc.id, [t.T6.id], 2);
    const o = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: m.byName("Rojak").id, qty: 2 }] } }), 201);
    const paid = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${o.id}/pay`, { data: { method: "ewallet", amount: o.total, msgId: uid() } }));
    await runPipeline(s.owner);
    await page.goto(`/receipt/${paid.payment.receiptToken}`);
    const r = page.getByTestId("receipt");
    await expect(r).toContainText("Rojak");
    await expect(r).toContainText((o.total / 100).toFixed(2));
    await expect(r).toContainText("KLCC");
  });

  test("a cashier signs in and only sees the tools their role allows", async ({ page }) => {
    const s = await seed();
    const cashier = await hire(s.owner, "cashier", [s.klcc.id], "Cass");
    await page.goto("/m/login");
    await page.getByLabel("Email").fill(cashier.email);
    await page.getByLabel("Password").fill("password-123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/m$/);
    const nav = page.getByTestId("staff-nav");
    await expect(nav.getByRole("link", { name: "POS" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Host stand" })).toBeVisible();
    for (const hidden of ["Team", "Reports", "Settings", "Menu", "Loyalty & promos"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
    await expect(page.getByTestId("branch-select")).not.toContainText("Bangsar");
  });
});
