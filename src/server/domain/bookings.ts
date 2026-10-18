// Reservations: slot availability against the floor plan, conflict-free booking, check-in.
import { core } from "../../core/server";
import { fail, notFound } from "../errors";
import { localParts, newId, zonedTime } from "../ids";
import { Tx } from "../tx";
import { streams, type BranchCtx } from "./context";
import { listTables, seatStatements, type TableRow } from "./floor";

export interface BookingRow {
  id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  party_size: number;
  slot_start: number;
  duration_minutes: number;
  status: string;
  table_ids: string;
  notes: string;
  member_id: string | null;
  session_id: string | null;
  seating_id: string | null;
  created_at: number;
}

export const toBooking = (b: BookingRow) => ({
  id: b.id,
  name: b.name,
  phone: b.phone,
  email: b.email,
  partySize: b.party_size,
  slotStart: b.slot_start,
  durationMinutes: b.duration_minutes,
  status: b.status,
  tableIds: JSON.parse(b.table_ids) as string[],
  notes: b.notes,
  memberId: b.member_id,
  sessionId: b.session_id,
  seatingId: b.seating_id,
  createdAt: b.created_at,
});

async function bookingsOverlapping(db: D1Database, branchId: string, from: number, to: number) {
  return (
    await db
      .prepare("SELECT * FROM bookings WHERE branch_id = ? AND status IN ('confirmed','checked_in') AND slot_start < ? AND slot_start + duration_minutes * 60000 > ?")
      .bind(branchId, to, from)
      .all<BookingRow>()
  ).results;
}

/** Tables (or a merge combo) that can take this party in [start, end) given other bookings. */
function planFor(tables: TableRow[], taken: Set<string>, partySize: number) {
  const free = tables
    .filter((t) => !t.parent_id && !taken.has(t.id))
    .map((t) => ({ id: t.id, label: t.label, seatsMin: t.seats_min, seatsMax: t.seats_max, mergeGroup: t.merge_group, splitConfig: null, parentId: null, status: "free" }));
  const cands = core().candidatesFor(partySize, free);
  const rank = (a: string) => (a === "seat" ? 0 : 2);
  cands.sort((a, b) => rank(a.action) - rank(b.action) || a.capacity - b.capacity);
  return cands[0] ?? null;
}

export async function availability(db: D1Database, ctx: BranchCtx, day: string, partySize: number) {
  const cfg = ctx.config.booking;
  if (!cfg.enabled || !ctx.config.modules.bookings) fail(409, "bookings_off", "This branch doesn't take bookings");
  const tables = await listTables(db, ctx.branch.id);
  const open = zonedTime(day, cfg.openHour, 0, ctx.config.timezone);
  const close = zonedTime(day, cfg.closeHour, 0, ctx.config.timezone);
  const all = await bookingsOverlapping(db, ctx.branch.id, open, close + cfg.durationMinutes * 60_000);
  const now = Date.now();
  const slots: { start: number; label: string; available: boolean; tables: string[] }[] = [];
  for (let t = open; t + cfg.durationMinutes * 60_000 <= close; t += cfg.slotMinutes * 60_000) {
    const end = t + cfg.durationMinutes * 60_000;
    const taken = new Set(all.filter((b) => b.slot_start < end && b.slot_start + b.duration_minutes * 60_000 > t).flatMap((b) => JSON.parse(b.table_ids) as string[]));
    const plan = planFor(tables, taken, partySize);
    const { hour } = localParts(t, ctx.config.timezone);
    const minute = new Date(t).getUTCMinutes();
    slots.push({
      start: t,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      available: !!plan && t >= now + cfg.leadMinutes * 60_000,
      tables: plan?.labels ?? [],
    });
  }
  return { day, partySize, durationMinutes: cfg.durationMinutes, slots };
}

export interface BookingInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  locale?: string | null;
  partySize: number;
  slotStart: number;
  notes?: string;
  memberId?: string | null;
}

