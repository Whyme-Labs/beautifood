// Custom field values of several records of one type: GET ?ids=a,b,c → { [id]: { key: value } }.
import { api } from "../../../../../../src/server/http";
import { staffTenant } from "../../../../../../src/server/routing";
import { readValues } from "../../../../../../src/server/domain/customFields";
import { ENTITIES, type Entity } from "../../../../../../src/shared/customFields";
import { fail } from "../../../../../../src/server/errors";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const entity = c.req.param("entity") as Entity;
  if (!ENTITIES.includes(entity)) fail(404, "not_found", "Unknown record type");
  const ids = (c.req.query("ids") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return readValues(c.env.DB, s, entity, ids);
});
