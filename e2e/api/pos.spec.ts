import { expect, test } from "@playwright/test";
import { errorOf, json, menuItems, seatWalkIn, seed, tableIds, uid } from "../helpers";

async function billWith(s: Awaited<ReturnType<typeof seed>>, label: string, lines: [string, number, any[]?][]) {
  const t = await tableIds(s.owner, s.klcc.id);
  const m = await menuItems(s.owner);
  const st = await seatWalkIn(s.owner, s.klcc.id, [t[label].id], 4);
  const o = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: lines.map(([n, qty, modifiers]) => ({ itemId: m.byName(n).id, qty, modifiers })) } }), 201);
  return { order: o, seatingId: st.seatingId, m };
}

const url = (s: Awaited<ReturnType<typeof seed>>, oid: string, action: string) => `/api/m/branches/${s.klcc.id}/orders/${oid}/${action}`;

test.describe("POS & payments", () => {
  test("bill math: service charge on discounted subtotal, 6% tax, 5-sen cash rounding (same Rust core as the phones)", async () => {
    const s = await seed();
    const { order } = await billWith(s, "T1", [["Char Kway Teow", 2], ["Teh Tarik", 1, [{ group: "Temperature", option: "Hot" }]]]);
    // 16.90*2 + 5.50 (+ required hot = 0) = 39.30; svc 3.93; tax 6% of 43.23 = 2.59; 45.82 → 45.80
    expect(order.subtotal).toBe(3930);
    expect(order.serviceCharge).toBe(393);
    expect(order.tax).toBe(259);
    expect(order.total).toBe(4580);
    expect(order.rounding).toBe(-2);
    const d = await json(s.owner.post(url(s, order.id, "discount"), { data: { kind: "percent", value: 10, reason: "Birthday" } }));
    expect(d.discount).toBe(393);
    expect(d.serviceCharge).toBe(354);
    expect(d.total % 5).toBe(0);
  });

  test("void with reason reprices; can't void below what's already paid", async () => {
    const s = await seed();
    const { order } = await billWith(s, "T2", [["Penang Assam Laksa", 1], ["Cendol", 1]]);
    const cendol = order.items.find((i: any) => i.name === "Cendol");
    await errorOf(s.owner.post(url(s, order.id, "void"), { data: { itemIds: [cendol.id], reason: "" } }), 400);
    const v = await json(s.owner.post(url(s, order.id, "void"), { data: { itemIds: [cendol.id], reason: "Wrong order" } }));
    expect(v.subtotal).toBe(1550);
    await json(s.owner.post(url(s, order.id, "pay"), { data: { method: "card", amount: v.total, msgId: uid() } }));
    const laksa = v.items.find((i: any) => i.name === "Penang Assam Laksa");
    await errorOf(s.owner.post(url(s, order.id, "void"), { data: { itemIds: [laksa.id], reason: "late" } }), 409);
  });

  test("payments: overpay refused, retried payment idempotent, split payments settle the bill, change computed", async () => {
    const s = await seed();
    const { order } = await billWith(s, "T3", [["Nasi Kerabu", 2]]);
    const total = order.total;
    await errorOf(s.owner.post(url(s, order.id, "pay"), { data: { method: "card", amount: total + 5, msgId: uid() } }), 409);
    const msgId = uid("p1");
    const p1 = await json(s.owner.post(url(s, order.id, "pay"), { data: { method: "card", amount: 2000, splitLabel: "Alice", msgId } }));
    const p1again = await json(s.owner.post(url(s, order.id, "pay"), { data: { method: "card", amount: 2000, splitLabel: "Alice", msgId } }));
    expect(p1again.payment.duplicate).toBe(true);
    expect(p1again.payment.paymentId).toBe(p1.payment.paymentId);
    expect(p1again.order.paid).toBe(2000);
    const rest = total - 2000;
    const p2 = await json(s.owner.post(url(s, order.id, "pay"), { data: { method: "cash", amount: rest, tendered: 10000, splitLabel: "Bob", msgId: uid() } }));
    expect(p2.payment.change).toBe(10000 - rest);
    expect(p2.payment.settled).toBe(true);
    expect(p2.order.status).toBe("paid");
    expect(p2.order.payments).toHaveLength(2);
  });

  test("equal split plan sums exactly; split-by-items creates a separate bill on the same table", async () => {
    const s = await seed();
    const { order, seatingId } = await billWith(s, "T4", [["Curry Mee", 1], ["Rojak", 1], ["Iced Barley", 1]]);
    const plan = await json(s.owner.post(url(s, order.id, "split_plan"), { data: { ways: 3 } }));
    expect(plan.parts.reduce((a: number, b: number) => a + b, 0)).toBe(order.total);
    expect(Math.max(...plan.parts) - Math.min(...plan.parts)).toBeLessThanOrEqual(1);
    const rojak = order.items.find((i: any) => i.name === "Rojak");
    const r = await json(s.owner.post(url(s, order.id, "split"), { data: { itemIds: [rojak.id] } }));
    expect(r.split.items.map((i: any) => i.name)).toEqual(["Rojak"]);
    expect(r.original.items.map((i: any) => i.name).sort()).toEqual(["Curry Mee", "Iced Barley"]);
    expect(r.split.seatingId).toBe(seatingId);
    expect(r.split.number).toMatch(/-A$/);
    // the table can't close until both bills are paid
    await json(s.owner.post(url(s, r.original.id, "pay"), { data: { method: "card", amount: r.original.total, msgId: uid() } }));
    await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${seatingId}/close`, { data: {} }), 409);
    await json(s.owner.post(url(s, r.split.id, "pay"), { data: { method: "ewallet", amount: r.split.total, msgId: uid() } }));
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/seatings/${seatingId}/close`, { data: {} }));
  });

  test("promo codes: minimum spend, single use per bill, global usage cap holds under concurrency", async () => {
    const s = await seed();
    await json(s.owner.post("/api/m/promos", { data: { code: "LAST2", kind: "amount", value: 500, minSpend: 1000, maxUses: 2, description: "RM5 off" } }), 201);
    const bills = await Promise.all(["T5", "T6", "T7", "T8"].map((l) => billWith(s, l, [["Hainanese Chicken Rice", 1]])));
    const results = await Promise.all(bills.map((b) => s.owner.post(url(s, b.order.id, "promo"), { data: { code: "last2" } })));
    const ok = results.filter((r) => r.status() === 200);
    expect(ok).toHaveLength(2);
    for (const r of results.filter((r) => r.status() !== 200)) expect((await r.json()).error.code).toBe("code_used_up");
    const applied = await ok[0].json();
    expect(applied.discount).toBe(500);
    // once per bill
    const again = await errorOf(s.owner.post(url(s, applied.id, "promo"), { data: { code: "LAST2" } }), 409);
    expect(["promo_already_applied", "code_used_up"]).toContain(again.code);
    const promos = await json<any[]>(s.owner.get("/api/m/promos"));
    expect(promos.find((p) => p.code === "LAST2").used).toBe(2);
    // minimum spend
    const small = await billWith(s, "T1", [["Kopi O", 1]]);
    expect((await errorOf(s.owner.post(url(s, small.order.id, "promo"), { data: { code: "WELCOME10" } }), 409)).code).toBe("min_spend");
  });

  test("refunds: partial then full, never more than paid; kitchen statuses move forward only", async () => {
    const s = await seed();
    const { order } = await billWith(s, "T6", [["Satay (6 sticks)", 2]]);
    const paid = await json(s.owner.post(url(s, order.id, "pay"), { data: { method: "card", amount: order.total, msgId: uid() } }));
    const pid = paid.payment.paymentId;
    const refundUrl = `/api/m/branches/${s.klcc.id}/payments/${pid}/refund`;
    await json(s.owner.post(refundUrl, { data: { amount: 1000, reason: "Cold satay", msgId: uid() } }));
    await errorOf(s.owner.post(refundUrl, { data: { amount: order.total, reason: "too much", msgId: uid() } }), 400);
    await json(s.owner.post(refundUrl, { data: { amount: order.total - 1000, reason: "Comp", msgId: uid() } }));
    const after = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${order.id}`));
    expect(after.status).toBe("refunded");
    expect(after.refunded).toBe(order.total);

    const itemIds = order.items.map((i: any) => i.id);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/kitchen/status`, { data: { itemIds, status: "preparing" } }));
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/kitchen/status`, { data: { itemIds, status: "ready" } }));
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/kitchen/status`, { data: { itemIds, status: "served" } }));
    const bad = await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/kitchen/status`, { data: { itemIds, status: "preparing" } }), 409);
    expect(bad.code).toBe("invalid_transition");
  });

  test("cash drawer shift: expected cash = float + cash takings − cash refunds; variance reported", async () => {
    const s = await seed();
    const sh = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/shifts`, { data: { openingFloat: 20000 } }), 201);
    await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/shifts`, { data: { openingFloat: 100 } }), 409);
    const { order } = await billWith(s, "T7", [["Teh Tarik", 1, [{ group: "Temperature", option: "Hot" }]]]);
    await json(s.owner.post(url(s, order.id, "pay"), { data: { method: "cash", amount: order.total, tendered: 1000, msgId: uid() } }));
    const closed = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/shifts/${sh.id}/close`, { data: { counted: 20000 + order.total - 10 } }));
    expect(closed.expected).toBe(20000 + order.total);
    expect(closed.variance).toBe(-10);
  });
});
