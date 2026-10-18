// Translate the whole menu (dishes, options, categories, story) into every registered
// language, or the ones given. Claude when configured, else Workers AI, else the glossary.
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { appEnv } from "../../../../src/server/appenv";
import { translateMenu } from "../../../../src/server/domain/translations";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  const input = await body(c, z.object({ locales: z.array(z.string()).optional(), refresh: z.boolean().optional() }));
  return translateMenu(c.env.DB, { ...appEnv(), AI: (c.env as { AI?: never }).AI }, s.tenantId, actorOf(s), input);
});
