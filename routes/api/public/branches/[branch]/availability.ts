import { api } from "../../../../../src/server/http";
import { getBranch } from "../../../../../src/server/domain/context";
import { availability } from "../../../../../src/server/domain/bookings";
import { today } from "../../../../../src/server/routing";
import { fail } from "../../../../../src/server/errors";

export const GET = api(async (c) => {
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  const day = c.req.query("day") ?? today(ctx);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(400, "invalid_day", "day must be YYYY-MM-DD");
  const party = Number(c.req.query("party") ?? 2);
  if (!Number.isInteger(party) || party < 1 || party > 60) fail(400, "invalid_party", "party must be 1-60");
  return availability(c.env.DB, ctx, day, party);
});
