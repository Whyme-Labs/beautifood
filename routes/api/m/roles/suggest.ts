// "Describe the role": a proposed name and permission set, clipped to what the asker holds. Nothing is saved.
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { appEnv } from "../../../../src/server/appenv";
import { suggestRole } from "../../../../src/server/ai/roles";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  const { description, locale } = await body(c, z.object({ description: z.string().trim().min(3).max(600), locale: z.enum(["en", "zh"]).default("en") }));
  return suggestRole(appEnv(), description, s.perms, s.tenantWide, locale);
});
