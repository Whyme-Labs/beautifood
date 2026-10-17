import { expect, test } from "@playwright/test";
import { errorOf, eventually, guestClient, inbox, json, menuItems, participant, runPipeline, seed, tableIds, uid } from "../helpers";

const tomorrow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(Date.now() + 86_400_000));

async function slot(ref: string, party: number, label: string) {
  const g = await guestClient();
  const av = await json(g.get(`/api/public/branches/${ref}/availability?day=${tomorrow()}&party=${party}`));
  return { av, s: av.slots.find((x: any) => x.label === label) };
}

test.describe("bookings", () => {
  test("availability lists bookable slots; booking confirms by email and the guest can view and cancel with their link", async () => {
    const s = await seed();
    const { av, s: seven } = await slot(s.klcc.ref, 2, "19:00");
    expect(av.durationMinutes).toBe(90);
    expect(av.slots[0].label).toBe("10:00");
    expect(seven.available).toBe(true);
    const email = `${uid("bk")}@example.com`;
    const g = await guestClient();
    const r = await json(g.post(`/api/public/branches/${s.klcc.ref}/bookings`, { data: { name: "Nora", email, partySize: 2, slotStart: seven.start, notes: "Anniversary", joinLoyalty: true } }), 201);
    expect(r.booking.status).toBe("confirmed");
    expect(r.booking.tableIds).toHaveLength(1);
    expect(r.booking.memberId).toBeTruthy();
    await runPipeline(s.owner);
    const mail = await eventually(async () => (await inbox(s.owner, email, "booking_created"))[0]);
    expect(mail.subject).toContain("KLCC");

    const k = `k=${encodeURIComponent(r.token)}`;
    const view = await json(g.get(`/api/public/bookings/${r.booking.id}?${k}`));
    expect(view.branch.name).toBe("KLCC");
    expect(view.phone).toBeUndefined();
    await errorOf(g.get(`/api/public/bookings/${r.booking.id}?k=forged`), 401);
    await json(g.delete(`/api/public/bookings/${r.booking.id}?${k}`));
    expect((await errorOf(g.delete(`/api/public/bookings/${r.booking.id}?${k}`), 409)).code).toBe("booking_closed");
    const list = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/bookings?day=${tomorrow()}`));
    expect(list.find((b) => b.id === r.booking.id).status).toBe("cancelled");
  });

  test("validation: too-soon slots and closed bookings are refused", async () => {
    const s = await seed();
    const g = await guestClient();
    expect((await errorOf(g.post(`/api/public/branches/${s.klcc.ref}/bookings`, { data: { name: "Late", partySize: 2, slotStart: Date.now() + 60_000 } }), 400)).code).toBe("too_soon");
    await json(s.owner.patch(`/api/m/branches/${s.bangsar.id}/settings`, { data: { modules: { bookings: false } } }));
    expect((await errorOf(g.get(`/api/public/branches/${s.bangsar.ref}/availability?day=${tomorrow()}&party=2`), 409)).code).toBe("bookings_off");
  });

  test("double-booking race: many guests grab the one table combo that fits 16 at the same time, exactly one wins", async () => {
    const s = await seed();
    const { s: eight } = await slot(s.klcc.ref, 16, "20:00");
    expect(eight.available).toBe(true);
    expect(eight.tables.every((l: string) => l.startsWith("P"))).toBe(true);
    const results = await Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        const g = await guestClient();
        return g.post(`/api/public/branches/${s.klcc.ref}/bookings`, { data: { name: `Party ${i}`, partySize: 16, slotStart: eight.start } });
      }),
    );
    const codes = results.map((r) => r.status());
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    for (const r of results.filter((r) => r.status() !== 201)) {
      expect(r.status()).toBe(409);
      expect(["slot_taken", "slot_full"]).toContain((await r.json()).error.code);
    }
    // the overlapping slot is now unavailable for 16, but a later non-overlapping one still is
    const after = await slot(s.klcc.ref, 16, "20:00");
    expect(after.s.available).toBe(false);
    expect((await slot(s.klcc.ref, 16, "19:00")).s.available).toBe(false); // 19:00–20:30 overlaps
    expect((await slot(s.klcc.ref, 16, "17:30")).s.available).toBe(true); // 17:30–19:00 ends before 20:00
    // smaller parties can still book other tables at 20:00
    expect((await slot(s.klcc.ref, 2, "20:00")).s.available).toBe(true);
  });

  test("booking with preorder: the order waits (held) until check-in, then moves to the table bill and fires", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const { s: noon } = await slot(s.klcc.ref, 4, "12:00");
    const g = await guestClient();
    const r = await json(g.post(`/api/public/branches/${s.klcc.ref}/bookings`, { data: { name: "Office lunch", partySize: 4, slotStart: noon.start } }), 201);
    const pre = await json(g.post(`/api/public/bookings/${r.booking.id}/preorder?k=${encodeURIComponent(r.token)}`), 201);
    const q = `k=${encodeURIComponent(pre.token)}`;
    const p = participant("Boss");
    await json(g.post(`/api/public/sessions/${pre.sessionId}/lines?${q}`, { data: { participant: p, itemId: m.byName("Char Kway Teow").id, qty: 2 } }), 201);
    const v = (await json(g.post(`/api/public/sessions/${pre.sessionId}/lines?${q}`, { data: { participant: p, itemId: m.byName("Rojak").id, qty: 1 } }), 201)).cart.session.version;
    const sent = await json(g.post(`/api/public/sessions/${pre.sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId: uid() } }));
    let kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    expect(kds.find((x) => x.orderId === sent.orderId)).toBeUndefined();
    const view = await json(g.get(`/api/public/bookings/${r.booking.id}?k=${encodeURIComponent(r.token)}`));
    expect(view.preorderUrl).toContain(`/s/${pre.sessionId}`);

    const seated = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/bookings/${r.booking.id}/check_in`, { data: {} }));
    expect(seated.seatingId).toBeTruthy();
    expect((await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/bookings/${r.booking.id}/check_in`, { data: {} }), 409)).code).toBe("booking_closed");
    kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    const ticket = kds.find((x) => x.orderId === sent.orderId);
    expect(ticket.items.every((i: any) => i.status === "fired")).toBe(true);
    const order = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${sent.orderId}`));
    expect(order.type).toBe("dine_in");
    expect(order.items).toHaveLength(2);
    const t = await tableIds(s.owner, s.klcc.id);
    expect(Object.values(t).filter((x) => x.status === "seated")).toHaveLength(seated.tableIds.length);
  });

  test("staff can take a phone booking and mark no-shows", async () => {
    const s = await seed();
    const { s: one } = await slot(s.klcc.ref, 6, "13:00");
    const b = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/bookings`, { data: { name: "Phone guest", phone: "+60123456789", partySize: 6, slotStart: one.start } }), 201);
    expect(b.status).toBe("confirmed");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/bookings/${b.id}/no_show`, { data: {} }));
    const list = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/bookings?day=${tomorrow()}`));
    expect(list.find((x) => x.id === b.id).status).toBe("no_show");
    // the table frees up for others at that time
    expect((await slot(s.klcc.ref, 6, "13:00")).s.available).toBe(true);
  });
});
