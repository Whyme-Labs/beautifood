import { expect, test, type BrowserContext } from "@playwright/test";
import { BASE, join, json, open, uid } from "../helpers";

async function signUp(ctx: BrowserContext, name = "Olivia Owner") {
  const email = `${uid("ui")}@test.co`;
  const r = await ctx.request.post("/api/auth/sign-up/email", { data: { email, password: "password-123456", name }, headers: { origin: BASE } });
  expect(r.status(), await r.text()).toBe(200);
  return email;
}

async function seededOwner(ctx: BrowserContext) {
  await signUp(ctx);
  const r = await ctx.request.post(`/api/dev/seed?name=${encodeURIComponent(`UI Resto ${uid("")}`)}`);
  expect(r.status()).toBe(201);
  const s = await r.json();
  return { ...s, klcc: s.branches[0], bangsar: s.branches[1] };
}

test.describe("merchant console (browser)", () => {
  test("sign up in the UI, create a restaurant, paste a menu, AI drafts it, apply", async ({ page }) => {
    await open(page, "/m/login");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Your name").fill("Faye");
    await page.getByLabel("Email").fill(`${uid("faye")}@test.co`);
    await page.getByLabel("Password").fill("password-123456");
    await page.getByRole("button", { name: "Create account" }).click();
    // a new account has no restaurant yet, so the console sends it to setup
    await page.waitForURL(/\/m\/setup/);
    await page.locator("html[data-hydrated]").waitFor();
    await page.getByLabel("Restaurant name").fill(`Faye's Noodle Bar ${uid("")}`);
    await page.getByLabel("First branch").fill("Damansara");
    await page.getByRole("button", { name: "Create restaurant" }).click();
    await expect(page.getByRole("heading", { name: /AI setup/ })).toBeVisible();
    await page.getByTestId("menu-text").fill("NOODLES\n★ Wonton Mee - RM12.90 - egg noodles, char siu, prawn wontons\nPan Mee 11.50\nPho Bo - RM15.90 - beef broth, rice noodles, basil\nDRINKS\nLime Juice - 5.00");
    await page.getByTestId("floor-text").fill("4 two-seaters and 2 tables of 4");
    await page.getByRole("button", { name: "Generate my setup" }).click();
    await expect(page.getByTestId("draft-item")).toHaveCount(4);
    await expect(page.getByTestId("draft-table")).toHaveCount(6);
    // pho broth is seasoned with fish sauce, though the line doesn't say: suggested, and added by the owner
    const pho = page.getByTestId("draft-item").filter({ has: page.locator('input[value="Pho Bo"]') });
    await pho.locator("summary").click();
    await expect(pho.getByTestId("likely-allergen")).toContainText("Often contains Fish");
    await pho.getByTestId("likely-allergen").getByRole("button", { name: "Add" }).click();
    await expect(pho.getByTestId("likely-allergen")).toHaveCount(0);
    await expect(pho.locator("summary")).toContainText(/Fish/);
    await page.getByTestId("apply-draft").click();
    await expect(page.getByTestId("setup-done")).toContainText("Applied 4 dishes and 6 tables");
    await open(page, "/m");
    await expect(page.getByTestId("onboarding")).toBeVisible();
  });

  test("boss dashboard shows every branch; host seats the suggested party; kitchen bumps; POS takes payment", async ({ page, context }) => {
    const s = await seededOwner(context);
    await join(s.klcc.ref, 2, "Walk-in Wendy");
    await join(s.bangsar.ref, 4, "Bangsar Bob");

    await open(page, "/m");
    await expect(page.getByTestId("branch-overview").locator("section")).toHaveCount(2);
    await expect(page.getByTestId("totals")).toContainText("2"); // two waiting across branches

    await page.getByTestId("branch-overview").locator("section", { hasText: "KLCC" }).getByRole("button", { name: "Open host stand" }).click();
    await expect(page).toHaveURL(/\/m\/host/);
    const sg = page.getByTestId("suggestion").first();
    await expect(sg).toContainText("A001");
    await sg.getByRole("button", { name: "Seat" }).click();
    await expect(page.getByTestId("ticket-row")).toHaveCount(0);

    // ring up an order for that table at the POS
    const board = await json(context.request.get(`/api/m/branches/${s.klcc.id}/board`));
    const seating = board.seatings[0];
    const menu = await json(context.request.get("/api/m/menu"));
    const dish = menu.items.find((i: any) => i.name === "Curry Mee");
    const order = await json(context.request.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: seating.id, items: [{ itemId: dish.id, qty: 2 }] } }), 201);

    await open(page, "/m/kitchen");
    const ticket = page.getByTestId("kds-ticket").filter({ hasText: "Curry Mee" });
    await expect(ticket).toBeVisible();
    await ticket.getByRole("button", { name: "All ready", exact: true }).click();
    await expect(ticket.getByRole("button", { name: "Served", exact: true })).toBeVisible();

    await open(page, "/m/pos");
    await page.getByTestId("open-bills").getByRole("button").filter({ hasText: order.number }).click();
    await expect(page.getByTestId("bill-item")).toHaveCount(1);
    await page.getByLabel("Cash tendered").fill("100");
    await page.getByRole("button", { name: "Pay cash" }).click();
    await expect(page.getByTestId("payment-row")).toHaveCount(1);
    await expect(page.getByText(/Change: \d+\.\d\d/)).toBeVisible();
    const after = await json(context.request.get(`/api/m/branches/${s.klcc.id}/orders/${order.id}`));
    expect(after.status).toBe("paid");
  });

  test("halal settings: certify the branch by JAKIM, guests see the badge, then set it back", async ({ page, context }) => {
    const s = await seededOwner(context);
    const standing = async () => (await json(context.request.get(`/api/public/branches/${s.klcc.ref}`))).halal;
    await open(page, "/m/settings");
    const card = page.getByTestId("halal-settings");
    await card.getByTestId("halal-certified").check();
    await card.getByTestId("halal-certifier").fill("JAKIM");
    await card.getByLabel("Certificate no.").fill("1234");
    await card.getByTestId("halal-valid-until").fill("2099-12-31");
    if (process.env.HALAL_SHOT) await card.screenshot({ path: process.env.HALAL_SHOT });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect.poll(async () => (await standing()).standing).toBe("certified");
    expect(await standing()).toMatchObject({ certifier: "JAKIM", certNo: "1234", validUntil: "2099-12-31" });

    await open(page, `/r/${s.klcc.ref}/menu`);
    await expect(page.getByTestId("halal-badge")).toContainText("Halal-certified · JAKIM");
    await expect(page.getByTestId("halal-badge")).toContainText("Cert. 1234");
    if (process.env.HALAL_MENU_SHOT) await page.screenshot({ path: process.env.HALAL_MENU_SHOT, clip: { x: 0, y: 0, width: 1280, height: 360 } });

    await open(page, "/m/settings");
    await page.getByTestId("halal-settings").getByTestId("halal-none").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect.poll(async () => (await standing()).standing).toBe("none");
    await open(page, `/r/${s.klcc.ref}/menu`);
    await expect(page.getByTestId("halal-badge")).toHaveCount(0);
  });
});
