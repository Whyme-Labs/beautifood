// Safety net for the side-effect pipeline (normally triggered right after each command),
// plus housekeeping: called tickets past their hold window become no-shows, and failed
// emails are retried with backoff.
import { defineScheduled } from "void";
import { processPending } from "../src/server/pipeline";
import { appEnv } from "../src/server/appenv";
import { expireCalledTickets } from "../src/server/domain/housekeeping";
import { retryFailedEmails } from "../src/server/domain/messaging";

export const cron = "* * * * *";

export default defineScheduled(async (_controller, bindings) => {
  const db = (bindings as { DB: D1Database }).DB;
  await expireCalledTickets(db);
  await processPending(db, appEnv(), 500);
  await retryFailedEmails(db, appEnv());
});
