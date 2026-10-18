// Tables, seatings, merge/split/transfer, queue tickets and seating suggestions.
import { core } from "../../core/server";
import type { EngineTable, EngineTicket, TurnModel } from "../../core/api";
import { categoryFor } from "../../shared/categories";
import type { BranchConfig, Suggestion } from "../../shared/types";
import { fail, notFound } from "../errors";
import { localParts, newId, randomToken } from "../ids";
import { Tx } from "../tx";
import { invalidateBranch, streams, type BranchCtx } from "./context";

export interface TableRow {
  id: string;
  branch_id: string;
  label: string;
  zone: string;
  seats_min: number;
  seats_max: number;
  x: number;
  y: number;
  merge_group: string | null;
  split_config: string | null;
  parent_id: string | null;
  status: string;
  seating_id: string | null;
  static_token: string;
  active: number;
  sort: number;
}

export interface TicketRow {
  id: string;
  branch_id: string;
  day: string;
  category: string;
  seq: number;
  number: string;
  party_size: number;
  name: string;
  phone: string | null;
  email: string | null;
  member_id: string | null;
  status: string;
  created_at: number;
  called_at: number | null;
  seated_at: number | null;
  ended_at: number | null;
  skips: number;
  priority: number;
  preferences: string;
  source: string;
  device_id: string | null;
  seating_id: string | null;
  held_table_ids: string | null;
  session_id: string | null;
}

export interface SeatingRow {
  id: string;
  branch_id: string;
  table_ids: string;
  party_size: number;
  ticket_id: string | null;
  booking_id: string | null;
  session_id: string;
  order_id: string | null;
  started_at: number;
  ended_at: number | null;
  status: string;
}

export const toTable = (r: TableRow) => ({
  id: r.id,
  label: r.label,
  zone: r.zone,
  seatsMin: r.seats_min,
  seatsMax: r.seats_max,
  x: r.x,
  y: r.y,
  mergeGroup: r.merge_group,
  splitConfig: r.split_config ? (JSON.parse(r.split_config) as { suffix: string; seats: number }[]) : null,
  parentId: r.parent_id,
  status: r.status,
  seatingId: r.seating_id,
  staticToken: r.static_token,
  active: !!r.active,
  sort: r.sort,
});

export const toTicket = (r: TicketRow) => ({
  id: r.id,
  number: r.number,
  category: r.category,
  partySize: r.party_size,
  name: r.name,
  phone: r.phone,
  email: r.email,
  memberId: r.member_id,
  status: r.status,
  createdAt: r.created_at,
  calledAt: r.called_at,
  seatedAt: r.seated_at,
  skips: r.skips,
  priority: r.priority,
  preferences: JSON.parse(r.preferences) as string[],
  source: r.source,
  seatingId: r.seating_id,
  heldTableIds: r.held_table_ids ? (JSON.parse(r.held_table_ids) as string[]) : [],
  sessionId: r.session_id,
});

export const toSeating = (r: SeatingRow) => ({
  id: r.id,
  tableIds: JSON.parse(r.table_ids) as string[],
  partySize: r.party_size,
  ticketId: r.ticket_id,
  bookingId: r.booking_id,
  sessionId: r.session_id,
  orderId: r.order_id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  status: r.status,
});

// ── reads ───────────────────────────────────────────────────────────────────

export async function listTables(db: D1Database, branchId: string, includeInactive = false) {
  const rows = (
    await db
      .prepare(`SELECT * FROM floor_tables WHERE branch_id = ? ${includeInactive ? "" : "AND active = 1"} ORDER BY sort, label`)
      .bind(branchId)
      .all<TableRow>()
  ).results;
  return rows;
}

export async function openSeatings(db: D1Database, branchId: string) {
  return (await db.prepare("SELECT * FROM seatings WHERE branch_id = ? AND status = 'open'").bind(branchId).all<SeatingRow>()).results;
}

export async function activeTickets(db: D1Database, branchId: string) {
  return (
    await db
      .prepare("SELECT * FROM tickets WHERE branch_id = ? AND status IN ('waiting','called') ORDER BY created_at")
      .bind(branchId)
      .all<TicketRow>()
  ).results;
}

export async function getTicket(db: D1Database, id: string) {
  return (await db.prepare("SELECT * FROM tickets WHERE id = ?").bind(id).first<TicketRow>()) ?? notFound("Ticket");
}

export async function getSeating(db: D1Database, id: string) {
  return (await db.prepare("SELECT * FROM seatings WHERE id = ?").bind(id).first<SeatingRow>()) ?? notFound("Seating");
}

async function upcomingBookings(db: D1Database, branchId: string, now: number) {
  return (
    await db
      .prepare("SELECT table_ids, slot_start FROM bookings WHERE branch_id = ? AND status = 'confirmed' AND slot_start BETWEEN ? AND ?")
      .bind(branchId, now - 15 * 60_000, now + 4 * 3600_000)
      .all<{ table_ids: string; slot_start: number }>()
  ).results.map((b) => ({ tableIds: JSON.parse(b.table_ids) as string[], slotStart: b.slot_start }));
}

