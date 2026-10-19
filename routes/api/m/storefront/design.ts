// The AI designer: a description (and, to refine, the current draft) in, a complete design out. Not saved.
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { appEnv } from "../../../../src/server/appenv";
import { getStorefront } from "../../../../src/server/domain/storefront";
import { getTenant } from "../../../../src/server/domain/context";
import { designStorefront } from "../../../../src/server/ai/storefront";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const { prompt, refine } = await body(c, z.object({ prompt: z.string().trim().min(3).max(600), refine: z.boolean().default(true) }));
  const [t, state] = await Promise.all([getTenant(c.env.DB, s.tenantId), getStorefront(c.env.DB, s.tenantId)]);
  return designStorefront(appEnv(), {
    prompt,
    current: refine ? state.draft : null,
    restaurant: { name: t.name, cuisine: t.cuisine, description: t.description, story: t.story, translations: JSON.parse(t.translations || "{}") },
    locales: ["en", "zh"],
  });
});
