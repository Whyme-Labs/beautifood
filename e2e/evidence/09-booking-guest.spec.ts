// Evidence 09 · Booking: a guest books a table for 4 on their phone, preorders, and the
// booking page links to the preorder; at the restaurant, staff check them in on the bookings
// page and the held preorder fires to the kitchen.
import { expect, test } from "@playwright/test";
import { eventually, guestClient, inbox, json, runPipeline, seed, uid } from "../helpers";
import { beat } from "./caption";
import { actor, DESKTOP, go, PHONE, signInAs, wrap } from "./stage";

test.afterEach(wrap);

test("booking: book a table with a preorder, booking page, staff check-in fires the preorder", async ({ browser }, info) => {
  const s = await seed();
  const email = `${uid("nora")}@example.com`;
  const g = await actor(browser, info, "09-booking-guest", "Guest · booking · phone", PHONE);
  const { page, say } = g;

  let bookingUrl = "";
  await test.step("Pick party size and a free slot", async () => {
    await go(page, `/r/${s.klcc.ref}`);
    await say("Branch page → Book for later");
    await page.getByRole("link", { name: "Book for later" }).click();
    await page.waitForURL(/\/book$/);
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByRole("heading", { name: "Book a table" })).toBeVisible();
    await page.getByRole("button", { name: "More people" }).click();
    await page.getByRole("button", { name: "More people" }).click();
    await expect(page.getByLabel("Guests")).toHaveValue("4");
    const slot = page.getByTestId("slots").getByRole("button", { name: "19:00" });
    await expect(slot).toBeEnabled();
    await say("4 guests, tomorrow: only slots with a free table for 4 can be picked");
    await slot.click();
    await expect(slot).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("Confirm the booking", async () => {
    await page.getByLabel("Name").fill("Nora");
    await page.getByLabel("Email (for confirmation)").fill(email);
    await page.getByLabel("Notes").fill("Anniversary");
    await say("Name, email, a note → Confirm booking");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await page.waitForURL(/\/booking\//);
    await page.locator("html[data-hydrated]").waitFor();
    bookingUrl = page.url();
    await expect(page.getByTestId("booking-summary")).toContainText("Table for 4");
    await expect(page.getByTestId("booking-summary")).toContainText("Nora");
    await expect(page.getByText("Confirmed")).toBeVisible();
    await say("Booking page: confirmed for 7 pm, table for 4 — the private link to manage it");
    await runPipeline(s.owner);
    const mail = await eventually(async () => (await inbox(s.owner, email, "booking_created"))[0], 20_000);
    expect(mail.subject).toContain("KLCC");
  });

  await test.step("Preorder so the food is ready on arrival", async () => {
    await page.getByRole("button", { name: "Preorder so food is ready when you arrive" }).click();
    await page.waitForURL(/\/s\//);
    await page.locator("html[data-hydrated]").waitFor();
    await page.getByLabel("Your name").fill("Nora");
    await page.getByRole("button", { name: "Start ordering" }).click();
    await say("Booking preorder: the same menu and cart as at the table");
    await page.getByRole("button", { name: "Add Penang Assam Laksa" }).click();
    await page.getByRole("button", { name: "Add Hainanese Chicken Rice" }).click();
    await page.getByRole("button", { name: "Add Cendol" }).click();
    await expect(page.getByTestId("tab-cart")).toContainText("Cart (3)");
    await page.getByTestId("send-order").click();
    await expect(page.getByTestId("sent-item")).toHaveCount(3);
    await expect(page.getByTestId("bill")).toContainText("Held");
    await say("Preorder saved and held: it goes to the kitchen when we check in");
    await go(page, bookingUrl);
    await expect(page.getByRole("button", { name: "Edit your preorder" })).toBeVisible();
    await say("The booking page now offers 'Edit your preorder'");
    await beat(page, 1200);
  });
  const bookingId = new URL(bookingUrl).pathname.split("/").pop()!;

  const staff = await actor(browser, info, "09-booking-staff", "Host · bookings · desktop", DESKTOP);
  await signInAs(staff, s.owner);
  await test.step("Staff check the guest in on the bookings page", async () => {
    await go(staff.page, "/m/bookings");
    const pub = await json((await guestClient()).get(`/api/public/bookings/${bookingId}?k=${encodeURIComponent(new URL(bookingUrl).searchParams.get("k")!)}`));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(pub.slotStart));
    await staff.page.getByRole("textbox", { name: "Day" }).fill(day);
    const row = staff.page.getByTestId("booking-row").filter({ hasText: "Nora" });
    await expect(row).toContainText("Preordered");
    await expect(row).toContainText("Anniversary");
    await expect(row).toContainText(/7:00 pm|19:00/i);
    await staff.say("Bookings for that day: Nora, 4 pax, 7 pm, preordered, note 'Anniversary'");
    await row.getByRole("button", { name: "Check in" }).click();
    await expect(row).toContainText("Checked in");
    const kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    const ticket = kds.find((k) => k.items.some((i: any) => i.name === "Penang Assam Laksa"));
    expect(ticket.items.every((i: any) => i.status === "fired")).toBe(true);
    await staff.say("Check in → seated on the booked table; the preorder fires to the kitchen");
    await beat(staff.page, 1500);
    await go(page, bookingUrl);
    await expect(page.getByText("Checked in")).toBeVisible();
    await say("Nora's booking page now says Checked in");
    await beat(page, 1200);
  });
});