/** Predicted turn minutes for party sizes 1..maxParty from the branch's learned model. */
export function turnTable(ctx: BranchCtx, now: number, maxParty = 30): Record<number, number> {
  const model = JSON.parse(ctx.branch.turn_model || "{}") as TurnModel;
  const { hour, weekend } = localParts(now, ctx.config.timezone);
  const c = core();
  const out: Record<number, number> = {};
  for (let p = 1; p <= maxParty; p++) out[p] = Math.round(c.predictTurn(model, p, hour, weekend) * 10) / 10;
  return out;
}

const engineTable = (t: TableRow): EngineTable => ({
  id: t.id,
  label: t.label,
  seatsMin: t.seats_min,
  seatsMax: t.seats_max,
  mergeGroup: t.merge_group,
  splitConfig: t.split_config ? JSON.parse(t.split_config) : null,
  parentId: t.parent_id,
  status: t.status,
});

const engineTicket = (t: TicketRow): EngineTicket => ({
  id: t.id,
  number: t.number,
  category: t.category,
  partySize: t.party_size,
  createdAt: t.created_at,
  skips: t.skips,
  priority: t.priority,
});

export interface QueueBoard {
  tickets: (ReturnType<typeof toTicket> & { etaMinutes: number | null; position: number })[];
  suggestions: Suggestion[];
  tables: ReturnType<typeof toTable>[];
  seatings: ReturnType<typeof toSeating>[];
  turn: Record<number, number>;
  strategy: BranchConfig["strategy"];
}

/** Staff view of the queue: tickets with ETAs, strategy suggestions, floor state. */
export async function queueBoard(db: D1Database, ctx: BranchCtx, now = Date.now()): Promise<QueueBoard> {
  const [tables, tickets, seatings, bookings] = await Promise.all([
    listTables(db, ctx.branch.id),
    activeTickets(db, ctx.branch.id),
    openSeatings(db, ctx.branch.id),
    upcomingBookings(db, ctx.branch.id, now),
  ]);
  const turn = turnTable(ctx, now);
  const c = core();
  const waiting = tickets.filter((t) => t.status === "waiting");
  const engine = {
    tables: tables.map(engineTable),
    tickets: waiting.map(engineTicket),
    bookings,
    strategy: ctx.config.strategy,
    weights: ctx.config.weights,
    maxSkips: ctx.config.maxSkips,
    now,
    turn,
  };
  const suggestions = c.suggest(engine);
  const busy = seatings.map((s) => ({ tableIds: JSON.parse(s.table_ids) as string[], freeAt: s.started_at + (turn[Math.min(s.party_size, 30)] ?? 60) * 60_000 }));
  const etas = c.estimateWaits(engine, busy);
  const position = new Map<string, number>();
  for (const cat of ctx.config.categories) waiting.filter((t) => t.category === cat.code).forEach((t, i) => position.set(t.id, i + 1));
  return {
    tickets: tickets.map((t) => ({ ...toTicket(t), etaMinutes: t.status === "called" ? 0 : etas[t.id] ?? null, position: position.get(t.id) ?? 0 })),
    suggestions,
    tables: tables.map(toTable),
    seatings: seatings.map(toSeating),
    turn,
    strategy: ctx.config.strategy,
  };
}

// Guest-facing reads (ticket pages polling, public status) share a 2-second
// snapshot per isolate, so hundreds of phones polling don't each re-run the
// ETA simulation. Staff screens always read fresh.
const boardCache = new Map<string, { at: number; board: Promise<QueueBoard> }>();
export function sharedBoard(db: D1Database, ctx: BranchCtx): Promise<QueueBoard> {
  const hit = boardCache.get(ctx.branch.id);
  if (hit && Date.now() - hit.at < 2000) return hit.board;
  const board = queueBoard(db, ctx);
  boardCache.set(ctx.branch.id, { at: Date.now(), board });
  board.catch(() => boardCache.delete(ctx.branch.id));
  return board;
}

/** Public, cacheable snapshot: per-category waiting counts, now-calling numbers and wait estimates. */
export async function publicStatus(db: D1Database, ctx: BranchCtx, now = Date.now()) {
  const board = await sharedBoard(db, ctx);
  const free = board.tables.filter((t) => t.status === "free").length;
  const categories = ctx.config.categories.map((cat) => {
    const inCat = board.tickets.filter((t) => t.category === cat.code && t.status === "waiting");
    const last = inCat[inCat.length - 1];
    // estimate for someone joining now = ETA of the last ticket + one turn spread over matching tables, roughly
    const matching = board.tables.filter((t) => t.seatsMax >= cat.min && t.seatsMin <= cat.max).length || 1;
    const lastEta = last?.etaMinutes ?? 0;
    const turn = board.turn[cat.max] ?? 60;
    const estimate = inCat.length === 0 && free > 0 ? 0 : Math.round(lastEta + turn / matching);
    return {
      code: cat.code,
      label: cat.label,
      prefix: cat.prefix,
      min: cat.min,
      max: cat.max,
      waiting: inCat.length,
      estimateMinutes: estimate,
    };
  });
  return {
    branchId: ctx.branch.id,
    name: ctx.branch.name,
    open: !!ctx.branch.active,
    categories,
    nowCalling: board.tickets.filter((t) => t.status === "called").map((t) => ({ number: t.number, tables: tableLabels(board.tables, t.heldTableIds) })),
    recentlySeated: [] as string[],
    tables: { total: board.tables.length, free, occupied: board.tables.filter((t) => t.status === "seated").length },
    at: now,
  };
}

