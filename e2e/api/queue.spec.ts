import { expect, test } from "@playwright/test";
import { board, errorOf, eventually, guestClient, join, json, seed, uid } from "../helpers";

test.describe("queue", () => {
  test("numbers are per size class, positions and ETAs are computed, and the public status reflects it", async () => {
    const s = await seed();
    const a1 = await join(s.klcc.ref, 2, "Ann");
    const b1 = await join(s.klcc.ref, 4, "Ben");
    const a2 = await join(s.klcc.ref, 1, "Cal");
    const c1 = await join(s.klcc.ref, 7, "Dee");
    expect([a1.ticket.number, b1.ticket.number, a2.ticket.number, c1.ticket.number]).toEqual(["A001", "B001", "A002", "C001"]);
    expect(a2.ticket.position).toBe(2);
    expect(a2.ticket.ahead).toBe(1);
    // free tables exist, so the head of each line can be seated now
    expect(a1.ticket.etaMinutes).toBe(0);

    // public status is cached for ~2s at the edge and in the isolate: it converges shortly
    const g = await guestClient();
    const st = await eventually(async () => {
      const x = await json(g.get(`/api/public/branches/${s.klcc.ref}/status?t=${Date.now()}`));
      return x.categories.find((c: any) => c.code === "S").waiting === 2 ? x : null;
    });
    expect(st.categories.find((c: any) => c.code === "L").waiting).toBe(1);

    const b = await board(s.owner, s.klcc.id);
    expect(b.tickets).toHaveLength(4);
    expect(b.suggestions.length).toBeGreaterThan(0);
    for (const sg of b.suggestions) expect(sg.reasons.length).toBeGreaterThan(0);
  });

  test("one active ticket per device (idempotent re-join) and a guest can cancel with their signed link", async () => {
    const s = await seed();
    const device = uid("dev-");
    const first = await join(s.klcc.ref, 2, "Eve", {}, device);
    const again = await join(s.klcc.ref, 2, "Eve", {}, device);
    expect(again.existing).toBe(true);
    expect(again.ticket.id).toBe(first.ticket.id);

    const g = await guestClient();
    // a forged / foreign token is rejected
    await errorOf(g.get(`/api/public/tickets/${first.ticket.id}?k=bogus.token`), 401);
    const other = await join(s.klcc.ref, 2, "Fay");
    await errorOf(g.get(`/api/public/tickets/${first.ticket.id}?k=${encodeURIComponent(other.token)}`), 403);

    await json(g.delete(`/api/public/tickets/${first.ticket.id}?k=${encodeURIComponent(first.token)}`));
    const t = await json(g.get(`/api/public/tickets/${first.ticket.id}?k=${encodeURIComponent(first.token)}`));
    expect(t.status).toBe("cancelled");
    // the same device can now queue again
    const third = await join(s.klcc.ref, 2, "Eve", {}, device);
    expect(third.existing).toBe(false);
    expect(third.ticket.number).toBe("A003");
  });

  test("admission control: a full queue answers 429 instead of melting down", async () => {
    const s = await seed();
    await json(s.owner.patch(`/api/m/branches/${s.klcc.id}/settings`, { data: { maxWaiting: 3 } }));
    for (let i = 0; i < 3; i++) await join(s.klcc.ref, 2, `G${i}`);
    const g = await guestClient();
    const e = await errorOf(g.post(`/api/public/branches/${s.klcc.ref}/queue`, { data: { partySize: 2, name: "Late" } }), 429);
    expect(e.code).toBe("queue_full");
  });

  test("validation: party size beyond every class is refused with a helpful message", async () => {
    const s = await seed();
    const g = await guestClient();
    const e = await errorOf(g.post(`/api/public/branches/${s.klcc.ref}/queue`, { data: { partySize: 45, name: "Bus tour" } }), 400);
    expect(e.code).toBe("party_too_large");
    await errorOf(g.post(`/api/public/branches/${s.klcc.ref}/queue`, { data: { partySize: 2 } }), 400);
  });
});
