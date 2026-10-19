import { expect, test } from "@playwright/test";
import { errorOf, hire, json, seed, staffClient, uid } from "../helpers";

/** Invite someone into a role (built-in or custom) at some branches, and sign them in. */
async function hireInto(owner: Awaited<ReturnType<typeof seed>>["owner"], role: string, branchIds: string[], name = "Person") {
  const email = `${uid("p")}@test.co`;
  const inv = await json<{ code: string }>(owner.post("/api/m/staff", { data: { email, name, role, branchIds } }), 201);
  const s = await staffClient(email, name);
  await json(s.api.post("/api/m/invites", { data: { code: inv.code } }));
  return s;
}

test.describe("custom roles", () => {
  test("a role built from a description does exactly what it says, at the branches it's given", async () => {
    const s = await seed();
    const hint = await json(s.owner.post("/api/m/roles/suggest", { data: { description: "A supervisor who runs the queue, takes payments, refunds and voids, but can't see reports" } }));
    expect(hint.permissions).toEqual(expect.arrayContaining(["queue.operate", "payment.take", "payment.refund", "order.void"]));
    expect(hint.permissions).not.toContain("report.view");
    expect(hint.closest.role).toBeTruthy();

    const { id } = await json(s.owner.post("/api/m/roles", { data: { name: "Supervisor", description: "Refunds and voids, no reports", permissions: hint.permissions } }), 201);
    expect(id).toMatch(/^rl_/);
    const sup = await hireInto(s.owner, id, [s.klcc.id], "Sam Supervisor");

    const me = await json(sup.api.get("/api/m/me"));
    expect(me.memberships[0]).toMatchObject({ role: id, roleName: "Supervisor", tenantWide: false });
    expect(me.memberships[0].permissions).toEqual(expect.arrayContaining(["payment.refund", "order.void"]));
    await json(sup.api.get(`/api/m/branches/${s.klcc.id}/orders`)); // order.create, at KLCC
    await errorOf(sup.api.get(`/api/m/branches/${s.klcc.id}/report`), 403); // no reports
    await errorOf(sup.api.get(`/api/m/branches/${s.bangsar.id}/orders`), 403); // not their branch
    await errorOf(sup.api.post("/api/m/menu/categories", { data: { name: "Nope" } }), 403);

    // the owner adds reports to the role: it applies at once
    await json(s.owner.post("/api/m/roles", { data: { id, name: "Supervisor", permissions: [...hint.permissions, "report.view"] } }));
    await json(sup.api.get(`/api/m/branches/${s.klcc.id}/report`));

    // the team list names the role; it can't be deleted while someone holds it
    const roles = await json(s.owner.get("/api/m/roles"));
    expect(roles.custom).toEqual([expect.objectContaining({ id, name: "Supervisor", members: 1, grantable: true })]);
    expect((await errorOf(s.owner.delete(`/api/m/roles/${id}`), 409)).code).toBe("role_in_use");
  });

  test("nobody builds or hands out more than they hold", async () => {
    const s = await seed();
    const bm = await hire(s.owner, "branch_manager", [s.klcc.id], "Priya Manager");
    // a branch manager can't put marketing powers, tenant-wide scope or staff management in a role
    await errorOf(bm.api.post("/api/m/roles", { data: { name: "Promoter", permissions: ["queue.operate", "campaign.manage"] } }), 403);
    await errorOf(bm.api.post("/api/m/roles", { data: { name: "Roamer", permissions: ["queue.operate"], tenantWide: true } }), 403);
    await errorOf(bm.api.post("/api/m/roles", { data: { name: "Deputy", permissions: ["queue.operate", "staff.manage"] } }), 403);
    // but can make a role from their own permissions, and hire into it at their branch only
    const { id } = await json(bm.api.post("/api/m/roles", { data: { name: "Runner", permissions: ["kds.operate", "order.create"] } }), 201);
    await json(bm.api.post("/api/m/staff", { data: { email: `${uid("r")}@test.co`, name: "Ravi", role: id, branchIds: [s.klcc.id] } }), 201);
    await errorOf(bm.api.post("/api/m/staff", { data: { email: `${uid("r")}@test.co`, name: "Rani", role: id, branchIds: [s.bangsar.id] } }), 403);
    // a role the owner made with more than the manager has can't be edited or handed out by them
    const big = await json(s.owner.post("/api/m/roles", { data: { name: "Marketing lead", permissions: ["campaign.manage", "member.manage", "report.view"] } }), 201);
    await errorOf(bm.api.post("/api/m/roles", { data: { id: big.id, name: "Marketing lead", permissions: ["report.view"] } }), 403);
    await errorOf(bm.api.post("/api/m/staff", { data: { email: `${uid("m")}@test.co`, name: "Mo", role: big.id, branchIds: [s.klcc.id] } }), 403);
    expect((await json(bm.api.get("/api/m/roles"))).custom.find((r: any) => r.id === big.id).grantable).toBe(false);
    // the suggester clips to the asker
    const hint = await json(bm.api.post("/api/m/roles/suggest", { data: { description: "Runs promo campaigns and loyalty points for every branch" } }));
    expect(hint.permissions).not.toContain("campaign.manage");
    expect(hint.withheld).toEqual(expect.arrayContaining(["campaign.manage"]));
    expect(hint.tenantWide).toBe(false);
    // owner-only powers, duplicate names and unknown roles are refused
    expect((await errorOf(s.owner.post("/api/m/roles", { data: { name: "Co-owner", permissions: ["tenant.manage"] } }), 400)).code).toBe("owner_only");
    expect((await errorOf(s.owner.post("/api/m/roles", { data: { name: "runner", permissions: ["kds.operate"] } }), 409)).code).toBe("role_name_taken");
    expect((await errorOf(s.owner.post("/api/m/staff", { data: { email: `${uid("x")}@test.co`, name: "X", role: "rl_doesnotexist", branchIds: ["*"] } }), 400)).code).toBe("unknown_role");
    // a waiter can't touch roles at all
    const waiter = await hire(s.owner, "waiter", [s.klcc.id]);
    await errorOf(waiter.api.get("/api/m/roles"), 403);
  });
});