const tableLabels = (tables: { id: string; label: string }[], ids: string[]) => ids.map((id) => tables.find((t) => t.id === id)?.label ?? id);

// ── table setup ────────────────────────────────────────────────────────────

export interface TableInput {
  id?: string;
  label: string;
  zone?: string;
  seatsMin: number;
  seatsMax: number;
  x?: number;
  y?: number;
  mergeGroup?: string | null;
  splitConfig?: { suffix: string; seats: number }[] | null;
  sort?: number;
}

function validateTable(t: TableInput) {
  if (t.seatsMin < 1 || t.seatsMax < t.seatsMin || t.seatsMax > 60) fail(400, "invalid_table", `${t.label}: seats must be 1 ≤ min ≤ max ≤ 60`);
  if (t.splitConfig && (t.splitConfig.length < 2 || t.splitConfig.reduce((s, p) => s + p.seats, 0) > t.seatsMax + 2))
    fail(400, "invalid_split", `${t.label}: a split needs at least two parts that fit the table`);
}

export async function saveTables(db: D1Database, ctx: BranchCtx, actor: string, input: TableInput[], replace: boolean) {
  input.forEach(validateTable);
  const labels = new Set<string>();
  for (const t of input) {
    if (labels.has(t.label)) fail(400, "duplicate_label", `Duplicate table label ${t.label}`);
    labels.add(t.label);
  }
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  if (replace) {
    tx.assert("NOT EXISTS (SELECT 1 FROM floor_tables WHERE branch_id = ? AND status NOT IN ('free','dirty','blocked') AND active = 1)", [ctx.branch.id], 409, "tables_in_use", "Finish open seatings before replacing the floor plan");
    tx.run("UPDATE floor_tables SET active = 0, label = label || '~' || id WHERE branch_id = ? AND parent_id IS NULL", ctx.branch.id);
    tx.run("DELETE FROM floor_tables WHERE branch_id = ? AND parent_id IS NOT NULL", ctx.branch.id);
  }
  const ids: string[] = [];
  input.forEach((t, i) => {
    const id = t.id ?? newId("tbl_");
    ids.push(id);
    tx.run(
      `INSERT INTO floor_tables (id, branch_id, label, zone, seats_min, seats_max, x, y, merge_group, split_config, status, static_token, active, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'free', ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, zone = excluded.zone, seats_min = excluded.seats_min, seats_max = excluded.seats_max,
         x = excluded.x, y = excluded.y, merge_group = excluded.merge_group, split_config = excluded.split_config, sort = excluded.sort, active = 1
       WHERE floor_tables.branch_id = excluded.branch_id`,
      id,
      ctx.branch.id,
      t.label,
      t.zone ?? "Main",
      t.seatsMin,
      t.seatsMax,
      t.x ?? (i % 8) * 120,
      t.y ?? Math.floor(i / 8) * 110,
      t.mergeGroup ?? null,
      t.splitConfig ? JSON.stringify(t.splitConfig) : null,
      randomToken(12),
      t.sort ?? i,
    );
  });
  tx.event({ stream: streams.branch(ctx.branch.id), type: "floor.saved", data: { count: input.length, replace } });
  await tx.commit();
  return ids;
}

export async function deleteTable(db: D1Database, ctx: BranchCtx, actor: string, tableId: string) {
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND branch_id = ? AND status IN ('free','dirty','blocked'))", [tableId, ctx.branch.id], 409, "table_in_use", "Table is in use")
    .run("UPDATE floor_tables SET active = 0, label = label || '~' || id WHERE id = ?", tableId)
    .event({ stream: streams.table(tableId), type: "table.removed" })
    .commit();
}

export async function setTableStatus(db: D1Database, ctx: BranchCtx, actor: string, tableId: string, status: "free" | "blocked" | "dirty") {
  const allowed = status === "free" ? "('dirty','blocked','free')" : "('free','dirty','blocked')";
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert(`EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND branch_id = ? AND status IN ${allowed})`, [tableId, ctx.branch.id], 409, "table_busy", "Table is occupied or reserved")
    .run("UPDATE floor_tables SET status = ? WHERE id = ?", status, tableId)
    .event({ stream: streams.table(tableId), type: `table.${status === "free" ? "cleaned" : status}` })
    .commit();
}

// ── split / unsplit ─────────────────────────────────────────────────────────

const childId = (parentId: string, suffix: string) => `${parentId}_${suffix}`;

