// One custom field: rename it, change its options, required or public, move it; or remove it
// (and every value recorded under it).
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { deleteField, updateField } from "../../../../src/server/domain/customFields";
import { FieldLabel } from "../../../../src/server/schemas";

export const PATCH = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const input = await body(
    c,
    z.object({
      label: FieldLabel.optional(),
      options: z.array(z.string().max(60)).max(30).optional(),
      required: z.boolean().optional(),
      public: z.boolean().optional(),
      sort: z.number().int().min(0).max(1000).optional(),
    }),
  );
  return updateField(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!, input);
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  await deleteField(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!);
  return { ok: true };
});
