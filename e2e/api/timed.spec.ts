import { expect, test } from "@playwright/test";
import { errorOf, guestClient, hire, json, menuItems, participant, seatWalkIn, seed, tableIds, uid } from "../helpers";

// The seeded branches run on Kuala Lumpur time. Windows are set relative to "now" there, so the
// tests hold whatever time of day they run (a window may wrap past midnight, which is allowed).
const TZ = "Asia/Kuala_Lumpur";
function klNow() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { minutes: Number(g("hour")) * 60 + Number(g("minute")), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")) };
}
const hhmm = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** A window that is on now (started 30 min ago, ends in 30) or off now (starts in 2 h, ends in 3 h). */
const onNow = () => ({ days: ALL_DAYS, from: hhmm(klNow().minutes - 30), to: hhmm(klNow().minutes + 30) });
const offNow = () => ({ days: ALL_DAYS, from: hhmm(klNow().minutes + 120), to: hhmm(klNow().minutes + 180) });

test.describe("timed menus and happy hours", () => {
  test("a dish on a menu that isn't on now can't be ordered by guests; the menu says when it's next", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const cendol = m.byName("Cendol");
    const { id: breakfast } = await json(s.owner.post("/api/m/menu/timed", { data: { name: "Breakfast", windows: [offNow()] } }), 201);
    await json(s.owner.put(`/api/m/menu/items/${cendol.id}`, { data: { ...strip(cendol), menuIds: [breakfast] } }));

    const pub = await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}/menu`));
    const row = pub.items.find((i: any) => i.id === cendol.id);
    expect(row.servedNow).toBe(false);
    expect(row.nextServed).toMatchObject({ menu: "Breakfast", menuId: breakfast, time: offNow().from });
    expect(pub.items.find((i: any) => i.name === "Char Kway Teow").servedNow).toBe(true); // on no menu: all day

    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T2.id]);
    const g = await guestClient();
    const q = `k=${encodeURIComponent(token)}`;
    const p = participant("Wei");
    const e = await errorOf(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: cendol.id, qty: 1 } }), 409);
    expect(e.code).toBe("not_served_now");
    expect(e.data.next).toMatchObject({ menu: "Breakfast" });

    // the till can still ring it up (the kitchen agreed)
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { takeaway: true, items: [{ itemId: cendol.id, qty: 1 }] } }), 201);

    // breakfast moved to now: guests can order it
    await json(s.owner.post("/api/m/menu/timed", { data: { id: breakfast, name: "Breakfast", windows: [onNow()] } }), 201);
    await json(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: cendol.id, qty: 1 } }), 201);
    // (the public menu is edge-cached for 15 s; the till's view isn't)
    const now = await json(s.owner.get(`/api/m/menu?branch=${s.klcc.id}&now=1`));
    expect(now.now.menus).toEqual([{ id: breakfast, name: "Breakfast", until: onNow().to }]);

    // deleting the menu leaves the dish on the all-day menu
    await json(s.owner.delete(`/api/m/menu/timed/${breakfast}`));
    expect(((await menuItems(s.owner)).byName("Cendol") as any).menuIds).toEqual([]);
  });

  test("a menu that runs at one branch only: its dishes aren't on the other branch's menu", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const { id: supper } = await json(s.owner.post("/api/m/menu/timed", { data: { name: "Supper", windows: [onNow()], branches: [s.klcc.id] } }), 201);
    await json(s.owner.put(`/api/m/menu/items/${m.byName("Cendol").id}`, { data: { ...strip(m.byName("Cendol")), menuIds: [supper] } }));
    const klcc = await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}/menu`));
    const bangsar = await json((await guestClient()).get(`/api/public/branches/${s.bangsar.ref}/menu`));
    expect(klcc.items.some((i: any) => i.name === "Cendol")).toBe(true);
    expect(bangsar.items.some((i: any) => i.name === "Cendol")).toBe(false);
  });

  test("happy hour prices the drinks while it's on, on the menu, the bill and for the till", async () => {
    const s = await seed();
    const m = await menuItems(s.owner);
    const drinks = m.categories.find((c: any) => c.name.toLowerCase().includes("drink"));
    expect(drinks, "the seed menu has a drinks category").toBeTruthy();
    const teh: any = m.items.find((i: any) => i.categoryId === drinks.id && !i.modifiers.some((g: any) => g.min > 0)) ?? m.items.find((i: any) => i.categoryId === drinks.id);
    const mods = teh.modifiers.filter((g: any) => g.min > 0).map((g: any) => ({ group: g.name, option: g.options[0].name }));
    const extra = teh.modifiers.filter((g: any) => g.min > 0).reduce((a: number, g: any) => a + g.options[0].price, 0);
    const { id: rule } = await json(s.owner.post("/api/m/menu/rules", { data: { name: "Happy hour", kind: "percent", value: 30, categories: [drinks.id], windows: [onNow()] } }), 201);
    const deal = Math.round((teh.price * 70) / 100);

    const pub = await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}/menu`));
    const row = pub.items.find((i: any) => i.id === teh.id);
    expect(row).toMatchObject({ price: deal, listPrice: teh.price, deal: { id: rule, name: "Happy hour" } });
    expect(pub.now.deals).toEqual([{ id: rule, name: "Happy hour", until: onNow().to }]);
    expect(pub.items.find((i: any) => i.name === "Char Kway Teow").listPrice).toBeUndefined();

    // the guest's order is charged the happy-hour price and says so
    const t = await tableIds(s.owner, s.klcc.id);
    const { sessionId, token } = await seatWalkIn(s.owner, s.klcc.id, [t.T3.id]);
    const g = await guestClient();
    const q = `k=${encodeURIComponent(token)}`;
    const p = participant("Ah Meng");
    const v = (await json(g.post(`/api/public/sessions/${sessionId}/lines?${q}`, { data: { participant: p, itemId: teh.id, qty: 2, modifiers: mods } }), 201)).cart.session.version;
    const sent = await json(g.post(`/api/public/sessions/${sessionId}/submit?${q}`, { data: { participant: p, expectedVersion: v, msgId: uid() } }));
    const order = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${sent.orderId}`));
    const line = order.items.find((i: any) => i.itemId === teh.id);
    expect(line).toMatchObject({ unitPrice: deal, listPrice: teh.price, deal: "Happy hour", qty: 2 });
    expect(order.subtotal).toBe((deal + extra) * 2);

    // switched off: back to the usual price, everywhere
    await json(s.owner.post("/api/m/menu/rules", { data: { id: rule, name: "Happy hour", kind: "percent", value: 30, categories: [drinks.id], windows: [onNow()], active: false } }), 201);
    const till = await json(s.owner.get(`/api/m/menu?branch=${s.klcc.id}&now=1`));
    expect(till.items.find((i: any) => i.id === teh.id).price).toBe(teh.price);

    // a rule outside its hours doesn't apply either
    await json(s.owner.post("/api/m/menu/rules", { data: { id: rule, name: "Happy hour", kind: "amount", value: 100, categories: [drinks.id], windows: [offNow()] } }), 201);
    const o2 = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { takeaway: true, items: [{ itemId: teh.id, qty: 1, modifiers: mods }] } }), 201);
    expect(o2.items[0]).toMatchObject({ unitPrice: teh.price, listPrice: null, deal: null });
  });

  test("schedules and rules are validated, and only menu managers can change them", async () => {
    const s = await seed();
    expect((await errorOf(s.owner.post("/api/m/menu/timed", { data: { name: "Bad", windows: [{ days: [], from: "07:00", to: "11:00" }] } }), 400)).code).toBeTruthy();
    expect((await errorOf(s.owner.post("/api/m/menu/timed", { data: { name: "Bad", windows: [{ days: [1], from: "7am", to: "11:00" }] } }), 400)).code).toBeTruthy();
    expect((await errorOf(s.owner.post("/api/m/menu/rules", { data: { name: "Free", kind: "percent", value: 100, windows: [onNow()] } }), 400)).code).toBeTruthy();
    const waiter = await hire(s.owner, "waiter", [s.klcc.id]);
    await errorOf(waiter.api.post("/api/m/menu/rules", { data: { name: "Staff special", kind: "percent", value: 90, windows: [onNow()] } }), 403);
    await errorOf(waiter.api.post("/api/m/menu/timed", { data: { name: "Breakfast", windows: [onNow()] } }), 403);
  });
});

/** The editable fields of a menu item, as the editor sends them. */
function strip(i: any) {
  const { id: _i, soldOut: _s, sort: _o, translations: _t, servedNow: _n, nextServed: _x, listPrice: _l, deal: _d, ...rest } = i;
  return rest;
}