/** Add statements that split a free parent table into its configured children (children become free). */
function splitStatements(tx: Tx, parent: TableRow) {
  const cfg = parent.split_config ? (JSON.parse(parent.split_config) as { suffix: string; seats: number }[]) : null;
  if (!cfg || cfg.length < 2) fail(400, "not_splittable", `${parent.label} has no split configuration`);
  tx.assert("EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND status = 'free' AND active = 1)", [parent.id], 409, "table_not_free", `${parent.label} is not free`);
  tx.run("UPDATE floor_tables SET status = 'split' WHERE id = ?", parent.id);
  for (const part of cfg) {
    tx.run(
      `INSERT INTO floor_tables (id, branch_id, label, zone, seats_min, seats_max, x, y, merge_group, split_config, parent_id, status, static_token, active, sort)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, NULL, NULL, ?, 'free', ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'free', active = 1, seating_id = NULL`,
      childId(parent.id, part.suffix),
      parent.branch_id,
      `${parent.label}${part.suffix}`,
      parent.zone,
      part.seats,
      parent.x,
      parent.y,
      parent.id,
      randomToken(12),
      parent.sort,
    );
  }
  tx.event({ stream: streams.table(parent.id), type: "table.split", data: { parts: cfg } });
  return cfg.map((p) => childId(parent.id, p.suffix));
}

async function tableById(db: D1Database, branchId: string, id: string) {
  const t = await db.prepare("SELECT * FROM floor_tables WHERE id = ? AND branch_id = ?").bind(id, branchId).first<TableRow>();
  return t ?? notFound("Table");
}

export async function splitTable(db: D1Database, ctx: BranchCtx, actor: string, tableId: string) {
  const parent = await tableById(db, ctx.branch.id, tableId);
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  const children = splitStatements(tx, parent);
  await tx.commit();
  return children;
}

export async function unsplitTable(db: D1Database, ctx: BranchCtx, actor: string, tableId: string) {
  const parent = await tableById(db, ctx.branch.id, tableId);
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND status = 'split')", [parent.id], 409, "not_split", `${parent.label} is not split`)
    .assert(
      "NOT EXISTS (SELECT 1 FROM floor_tables WHERE parent_id = ? AND active = 1 AND status NOT IN ('free','dirty'))",
      [parent.id],
      409,
      "children_busy",
      `Both halves of ${parent.label} must be free to join them back`,
    )
    .run("UPDATE floor_tables SET active = 0, status = 'free', seating_id = NULL WHERE parent_id = ?", parent.id)
    .run("UPDATE floor_tables SET status = 'free' WHERE id = ?", parent.id)
    .event({ stream: streams.table(parent.id), type: "table.unsplit" })
    .commit();
}

// ── seating ─────────────────────────────────────────────────────────────────

export interface SeatPlan {
  tableIds: string[];
  split?: { parentId: string; childSuffixes: string[] } | null;
}

export interface SeatResult {
  seatingId: string;
  sessionId: string;
  tableIds: string[];
  tableLabels: string[];
}

/**
 * Add the statements that seat a party: resolve a split if requested, verify every
 * table is still free (or reserved for this ticket), open the seating and its cart
 * session, and flip table status. Caller commits.
 */
export async function seatStatements(
  db: D1Database,
  tx: Tx,
  ctx: BranchCtx,
  plan: SeatPlan,
  party: { partySize: number; ticketId?: string | null; bookingId?: string | null },
): Promise<SeatResult> {
  let tableIds = [...new Set(plan.tableIds)];
  if (!tableIds.length) fail(400, "no_tables", "Pick at least one table");
  const rows = (
    await db
      .prepare(`SELECT * FROM floor_tables WHERE branch_id = ? AND id IN (${tableIds.map(() => "?").join(",")})`)
      .bind(ctx.branch.id, ...tableIds)
      .all<TableRow>()
  ).results;
  if (rows.length !== tableIds.length) notFound("Table");
  if (plan.split) {
    const parent = rows.find((r) => r.id === plan.split!.parentId);
    if (!parent) fail(400, "invalid_split", "Split parent must be one of the tables");
    const children = splitStatements(tx, parent);
    const chosen = plan.split.childSuffixes.map((s) => childId(parent.id, s));
    if (chosen.some((c) => !children.includes(c))) fail(400, "invalid_split", "Unknown split part");
    tableIds = [...tableIds.filter((id) => id !== parent.id), ...chosen];
  }
  const groups = new Set(rows.filter((r) => !plan.split || r.id !== plan.split.parentId).map((r) => r.merge_group));
  if (tableIds.length > 1 && !plan.split && (groups.size !== 1 || groups.has(null))) fail(400, "not_mergeable", "These tables can't be pushed together");
  const seatingId = newId("st_");
  const sessionId = newId("ss_");
  const labelOf = (id: string) => rows.find((r) => r.id === id)?.label ?? `${rows.find((r) => id.startsWith(r.id))?.label ?? ""}${id.split("_").pop()}`;
  for (const id of tableIds) {
    tx.assert(
      "EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND active = 1 AND (status = 'free' OR (status = 'reserved' AND ? IS NOT NULL AND EXISTS (SELECT 1 FROM tickets WHERE id = ? AND held_table_ids LIKE '%' || ? || '%'))))",
      [id, party.ticketId ?? null, party.ticketId ?? null, id],
      409,
      "table_taken",
      `${labelOf(id)} was just taken by someone else`,
    );
  }
  tx.run(
    "INSERT INTO seatings (id, branch_id, table_ids, party_size, ticket_id, booking_id, session_id, started_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')",
    seatingId,
    ctx.branch.id,
    JSON.stringify(tableIds),
    party.partySize,
    party.ticketId ?? null,
    party.bookingId ?? null,
    sessionId,
    tx.at,
  );
  tx.run("INSERT INTO sessions (id, branch_id, tenant_id, kind, ref_id, status, created_at) VALUES (?, ?, ?, 'table', ?, 'open', ?)", sessionId, ctx.branch.id, ctx.tenant.id, seatingId, tx.at);
  tx.run(`UPDATE floor_tables SET status = 'seated', seating_id = ? WHERE id IN (${tableIds.map(() => "?").join(",")})`, seatingId, ...tableIds);
  for (const id of tableIds) tx.event({ stream: streams.table(id), type: "table.seated", data: { seatingId } });
  tx.event({ stream: streams.seating(seatingId), type: "seating.opened", data: { tableIds, partySize: party.partySize, ticketId: party.ticketId ?? null, bookingId: party.bookingId ?? null } });
  return { seatingId, sessionId, tableIds, tableLabels: tableIds.map(labelOf) };
}

