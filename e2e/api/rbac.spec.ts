import { expect, test, request as pwRequest } from "@playwright/test";
import { BASE, errorOf, hire, json, menuItems, seatWalkIn, seed, staffClient, tableIds, uid } from "../helpers";

test.describe("multi-branch RBAC", () => {
  test("a cashier works only their own branch and only cashier things", async () => {
    const s = await seed();
    const cashier = await hire(s.owner, "cashier", [s.klcc.id]);
    const me = await json(cashier.api.get("/api/m/me"));
    expect(me.memberships[0].role).toBe("cashier");
    expect(me.memberships[0].permissions).toContain("payment.take");
    expect(me.memberships[0].permissions).not.toContain("order.void");

    const t = await tableIds(s.owner, s.klcc.id);
    const m = await menuItems(s.owner);
    const st = await seatWalkIn(cashier.api, s.klcc.id, [t.T1.id], 2);
    const order = await json(cashier.api.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: m.byName("Nasi Kerabu").id, qty: 1 }] } }), 201);
    // voids and discounts need a manager
    const v = await errorOf(cashier.api.post(`/api/m/branches/${s.klcc.id}/orders/${order.id}/void`, { data: { itemIds: [order.items[0].id], reason: "Changed mind" } }), 403);
    expect(v.message).toMatch(/cashier/);
    await errorOf(cashier.api.post(`/api/m/branches/${s.klcc.id}/orders/${order.id}/discount`, { data: { kind: "percent", value: 50, reason: "friend" } }), 403);
    await json(cashier.api.post(`/api/m/branches/${s.klcc.id}/orders/${order.id}/pay`, { data: { method: "card", amount: order.total, msgId: uid() } }));
    // but refunds are a manager's call too
    const paid = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${order.id}`));
    await errorOf(cashier.api.post(`/api/m/branches/${s.klcc.id}/payments/${paid.payments[0].id}/refund`, { data: { amount: 100, reason: "x", msgId: uid() } }), 403);

    // the other branch is invisible to them
    expect((await errorOf(cashier.api.get(`/api/m/branches/${s.bangsar.id}/board`), 403)).message).toMatch(/outside your access/);
    const branches = await json<any[]>(cashier.api.get("/api/m/branches"));
    expect(branches.map((b) => b.id)).toEqual([s.klcc.id]);
    // no staff admin, menu editing, reports or campaigns
    await errorOf(cashier.api.get("/api/m/staff"), 403);
    await errorOf(cashier.api.post("/api/m/menu/items", { data: { name: "Free food", price: 0, categoryId: m.categories[0].id } }), 403);
    await errorOf(cashier.api.get(`/api/m/branches/${s.klcc.id}/report`), 403);
    await errorOf(cashier.api.get("/api/m/campaigns"), 403);
  });

  test("no privilege escalation: a branch manager can hire floor staff for their branch only", async () => {
    const s = await seed();
    const mgr = await hire(s.owner, "branch_manager", [s.bangsar.id]);
    const ok = await json(mgr.api.post("/api/m/staff", { data: { email: `${uid("w")}@test.co`, name: "Wai", role: "waiter", branchIds: [s.bangsar.id] } }), 201);
    expect(ok.code).toBeTruthy();
    expect((await errorOf(mgr.api.post("/api/m/staff", { data: { email: `${uid("a")}@test.co`, name: "Ad", role: "admin", branchIds: [s.bangsar.id] } }), 403)).message).toMatch(/can't assign the admin role/);
    await errorOf(mgr.api.post("/api/m/staff", { data: { email: `${uid("c")}@test.co`, name: "Cy", role: "cashier", branchIds: [s.klcc.id] } }), 403);
    await errorOf(mgr.api.post("/api/m/staff", { data: { email: `${uid("c")}@test.co`, name: "Cy", role: "cashier", branchIds: ["*"] } }), 403);
    // can't promote themselves
    await errorOf(mgr.api.patch(`/api/m/staff/${mgr.userId}`, { data: { role: "owner", branchIds: ["*"] } }), 400);
    // manager can see their branch's report but not the other branch
    await json(mgr.api.get(`/api/m/branches/${s.bangsar.id}/report`));
    await errorOf(mgr.api.get(`/api/m/branches/${s.klcc.id}/report`), 403);
  });

  test("invitations are single-use and bound to the invited email", async () => {
    const s = await seed();
    const email = `${uid("inv")}@test.co`;
    const { code } = await json(s.owner.post("/api/m/staff", { data: { email, name: "Kit", role: "kitchen", branchIds: [s.klcc.id] } }), 201);
    const stranger = await staffClient();
    expect((await errorOf(stranger.api.post("/api/m/invites", { data: { code } }), 403)).code).toBe("wrong_account");
    const kit = await staffClient(email, "Kit");
    await json(kit.api.post("/api/m/invites", { data: { code } }));
    expect((await errorOf(kit.api.post("/api/m/invites", { data: { code } }), 409)).code).toBe("invite_used");
    // kitchen can work the KDS and toggle sold-out, but can't ring up orders
    await json(kit.api.get(`/api/m/branches/${s.klcc.id}/kitchen`));
    const t = await tableIds(s.owner, s.klcc.id);
    const st = await seatWalkIn(s.owner, s.klcc.id, [t.T2.id], 2);
    const m = await menuItems(s.owner);
    await errorOf(kit.api.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: m.items[0].id, qty: 1 }] } }), 403);
    // removing staff revokes access immediately
    await json(s.owner.delete(`/api/m/staff/${kit.userId}`));
    await errorOf(kit.api.get(`/api/m/branches/${s.klcc.id}/kitchen`), 403);
  });

  test("restaurants are isolated from each other", async () => {
    const a = await seed();
    const b = await seed();
    await errorOf(b.owner.get(`/api/m/branches/${a.klcc.id}/board`), 403);
    const t = await tableIds(a.owner, a.klcc.id);
    await errorOf(b.owner.post(`/api/m/branches/${a.klcc.id}/seat`, { data: { partySize: 2, tableIds: [t.T1.id] } }), 403);
    // menu, members and staff lists only show your own restaurant's rows
    const am = await menuItems(a.owner);
    const bm = await menuItems(b.owner);
    expect(am.items.map((i) => i.id).filter((id) => bm.items.some((x) => x.id === id))).toEqual([]);
    const staffB = await json(b.owner.get("/api/m/staff"));
    expect(staffB.staff.map((x: any) => x.email)).toEqual([b.ownerEmail]);
  });

  test("boss view: the owner sees every branch live; a branch manager sees only theirs", async () => {
    const s = await seed();
    const t = await tableIds(s.owner, s.bangsar.id);
    await json(s.owner.post(`/api/m/branches/${s.bangsar.id}/seat`, { data: { partySize: 2, tableIds: [t.T1.id] } }), 201);
    const all = await json(s.owner.get("/api/m/overview"));
    expect(all.branches.map((b: any) => b.name).sort()).toEqual(["Bangsar", "KLCC"]);
    expect(all.branches.find((b: any) => b.name === "Bangsar").tables.seated).toBe(1);
    expect(all.trend).toBeInstanceOf(Array);
    const mgr = await hire(s.owner, "branch_manager", [s.klcc.id]);
    const mine = await json(mgr.api.get("/api/m/overview"));
    expect(mine.branches.map((b: any) => b.name)).toEqual(["KLCC"]);
  });

  test("personal access tokens let a merchant's own agent call the API; tokens can't mint tokens and can be revoked", async () => {
    const s = await seed();
    const { token } = await json(s.owner.post("/api/m/tokens", { data: { name: "My agent" } }), 201);
    expect(token).toMatch(/^bf_pat_/);
    const agent = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { authorization: `Bearer ${token}` } });
    const board = await json(agent.get(`/api/m/branches/${s.klcc.id}/board`));
    expect(board.tickets).toEqual([]);
    await errorOf(agent.post("/api/m/tokens", { data: { name: "child" } }), 403);
    const anon = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { authorization: "Bearer bf_pat_nope" } });
    await errorOf(anon.get(`/api/m/branches/${s.klcc.id}/board`), 401);
    const list = await json<any[]>(s.owner.get("/api/m/tokens"));
    expect(list[0].last_used_at).toBeTruthy();
    await json(s.owner.delete(`/api/m/tokens?id=${list[0].id}`));
    await errorOf(agent.get(`/api/m/branches/${s.klcc.id}/board`), 401);
  });
});
