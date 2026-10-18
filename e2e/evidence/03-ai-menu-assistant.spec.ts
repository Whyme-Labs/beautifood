// Evidence 03 · The AI menu assistant on a guest's phone: signatures, a peanut allergy (with the
// safety note), vegetarian, budget, a dish's story; then the same in 中文; then from the table
// cart, where a recommendation goes straight into the shared cart.
import { expect, test, type Page } from "@playwright/test";
import { menuItems, seatWalkIn, seed, tableIds } from "../helpers";
import { beat } from "./caption";
import { actor, go, PHONE, wrap } from "./stage";

test.afterEach(wrap);

const lastAnswer = (page: Page) => page.getByTestId("assistant-answer").last();

async function ask(page: Page, q: string, inputLabel: string) {
  const n = await page.getByTestId("assistant-answer").count();
  const input = page.getByLabel(inputLabel);
  await input.fill(q);
  await input.press("Enter");
  await expect(page.getByTestId("assistant-answer")).toHaveCount(n + 1, { timeout: 30_000 });
  await lastAnswer(page).scrollIntoViewIfNeeded();
}

test("AI menu assistant: signatures, allergens with a safety note, vegetarian, budget, story — in English and 中文", async ({ browser }, info) => {
  const s = await seed();
  const m = await menuItems(s.owner);
  const peanutDishes = m.items.filter((i) => i.allergens.includes("peanuts")).map((i) => i.name);
  expect(peanutDishes).toEqual(expect.arrayContaining(["Satay (6 sticks)"]));
  const g = await actor(browser, info, "03-ai-menu-assistant", "Guest · AI menu assistant", PHONE);
  const { page, say } = g;

  await test.step("Open the assistant on the branch page", async () => {
    await go(page, `/r/${s.klcc.ref}`);
    await say("Branch page → 'Ask what to eat' opens the AI menu assistant");
    await page.getByRole("button", { name: /Ask what to eat/ }).click();
    await expect(page.getByTestId("assistant")).toBeVisible();
  });

  await test.step("Signatures", async () => {
    await say("Tap a suggestion: “What are your signatures?”");
    await page.getByTestId("assistant").getByRole("button", { name: "What are your signatures?" }).click();
    await expect(page.getByTestId("assistant-answer")).toHaveCount(1, { timeout: 30_000 });
    const a = lastAnswer(page);
    await expect(a).toContainText("Char Kway Teow");
    await expect(a).toContainText("Nasi Lemak Ayam Rempah");
    await say("It recommends the signatures, with prices, from the live menu");
    await beat(page, 1500);
  });

  await test.step("Peanut allergy → safe dishes + safety note", async () => {
    await say("“I'm allergic to peanuts, what can I eat?”");
    await ask(page, "I'm allergic to peanuts, what can I eat?", "Ask the menu assistant");
    const a = lastAnswer(page);
    await expect(a.getByTestId("safety-note")).toContainText("confirm with staff");
    for (const d of peanutDishes) await expect(a).not.toContainText(d);
    await say(`Only peanut-free dishes (none of: ${peanutDishes.join(", ")}) + a safety note`);
    await beat(page, 1500);
  });

  await test.step("Vegetarian, budget and a dish's story", async () => {
    await ask(page, "Anything vegetarian?", "Ask the menu assistant");
    await expect(lastAnswer(page)).toContainText("Vegetarian Mee Goreng");
    await say("“Anything vegetarian?” → Vegetarian Mee Goreng, Garden Salad…");
    await ask(page, "Something under RM8?", "Ask the menu assistant");
    await expect(lastAnswer(page)).toContainText("Teh Tarik");
    await expect(lastAnswer(page)).not.toContainText("Char Kway Teow");
    await say("“Something under RM8?” → only dishes within budget");
    await ask(page, "What's the story behind the char kway teow?", "Ask the menu assistant");
    await expect(lastAnswer(page)).toContainText(/char kway teow/i);
    await say("“What's the story behind the char kway teow?”");
    await beat(page, 1500);
    await page.keyboard.press("Escape");
  });

  await test.step("Same assistant in 中文", async () => {
    await go(page, `/r/${s.klcc.ref}`);
    await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "中" }).click();
    await expect(page.getByRole("heading", { name: "实时排队" })).toBeVisible();
    await say("切换到中文 → 问问吃什么 (the assistant answers in Chinese)");
    await page.getByRole("button", { name: /问问吃什么/ }).click();
    await page.getByTestId("assistant").getByRole("button", { name: "你们的招牌菜是什么？" }).click();
    await expect(page.getByTestId("assistant-answer")).toHaveCount(1, { timeout: 30_000 });
    await expect(lastAnswer(page)).toContainText(/[一-鿿]/);
    await say("“你们的招牌菜是什么？” → signatures, answered in Chinese");
    await ask(page, "我对花生过敏", "向菜单助手提问");
    await expect(lastAnswer(page).getByTestId("safety-note")).toContainText("请在点餐前向店员确认");
    await say("“我对花生过敏” (peanut allergy) → safe picks + the safety note in Chinese");
    await ask(page, "有素食吗？", "向菜单助手提问");
    await expect(lastAnswer(page)).toContainText("素");
    await say("“有素食吗？” (vegetarian?) → vegetarian dishes");
    await beat(page, 1500);
  });

  await test.step("At the table: a recommendation goes straight into the shared cart", async () => {
    const t = await tableIds(s.owner, s.klcc.id);
    const st = await seatWalkIn(s.owner, s.klcc.id, [t.T7.id], 2);
    await go(page, st.sessionUrl);
    await page.getByLabel("你的名字").fill("Lin");
    await page.getByRole("button", { name: "开始点餐" }).click();
    await say("Seated at T7 → 提问 opens the assistant inside the table cart");
    await page.getByRole("button", { name: "提问" }).click();
    await ask(page, "有素食吗？", "向菜单助手提问");
    await lastAnswer(page).getByRole("button", { name: "加入" }).first().click();
    await expect(page.getByTestId("tab-cart")).toContainText("购物车（1）");
    await say("加入 on a recommendation → it's in the table's cart");
    await page.getByTestId("tab-cart").click();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await beat(page, 1500);
  });
});