export async function seatWalkIn(db: D1Database, ctx: BranchCtx, actor: string, partySize: number, plan: SeatPlan) {
  if (partySize < 1 || partySize > 60) fail(400, "invalid_party", "Party size must be 1–60");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  const res = await seatStatements(db, tx, ctx, plan, { partySize });
  await tx.commit();
  return res;
}

/** Push more tables onto an open seating (party grew, or merging to make room). */
export async function addTablesToSeating(db: D1Database, ctx: BranchCtx, actor: string, seatingId: string, addIds: string[]) {
  const s = await getSeating(db, seatingId);
  if (s.status !== "open") fail(409, "seating_closed", "Seating is closed");
  const current = JSON.parse(s.table_ids) as string[];
  const all = [...new Set([...current, ...addIds])];
  const rows = (
    await db
      .prepare(`SELECT * FROM floor_tables WHERE branch_id = ? AND id IN (${all.map(() => "?").join(",")})`)
      .bind(ctx.branch.id, ...all)
      .all<TableRow>()
  ).results;
  const groups = new Set(rows.filter((r) => !r.parent_id).map((r) => r.merge_group));
  if (groups.size !== 1 || groups.has(null)) fail(400, "not_mergeable", "These tables can't be pushed together");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  for (const id of addIds) tx.assert("EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND status = 'free' AND active = 1)", [id], 409, "table_taken", `${rows.find((r) => r.id === id)?.label ?? id} is not free`);
  tx.assert("EXISTS (SELECT 1 FROM seatings WHERE id = ? AND status = 'open')", [seatingId], 409, "seating_closed", "Seating is closed");
  tx.run("UPDATE seatings SET table_ids = ?, version = version + 1 WHERE id = ?", JSON.stringify(all), seatingId);
  tx.run(`UPDATE floor_tables SET status = 'seated', seating_id = ? WHERE id IN (${addIds.map(() => "?").join(",")})`, seatingId, ...addIds);
  tx.event({ stream: streams.seating(seatingId), type: "seating.tables_merged", data: { added: addIds } });
  await tx.commit();
  return { tableIds: all };
}

/** Move a party to other table(s). */
export async function transferSeating(db: D1Database, ctx: BranchCtx, actor: string, seatingId: string, toIds: string[]) {
  const s = await getSeating(db, seatingId);
  if (s.status !== "open") fail(409, "seating_closed", "Seating is closed");
  const from = JSON.parse(s.table_ids) as string[];
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  for (const id of toIds.filter((i) => !from.includes(i)))
    tx.assert("EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND branch_id = ? AND status = 'free' AND active = 1)", [id, ctx.branch.id], 409, "table_taken", "Destination table is not free");
  const released = from.filter((i) => !toIds.includes(i));
  if (released.length) tx.run(`UPDATE floor_tables SET status = 'dirty', seating_id = NULL WHERE id IN (${released.map(() => "?").join(",")})`, ...released);
  tx.run(`UPDATE floor_tables SET status = 'seated', seating_id = ? WHERE id IN (${toIds.map(() => "?").join(",")})`, seatingId, ...toIds);
  tx.run("UPDATE seatings SET table_ids = ?, version = version + 1 WHERE id = ?", JSON.stringify(toIds), seatingId);
  tx.event({ stream: streams.seating(seatingId), type: "seating.transferred", data: { from, to: toIds } });
  await tx.commit();
}

/**
 * Merge seating B into seating A: one party, one bill. B's tables join A, B's
 * order items move to A's order, B's open cart lines move to A's session.
 */
