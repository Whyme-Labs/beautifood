// Development: run the side-effect pipeline and housekeeping now (production uses cron + waitUntil).
import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { fail } from "../../../src/server/errors";
import { processPending } from "../../../src/server/pipeline";
import { expireCalledTickets } from "../../../src/server/domain/housekeeping";

export const POST = api(async (c) => {
  if (appEnv().APP_ENV === "production") fail(404, "not_found", "Not found");
  const expired = await expireCalledTickets(c.env.DB, Date.now() + Number(c.req.query("advanceMinutes") ?? 0) * 60_000);
  return { expired, ...(await processPending(c.env.DB, appEnv(), 1000)) };
});
