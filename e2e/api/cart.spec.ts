import { expect, test } from "@playwright/test";
import { errorOf, guestClient, join, json, menuItems, participant, seatWalkIn, seed, tableIds, uid } from "../helpers";

test.describe("shared table cart", () => {
  test("diners at one table share a cart, own their lines, and the server prices modifiers", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T1.id], 2);
    const m = await menuItems(s.owner);
    const alice = participant("Alice");
    const bob = participant("Bob");
    const phoneA = await guestClient();
    const phoneB = await guestClient();
    const q = `k=${encodeURIComponent(token)}`;
    await json(phoneA.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: alice, itemId: m.byName("Char Kway Teow").id, qty: 1, notes: "less spicy" } }), 201);
    const e = await errorOf(phoneB.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: bob, itemId: m.byName("Teh Tarik").id, qty: 2 } }), 400);
    expect(e.code).toBe("modifier_required");
    const r = await json(phoneB.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: bob, itemId: m.byName("Teh Tarik").id, qty: 2, modifiers: [{ group: "Temperature", option: "Iced" }] } }), 201);
    expect(r.cart.participants.map((p: any) => p.name).sort()).toEqual(["Alice", "Bob"]);
    expect(r.cart.cartTotal).toBe(1690 + (550 + 50) * 2);
    // phone A sees Bob's line (shared state)
    const viewA = await json(phoneA.get(`/api/public/sessions/${sessionId}?${q}`));
    expect(viewA.lines).toHaveLength(2);
    // nobody can edit someone else's line
    const bobLine = viewA.lines.find((l: any) => l.participantId === bob.id);
    const forbidden = await errorOf(phoneA.patch(`/api/public/sessions/${sessionId}/lines/${bobLine.id}?${q}`, { data: { participant: alice, qty: 0 } }), 403);
    expect(forbidden.code).toBe("not_your_line");
    // a token for another cart is rejected
    await errorOf(phoneA.get(`/api/public/sessions/ss_other?${q}`), 403);
  });

  test("polling is cheap: an unchanged cart answers 204", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T2.id]);
    const g = await guestClient();
    const v = await json(g.get(`/api/public/sessions/${sessionId}?k=${encodeURIComponent(token)}`));
    const r = await g.get(`/api/public/sessions/${sessionId}?k=${encodeURIComponent(token)}&since=${v.session.version}`);
    expect(r.status()).toBe(204);
  });

  test("stale send is rejected with the fresh cart; simultaneous sends: one wins, the other is told it was already sent", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T3.id]);
    const m = await menuItems(s.owner);
    const g = await guestClient();
    const q = `k=${encodeURIComponent(token)}`;
    const alice = participant("Alice");
    const bob = participant("Bob");
    const add = (p: any, name: string) => json(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: m.byName(name).id, qty: 1 } }), 201);
    const v1 = (await add(alice, "Penang Assam Laksa")).cart.session.version;
    await add(bob, "Satay (6 sticks)"); // Bob adds while Alice is looking at v1
    const stale = await errorOf(g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: alice, expectedVersion: v1, msgId: uid("m") } }), 409);
    expect(stale.code).toBe("version_conflict");
    expect(stale.data.lines).toHaveLength(2); // the fresh cart comes back so Alice can review it
    const v = stale.data.session.version;
    const [ra, rb] = await Promise.all([
      g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: alice, expectedVersion: v, msgId: uid("ma") } }),
      g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: bob, expectedVersion: v, msgId: uid("mb") } }),
    ]);
    const statuses = [ra.status(), rb.status()].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = ra.status() === 409 ? await ra.json() : await rb.json();
    expect(["already_sent", "version_conflict"]).toContain(loser.error.code);
    const view = await json(g.get(`/api/public/sessions/${sessionId}?${q}`));
    expect(view.lines).toHaveLength(0);
    expect(view.order.items).toHaveLength(2); // exactly one round reached the kitchen
    expect(view.order.items.every((i: any) => i.status === "fired")).toBe(true);
  });

  test("a retried send (same msgId) is idempotent", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T4.id]);
    const m = await menuItems(s.owner);
    const g = await guestClient();
    const q = `k=${encodeURIComponent(token)}`;
    const p = participant("Cy");
    const v = (await json(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: m.byName("Rojak").id, qty: 1 } }), 201)).cart.session.version;
    const msgId = uid("retry");
    const first = await json(g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId } }));
    const again = await json(g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId } }));
    expect(again.duplicate).toBe(true);
    expect(again.orderId).toBe(first.orderId);
    const view = await json(g.get(`/api/public/sessions/${sessionId}?${q}`));
    expect(view.order.items).toHaveLength(1);
  });

  test("sold-out dishes can't be added or sent; price comes from the menu at send time", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T5.id]);
    const m = await menuItems(s.owner);
    const g = await guestClient();
    const q = `k=${encodeURIComponent(token)}`;
    const p = participant("Di");
    const cendol = m.byName("Cendol");
    const v = (await json(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: cendol.id, qty: 1 } }), 201)).cart.session.version;
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/availability`, { data: { itemId: cendol.id, soldOut: true } }));
    const e = await errorOf(g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId: uid() } }), 409);
    expect(e.code).toBe("sold_out");
    await errorOf(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: cendol.id, qty: 1 } }), 409);
    // the other branch is unaffected
    const other = await seatWalkIn(s.owner, s.bangsar.id, [(await tableIds(s.owner, s.bangsar.id)).T1.id]);
    await json(g.post(`/api/public/sessions/${other.sessionId}/lines?k=${encodeURIComponent(other.token)}`, { data: { participant: p, itemId: cendol.id, qty: 1 } }), 201);
  });

  test("static QR: joins the seated table's cart, asks free tables to see the host (or self-seats when enabled)", async () => {
    const s = await seed();
    const tables = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/tables`));
    const t6 = tables.find((x) => x.label === "T6");
    const t7 = tables.find((x) => x.label === "T7");
    const g = await guestClient();
    const free = await json(g.get(`/api/public/qr/${t6.staticToken}`));
    expect(free.action).toBe("ask_staff");
    const seated = await seatWalkIn(s.owner, s.klcc.id, [t6.id]);
    const join1 = await json(g.get(`/api/public/qr/${t6.staticToken}`));
    expect(join1.action).toBe("join");
    expect(join1.sessionId).toBe(seated.sessionId);
    await json(s.owner.patch(`/api/m/branches/${s.klcc.id}/settings`, { data: { staticQrSelfSeat: true } }));
    const self = await json(g.get(`/api/public/qr/${t7.staticToken}`));
    expect(self.action).toBe("self_seat");
    const sat = await json(g.post(`/api/public/qr/${t7.staticToken}/seat`, { data: { partySize: 2 } }), 201);
    expect(sat.tableLabels).toEqual(["T7"]);
    await json(s.owner.patch(`/api/m/branches/${s.klcc.id}/settings`, { data: { qrMode: "dynamic" } }));
    const dyn = await json(g.get(`/api/public/qr/${t6.staticToken}?v=1`));
    expect(dyn.action).toBe("ask_staff");
  });

  test("preorder while queueing: held until seated, then the bill moves to the table and fires to the kitchen", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const tk = await join(s.klcc.ref, 2, "Hungry");
    const g = await guestClient();
    const pre = await json(g.post(`/api/public/tickets/${tk.ticket.id}/preorder?k=${encodeURIComponent(tk.token)}`), 201);
    const q = `k=${encodeURIComponent(pre.token)}`;
    const p = participant("Hungry");
    const v = (await json(g.post(`/api/public/sessions/${pre.sessionId}/lines?${q}`, { data: { participant: p, itemId: m.byName("Nasi Lemak Ayam Rempah").id, qty: 2 } }), 201)).cart.session.version;
    const sent = await json(g.post(`/api/public/sessions/${pre.sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId: uid() } }));
    let kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    expect(kds.find((x) => x.orderId === sent.orderId)).toBeUndefined(); // held, not cooking yet
    const t = await tableIds(s.owner, s.klcc.id);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${tk.ticket.id}/seat`, { data: { tableIds: [t.T8.id] } }));
    kds = await json<any[]>(s.owner.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    const ticket = kds.find((x) => x.orderId === sent.orderId);
    expect(ticket.tables).toEqual(["T8"]);
    expect(ticket.items[0].status).toBe("fired");
    // the guest's ticket page now carries the table's cart link
    const view = await json(g.get(`/api/public/tickets/${tk.ticket.id}?k=${encodeURIComponent(tk.token)}`));
    expect(view.status).toBe("seated");
    expect(view.tableLink).toContain("/s/");
    const order = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${sent.orderId}`));
    expect(order.type).toBe("dine_in");
    expect(order.serviceCharge).toBeGreaterThan(0);
  });

  test("takeaway: no service charge, order number for pickup", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const g = await guestClient();
    const tw = await json(g.post(`/api/public/branches/${s.klcc.ref}/takeaway`), 201);
    const q = `k=${encodeURIComponent(tw.token)}`;
    const p = participant("Togo");
    const v = (await json(g.post(`/api/public/sessions/${tw.sessionId}/lines?${q}`, { data: { participant: p, itemId: m.byName("Curry Mee").id, qty: 1 } }), 201)).cart.session.version;
    await json(g.post(`/api/public/sessions/${tw.sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId: uid() } }));
    const view = await json(g.get(`/api/public/sessions/${tw.sessionId}?${q}`));
    expect(view.order.type).toBe("takeaway");
    expect(view.order.serviceCharge).toBe(0);
    expect(view.order.tax).toBe(Math.round(1490 * 0.06));
    expect(view.order.number).toMatch(/^\d{4}$/);
  });
});
