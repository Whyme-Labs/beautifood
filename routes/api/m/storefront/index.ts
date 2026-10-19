// The storefront editor's state: the draft, what's live, and the live data the preview fills it with.
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { cleanStorefront, getStorefront, saveDraft, storefrontData } from "../../../../src/server/domain/storefront";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const slug = (await c.env.DB.prepare("SELECT slug FROM tenants WHERE id = ?").bind(s.tenantId).first<{ slug: string }>())!.slug;
  const [state, data] = await Promise.all([getStorefront(c.env.DB, s.tenantId), storefrontData(c.env.DB, slug)]);
  return { ...state, data };
});

export const PUT = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const { design } = await body(c, z.object({ design: z.unknown() }));
  const clean = cleanStorefront(design);
  await saveDraft(c.env.DB, s.tenantId, actorOf(s), clean);
  return { draft: clean };
});
