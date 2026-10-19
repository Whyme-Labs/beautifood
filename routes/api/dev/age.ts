// Test-only: make tonight's state look like it has been going for a while. Moves seatings (and
// their bills) and queue tickets back in time, so "seated 40 min ago" and "waiting 18 min" are
// real values the turn model and the host stand work from. Only for restaurants the caller staffs.
import { getUser } from "void/auth";
import { z } from "zod";
import { api, body } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { fail } from "../../../src/server/errors";

const Age = z.object({
  seatings: z.array(z.object({ id: z.string(), minutes: z.number().min(0).max(600) })).max(200).default([]),
  tickets: z.array(z.object({ id: z.string(), minutes: z.number().min(0).max(600) })).max(200).default([]),
});

const MINE = "branch_id IN (SELECT b.id FROM branches b JOIN staff s ON s.tenant_id = b.tenant_id WHERE s.user_id = ?)";

export const POST = api(async (c) => {
  if (appEnv().APP_ENV === "production") fail(404, "not_found", "Not found");
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in first");
  const { seatings, tickets } = await body(c, Age);
  const db = c.env.DB;
  const stmts = [
    ...seatings.flatMap(({ id, minutes }) => {
      const ms = Math.round(minutes * 60_000);
      return [
        db.prepare(`UPDATE seatings SET started_at = started_at - ? WHERE id = ? AND ${MINE}`).bind(ms, id, user.id),
        db.prepare(`UPDATE orders SET created_at = created_at - ? WHERE seating_id = ? AND ${MINE}`).bind(ms, id, user.id),
        db.prepare(`UPDATE order_items SET created_at = created_at - ?, fired_at = fired_at - ? WHERE order_id IN (SELECT id FROM orders WHERE seating_id = ?) AND ${MINE}`).bind(ms, ms, id, user.id),
      ];
    }),
    ...tickets.map(({ id, minutes }) =>
      db.prepare(`UPDATE tickets SET created_at = created_at - ?, called_at = called_at - ? WHERE id = ? AND ${MINE}`).bind(Math.round(minutes * 60_000), Math.round(minutes * 60_000), id, user.id),
    ),
  ];
  if (stmts.length) await db.batch(stmts);
  return c.json({ seatings: seatings.length, tickets: tickets.length });
});
