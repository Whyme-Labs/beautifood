// The hybrid avoid reader through the real Firebase AI Logic SDK, with Google's App Check and Gemini
// endpoints stood in for (no key, no network): what the page sends, and what the reading changes.
import { expect, test, type Page } from "@playwright/test";
import { open } from "../helpers";

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
  test("off without App Check: the rules alone answer, and say so", async ({ page }) => {
    await open(page, "/hybrid");
    await expect(page.getByTestId("hybrid-status")).toContainText("switched off");
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