export async function mergeSeatings(db: D1Database, ctx: BranchCtx, actor: string, intoId: string, fromId: string) {
  if (intoId === fromId) fail(400, "same_seating", "Pick two different tables");
  const [a, b] = await Promise.all([getSeating(db, intoId), getSeating(db, fromId)]);
  if (a.status !== "open" || b.status !== "open") fail(409, "seating_closed", "Both seatings must be open");
  const tables = [...new Set([...JSON.parse(a.table_ids), ...JSON.parse(b.table_ids)])] as string[];
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("(SELECT COUNT(*) FROM seatings WHERE id IN (?, ?) AND status = 'open') = 2", [intoId, fromId], 409, "seating_closed", "Both seatings must be open")
    .run("UPDATE seatings SET table_ids = ?, party_size = party_size + ?, version = version + 1 WHERE id = ?", JSON.stringify(tables), b.party_size, intoId)
    .run("UPDATE seatings SET status = 'merged', ended_at = ? WHERE id = ?", Date.now(), fromId)
    .run("UPDATE floor_tables SET seating_id = ? WHERE seating_id = ?", intoId, fromId)
    .run("UPDATE cart_lines SET session_id = ? WHERE session_id = ?", a.session_id, b.session_id)
    .run("UPDATE sessions SET status = 'merged', version = version + 1 WHERE id = ?", b.session_id)
    .run("UPDATE sessions SET version = version + 1 WHERE id = ?", a.session_id);
  if (b.order_id && a.order_id) {
    tx.assert("EXISTS (SELECT 1 FROM orders WHERE id = ? AND paid = 0)", [b.order_id], 409, "order_paid", "The other table already paid; settle it separately");
    tx.run("UPDATE order_items SET order_id = ? WHERE order_id = ?", a.order_id, b.order_id);
    tx.run("UPDATE orders SET status = 'merged', total = 0, subtotal = 0, service_charge = 0, tax = 0, rounding = 0, discount_amount = 0, closed_at = ? WHERE id = ?", Date.now(), b.order_id);
  } else if (b.order_id) {
    tx.run("UPDATE seatings SET order_id = ? WHERE id = ?", b.order_id, intoId);
    tx.run("UPDATE orders SET seating_id = ?, session_id = ? WHERE id = ?", intoId, a.session_id, b.order_id);
    tx.run("UPDATE sessions SET order_id = ? WHERE id = ?", b.order_id, a.session_id);
  }
  tx.event({ stream: streams.seating(intoId), type: "seating.merged", data: { from: fromId } });
  await tx.commit();
  return { seatingId: intoId, mergedOrder: !!(b.order_id && a.order_id), orderId: a.order_id ?? b.order_id };
}


/** Close a seating once its bill is settled (or empty): tables go to "dirty", the cart closes, the turn model learns. */
export async function closeSeating(db: D1Database, ctx: BranchCtx, actor: string, seatingId: string, force = false) {
  const s = await getSeating(db, seatingId);
  if (s.status !== "open") return { closed: false, minutes: 0 };
  const tables = JSON.parse(s.table_ids) as string[];
  const now = Date.now();
  const minutes = (now - s.started_at) / 60_000;
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  if (!force)
    tx.assert(
      "NOT EXISTS (SELECT 1 FROM orders WHERE seating_id = ? AND status = 'open' AND total > paid)",
      [seatingId],
      409,
      "bill_unpaid",
      "The bill isn't settled yet",
    );
  tx.run("UPDATE seatings SET status = 'closed', ended_at = ? WHERE id = ? AND status = 'open'", now, seatingId)
    .run(`UPDATE floor_tables SET status = 'dirty', seating_id = NULL WHERE id IN (${tables.map(() => "?").join(",")})`, ...tables)
    .run("UPDATE sessions SET status = 'closed', version = version + 1 WHERE id = ?", s.session_id)
    .run("DELETE FROM cart_lines WHERE session_id = ?", s.session_id)
    .run("INSERT INTO turn_observations (branch_id, party_size, started_at, minutes) VALUES (?, ?, ?, ?)", ctx.branch.id, s.party_size, s.started_at, minutes)
    .event({ stream: streams.seating(seatingId), type: "seating.closed", data: { minutes: Math.round(minutes), force } });
  if (s.ticket_id) tx.run("UPDATE tickets SET ended_at = ? WHERE id = ?", now, s.ticket_id);
  if (s.booking_id) tx.run("UPDATE bookings SET status = 'completed' WHERE id = ?", s.booking_id);
  // learn from this visit: fold the duration into the branch's turn-time model
  const { hour, weekend } = localParts(s.started_at, ctx.config.timezone);
  const model = core().observeTurn(JSON.parse(ctx.branch.turn_model || "{}"), s.party_size, hour, weekend, minutes);
  tx.run("UPDATE branches SET turn_model = ? WHERE id = ?", JSON.stringify(model), ctx.branch.id);
  await tx.commit();
  invalidateBranch(ctx.branch.id);
  return { closed: true, minutes: Math.round(minutes) };
}

// ── queue ───────────────────────────────────────────────────────────────────

export interface JoinInput {
  partySize: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  /** The guest's language, for their emails. */
  locale?: string | null;
  memberId?: string | null;
  preferences?: string[];
  source?: string;
  priority?: number;
}

/**
 * Join the queue. Numbering is gap-free per (branch, day, size class) and is
 * computed inside the INSERT itself, so a surge of simultaneous joins can't
 * produce duplicates. Admission control caps the waiting list.
 */
