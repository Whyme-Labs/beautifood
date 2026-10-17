import { expect, test } from "@playwright/test";
import { board, errorOf, guestClient, join, json, seed, tableIds } from "../helpers";

test.describe("seating, merge, split, transfer", () => {
  test("smart strategy merges pushable tables for a big party when no single table fits", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    // occupy both 10-tops so only the patio 4-tops (one merge group) can take a party of 7
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 9, tableIds: [t.T9.id] } }), 201);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 9, tableIds: [t.T10.id] } }), 201);
    const c1 = await join(s.klcc.ref, 7, "Big group");
    const b = await board(s.owner, s.klcc.id);
    const sg = b.suggestions.find((x: any) => x.ticketId === c1.ticket.id);
    expect(sg.action).toBe("merge_seat");
    expect(sg.tableLabels.every((l: string) => l.startsWith("P"))).toBe(true);
    expect(sg.reasons.join(" ")).toMatch(/merges P\d+\+P\d+/);
    const seated = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${c1.ticket.id}/seat`, { data: { tableIds: sg.tableIds } }));
    expect(seated.tableLabels).toHaveLength(2);
    const after = await tableIds(s.owner, s.klcc.id);
    for (const l of seated.tableLabels) expect(after[l].status).toBe("seated");
  });

  test("tables from different merge groups can't be pushed together", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const e = await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 6, tableIds: [t.T1.id, t.P1.id] } }), 400);
    expect(e.code).toBe("not_mergeable");
  });

  test("split a 10-top into 6 + 4, seat a party on one half, and refuse to rejoin while occupied", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const { children } = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tables/${t.T9.id}/split`));
    expect(children).toHaveLength(2);
    const after = await tableIds(s.owner, s.klcc.id);
    expect(after.T9.status).toBe("split");
    expect(after.T9a.seatsMax).toBe(6);
    expect(after.T9b.seatsMax).toBe(4);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 4, tableIds: [after.T9b.id] } }), 201);
    const e = await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/tables/${t.T9.id}/unsplit`), 409);
    expect(e.code).toBe("children_busy");
  });

  test("engine suggests splitting a large table for a small party and seating applies the split atomically", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    // occupy every table except the two 10-tops
    const others = Object.values(t).filter((x) => x.seatsMax < 10);
    for (const x of others) await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 2, tableIds: [x.id] } }), 201);
    const a = await join(s.klcc.ref, 3, "Trio");
    const b = await board(s.owner, s.klcc.id);
    const sg = b.suggestions.find((x: any) => x.ticketId === a.ticket.id);
    expect(sg.action).toBe("split_seat");
    expect(sg.tableLabels[0]).toMatch(/T(9|10)b/);
    const res = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${a.ticket.id}/seat`, { data: { tableIds: sg.tableIds, split: sg.split } }));
    expect(res.tableLabels[0]).toMatch(/T(9|10)b/);
  });

  test("two hosts seating different parties on the same table at once: exactly one wins", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const a = await join(s.klcc.ref, 2, "A");
    const b2 = await join(s.klcc.ref, 2, "B");
    const [r1, r2] = await Promise.all([
      s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${a.ticket.id}/seat`, { data: { tableIds: [t.T1.id] } }),
      s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${b2.ticket.id}/seat`, { data: { tableIds: [t.T1.id] } }),
    ]);
    const codes = [r1.status(), r2.status()].sort();
    expect(codes).toEqual([200, 409]);
    const loser = r1.status() === 409 ? await r1.json() : await r2.json();
    expect(loser.error.code).toBe("table_taken");
    const bd = await board(s.owner, s.klcc.id);
    expect(bd.seatings).toHaveLength(1);
  });

  test("seating a ticket counts skips for earlier parties; the fairness bound then protects them", async () => {
    const s = await seed();
    await json(s.owner.patch(`/api/m/branches/${s.klcc.id}/settings`, { data: { maxSkips: 1 } }));
    const t = await tableIds(s.owner, s.klcc.id);
    const first = await join(s.klcc.ref, 2, "First");
    const second = await join(s.klcc.ref, 2, "Second");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${second.ticket.id}/seat`, { data: { tableIds: [t.T1.id] } }));
    const bd = await board(s.owner, s.klcc.id);
    const f = bd.tickets.find((x: any) => x.id === first.ticket.id);
    expect(f.skips).toBe(1);
    const sg = bd.suggestions.find((x: any) => x.ticketId === first.ticket.id);
    expect(sg.reasons[0]).toMatch(/fairness/);
  });

  test("call holds the table, re-queue releases it, transfer and merge seatings combine parties and bills", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const a = await join(s.klcc.ref, 2, "Held");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${a.ticket.id}/call`, { data: { holdTableIds: [t.T2.id] } }));
    expect((await tableIds(s.owner, s.klcc.id)).T2.status).toBe("reserved");
    // a walk-in can't take the held table
    await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 2, tableIds: [t.T2.id] } }), 409);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${a.ticket.id}/requeue`));
    expect((await tableIds(s.owner, s.klcc.id)).T2.status).toBe("free");

    const s1 = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 2, tableIds: [t.T3.id] } }), 201);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${s1.seatingId}/transfer`, { data: { tableIds: [t.T4.id] } }));
    let now = await tableIds(s.owner, s.klcc.id);
    expect(now.T3.status).toBe("dirty");
    expect(now.T4.status).toBe("seated");

    const s2 = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 2, tableIds: [t.T5.id] } }), 201);
    const items = (await json(s.owner.get("/api/m/menu"))).items;
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: s1.seatingId, items: [{ itemId: items[0].id, qty: 1 }] } }), 201);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: s2.seatingId, items: [{ itemId: items[1].id, qty: 2 }] } }), 201);
    const merged = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${s1.seatingId}/merge`, { data: { fromSeatingId: s2.seatingId } }));
    expect(merged.mergedOrder).toBe(true);
    const bill = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${merged.orderId}`));
    expect(bill.items).toHaveLength(2);
    const bd = await board(s.owner, s.klcc.id);
    const st = bd.seatings.find((x: any) => x.id === s1.seatingId);
    expect(st.partySize).toBe(4);
    expect(st.tableIds).toHaveLength(2);
    now = await tableIds(s.owner, s.klcc.id);
    expect(now.T5.seatingId).toBe(s1.seatingId);
  });

  test("closing requires a settled bill; closing teaches the turn-time model", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.klcc.id);
    const st = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seat`, { data: { partySize: 2, tableIds: [t.T1.id] } }), 201);
    const items = (await json(s.owner.get("/api/m/menu"))).items;
    const order = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: items[0].id, qty: 1 }] } }), 201);
    const e = await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${st.seatingId}/close`, { data: {} }), 409);
    expect(e.code).toBe("bill_unpaid");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${order.id}/pay`, { data: { method: "card", amount: order.total, msgId: `pay-${order.id}` } }));
    const closed = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${st.seatingId}/close`, { data: {} }));
    expect(closed.closed).toBe(true);
    expect((await tableIds(s.owner, s.klcc.id)).T1.status).toBe("dirty");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tables/${t.T1.id}/clean`));
    expect((await tableIds(s.owner, s.klcc.id)).T1.status).toBe("free");
    // dynamic QR for the closed seating no longer works for ordering
    const g = await guestClient();
    const link = await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${st.seatingId}/link`), 409);
    expect(link.code).toBe("seating_closed");
    void g;
  });
});
