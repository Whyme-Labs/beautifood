// Evidence 08 · Marketing: loyalty members and tiers, a points adjustment, a new promo code,
// a promo broadcast to a segment, and the outbox of guest emails (incl. a guest who queued in
// 中文 and got their emails in Chinese). Then a member checks their points on their phone.
import { expect, test } from "@playwright/test";
import { eventually, guestClient, hire, inbox, json, runPipeline, seed, tableIds, uid } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, go, PHONE, signInAs, wrap } from "./stage";

test.afterEach(wrap);

test("marketing: members, points, promo codes, campaign to a segment, outbox (EN + 中文), member rewards", async ({ browser }, info) => {
  const s = await seed();
  // a guest queues in Chinese with their email and joins the loyalty programme; the host calls them
  const hongEmail = `${uid("xiaohong")}@example.com`;
  const g = await guestClient();
  const j = await json(g.post(`/api/public/branches/${s.klcc.ref}/queue`, { data: { partySize: 2, name: "小红", email: hongEmail, joinLoyalty: true }, headers: { "x-lang": "zh" } }));
  const t = await tableIds(s.owner, s.klcc.id);
  await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${j.ticket.id}/call`, { data: { holdTableIds: [t.T2.id] } }));
  await runPipeline(s.owner);
  const mk = await hire(s.owner, "marketing", ["*"], "Maya (marketing)");

  const m = await actor(browser, info, "08-marketing", "Marketing · console · desktop", DESKTOP);
  const { page, say } = m;
  await signInAs(m, mk.api);
  const subject = `Durian season is here ${uid("").slice(-3)}`;

  await test.step("Loyalty members", async () => {
    await go(page, "/m/members");
    await expect(page.getByRole("heading", { name: "Loyalty & promotions" })).toBeVisible();
    await expect(page.getByTestId("member-row")).toHaveCount(4);
    await expect(page.getByTestId("member-row").filter({ hasText: hongEmail })).toContainText("小红");
    await say("Marketing role: 4 loyalty members, incl. 小红 who joined while queueing");
  });

  await test.step("Adjust a member's points", async () => {
    await page.getByLabel("Search members").fill("ali@");
    await expect(page.getByTestId("member-row")).toHaveCount(1);
    await page.getByRole("button", { name: "Adjust points for Ali" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Points to add (negative to remove)").fill("150");
    await dlg.getByLabel("Reason").fill("Birthday bonus");
    await say("Search Ali → add 150 points (reason: birthday bonus)");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("member-row")).toContainText("150");
    await expect(page.getByTestId("member-row")).toContainText("Bronze");
    await say("Ali: 150 points, Bronze tier");
    await page.getByLabel("Search members").fill("");
  });

  await test.step("Create a promo code", async () => {
    await page.getByLabel("Code", { exact: true }).fill("DURIAN15");
    await page.getByLabel("Value").fill("15");
    await page.getByLabel("Min spend").fill("40");
    await page.getByLabel("Max uses").fill("50");
    await say("New promo code DURIAN15: 15% off over RM40, max 50 uses");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".promo-code", { hasText: "DURIAN15" })).toBeVisible();
    await expect(page.getByText("0/50 used")).toBeVisible();
  });

  await test.step("Broadcast the promo to a segment", async () => {
    await page.getByLabel("Name", { exact: true }).fill("Durian season");
    await page.getByLabel("Subject").fill(subject);
    await page.getByLabel(/^Message/).fill("Hi {name},\n\nMusang King cendol is back this weekend!");
    await page.getByLabel("Audience").selectOption("all");
    await page.getByLabel("Promo code (optional)").fill("DURIAN15");
    await page.getByRole("button", { name: "Preview audience" }).click();
    await expect(page.getByText("4 recipients")).toBeVisible();
    await say("Campaign to all opted-in members with DURIAN15 → preview: 4 recipients");
    await page.getByRole("button", { name: "Send campaign" }).click();
    const row = page.getByTestId("campaign-row").filter({ hasText: "Durian season" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("4/4 sent", { timeout: 30_000 });
    await expect(row).toContainText("Sent");
    await say("Sent through the broadcast queue: 4/4 delivered, one email each");
    await beat(page);
  });

  await test.step("Outbox: the campaign email", async () => {
    await go(page, "/m/inbox");
    await expect(page.getByRole("heading", { name: "Outbox" })).toBeVisible();
    await page.getByLabel("Recipient").fill("ali@example.com");
    const mail = page.locator(".inbox-row").filter({ hasText: subject });
    await expect(mail).toHaveCount(1);
    await mail.click();
    const frame = page.frameLocator("iframe[title='Email preview']");
    await expect(frame.locator("body")).toContainText("Hi Ali");
    await expect(frame.locator("body")).toContainText("DURIAN15");
    await say("Outbox: every guest email · Ali's campaign email with his name and the promo code");
    await beat(page, 1500);
  });

  await test.step("Outbox: 小红's queue emails arrived in Chinese", async () => {
    await page.getByLabel("Recipient").fill(hongEmail);
    const rows = page.locator(".inbox-row");
    await expect(rows.filter({ hasText: "Table ready" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Queue ticket" })).toHaveCount(1);
    await rows.filter({ hasText: "Table ready" }).click();
    const frame = page.frameLocator("iframe[title='Email preview']");
    await expect(frame.locator("body")).toContainText("T2");
    await expect(frame.locator("body")).toContainText(/[一-鿿]{4,}/);
    await expect(page.locator(".inbox-preview h2")).toHaveText(/[一-鿿]/);
    await say("小红 queued in 中文, so her 'table ready' email is in Chinese");
    await beat(page, 2000);
  });

  // Ali checks his points on his phone (passwordless: a 6-digit code by email)
  const ali = await actor(browser, info, "08-marketing-b-member", "Member Ali · rewards · phone", PHONE);
  await test.step("Member signs in with an emailed code and sees his points", async () => {
    await go(ali.page, `/me?tenant=${s.slug}`);
    await ali.page.getByLabel("Email").fill("ali@example.com");
    await ali.say("Ali opens 'My rewards' and asks for a sign-in code");
    await ali.page.getByRole("button", { name: "Email me a code" }).click();
    const otp = await eventually(async () => (await inbox(s.owner, "ali@example.com", "otp"))[0], 20_000);
    const code = otp.subject.match(/^(\d{6})/)![1];
    await ali.page.getByLabel("6-digit code").fill(code);
    await ali.say(`Code ${code} from the email → sign in`);
    await ali.page.getByRole("button", { name: "Sign in" }).click();
    const card = ali.page.getByTestId("member");
    await expect(card).toContainText("150");
    await expect(card).toContainText("Bronze");
    await expect(card).toContainText(/to Silver|Silver/);
    await ali.say("150 points (Bronze) and how far to the next tier");
    await beat(ali.page, 2000);
  });
});
