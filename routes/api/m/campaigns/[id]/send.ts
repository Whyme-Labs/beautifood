// Fan a campaign out through the broadcasts queue (50 recipients per message).
import { queues } from "void/queues";
import { api } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { startCampaign } from "../../../../../src/server/domain/campaigns";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "campaign.manage");
  const batches = await startCampaign(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!);
  for (const b of batches) await queues.broadcasts.send(b);
  return { batches: batches.length, recipients: batches.reduce((n, b) => n + b.recipients.length, 0) };
});
