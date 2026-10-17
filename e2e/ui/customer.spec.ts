import { expect, test } from "@playwright/test";
import { join, json, open, seed, tableIds } from "../helpers";

test.describe("guest journey (browser)", () => {
  test("queue from the phone → called → seated → two diners share one cart live → send to kitchen", async ({ browser }) => {
    const s = await seed();
    const ann = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await open(ann, `/r/${s.klcc.ref}`);
    await expect(ann.getByTestId("queue-status")).toBeVisible();
    await ann.getByLabel("Party size").fill("1");
    await ann.getByLabel("More people").click();
    await expect(ann.getByLabel("Party size")).toHaveValue("2");
    await ann.getByPlaceholder("What should we call you?").fill("Ann");
    await ann.getByRole("button", { name: "Get my number" }).click();
    await expect(ann).toHaveURL(/\/ticket\//);
    await expect(ann.getByTestId("ticket-number")).toHaveText("A001");
    await expect(ann.getByTestId("ticket-wait")).toContainText("You're next in line");

    // the host calls and seats the party
    const ticketId = new URL(ann.url()).pathname.split("/").pop()!;
    const t = await tableIds(s.owner, s.klcc.id);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${ticketId}/call`, { data: { holdTableIds: [t.T4.id] } }));
    await expect(ann.getByTestId("ticket-called")).toContainText("table T4", { timeout: 15_000 });
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${ticketId}/seat`, { data: { tableIds: [t.T4.id] } }));
    await ann.getByTestId("table-link").click({ timeout: 15_000 });
    await expect(ann).toHaveURL(/\/s\//);
    await ann.getByLabel("Your name").fill("Ann");
    await ann.getByRole("button", { name: "Start ordering" }).click();
    await ann.getByRole("button", { name: "Add Char Kway Teow" }).click();
    await expect(ann.getByTestId("tab-cart")).toContainText("Cart (1)");

    // a friend opens the same table link on their own phone
    const ben = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await open(ben, ann.url());
    await ben.getByLabel("Your name").fill("Ben");
    await ben.getByRole("button", { name: "Start ordering" }).click();
    await ben.getByRole("button", { name: "Add Teh Tarik" }).click();
    await ben.getByRole("button", { name: /^Iced/ }).click();
    await ben.getByRole("button", { name: /^Add ·/ }).click();
    await expect(ben.getByTestId("tab-cart")).toContainText("Cart (2)");
    // Ann's phone picks up Ben's line without a reload
    await expect(ann.getByTestId("tab-cart")).toContainText("Cart (2)", { timeout: 15_000 });
    await expect(ann.getByTestId("participants")).toContainText("Ben");
    await ann.getByTestId("tab-cart").click();
    await expect(ann.getByTestId("cart-line")).toHaveCount(2);
    await expect(ann.getByTestId("cart")).toContainText("Iced");
    await expect(ann.getByTestId("bill-preview")).toBeVisible();
    // Ann can't edit Ben's line
    await expect(ann.getByRole("button", { name: "Add one Teh Tarik" })).toHaveCount(0);

    await ann.getByTestId("send-order").click();
    await ann.getByTestId("tab-bill").click();
    await expect(ann.getByTestId("sent-item")).toHaveCount(2);
    await ben.getByTestId("tab-bill").click();
    await expect(ben.getByTestId("sent-item")).toHaveCount(2, { timeout: 15_000 });
    const kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    expect(kds.find((k) => k.tables.includes("T4")).items.map((i: any) => i.addedBy).sort()).toEqual(["Ann", "Ben"]);
  });

  test("the customer directory shows every restaurant's live queues", async ({ page }) => {
    const s = await seed();
    await join(s.bangsar.ref, 3, "Queued");
    await open(page, "/");
    await page.getByLabel("Search restaurants").fill(s.slug.split("-").pop()!);
    const cards = page.getByTestId("branch-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "Bangsar" })).toContainText("1");
    await cards.filter({ hasText: "Bangsar" }).click();
    await expect(page.getByRole("heading", { name: "Queue now" })).toBeVisible();
    await expect(page.getByTestId("queue-status")).toBeVisible();
  });

  test("menu assistant chat answers allergen questions in the browser", async ({ page }) => {
    const s = await seed();
    await open(page, `/r/${s.klcc.ref}`);
    await page.getByRole("button", { name: /Ask what to eat/ }).click();
    const input = page.getByLabel("Ask the menu assistant");
    await input.fill("I'm allergic to peanuts, what's safe?");
    await input.press("Enter");
    await expect(page.getByRole("dialog")).toContainText("confirm with staff", { timeout: 15_000 });
  });
});