/** Create a booking. Table conflicts are re-checked inside the batch, so two people can't book the same table/time. */
export async function createBooking(db: D1Database, ctx: BranchCtx, input: BookingInput, actor: string) {
  const cfg = ctx.config.booking;
  if (!cfg.enabled || !ctx.config.modules.bookings) fail(409, "bookings_off", "This branch doesn't take bookings");
  if (input.slotStart < Date.now() + cfg.leadMinutes * 60_000 - 60_000) fail(400, "too_soon", `Book at least ${cfg.leadMinutes} minutes ahead`);
  const end = input.slotStart + cfg.durationMinutes * 60_000;
  const tables = await listTables(db, ctx.branch.id);
  const taken = new Set((await bookingsOverlapping(db, ctx.branch.id, input.slotStart, end)).flatMap((b) => JSON.parse(b.table_ids) as string[]));
  const plan = planFor(tables, taken, input.partySize);
  if (!plan) fail(409, "slot_full", "That time is fully booked for your party size");
  const id = newId("bk_");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  for (const tid of plan.tableIds)
    tx.assert(
      `NOT EXISTS (SELECT 1 FROM bookings WHERE branch_id = ? AND status IN ('confirmed','checked_in') AND table_ids LIKE '%"' || ? || '"%'
        AND slot_start < ? AND slot_start + duration_minutes * 60000 > ?)`,
      [ctx.branch.id, tid, end, input.slotStart],
      409,
      "slot_taken",
      "Someone just booked that slot. Please pick another time.",
    );
  tx.run(
    "INSERT INTO bookings (id, branch_id, name, phone, email, locale, party_size, slot_start, duration_minutes, status, table_ids, notes, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)",
    id,
    ctx.branch.id,
    input.name.slice(0, 60),
    input.phone ?? null,
    input.email?.toLowerCase() ?? null,
    input.locale ?? null,
    input.partySize,
    input.slotStart,
    cfg.durationMinutes,
    JSON.stringify(plan.tableIds),
    (input.notes ?? "").slice(0, 300),
    input.memberId ?? null,
    tx.at,
  );
  tx.event({ stream: streams.booking(id), type: "booking.created", data: { partySize: input.partySize, slotStart: input.slotStart, tables: plan.labels } });
  await tx.commit();
  return getBooking(db, id);
}

export async function getBooking(db: D1Database, id: string) {
  return (await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first<BookingRow>()) ?? notFound("Booking");
}

export async function listBookings(db: D1Database, ctx: BranchCtx, day: string) {
  const from = zonedTime(day, 0, 0, ctx.config.timezone);
  return (
    await db
      .prepare("SELECT * FROM bookings WHERE branch_id = ? AND slot_start >= ? AND slot_start < ? ORDER BY slot_start")
      .bind(ctx.branch.id, from, from + 24 * 3600_000)
      .all<BookingRow>()
  ).results.map(toBooking);
}

export async function setBookingStatus(db: D1Database, ctx: BranchCtx, actor: string, id: string, status: "cancelled" | "no_show") {
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM bookings WHERE id = ? AND branch_id = ? AND status = 'confirmed')", [id, ctx.branch.id], 409, "booking_closed", "Booking is no longer active")
    .run("UPDATE bookings SET status = ? WHERE id = ?", status, id)
    .run("UPDATE sessions SET status = 'closed', version = version + 1 WHERE id = (SELECT session_id FROM bookings WHERE id = ?)", id)
    .event({ stream: streams.booking(id), type: `booking.${status}` })
    .commit();
}

/** Guest arrived: seat them on the booked tables (or others the host picks). The preorder moves to the table bill. */
export async function checkIn(db: D1Database, ctx: BranchCtx, actor: string, id: string, tableIds?: string[]) {
  const b = await getBooking(db, id);
  if (b.branch_id !== ctx.branch.id) notFound("Booking");
  if (b.status !== "confirmed") fail(409, "booking_closed", `Booking is ${b.status}`);
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  tx.assert("EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status = 'confirmed')", [id], 409, "booking_closed", "Booking already checked in");
  const res = await seatStatements(db, tx, ctx, { tableIds: tableIds?.length ? tableIds : (JSON.parse(b.table_ids) as string[]) }, { partySize: b.party_size, bookingId: id });
  tx.run("UPDATE bookings SET status = 'checked_in', seating_id = ? WHERE id = ?", res.seatingId, id);
  if (b.session_id) {
    tx.run("UPDATE orders SET seating_id = ?, session_id = ?, type = 'dine_in' WHERE session_id = ? AND status = 'open'", res.seatingId, res.sessionId, b.session_id);
    tx.run("UPDATE seatings SET order_id = (SELECT id FROM orders WHERE seating_id = ? AND status = 'open' LIMIT 1) WHERE id = ?", res.seatingId, res.seatingId);
    tx.run("UPDATE sessions SET order_id = (SELECT order_id FROM seatings WHERE id = ?) WHERE id = ?", res.seatingId, res.sessionId);
    tx.run("UPDATE cart_lines SET session_id = ? WHERE session_id = ?", res.sessionId, b.session_id);
    tx.run("UPDATE sessions SET status = 'seated', version = version + 1 WHERE id = ?", b.session_id);
    tx.run("UPDATE order_items SET status = 'fired', fired_at = ? WHERE status = 'held' AND order_id IN (SELECT id FROM orders WHERE seating_id = ?)", tx.at, res.seatingId);
  }
  tx.event({ stream: streams.booking(id), type: "booking.checked_in", data: { seatingId: res.seatingId } });
  await tx.commit();
  return res;
}
