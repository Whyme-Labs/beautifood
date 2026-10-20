import { expect, test } from "@playwright/test";
import { hire, json, menuItems, open, runPipeline, seatWalkIn, seed, tableIds, uid } from "../helpers";

test.describe("QR, receipts and role-aware console (browser)", () => {
  test("static table QR: free table asks for staff; once seated, scanning lands in that table's shared cart", async ({ page }) => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    await open(page, `/t/${t.T5.staticToken}`);
    await expect(page.getByRole("heading")).toContainText("Table T5");
    await expect(page.getByTestId("qr-message")).toBeVisible();
    await seatWalkIn(s.owner, s.klcc.id, [t.T5.id], 2);
    await open(page, `/t/${t.T5.staticToken}`);
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
    await open(page, `/receipt/${paid.payment.receiptToken}`);
    const r = page.getByTestId("receipt");
    await expect(r).toContainText("Rojak");
    await expect(r).toContainText((o.total / 100).toFixed(2));
    await expect(r).toContainText("KLCC");
  });

  test("a cashier signs in and only sees the tools their role allows", async ({ page }) => {
    const s = await seed();
    const cashier = await hire(s.owner, "cashier", [s.klcc.id], "Cass");
    await open(page, "/m/login");
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

  test("an owner connects their own web address from the storefront editor", async ({ page }) => {
    const s = await seed();
    const host = `www.${uid("ui").toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    await open(page, "/m/login");
    await page.getByLabel("Email").fill(s.ownerEmail);
    await page.getByLabel("Password").fill("password-123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/m$/);
    await open(page, "/m/storefront");
    const card = page.getByTestId("sf-domains");
    await expect(card).toContainText(`${s.slug}.stores.test`);
    await card.getByTestId("sf-domain-input").fill(host);
    await card.getByTestId("sf-domain-add").click();
    const row = card.getByTestId("sf-domain");
    await expect(row).toHaveAttribute("data-status", "pending");
    await expect(row).toContainText("CNAME");
    await expect(row).toContainText("Waiting for DNS");
    if (process.env.SHOTS) await card.screenshot({ path: `${process.env.SHOTS}/domains-pending.png` });
    await row.getByRole("button", { name: "Check now" }).click();
    await expect(row).toHaveAttribute("data-status", "active");
    await expect(row.getByRole("link", { name: host })).toBeVisible();
    if (process.env.SHOTS) await card.screenshot({ path: `${process.env.SHOTS}/domains-live.png` });
  });

  test("an owner adds a dish field in Settings, fills it in on a dish, and guests see it on the menu", async ({ page }) => {
    const s = await seed();
    await open(page, "/m/login");
    await page.getByLabel("Email").fill(s.ownerEmail);
    await page.getByLabel("Password").fill("password-123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/m$/);
    await open(page, "/m/settings");
    const card = page.getByTestId("custom-fields");
    await card.getByRole("button", { name: "Halal certified" }).click();
    await expect(card.getByTestId("cf-row")).toContainText("Halal certified");
    await expect(card.getByTestId("cf-row")).toContainText("On menu");
    // a private one too, by hand
    await card.getByTestId("cf-name").fill("Supplier");
    await card.getByTestId("cf-add").click();
    await expect(card.getByTestId("cf-row")).toHaveCount(2);
    if (process.env.SHOTS) await card.screenshot({ path: `${process.env.SHOTS}/fields-settings.png` });

    await open(page, "/m/menu");
    await page.getByTestId("menu-item").filter({ hasText: "Rojak" }).getByRole("button", { name: "Edit" }).click();
    const form = page.getByTestId("cf-form-dish");
    await form.locator('[data-field="halal_certified"]').check();
    await form.locator('[data-field="supplier"]').fill("Pak Ali");
    if (process.env.SHOTS) await form.screenshot({ path: `${process.env.SHOTS}/fields-dish.png` });
    await form.getByTestId("cf-save").click();
    await expect(page.getByText("Details saved")).toBeVisible();

    await open(page, `/r/${s.klcc.ref}/menu`);
    const dish = page.getByTestId("dish").filter({ hasText: "Rojak" });
    await expect(dish.getByTestId("dish-facts")).toHaveText("Halal certified");
    await expect(page.getByText("Pak Ali")).toHaveCount(0);
  });
});
