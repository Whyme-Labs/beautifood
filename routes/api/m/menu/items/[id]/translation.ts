// The restaurant's own translation of a dish. Marked manual, so re-translating never overwrites it.
import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../../src/server/routing";
import { setItemTranslation } from "../../../../../../src/server/domain/translations";
import { isLocale } from "../../../../../../src/i18n/core";
import { fail, notFound } from "../../../../../../src/server/errors";

const Tr = z.object({
  locale: z.string(),
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(600).optional(),
  story: z.string().trim().max(1200).optional(),
  modifiers: z.record(z.string(), z.object({ name: z.string().max(60).optional(), options: z.record(z.string(), z.string().max(60)).optional() })).optional(),
});

export const PUT = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  const { locale, ...tr } = await body(c, Tr);
  if (!isLocale(locale)) fail(400, "invalid_locale", "Unknown language");
  if (!(await setItemTranslation(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!, locale, tr))) notFound("Item");
  return { ok: true };
});