export async function joinQueue(db: D1Database, ctx: BranchCtx, input: JoinInput, deviceId: string | null) {
  if (!ctx.branch.active) fail(409, "branch_closed", "This branch isn't taking queue tickets right now");
  const cat = categoryFor(ctx.config.categories, input.partySize);
  if (!cat) fail(400, "party_too_large", `We can't seat a party of ${input.partySize} from the queue. Please call the restaurant.`);
  if (deviceId) {
    const existing = await db
      .prepare("SELECT * FROM tickets WHERE branch_id = ? AND device_id = ? AND status IN ('waiting','called') LIMIT 1")
      .bind(ctx.branch.id, deviceId)
      .first<TicketRow>();
    if (existing) return { ticket: existing, existing: true };
  }
  const now = Date.now();
  const day = localParts(now, ctx.config.timezone).day;
  const id = newId("tk_");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: deviceId ? `device:${deviceId}` : "kiosk" });
  tx.assert(
    "(SELECT COUNT(*) FROM tickets WHERE branch_id = ? AND status = 'waiting') < ?",
    [ctx.branch.id, ctx.config.maxWaiting],
    429,
    "queue_full",
    "The queue is full right now. Please try again in a few minutes.",
  );
  if (deviceId)
    tx.assert(
      "NOT EXISTS (SELECT 1 FROM tickets WHERE branch_id = ? AND device_id = ? AND status IN ('waiting','called'))",
      [ctx.branch.id, deviceId],
      409,
      "already_queued",
      "You already have a ticket here",
    );
  tx.run(
    `INSERT INTO tickets (id, branch_id, day, category, seq, number, party_size, name, phone, email, locale, member_id, status, created_at, priority, preferences, source, device_id)
     SELECT ?, ?, ?, ?, n, ? || printf('%03d', n), ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?
     FROM (SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM tickets WHERE branch_id = ? AND day = ? AND category = ?)`,
    id,
    ctx.branch.id,
    day,
    cat.code,
    cat.prefix,
    input.partySize,
    input.name.slice(0, 60),
    input.phone ?? null,
    input.email?.toLowerCase() ?? null,
    input.locale ?? null,
    input.memberId ?? null,
    now,
    input.priority ?? 0,
    JSON.stringify(input.preferences ?? []),
    input.source ?? "web",
    deviceId,
    ctx.branch.id,
    day,
    cat.code,
  );
  tx.event({ stream: streams.queue(ctx.branch.id), type: "queue.joined", data: { ticketId: id, partySize: input.partySize, category: cat.code } });
  await tx.commit();
  return { ticket: await getTicket(db, id), existing: false };
}

export async function cancelTicket(db: D1Database, ctx: BranchCtx, actor: string, ticketId: string, reason: "cancelled" | "no_show" = "cancelled") {
  const t = await getTicket(db, ticketId);
  if (t.branch_id !== ctx.branch.id) notFound("Ticket");
  const held = t.held_table_ids ? (JSON.parse(t.held_table_ids) as string[]) : [];
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM tickets WHERE id = ? AND status IN ('waiting','called'))", [ticketId], 409, "ticket_closed", "This ticket is no longer active")
    .run("UPDATE tickets SET status = ?, ended_at = ?, held_table_ids = NULL WHERE id = ?", reason, Date.now(), ticketId);
  if (held.length) tx.run(`UPDATE floor_tables SET status = 'free' WHERE status = 'reserved' AND id IN (${held.map(() => "?").join(",")})`, ...held);
  if (t.session_id) tx.run("UPDATE sessions SET status = 'closed', version = version + 1 WHERE id = ?", t.session_id);
  tx.event({ stream: streams.queue(ctx.branch.id), type: `queue.${reason}`, data: { ticketId, number: t.number } });
  await tx.commit();
}

/** Call a ticket to the host stand, optionally holding the tables we plan to give them. */
export async function callTicket(db: D1Database, ctx: BranchCtx, actor: string, ticketId: string, holdTableIds: string[] = []) {
  const t = await getTicket(db, ticketId);
  if (t.branch_id !== ctx.branch.id) notFound("Ticket");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor }).assert(
    "EXISTS (SELECT 1 FROM tickets WHERE id = ? AND status IN ('waiting','called'))",
    [ticketId],
    409,
    "ticket_closed",
    "This ticket is no longer waiting",
  );
  for (const id of holdTableIds)
    tx.assert("EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND branch_id = ? AND status = 'free' AND active = 1)", [id, ctx.branch.id], 409, "table_taken", "That table is no longer free");
  if (holdTableIds.length) tx.run(`UPDATE floor_tables SET status = 'reserved' WHERE id IN (${holdTableIds.map(() => "?").join(",")})`, ...holdTableIds);
  tx.run("UPDATE tickets SET status = 'called', called_at = ?, held_table_ids = ? WHERE id = ?", Date.now(), holdTableIds.length ? JSON.stringify(holdTableIds) : null, ticketId);
  tx.event({ stream: streams.queue(ctx.branch.id), type: "queue.called", data: { ticketId, number: t.number, tables: holdTableIds } });
  if (ctx.config.preorderFire === "on_call" && t.session_id) fireHeldStatements(tx, t.session_id);
  await tx.commit();
  return getTicket(db, ticketId);
}

