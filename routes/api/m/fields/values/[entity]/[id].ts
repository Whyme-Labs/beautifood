// One record's custom field values. PUT { values: { key: value } } sets those keys (null or ""
// clears one) and answers with all of the record's values.
import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../../src/server/routing";
import { readValues, setValues } from "../../../../../../src/server/domain/customFields";
import { ENTITIES, type Entity } from "../../../../../../src/shared/customFields";
import { fail } from "../../../../../../src/server/errors";

const entityOf = (e: string | undefined) => {
  if (!e || !(ENTITIES as readonly string[]).includes(e)) fail(404, "not_found", "Unknown record type");
  return e as Entity;
};

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const id = c.req.param("id")!;
  return (await readValues(c.env.DB, s, entityOf(c.req.param("entity")), [id]))[id] ?? {};
});

export const PUT = api(async (c) => {
  const s = await staffTenant(c, null);
  const { values } = await body(c, z.object({ values: z.record(z.string(), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])) }));
  return setValues(c.env.DB, s, actorOf(s), entityOf(c.req.param("entity")), c.req.param("id")!, values);
});
