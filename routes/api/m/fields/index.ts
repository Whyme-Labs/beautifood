// The restaurant's custom fields: everyone on staff can read them (the console shows them on
// dishes, orders, members and staff); people who manage settings add them.
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { createField, listFields } from "../../../../src/server/domain/customFields";
import { ENTITIES, FIELD_TYPES } from "../../../../src/shared/customFields";
import { FieldLabel } from "../../../../src/server/schemas";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const entity = c.req.query("entity");
  return listFields(c.env.DB, s.tenantId, entity && (ENTITIES as readonly string[]).includes(entity) ? (entity as (typeof ENTITIES)[number]) : undefined);
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const input = await body(
    c,
    z.object({
      entity: z.enum(ENTITIES),
      label: FieldLabel,
      type: z.enum(FIELD_TYPES),
      options: z.array(z.string().max(60)).max(30).optional(),
      required: z.boolean().optional(),
      public: z.boolean().optional(),
    }),
  );
  return c.json(await createField(c.env.DB, s.tenantId, actorOf(s), input), 201);
});
