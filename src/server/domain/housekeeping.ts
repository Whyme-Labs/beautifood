import { getBranch } from "./context";
import { cancelTicket } from "./floor";

/** Tickets called but not checked in within the branch's hold window become no-shows (tables released). */
export async function expireCalledTickets(db: D1Database, now = Date.now()) {
  const called = (await db.prepare("SELECT id, branch_id, called_at FROM tickets WHERE status = 'called'").all<{ id: string; branch_id: string; called_at: number }>()).results;
  let expired = 0;
  for (const t of called) {
    const ctx = await getBranch(db, t.branch_id);
    if (now - t.called_at > ctx.config.holdCalledMinutes * 60_000) {
      try {
        await cancelTicket(db, ctx, "system", t.id, "no_show");
        expired++;
      } catch {
        /* already handled by staff */
      }
    }
  }
  return expired;
}
