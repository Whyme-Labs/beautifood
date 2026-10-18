// Evidence 04 · The host stand on a desktop: seating suggestions with reasons (incl. a merge),
// call / seat / no-show, a walk-in, and the floor plan: transfer, push tables together, merge
// two parties, split a round table and join it back, the per-seating ordering QR, priority guests.
import { expect, test } from "@playwright/test";
import { guestClient, join, json, seatWalkIn, seed, tableIds } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, go, signInAs, wrap } from "./stage";

test.afterEach(wrap);

test("host stand: suggestions with reasons, call, seat, no-show, walk-in, transfer, merge, split, QR", async ({ browser }, info) => {
  const s = await seed();
  const t = await tableIds(s.owner, s.klcc.id);
  await join(s.klcc.ref, 2, "Amy");
  await join(s.klcc.ref, 4, "Ben");
  await join(s.klcc.ref, 6, "Chen family");
  // a party already eating at T1 asks for the bill from their phone
  const t1 = await seatWalkIn(s.owner, s.klcc.id, [t.T1.id], 2);
  await json((await guestClient()).post(`/api/public/sessions/${t1.sessionId}/call-staff?k=${encodeURIComponent(t1.token)}`, { data: { reason: "bill" } }));

  const h = await actor(browser, info, "04-host", "Host · host stand · desktop", DESKTOP);
  const { page, say } = h;
  await signInAs(h, s.owner);
  const tile = (label: string) => page.getByTestId(`table-${label}`);
  const row = (num: string) => page.getByTestId("ticket-row").filter({ hasText: num });

  await test.step("Host stand: queue, live floor, staff calls, suggestions with reasons", async () => {
    await go(page, "/m/host");
    await expect(page.getByRole("heading", { name: "Host stand" })).toBeVisible();
    await expect(page.getByText("Strategy: Smart")).toBeVisible();
    await expect(page.getByTestId("staff-calls")).toContainText("T1: wants the bill");
    await expect(page.getByTestId("ticket-row")).toHaveCount(3);
    await say("Host stand (strategy: Smart) · T1 is asking for the bill from their phone");
    const split = page.getByTestId("suggestion").filter({ hasText: "C001" });
    await expect(split).toContainText("Split");
    await expect(split).toContainText("splits table to free the other half");
    await expect(page.getByTestId("suggestion").filter({ hasText: "A001" })).toContainText("perfect fit");
    await say("Suggestions with reasons: A001 → perfect fit · C001 (6 pax) → split round table T9");
    await beat(page, 1500);
  });

  await test.step("Seat the split suggestion", async () => {
    await page.getByTestId("suggestion").filter({ hasText: "C001" }).getByRole("button", { name: "Seat" }).click();
    await expect(row("C001")).toHaveCount(0);
    await expect(tile("T9a")).toHaveClass(/seated/);
    await expect(tile("T9b")).toHaveClass(/free/);
    await say("Seat → the Chen family sits at T9a (6); T9b (4) stays free for others");
  });

  await test.step("A party of 10 and a party of 8 arrive → T10 for the 10, merged patio tables for the 8", async () => {
    await join(s.klcc.ref, 10, "Lim family");
    await join(s.klcc.ref, 8, "Dara's team");
    await expect(page.getByTestId("suggestion").filter({ hasText: "D001" })).toContainText("T10", { timeout: 20_000 });
    const merge = page.getByTestId("suggestion").filter({ hasText: "C002" });
    await expect(merge).toContainText("Merge", { timeout: 20_000 });
    await expect(merge).toContainText(/merges P\d\+P\d/);
    await say("New: D001 (10) → round table T10 · C002 (8) → Merge two 4-tops in the patio");
    await beat(page, 1200);
    await merge.getByRole("button", { name: "Seat" }).click();
    await expect(row("C002")).toHaveCount(0);
    await expect(page.locator(".tbl.seated", { hasText: /^P/ })).toHaveCount(2);
    await say("Seated across two pushed-together patio tables");
  });

  await test.step("Call A001, then mark a no-show", async () => {
    await page.getByTestId("suggestion").filter({ hasText: "A001" }).getByRole("button", { name: "Call" }).click();
    await expect(row("A001")).toContainText("Called");
    await expect(row("A001")).toContainText("holding");
    await say("Call A001 → their phone lights up; the table is held for them");
    await row("A001").getByRole("button", { name: "No-show" }).click();
    await expect(row("A001")).toHaveCount(0);
    await say("Amy never showed up → No-show frees the held table");
  });

  await test.step("Seat B001 from the queue with the seat dialog", async () => {
    await row("B001").getByRole("button", { name: "Seat…" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("Seat B001 · 4 pax");
    await expect(dlg).toContainText("Suggested:");
    await say("Seat… shows the suggestion and every free table");
    await dlg.getByRole("button", { name: "Seat here" }).click();
    await expect(row("B001")).toHaveCount(0);
  });

  await test.step("Walk-in at a free table", async () => {
    await tile("T3").click();
    await expect(page.getByTestId("table-panel")).toContainText("T3");
    await say("Tap T3 on the floor → Seat walk-in");
    await page.getByRole("button", { name: "Seat walk-in at T3" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Seat" }).click();
    await expect(tile("T3")).toHaveClass(/seated/);
  });

  // two free patio 4-tops (they share a merge group, so they can be pushed together)
  const free = Object.values(await tableIds(s.owner, s.klcc.id)).filter((x) => x.label.startsWith("P") && x.status === "free").map((x) => x.label);
  const [pa, pb] = free;
  expect(pb).toBeTruthy();

  await test.step("Transfer a party to another table", async () => {
    await tile("T3").click();
    await tile(pa).click();
    await say(`Select T3 (seated) + ${pa} (free) → move the party to the patio`);
    await page.getByRole("button", { name: `Move party from T3 to ${pa}` }).click();
    await expect(tile(pa)).toHaveClass(/seated/);
    await expect(tile("T3")).not.toHaveClass(/seated/);
  });

  await test.step("Push a free table onto a seated one", async () => {
    await tile(pa).click();
    await tile(pb).click();
    await say(`${pa} + free ${pb} → push the patio tables together`);
    await page.getByRole("button", { name: `Push free tables onto ${pa}` }).click();
    await expect(tile(pb)).toHaveClass(/seated/);
  });

  await test.step("Merge two seated parties", async () => {
    await tile(pa).click();
    await expect(page.getByTestId("table-panel")).toContainText("Party of 2");
    await page.getByRole("button", { name: "Merge with another table…" }).click();
    const dlg = page.getByRole("dialog");
    await say(`Merge: the T1 party (and their bill) joins ${pa}+${pb}`);
    await dlg.getByRole("button", { name: /^T1 · party of 2/ }).click();
    await expect(dlg).toHaveCount(0);
    const tb = await tableIds(s.owner, s.klcc.id);
    const b = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/board`));
    const merged = b.seatings.find((x: any) => x.tableIds.includes(tb[pa].id));
    expect(merged.tableIds).toEqual(expect.arrayContaining([t.T1.id, tb[pa].id, tb[pb].id]));
    expect(merged.partySize).toBe(4);
    await tile(pa).click();
    await expect(page.getByTestId("table-panel")).toContainText("Party of 4");
    await say(`One party of 4 across ${pa} + ${pb} + T1, one bill`);
    await beat(page);
  });

  await test.step("Per-seating ordering QR (dynamic)", async () => {
    await page.getByRole("button", { name: "Show ordering QR" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("img", { name: "Table ordering QR code" })).toBeVisible();
    await expect(dlg.getByTestId("qr-link")).toHaveAttribute("href", /\/s\/.+\?k=/);
    await say("Show ordering QR: a per-seating code guests scan to order together");
    await beat(page, 1500);
    await dlg.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Clear selection" }).click();
  });

  await test.step("Split a round table of 10 into 6 + 4, then join it back", async () => {
    await tile("T10").click();
    await say("T10 is a round table of 10 → Split into 6 + 4");
    await page.getByRole("button", { name: "Split into 6 + 4" }).click();
    await expect(tile("T10a")).toBeVisible();
    await expect(tile("T10b")).toBeVisible();
    await expect(tile("T10")).toHaveCount(0);
    await say("Now T10a (6 seats) and T10b (4 seats) can be seated separately");
    await tile("T10a").click();
    await page.getByRole("button", { name: "Join T10 back" }).click();
    await expect(tile("T10")).toBeVisible();
    await expect(tile("T10a")).toHaveCount(0);
  });

  await test.step("Add a priority guest to the queue", async () => {
    await page.getByRole("button", { name: "Add to queue" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Name").fill("Mdm Tan");
    await dlg.getByLabel("Party size").fill("2");
    await dlg.getByLabel(/Priority/).check();
    await say("Add to queue at the stand: Mdm Tan, 2 pax, priority (elderly)");
    await dlg.getByRole("button", { name: "Add" }).click();
    await expect(row("Mdm Tan")).toContainText("Priority");
    await expect(page.getByTestId("suggestion").filter({ hasText: "A002" })).toContainText("priority guest");
    await say("Mdm Tan is first in line and the engine says why: 'priority guest'");
    await beat(page, 1500);
  });
});
