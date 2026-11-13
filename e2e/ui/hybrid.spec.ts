// The hybrid avoid reader through the real Firebase AI Logic SDK, with Google's App Check and Gemini
// endpoints stood in for (no key, no network): what the page sends, and what the reading changes.
import { expect, test, type Page } from "@playwright/test";
import { menuItems, open, seed } from "../helpers";

const READING = { allergens: ["fish", "crustaceans", "molluscs"], diets: [], meats: [], alcohol: false };

async function fakeGoogle(page: Page, reading: object = READING) {
  const sent: { url: string; body: string }[] = [];
  await page.route(/googleapis\.com|google\.com\/recaptcha|gstatic\.com/, async (route) => {
    const url = route.request().url();
    if (/exchangeDebugToken/.test(url)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "e2e-app-check", ttl: "3600s" }) });
    if (/:generateContent/.test(url)) {
      sent.push({ url, body: route.request().postData() ?? "" });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(reading) }] }, finishReason: "STOP" }] }) });
    }
    return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  // the App Check debug provider, as a developer would turn it on (never shipped)
  await page.addInitScript(() => localStorage.setItem("bf-appcheck-debug", "e2e-debug-token"));
  return sent;
}

test.describe("hybrid avoid reader (browser)", () => {
  test("when the model can't be reached, the rules alone answer, and say so", async ({ page }) => {
    // (no network to Google: no App Check token, no model)
    await page.route(/googleapis\.com|google\.com\/recaptcha|gstatic\.com/, (route) => route.abort());
    await open(page, "/hybrid");
    await page.getByTestId("hybrid-example").first().click();
    await expect(page.getByTestId("hybrid-readings")).toContainText("Model read: not available here");
    await expect(page.getByTestId("hybrid-answer-rules")).toContainText("Curry Laksa Set");
    await expect(page.getByTestId("hybrid-answer-hybrid")).toHaveCount(0);
  });

  test("a cloud reading the rules missed keeps seafood off the answer", async ({ page }) => {
    const sent = await fakeGoogle(page);
    await open(page, "/hybrid");
    await page.getByTestId("hybrid-example").first().click();
    await expect(page.getByTestId("hybrid-added")).toContainText("fish, crustaceans, molluscs");
    await expect(page.getByTestId("hybrid-source")).toContainText("in the cloud");
    // the rules alone still offer the laksa; with the reading, nothing from the sea
    await expect(page.getByTestId("hybrid-answer-rules")).toContainText("Curry Laksa Set");
    const hybrid = page.getByTestId("hybrid-answer-hybrid");
    await expect(hybrid).toContainText("Vegetarian Mee Goreng Set");
    await expect(hybrid).not.toContainText("Curry Laksa");
    await expect(hybrid).not.toContainText("Nasi Lemak");
    // what Firebase AI Logic was asked: the cloud model, our JSON schema, our instruction, the guest's words
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain("/projects/beautifood-hybrid/models/gemini-3.5-flash-lite:generateContent");
    const body = JSON.parse(sent[0].body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.properties.allergens.items.enum).toContain("tree_nuts");
    expect(JSON.stringify(body.systemInstruction)).toContain("must not be served");
    expect(JSON.stringify(body.contents)).toContain("no ocean stuff");
  });

  test("a reading outside the vocabulary, or one that says less, never loosens the answer", async ({ page }) => {
    await fakeGoogle(page, { allergens: ["shellfish", "nothing"], diets: ["keto"], meats: [], alcohol: false });
    await open(page, "/hybrid");
    await page.locator('input[aria-label="Your message"]').fill("I'm allergic to peanuts, what's good?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByTestId("hybrid-readings")).toContainText("Rules read: peanuts");
    await expect(page.getByTestId("hybrid-readings")).toContainText("Model read: nothing to avoid");
    await expect(page.getByTestId("hybrid-added")).toHaveCount(0);
    const rules = await page.getByTestId("hybrid-answer-rules").innerText();
    await expect(page.getByTestId("hybrid-answer-hybrid")).toContainText(rules.split("\n").slice(1).join("\n").slice(0, 60));
  });
});

test.describe("the kiosk answers by itself (browser)", () => {
  test("on the kiosk: the reading keeps seafood off, and with the network gone it still answers", async ({ page, context }) => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const seafood = new Set(m.items.filter((i) => i.allergens.some((a: string) => ["fish", "crustaceans", "molluscs"].includes(a))).map((i) => i.name));
    await fakeGoogle(page);
    await open(page, `/r/${s.klcc.ref}/kiosk`);
    await page.getByTestId("kiosk-ask").click();
    const box = page.getByTestId("kiosk-assistant");
    await expect(box.getByRole("button", { name: /allergic to prawns/ })).toBeEnabled();
    await box.locator("input").fill("doctor says no ocean stuff for me, what's good?");
    await box.getByRole("button", { name: "Ask", exact: true }).click();
    const answer = box.getByTestId("kiosk-answer").last();
    await expect(answer).toContainText("Answered on this kiosk");
    await expect(box.getByTestId("kiosk-hint-added")).toContainText("fish");
    for (const li of await answer.locator("li").allInnerTexts()) expect(seafood.has(li.trim())).toBe(false);
    if (process.env.SHOTS) await page.setViewportSize({ width: 820, height: 1180 }), await page.screenshot({ path: `${process.env.SHOTS}/kiosk-ask.png`, fullPage: true });
    // the restaurant's Wi-Fi drops: the kiosk keeps answering from the menu it holds
    await context.setOffline(true);
    await expect(box.getByTestId("kiosk-offline")).toBeVisible();
    await box.locator("input").fill("I'm allergic to peanuts, anything to drink?");
    await box.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(box.getByTestId("kiosk-answer")).toHaveCount(2);
    await expect(box.getByTestId("kiosk-answer").last()).not.toBeEmpty();
    // the next guest starts fresh
    await box.getByRole("button", { name: "New guest" }).click();
    await expect(box.getByTestId("kiosk-answer")).toHaveCount(0);
    await context.setOffline(false);
  });
});
