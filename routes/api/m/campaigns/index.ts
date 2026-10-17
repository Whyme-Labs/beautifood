import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { createCampaign, listCampaigns, recipients } from "../../../../src/server/domain/campaigns";

const Segment = z.object({ type: z.enum(["all", "tier", "inactive", "branch", "top"]), tier: z.string().optional(), days: z.number().int().min(1).optional(), branchId: z.string().optional(), limit: z.number().int().min(1).optional() });

export const GET = api(async (c) => {
  const s = await staffTenant(c, "campaign.manage");
  if (c.req.query("preview")) {
    const seg = Segment.parse(JSON.parse(c.req.query("preview")!));
    const list = await recipients(c.env.DB, s.tenantId, seg);
    return { count: list.length, sample: list.slice(0, 5).map((r) => r.email) };
  }
  return listCampaigns(c.env.DB, s.tenantId);
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "campaign.manage");
  const input = await body(c, z.object({ name: z.string().min(2).max(60), subject: z.string().min(2).max(120), body: z.string().min(2).max(4000), segment: Segment, promoCode: z.string().max(20).nullable().optional() }));
  return c.json({ id: await createCampaign(c.env.DB, s.tenantId, actorOf(s), input) }, 201);
});
