// Once a day: rebuild the platform's dish-pairing table from every restaurant's orders (only
// what enough restaurants share is kept), and drop assistant log entries past 90 days.
import { defineScheduled } from "void";
import { rebuildConceptPairs } from "../src/server/ai/brain/platform";
import { purgeTurns } from "../src/server/ai/brain/log";

export const cron = "17 3 * * *";

export default defineScheduled(async (_controller, bindings) => {
  const db = (bindings as { DB: D1Database }).DB;
  console.log("concept pairs", await rebuildConceptPairs(db));
  await purgeTurns(db);
});
