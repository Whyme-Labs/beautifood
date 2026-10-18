// Evidence 07 · The owner: sign up → AI onboarding copilot (paste menu + floor → review → apply)
// → translate the menu to 中文 and correct one dish → settings (queue classes, modules, menu
// language) → the boss dashboard across branches → reports with menu engineering → invite a
// cashier, who signs up from the link and only sees what a cashier may use.
import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";
import { BASE, join, json, menuItems, seatWalkIn, tableIds, uid } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, go, wrap } from "./stage";

test.afterEach(wrap);

const MENU = `NOODLES
★ Wonton Mee - RM12.90 - egg noodles, char siu, prawn wontons
Pan Mee - RM11.50 - hand-torn noodles, anchovies, egg
RICE
Nasi Lemak - RM14.90 - coconut rice, sambal, peanuts, anchovies, egg
DRINKS
Kopi C - RM3.20
Lime Juice - RM5.00`;

async function sell(api: APIRequestContext, branchId: string, label: string, lines: [string, number][]) {
  const t = await tableIds(api, branchId);
  const m = await menuItems(api);
  const st = await seatWalkIn(api, branchId, [t[label].id], 2);
  const o = await json(api.post(`/api/m/branches/${branchId}/orders`, { data: { seatingId: st.seatingId, items: lines.map(([n, qty]) => ({ itemId: m.byName(n).id, qty })) } }), 201);
  await json(api.post(`/api/m/branches/${branchId}/orders/${o.id}/pay`, { data: { method: "card", amount: o.total, msgId: uid() } }));
  return o;
}