/** Put a called (or no-show) ticket back in line, keeping its original place. */
export async function requeueTicket(db: D1Database, ctx: BranchCtx, actor: string, ticketId: string) {
  const t = await getTicket(db, ticketId);
  const held = t.held_table_ids ? (JSON.parse(t.held_table_ids) as string[]) : [];
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM tickets WHERE id = ? AND branch_id = ? AND status IN ('called','no_show'))", [ticketId, ctx.branch.id], 409, "ticket_not_called", "Only called or no-show tickets can be re-queued")
    .run("UPDATE tickets SET status = 'waiting', called_at = NULL, held_table_ids = NULL, ended_at = NULL WHERE id = ?", ticketId);
  if (held.length) tx.run(`UPDATE floor_tables SET status = 'free' WHERE status = 'reserved' AND id IN (${held.map(() => "?").join(",")})`, ...held);
  tx.event({ stream: streams.queue(ctx.branch.id), type: "queue.requeued", data: { ticketId } });
  await tx.commit();
}

/** Fire every held (preordered) item in a session's order to the kitchen. */
export function fireHeldStatements(tx: Tx, sessionId: string) {
  tx.run(
    "UPDATE order_items SET status = 'fired', fired_at = ? WHERE status = 'held' AND order_id IN (SELECT order_id FROM sessions WHERE id = ? AND order_id IS NOT NULL)",
    Date.now(),
    sessionId,
  );
}

/**
 * Seat a queue ticket. Everyone who joined earlier in the same size class and is
 * still waiting gets a skip counted (the fairness bound uses it). A preorder made
 * while queueing moves onto the table's bill and, by policy, fires to the kitchen.
 */
export async function seatTicket(db: D1Database, ctx: BranchCtx, actor: string, ticketId: string, plan: SeatPlan) {
  const t = await getTicket(db, ticketId);
  if (t.branch_id !== ctx.branch.id) notFound("Ticket");
  if (!["waiting", "called"].includes(t.status)) fail(409, "ticket_closed", `Ticket ${t.number} is ${t.status}`);
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  tx.assert("EXISTS (SELECT 1 FROM tickets WHERE id = ? AND status IN ('waiting','called'))", [ticketId], 409, "ticket_closed", "Someone else already seated this ticket");
  const res = await seatStatements(db, tx, ctx, plan, { partySize: t.party_size, ticketId });
  const held = t.held_table_ids ? (JSON.parse(t.held_table_ids) as string[]) : [];
  const unused = held.filter((h) => !res.tableIds.includes(h));
  if (unused.length) tx.run(`UPDATE floor_tables SET status = 'free' WHERE status = 'reserved' AND id IN (${unused.map(() => "?").join(",")})`, ...unused);
  tx.run("UPDATE tickets SET status = 'seated', seated_at = ?, seating_id = ?, held_table_ids = NULL WHERE id = ?", tx.at, res.seatingId, ticketId);
  tx.run(
    "UPDATE tickets SET skips = skips + 1 WHERE branch_id = ? AND status = 'waiting' AND category = ? AND created_at < ? AND id <> ?",
    ctx.branch.id,
    t.category,
    t.created_at,
    ticketId,
  );
  if (t.session_id) {
    // the preorder bill becomes the table's bill
    tx.run("UPDATE orders SET seating_id = ?, session_id = ?, type = 'dine_in' WHERE session_id = ? AND status = 'open'", res.seatingId, res.sessionId, t.session_id);
    tx.run("UPDATE seatings SET order_id = (SELECT id FROM orders WHERE seating_id = ? AND status = 'open' LIMIT 1) WHERE id = ?", res.seatingId, res.seatingId);
    tx.run("UPDATE sessions SET order_id = (SELECT order_id FROM seatings WHERE id = ?) WHERE id = ?", res.seatingId, res.sessionId);
    tx.run("UPDATE cart_lines SET session_id = ? WHERE session_id = ?", res.sessionId, t.session_id);
    tx.run("UPDATE sessions SET status = 'seated', version = version + 1 WHERE id = ?", t.session_id);
    if (ctx.config.preorderFire === "on_seat") fireHeldStatements(tx, res.sessionId);
  }
  tx.event({ stream: streams.queue(ctx.branch.id), type: "queue.seated", data: { ticketId, number: t.number, seatingId: res.seatingId, tables: res.tableLabels } });
  await tx.commit();
  return res;
}

/** Public view of one ticket, including line position, ETA and (once seated) the table cart link. */
export async function ticketView(db: D1Database, ctx: BranchCtx, ticketId: string, fresh = false) {
  const t = await getTicket(db, ticketId);
  const board = fresh || t.status !== "waiting" ? await queueBoard(db, ctx) : await sharedBoard(db, ctx);
  const onBoard = board.tickets.find((x) => x.id === ticketId);
  let seating: ReturnType<typeof toSeating> | null = null;
  let tableLabelsOut: string[] = [];
  if (t.seating_id) {
    seating = toSeating(await getSeating(db, t.seating_id));
    tableLabelsOut = seating.tableIds.map((id) => board.tables.find((x) => x.id === id)?.label ?? id);
  }
  return {
    ...toTicket(t),
    phone: undefined,
    email: undefined,
    position: onBoard?.position ?? 0,
    ahead: onBoard ? Math.max(0, onBoard.position - 1) : 0,
    etaMinutes: onBoard?.etaMinutes ?? null,
    calledTables: tableLabels(board.tables, onBoard?.heldTableIds ?? []),
    seating: seating && seating.status === "open" ? { id: seating.id, sessionId: seating.sessionId, tables: tableLabelsOut } : null,
    branch: { id: ctx.branch.id, name: ctx.branch.name },
  };
}
