// Evidence 10 · The self-service kiosk at the door (tablet) and the "now calling" TV board.
// Guests take numbers on the kiosk; the board shows each line's length and wait, and the
// numbers the host calls (with their table), live; it can run in 中文 too.
import { expect, test } from "@playwright/test";
import { json, seed, tableIds } from "../helpers";
import { beat } from "./caption";
import { actor, go, TABLET, TV, wrap } from "./stage";

test.afterEach(wrap);

test("kiosk + display: take numbers at the door, the TV board shows lines and called numbers", async ({ browser }, info) => {
  const s = await seed();
  const t = await tableIds(s.owner, s.klcc.id);
  const tv = await actor(browser, info, "10-display-tv", "Entrance TV · now calling", TV);
  const kiosk = await actor(browser, info, "10-kiosk-tablet", "Kiosk · tablet at the door", TABLET);

  await test.step("The TV board starts empty", async () => {
    await go(tv.page, `/r/${s.klcc.ref}/display`);
    await expect(tv.page.getByRole("heading", { level: 1 })).toContainText("KLCC");
    await expect(tv.page.getByTestId("now-calling")).toContainText("—");
    await tv.say("Entrance TV: nobody called yet; each line's waiting count and ETA");
  });

  await test.step("A party of 4 takes a number on the kiosk", async () => {
    await go(kiosk.page, `/r/${s.klcc.ref}/kiosk`);
    await expect(kiosk.page.getByRole("heading", { name: "How many in your party?" })).toBeVisible();
    await kiosk.say("Kiosk: big buttons for the party size");
    await kiosk.page.getByRole("button", { name: "4", exact: true }).click();
    await kiosk.page.getByPlaceholder("Your name (optional)").fill("Lim");
    await kiosk.page.getByRole("button", { name: "Get my number" }).click();
    await expect(kiosk.page.getByTestId("kiosk-number")).toHaveText("B001");
    await kiosk.say("Number B001 — watch the screen. 'Done' resets for the next guest");
    await beat(kiosk.page, 1500);
    await kiosk.page.getByRole("button", { name: "Done" }).click();
  });

  await test.step("A couple takes the next number", async () => {
    await expect(kiosk.page.getByRole("heading", { name: "How many in your party?" })).toBeVisible();
    await kiosk.page.getByRole("button", { name: "2", exact: true }).click();
    await kiosk.page.getByRole("button", { name: "Get my number" }).click();
    await expect(kiosk.page.getByTestId("kiosk-number")).toHaveText("A001");
    await kiosk.say("A couple (no name needed) → A001");
    await beat(kiosk.page, 1200);
    const board = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
    expect(board.tickets.filter((x: any) => x.source === "kiosk")).toHaveLength(2);
  });

  await test.step("The host calls numbers; the TV shows them with the table", async () => {
    const board = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
    const b001 = board.tickets.find((x: any) => x.number === "B001");
    const a001 = board.tickets.find((x: any) => x.number === "A001");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${b001.id}/call`, { data: { holdTableIds: [t.P1.id] } }));
    await expect(tv.page.getByTestId("now-calling")).toContainText("B001", { timeout: 15_000 });
    await expect(tv.page.getByTestId("now-calling")).toContainText("Table P1");
    await tv.say("Host calls B001 → the board shows it with table P1 (and reads it aloud)");
    await beat(tv.page, 1500);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${a001.id}/call`, { data: { holdTableIds: [t.T2.id] } }));
    await expect(tv.page.getByTestId("now-calling")).toContainText("A001", { timeout: 15_000 });
    await expect(tv.page.getByTestId("now-calling")).toContainText("Table T2");
    await tv.say("…and A001 to T2");
    await beat(tv.page, 1500);
  });

  await test.step("The same board in 中文", async () => {
    await go(tv.page, `/r/${s.klcc.ref}/display?lang=zh`);
    await expect(tv.page.getByRole("heading", { name: "正在叫号" })).toBeVisible();
    await expect(tv.page.getByTestId("now-calling")).toContainText("P1 号桌");
    await tv.say("The board in Chinese: 正在叫号 · B001 → P1 号桌");
    await beat(tv.page, 2000);
  });
});