test("owner: sign up, AI onboarding, translate menu, settings, multi-branch dashboard, reports, team & RBAC", async ({ browser }, info) => {
  const o = await actor(browser, info, "07-owner", "Owner · console · desktop", DESKTOP);
  const { page, say } = o;
  const email = `${uid("olivia")}@test.co`;
  const name = `Kopi & Noodle House ${uid("").slice(-4)}`;

  await test.step("Sign up", async () => {
    await go(page, "/m/login");
    await say("A new restaurant owner signs up for Beautifood");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Your name").fill("Olivia Tan");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password-123456");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/m\/setup/);
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByRole("heading", { name: "Set up your restaurant" })).toBeVisible();
    await page.getByLabel("Restaurant name").fill(name);
    await page.getByLabel("Cuisine").fill("Malaysian kopitiam");
    await page.getByLabel("First branch").fill("Damansara");
    await say("No restaurant yet → name it and its first branch");
    await page.getByRole("button", { name: "Create restaurant" }).click();
    await expect(page.getByRole("heading", { name: /AI setup/ })).toBeVisible();
  });

  await test.step("AI onboarding copilot: paste the menu, describe the floor, review, apply", async () => {
    await page.getByLabel(/About your restaurant/).fill("Family kopitiam since 1975. Hand-made wontons every morning.");
    await page.getByTestId("menu-text").fill(MENU);
    await page.getByTestId("floor-text").fill("4 two-seaters and 2 tables of 4 that can be pushed together");
    await say("AI setup: paste the menu as-is (★ = signature) and describe the floor in words");
    await page.getByRole("button", { name: "Generate my setup" }).click();
    await expect(page.getByTestId("draft-item")).toHaveCount(5);
    await expect(page.getByTestId("draft-table")).toHaveCount(6);
    await expect(page.getByLabel("Wonton Mee is a signature")).toBeChecked();
    await expect(page.getByLabel("Pan Mee is a signature")).not.toBeChecked();
    await expect(page.getByTestId("draft-item").filter({ hasText: "Nasi Lemak" })).toContainText(/Peanuts/i);
    await say("Draft to review: 5 dishes with categories, prices, inferred allergens, the ★ signature; 6 tables");
    await page.mouse.wheel(0, 500);
    await beat(page, 1500);
    await page.getByTestId("apply-draft").click();
    await expect(page.getByTestId("setup-done")).toContainText("Applied 5 dishes and 6 tables");
    await say("Applied to Damansara: the menu and floor plan are live");
    await go(page, "/m");
    await expect(page.getByTestId("onboarding")).toBeVisible();
    await say("Dashboard shows the setup checklist and what to do next");
  });

  const tenant = await json(page.context().request.get("/api/m/tenant"));
  const ref = `${tenant.slug}~${tenant.branches[0].slug}`;

  await test.step("Translate the menu to 中文 and correct one dish", async () => {
    await go(page, "/m/menu");
    await expect(page.getByTestId("menu-translate")).toContainText("Your menu is written in English");
    // applying the AI draft already machine-translated the new dishes
    await expect(page.getByTestId("menu-item").filter({ hasText: "No 中文 yet" })).toHaveCount(0);
    await say("Menu languages: written in English; guests reading 中文 get a translation");
    await page.getByTestId("menu-translate").getByLabel(/Refresh machine translations/).check();
    await page.getByTestId("menu-translate").getByRole("button", { name: "Translate menu" }).click();
    await expect(page.getByTestId("translate-result")).toContainText("中文");
    await expect(page.getByTestId("translate-result")).toContainText("Engine: Built-in glossary");
    await say("One tap re-translates the menu into 中文 (no API key here → built-in hawker glossary)");
    await page.getByTestId("menu-item").filter({ hasText: "Wonton Mee" }).getByRole("button", { name: "Edit" }).click();
    const tr = page.getByTestId("item-translation");
    await expect(tr.getByLabel("Name in 中文")).toHaveValue("云吞面");
    await expect(tr.getByTestId("translation-source")).toHaveText("Glossary");
    await tr.scrollIntoViewIfNeeded();
    await say("Edit Wonton Mee → the owner corrects the Chinese name");
    await tr.getByLabel("Name in 中文").fill("招牌手工云吞面");
    await tr.getByRole("button", { name: "Save 中文" }).click();
    await expect(tr.getByTestId("translation-source")).toHaveText("Manual");
    await say("Saved as a manual translation (kept when the menu is re-translated)");
    await page.keyboard.press("Escape");

    await go(page, `/r/${ref}/menu?lang=zh`);
    const dish = page.getByTestId("dish").filter({ hasText: "Wonton Mee" });
    await expect(dish.locator(".name")).toHaveText("招牌手工云吞面");
    await expect(dish.locator(".alt")).toHaveText("Wonton Mee");
    await say("What a guest reading Chinese sees: the owner's wording, the original underneath");
    await beat(page, 1500);
    await go(page, "/m/settings?lang=en");
  });

  await test.step("Settings: queue classes, modules, menu language", async () => {
    await expect(page.getByRole("heading", { name: "Settings · Damansara" })).toBeVisible();
    const classes = page.locator(".settings-class");
    await expect(classes).toHaveCount(4);
    await say("Queue size classes: each party size gets its own line and ticket prefix");
    await classes.nth(1).getByLabel("Max").fill("5");
    await classes.nth(2).getByLabel("Min").fill("6");
    await page.getByLabel("Kiosk").uncheck();
    await say("Medium now 3–5, Large 6–8 · switch off the Kiosk module");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    const cfg = (await json(page.context().request.get("/api/m/tenant"))).branches[0].config;
    expect(cfg.categories[1].max).toBe(5);
    expect(cfg.categories[2].min).toBe(6);
    expect(cfg.modules.kiosk).toBe(false);
    await page.getByTestId("menu-language").selectOption("zh");
    await say("Menu language: the language dish names are written in (here: switch to 中文)");
    await page.getByRole("button", { name: "Save language" }).click();
    await expect(page.getByText("Menu language saved")).toBeVisible();
    expect((await json(page.context().request.get("/api/m/tenant"))).menuLanguage).toBe("zh");
    await page.getByTestId("menu-language").selectOption("en");
    await page.getByRole("button", { name: "Save language" }).click();
    await expect(page.getByRole("button", { name: "Save language" })).toBeDisabled();
    expect((await json(page.context().request.get("/api/m/tenant"))).menuLanguage).toBe("en");
    await say("…and back to English. Saved per restaurant, applies to every branch");
  });

  // The owner also runs a busier two-branch restaurant (the demo data), with today's trade.
  const demo = await json(page.context().request.post(`/api/dev/seed?name=${encodeURIComponent(`Beautifood ${uid("").slice(-4)}`)}`), 201);
  const api = await pwRequest.newContext({ baseURL: BASE, storageState: await page.context().storageState(), extraHTTPHeaders: { "x-auth-trusted-key": process.env.AUTH_TRUSTED_KEY ?? "e2e-trusted", origin: BASE, "x-tenant": demo.tenantId } });
  const [klcc, bangsar] = demo.branches;
  await sell(api, klcc.id, "T1", [["Char Kway Teow", 3], ["Kopi O", 1]]);
  await sell(api, klcc.id, "T2", [["Char Kway Teow", 2], ["Cendol", 2]]);
  await sell(api, klcc.id, "T3", [["Nasi Kerabu", 1], ["Kopi O", 2]]);
  await sell(api, bangsar.id, "T1", [["Hainanese Chicken Rice", 2], ["Ais Kacang", 1]]);
  await sell(api, bangsar.id, "T2", [["Penang Assam Laksa", 1]]);
  await join(klcc.ref, 2, "Walk-in");
  await join(klcc.ref, 4, "Family");
  await join(bangsar.ref, 2, "Couple");

  await test.step("Boss dashboard across branches", async () => {
    await go(page, "/m");
    const switcher = page.getByLabel("Restaurant");
    await expect(switcher).toBeVisible();
    await say("The owner also runs a two-branch restaurant → switch restaurant");
    await switcher.selectOption(demo.tenantId);
    await page.waitForLoadState("load");
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByText("All 2 branches, live")).toBeVisible();
    const branches = page.getByTestId("branch-overview").locator("section");
    await expect(branches).toHaveCount(2);
    await expect(page.getByTestId("totals")).toContainText("5"); // bills today across both branches
    await expect(page.getByTestId("totals")).toContainText("3"); // waiting across both branches
    await expect(page.getByTestId("insights")).toContainText("Char Kway Teow");
    const ov = await json(api.get("/api/m/overview"));
    expect(ov.totals.orders).toBe(5);
    expect(ov.totals.waiting).toBe(3);
    await say("Every branch live: waiting, occupancy, open bills, today's sales · totals across branches");
    await page.mouse.wheel(0, 600);
    await say("7-day trend and AI insights narrated from today's numbers");
    await beat(page, 1500);
  });

  await test.step("Reports with menu engineering", async () => {
    await go(page, "/m/reports");
    await expect(page.getByTestId("report-sales")).toContainText("Bills");
    await expect(page.getByTestId("report-sales")).toContainText("3");
    const best = page.locator("table").filter({ hasText: "Char Kway Teow" });
    await expect(best).toContainText("5");
    await expect(best.locator(".badge").first()).toHaveText(/Star|Plowhorse|Puzzle|Dog/);
    await say("KLCC Z-report: sales, takings by method, queue & table KPIs");
    await page.mouse.wheel(0, 600);
    await say("Best sellers classified Star / Plowhorse / Puzzle / Dog (menu engineering)");
    await beat(page, 1500);
    await page.getByTestId("branch-select").selectOption({ label: "Bangsar" });
    await expect(page.getByRole("heading", { name: "Report · Bangsar" })).toBeVisible();
    await expect(page.locator("table").filter({ hasText: "Hainanese Chicken Rice" })).toBeVisible();
    await say("Switch branch → Bangsar's own report");
    await page.getByTestId("branch-select").selectOption({ label: "KLCC" });
  });

  let inviteUrl = "";
  await test.step("Team: invite a cashier for KLCC", async () => {
    await go(page, "/m/staff");
    await page.getByLabel("Name", { exact: true }).fill("Cass Lee");
    const cassEmail = `${uid("cass")}@test.co`;
    await page.getByLabel("Email", { exact: true }).fill(cassEmail);
    await page.getByLabel("Role").selectOption("cashier");
    await page.getByRole("checkbox", { name: "KLCC" }).check();
    await say("Team → invite Cass as a Cashier, KLCC branch only");
    await page.getByRole("button", { name: "Create invite link" }).click();
    await expect(page.getByTestId("invite-link")).toContainText("/m/join?code=");
    inviteUrl = (await page.getByTestId("invite-link").locator("code").textContent())!;
    await say("Invite link created — send it to Cass");
    o.answers.push(cassEmail); // remembered for the cashier's sign-up below
  });

  const cassEmail = o.answers.pop()!;
  const c = await actor(browser, info, "07-owner-b-cashier", "Cashier Cass · console · desktop", DESKTOP);
  await test.step("Cass accepts the invite and sees only a cashier's tools", async () => {
    await go(c.page, new URL(inviteUrl).pathname + new URL(inviteUrl).search);
    await c.say("Cass opens the invite link");
    await c.page.getByRole("link", { name: "sign in or create an account" }).click();
    await c.page.waitForURL(/\/m\/login/);
    await c.page.locator("html[data-hydrated]").waitFor();
    await c.page.getByRole("button", { name: "New here? Create an account" }).click();
    await c.page.getByLabel("Your name").fill("Cass Lee");
    await c.page.getByLabel("Email").fill(cassEmail);
    await c.page.getByLabel("Password").fill("password-123456");
    await c.page.getByRole("button", { name: "Create account" }).click();
    await c.page.waitForURL(/\/m\/join/);
    await c.page.locator("html[data-hydrated]").waitFor();
    await c.say("Account created → accept the invitation");
    await c.page.getByRole("button", { name: "Accept invitation" }).click();
    await c.page.waitForURL(/\/m$/);
    await c.page.locator("html[data-hydrated]").waitFor();
    const nav = c.page.getByTestId("staff-nav");
    await expect(nav.getByRole("link", { name: "POS" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Host stand" })).toBeVisible();
    for (const hidden of ["Team", "Reports", "Settings", "Menu", "Kitchen"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
    await expect(c.page.getByTestId("branch-select")).not.toContainText("Bangsar");
    await c.say("Role-limited: Cass sees Dashboard, Host stand, POS, Bookings — KLCC only; no Team, Reports, Settings, Menu");
    await beat(c.page, 2000);

    await go(page, "/m/staff");
    await expect(page.getByTestId("staff-row").filter({ hasText: "Cass Lee" })).toContainText("Cashier");
    await say("Back on the owner's Team page: Cass is on the team as Cashier");
    await beat(page, 1200);
  });
});
