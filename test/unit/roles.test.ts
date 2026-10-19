// "Describe the role": the rules reading (used without Claude) and the clipping that always applies.
import { describe, expect, it } from "vitest";
import { closestBuiltIn, readDescription, suggestRole } from "../../src/server/ai/roles";
import { ROLE_PERMISSIONS, type Permission } from "../../src/shared/rbac";

const noClaude = { ANTHROPIC_MODEL: "x" };

describe("reading a role description", () => {
  it("keeps what's asked for and honours the 'but not'", () => {
    const r = readDescription("A supervisor who can take payments, refund and void, but can't see reports");
    expect(r.perms).toEqual(expect.arrayContaining(["payment.refund", "order.void", "payment.take", "order.create"]));
    expect(r.perms).not.toContain("report.view");
    expect(r.tenantWide).toBe(false);
  });

  it("reads Chinese, including 不能", () => {
    const r = readDescription("主管：可以收款、退款和作废订单，不能看报表，也不能改菜单");
    expect(r.perms).toEqual(expect.arrayContaining(["payment.take", "payment.refund", "order.void"]));
    expect(r.perms).not.toContain("report.view");
    expect(r.perms).not.toContain("menu.manage");
  });

  it("an area manager across every branch is tenant-wide and sees all reports", () => {
    const r = readDescription("Area manager: sees reports for all branches and manages staff");
    expect(r.tenantWide).toBe(true);
    expect(r.perms).toEqual(expect.arrayContaining(["report.view", "report.view_all", "staff.manage"]));
  });

  it("names the nearest built-in role and the difference", () => {
    const perms: Permission[] = [...ROLE_PERMISSIONS.cashier, "payment.refund", "order.void"];
    expect(closestBuiltIn(perms)).toMatchObject({ role: "cashier", adds: ["order.void", "payment.refund"], removes: [] });
  });
});

describe("suggestions never exceed the asker", () => {
  it("a branch manager asking for marketing powers gets them withheld, and no tenant-wide scope", async () => {
    const bm = [...ROLE_PERMISSIONS.branch_manager];
    const s = await suggestRole(noClaude, "Captain for every branch: seats guests, runs promo campaigns and loyalty points", bm, false, "en");
    expect(s.engine).toBe("rules");
    expect(s.name).toBe("Captain");
    expect(s.permissions).toContain("queue.operate");
    expect(s.withheld).toEqual(expect.arrayContaining(["campaign.manage", "member.manage"]));
    expect(s.permissions).not.toContain("campaign.manage");
    expect(s.tenantWide).toBe(false);
  });

  it("owner-only powers are never suggested", async () => {
    const s = await suggestRole(noClaude, "Manage staff and settings", [...ROLE_PERMISSIONS.owner], true, "zh");
    expect(s.permissions).not.toContain("tenant.manage");
    expect(s.name).toBe("自定义角色");
  });
});
