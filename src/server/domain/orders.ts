// Shared carts, orders (bills), kitchen tickets and payments.
import { core } from "../../core/server";
import type { CartModifier, OrderType } from "../../shared/types";
import { AppError, fail, notFound } from "../errors";
import { localParts, newId, randomToken } from "../ids";
import { DuplicateCommand, Tx } from "../tx";
import { loyaltyConfig, streams, type BranchCtx } from "./context";
import { getItems, priceModifiers, type ChosenModifier } from "./menu";

// ── rows & mappers ──────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  branch_id: string;
  tenant_id: string;
  kind: "table" | "queue" | "booking" | "takeaway" | "pos";
  ref_id: string | null;
  status: string;
  version: number;
  submit_seq: number;
  order_id: string | null;
  created_at: number;
}

interface LineRow {
  id: string;
  session_id: string;
  participant_id: string;
  participant_name: string;
  item_id: string;
  name: string;
  unit_price: number;
  qty: number;
  modifiers: string;
  notes: string;
  updated_at: number;
}

export interface OrderRow {
  id: string;
  branch_id: string;
  tenant_id: string;
  number: string;
  type: OrderType;
  status: string;
  seating_id: string | null;
  ticket_id: string | null;
  booking_id: string | null;
  session_id: string | null;
  parent_order_id: string | null;
  email: string | null;
  member_id: string | null;
  discount: string | null;
  subtotal: number;
  discount_amount: number;
  service_charge: number;
  tax: number;
  rounding: number;
  total: number;
  paid: number;
  refunded: number;
  covers: number;
  receipt_token: string | null;
  created_at: number;
  closed_at: number | null;
  day: string;
  version: number;
}

export interface ItemRow {
  id: string;
  order_id: string;
  branch_id: string;
  round: number;
  item_id: string;
  name: string;
  category: string;
  unit_price: number;
  qty: number;
  modifiers: string;
  notes: string;
  added_by: string;
  status: string;
  station: string;
  created_at: number;
  fired_at: number | null;
  ready_at: number | null;
  void_reason: string | null;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  branch_id: string;
  method: string;
  amount: number;
  tendered: number | null;
  change: number;
  ref: string | null;
  split_label: string | null;
  status: string;
  refunded: number;
  shift_id: string | null;
  created_at: number;
  day: string;
}

const toLine = (r: LineRow) => ({
  id: r.id,
  participantId: r.participant_id,
  participantName: r.participant_name,
  itemId: r.item_id,
  name: r.name,
  unitPrice: r.unit_price,
  qty: r.qty,
  modifiers: JSON.parse(r.modifiers) as CartModifier[],
  notes: r.notes,
  updatedAt: r.updated_at,
});

export const toOrderItem = (r: ItemRow) => ({
  id: r.id,
  round: r.round,
  itemId: r.item_id,
  name: r.name,
  category: r.category,
  unitPrice: r.unit_price,
  qty: r.qty,
  modifiers: JSON.parse(r.modifiers) as CartModifier[],
  notes: r.notes,
  addedBy: r.added_by,
  status: r.status,
  station: r.station,
  createdAt: r.created_at,
  firedAt: r.fired_at,
  readyAt: r.ready_at,
  voidReason: r.void_reason,
});

export const toPayment = (r: PaymentRow) => ({
  id: r.id,
  method: r.method,
  amount: r.amount,
  tendered: r.tendered,
  change: r.change,
  ref: r.ref,
  splitLabel: r.split_label,
  status: r.status,
  refunded: r.refunded,
  createdAt: r.created_at,
});

// ── sessions & carts ────────────────────────────────────────────────────────

export async function getSession(db: D1Database, id: string) {
  return (await db.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>()) ?? notFound("Cart");
}

/** Open a fresh cart for a queue ticket's preorder, a booking preorder or a takeaway order. */
export async function openSession(db: D1Database, ctx: BranchCtx, kind: "queue" | "booking" | "takeaway" | "pos", refId: string | null) {
  const id = newId("ss_");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id });
  tx.run("INSERT INTO sessions (id, branch_id, tenant_id, kind, ref_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)", id, ctx.branch.id, ctx.tenant.id, kind, refId, tx.at);
  if (kind === "queue" && refId) {
    tx.assert("EXISTS (SELECT 1 FROM tickets WHERE id = ? AND session_id IS NULL AND status IN ('waiting','called'))", [refId], 409, "already_open", "Preorder already started");
    tx.run("UPDATE tickets SET session_id = ? WHERE id = ?", id, refId);
  }
  if (kind === "booking" && refId) {
    tx.assert("EXISTS (SELECT 1 FROM bookings WHERE id = ? AND session_id IS NULL AND status = 'confirmed')", [refId], 409, "already_open", "Preorder already started");
    tx.run("UPDATE bookings SET session_id = ? WHERE id = ?", id, refId);
  }
  tx.event({ stream: streams.session(id), type: "session.opened", data: { kind, refId } });
  await tx.commit();
  return id;
}

export async function cartView(db: D1Database, sessionId: string) {
  const s = await getSession(db, sessionId);
  const [lines, order] = await Promise.all([
    db.prepare("SELECT * FROM cart_lines WHERE session_id = ? ORDER BY updated_at, id").bind(sessionId).all<LineRow>(),
    s.order_id ? orderView(db, s.order_id) : Promise.resolve(null),
  ]);
  const ls = lines.results.map(toLine);
  return {
    session: { id: s.id, kind: s.kind, status: s.status, version: s.version, rounds: s.submit_seq },
    lines: ls,
    participants: [...new Map(ls.map((l) => [l.participantId, l.participantName])).entries()].map(([id, name]) => ({ id, name })),
    cartTotal: ls.reduce((sum, l) => sum + (l.unitPrice + l.modifiers.reduce((m, x) => m + x.price, 0)) * l.qty, 0),
    order,
  };
}

export interface Participant {
  id: string;
  name: string;
}

function assertOpen(tx: Tx, sessionId: string) {
  tx.assert("EXISTS (SELECT 1 FROM sessions WHERE id = ? AND status = 'open')", [sessionId], 409, "cart_closed", "This table's ordering is closed");
}

export async function addLine(
  db: D1Database,
  ctx: BranchCtx,
  sessionId: string,
  who: Participant,
  input: { itemId: string; qty: number; modifiers?: ChosenModifier[]; notes?: string },
) {
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 50) fail(400, "invalid_qty", "Quantity must be 1–50");
  const item = (await getItems(db, ctx.tenant.id, ctx.branch.id, [input.itemId])).get(input.itemId);
  if (!item || !item.active) fail(404, "item_unavailable", "That dish isn't on the menu");
  if (item.soldOut) fail(409, "sold_out", `${item.name} is sold out`);
  const mods = priceModifiers(item, input.modifiers ?? []);
  const id = newId("ln_");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: `diner:${who.id}` });
  assertOpen(tx, sessionId);
  tx.run(
    "INSERT INTO cart_lines (id, session_id, participant_id, participant_name, item_id, name, unit_price, qty, modifiers, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    sessionId,
    who.id,
    who.name.slice(0, 40),
    item.id,
    item.name,
    item.price,
    input.qty,
    JSON.stringify(mods),
    (input.notes ?? "").slice(0, 200),
    tx.at,
  );
  tx.run("UPDATE sessions SET version = version + 1 WHERE id = ?", sessionId);
  tx.event({ stream: streams.session(sessionId), type: "cart.line_added", data: { lineId: id, itemId: item.id, qty: input.qty, by: who.name } });
  await tx.commit();
  return id;
}

/** Change or remove one of *your own* lines. Each diner owns their lines, so edits never collide. */
export async function updateLine(db: D1Database, ctx: BranchCtx, sessionId: string, who: Participant, lineId: string, patch: { qty?: number; notes?: string }, staff = false) {
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: staff ? "staff" : `diner:${who.id}` });
  assertOpen(tx, sessionId);
  tx.assert(
    `EXISTS (SELECT 1 FROM cart_lines WHERE id = ? AND session_id = ? ${staff ? "" : "AND participant_id = ?"})`,
    staff ? [lineId, sessionId] : [lineId, sessionId, who.id],
    403,
    "not_your_line",
    "You can only change dishes you added",
  );
  if (patch.qty === 0) tx.run("DELETE FROM cart_lines WHERE id = ?", lineId);
  else {
    if (patch.qty !== undefined && (!Number.isInteger(patch.qty) || patch.qty < 0 || patch.qty > 50)) fail(400, "invalid_qty", "Quantity must be 0–50");
    tx.run("UPDATE cart_lines SET qty = COALESCE(?, qty), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?", patch.qty ?? null, patch.notes?.slice(0, 200) ?? null, tx.at, lineId);
  }
  tx.run("UPDATE sessions SET version = version + 1 WHERE id = ?", sessionId);
  tx.event({ stream: streams.session(sessionId), type: patch.qty === 0 ? "cart.line_removed" : "cart.line_changed", data: { lineId, ...patch } });
  await tx.commit();
}

const ORDER_TYPE: Record<SessionRow["kind"], OrderType> = {
  table: "dine_in",
  queue: "queue_preorder",
  booking: "booking_preorder",
  takeaway: "takeaway",
  pos: "takeaway",
};

function itemStatusFor(type: OrderType, round: number, ctx: BranchCtx): string {
  if (type === "queue_preorder" || type === "booking_preorder") return "held";
  if (type === "dine_in" && round === 1 && ctx.config.requireStaffConfirmFirstRound) return "pending";
  return "fired";
}

export interface PricedLine {
  itemId: string;
  name: string;
  category: string;
  station: string;
  unitPrice: number;
  qty: number;
  modifiers: CartModifier[];
  notes: string;
  addedBy: string;
}

/** Totals for an order given its live items and discount, via the shared Rust core. */
export function priceOrder(ctx: BranchCtx, type: OrderType, items: { unitPrice: number; qty: number; modifiers: CartModifier[] }[], discount: { kind: "percent" | "amount"; value: number } | null) {
  return core().computeTotals({
    lines: items,
    discount,
    serviceChargePct: type === "takeaway" ? 0 : ctx.config.serviceChargePct,
    taxPct: ctx.config.taxPct,
    taxInclusive: ctx.config.taxInclusive,
    cashRounding: ctx.config.cashRounding,
  });
}

async function liveItems(db: D1Database, orderId: string) {
  return (await db.prepare("SELECT * FROM order_items WHERE order_id = ? AND status <> 'void'").bind(orderId).all<ItemRow>()).results;
}

const totalsStmt = (tx: Tx, orderId: string, version: number, t: ReturnType<typeof priceOrder>) =>
  tx.run(
    "UPDATE orders SET subtotal = ?, discount_amount = ?, service_charge = ?, tax = ?, rounding = ?, total = ?, version = version + 1 WHERE id = ? AND version = ?",
    t.subtotal,
    t.discount,
    t.serviceCharge,
    t.tax,
    t.rounding,
    t.total,
    orderId,
    version,
  );

const assertVersion = (tx: Tx, orderId: string, version: number) =>
  tx.assert("EXISTS (SELECT 1 FROM orders WHERE id = ? AND version = ?)", [orderId, version], 409, "order_changed", "The bill changed at the same moment, retrying");

/** Retry a read-compute-commit command when the bill moved underneath us. */
async function retrying<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i < attempts - 1 && e instanceof AppError && e.code === "order_changed") continue;
      throw e;
    }
  }
}

/**
 * Add a round of items to the session's bill (creating the bill on the first round).
 * Shared by diners' cart submits and staff POS entry.
 */
async function addRound(
  db: D1Database,
  ctx: BranchCtx,
  tx: Tx,
  s: SessionRow,
  lines: PricedLine[],
  round: number,
): Promise<{ orderId: string; number?: string }> {
  const type = ORDER_TYPE[s.kind];
  const status = itemStatusFor(type, round, ctx);
  let orderId = s.order_id;
  let existing: OrderRow | null = null;
  if (orderId) existing = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<OrderRow>();
  if (existing && existing.status !== "open") fail(409, "bill_closed", "This bill is already settled");
  const prior = existing ? (await liveItems(db, existing.id)).map((r) => ({ unitPrice: r.unit_price, qty: r.qty, modifiers: JSON.parse(r.modifiers) })) : [];
  const discount = existing?.discount ? JSON.parse(existing.discount) : null;
  const totals = priceOrder(ctx, existing?.type ?? type, [...prior, ...lines], discount);
  if (!existing) {
    orderId = newId("or_");
    const day = localParts(tx.at, ctx.config.timezone).day;
    const seating = s.kind === "table" && s.ref_id ? await db.prepare("SELECT party_size, ticket_id, booking_id FROM seatings WHERE id = ?").bind(s.ref_id).first<{ party_size: number; ticket_id: string | null; booking_id: string | null }>() : null;
    tx.assert("EXISTS (SELECT 1 FROM sessions WHERE id = ? AND order_id IS NULL)", [s.id], 409, "order_changed", "Bill created concurrently, retrying");
    tx.run(
      `INSERT INTO orders (id, branch_id, tenant_id, number, type, status, seating_id, ticket_id, booking_id, session_id, subtotal, discount_amount, service_charge, tax, rounding, total, covers, created_at, day)
       SELECT ?, ?, ?, printf('%04d', COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1), ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM orders WHERE branch_id = ? AND day = ?`,
      orderId,
      ctx.branch.id,
      ctx.tenant.id,
      type,
      s.kind === "table" ? s.ref_id : null,
      s.kind === "queue" ? s.ref_id : seating?.ticket_id ?? null,
      s.kind === "booking" ? s.ref_id : seating?.booking_id ?? null,
      s.id,
      totals.subtotal,
      totals.discount,
      totals.serviceCharge,
      totals.tax,
      totals.rounding,
      totals.total,
      seating?.party_size ?? 0,
      tx.at,
      day,
      ctx.branch.id,
      day,
    );
    tx.run("UPDATE sessions SET order_id = ? WHERE id = ?", orderId, s.id);
    if (s.kind === "table" && s.ref_id) tx.run("UPDATE seatings SET order_id = ? WHERE id = ?", orderId, s.ref_id);
  } else {
    assertVersion(tx, existing.id, existing.version);
    totalsStmt(tx, existing.id, existing.version, totals);
  }
  for (const l of lines) {
    tx.run(
      `INSERT INTO order_items (id, order_id, branch_id, round, item_id, name, category, unit_price, qty, modifiers, notes, added_by, status, station, created_at, fired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("oi_"),
      orderId,
      ctx.branch.id,
      round,
      l.itemId,
      l.name,
      l.category,
      l.unitPrice,
      l.qty,
      JSON.stringify(l.modifiers),
      l.notes,
      l.addedBy,
      status,
      l.station,
      tx.at,
      status === "fired" ? tx.at : null,
    );
  }
  tx.event({ stream: streams.order(orderId!), type: "order.round_added", data: { round, items: lines.length, status } });
  return { orderId: orderId! };
}

/**
 * Send the shared cart to the kitchen. Optimistic concurrency: the submit carries
 * the cart version the sender last saw; if anyone changed the cart since, it's
 * rejected with the fresh cart so nobody sends an order they haven't seen.
 * Two people pressing Send at the same instant: one wins, the other gets
 * "already sent". A retried request (same msgId) is answered idempotently.
 */
export async function submitCart(db: D1Database, ctx: BranchCtx, sessionId: string, who: Participant, expectedVersion: number, msgId: string) {
  return retrying(async () => {
    const s = await getSession(db, sessionId);
    if (s.status !== "open") fail(409, "cart_closed", "This table's ordering is closed");
    if (s.version !== expectedVersion) {
      const prev = await db.prepare("SELECT data FROM events WHERE msg_id = ?").bind(`submit:${msgId}`).first<{ data: string }>();
      if (prev) return { ...JSON.parse(prev.data), duplicate: true };
      throw new AppError(409, "version_conflict", "The cart changed while you were looking. Please review and send again.", await cartView(db, sessionId));
    }
    const rows = (await db.prepare("SELECT * FROM cart_lines WHERE session_id = ?").bind(sessionId).all<LineRow>()).results;
    if (!rows.length) fail(400, "empty_cart", "The cart is empty");
    const menu = await getItems(db, ctx.tenant.id, ctx.branch.id, rows.map((r) => r.item_id));
    const lines: PricedLine[] = rows.map((r) => {
      const m = menu.get(r.item_id);
      if (!m || !m.active) fail(409, "item_unavailable", `${r.name} is no longer available`);
      if (m.soldOut) fail(409, "sold_out", `${r.name} just sold out — please remove it`);
      // authoritative price at submit time (menu may have changed since the line was added)
      const mods = priceModifiers(m, JSON.parse(r.modifiers));
      return { itemId: m.id, name: m.name, category: m.category, station: m.station, unitPrice: m.price, qty: r.qty, modifiers: mods, notes: r.notes, addedBy: r.participant_name };
    });
    const round = s.submit_seq + 1;
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: `diner:${who.id}` });
    tx.assert("EXISTS (SELECT 1 FROM sessions WHERE id = ? AND status = 'open' AND version = ?)", [sessionId, expectedVersion], 409, "version_conflict", "The cart changed while you were looking. Please review and send again.");
    const { orderId } = await addRound(db, ctx, tx, s, lines, round);
    tx.run(`DELETE FROM cart_lines WHERE id IN (${rows.map(() => "?").join(",")})`, ...rows.map((r) => r.id));
    tx.run("UPDATE sessions SET version = version + 1, submit_seq = submit_seq + 1 WHERE id = ?", sessionId);
    const result = { orderId, round, items: lines.length, by: who.name };
    tx.event({ stream: streams.session(sessionId), version: round, type: "cart.submitted", data: result, msgId: `submit:${msgId}` });
    try {
      await tx.commit();
    } catch (e) {
      if (e instanceof DuplicateCommand) return { ...result, duplicate: true };
      if (e instanceof AppError && e.code === "version_conflict") {
        const view = await cartView(db, sessionId);
        if (!view.lines.length && view.session.rounds >= round) throw new AppError(409, "already_sent", "Someone at your table just sent this order", view);
        throw new AppError(409, "version_conflict", e.message, view);
      }
      throw e;
    }
    return result;
  });
}

/** Staff POS: add items straight to a seating's bill or a new takeaway bill. */
export async function posAddItems(
  db: D1Database,
  ctx: BranchCtx,
  actor: string,
  target: { seatingId?: string; orderId?: string; takeaway?: boolean },
  items: { itemId: string; qty: number; modifiers?: ChosenModifier[]; notes?: string }[],
) {
  if (!items.length) fail(400, "empty", "No items");
  return retrying(async () => {
    let s: SessionRow;
    if (target.seatingId) {
      const st = await db.prepare("SELECT session_id, status FROM seatings WHERE id = ? AND branch_id = ?").bind(target.seatingId, ctx.branch.id).first<{ session_id: string; status: string }>();
      if (!st || st.status !== "open") fail(409, "seating_closed", "That table isn't seated");
      s = await getSession(db, st.session_id);
    } else if (target.orderId) {
      const o = await getOrderRow(db, target.orderId);
      if (!o.session_id) fail(400, "no_session", "Order has no session");
      s = await getSession(db, o.session_id);
    } else {
      s = await getSession(db, await openSession(db, ctx, "pos", null));
    }
    const menu = await getItems(db, ctx.tenant.id, ctx.branch.id, items.map((i) => i.itemId));
    const lines: PricedLine[] = items.map((i) => {
      const m = menu.get(i.itemId);
      if (!m || !m.active) fail(404, "item_unavailable", "Unknown item");
      if (m.soldOut) fail(409, "sold_out", `${m.name} is sold out`);
      if (!Number.isInteger(i.qty) || i.qty < 1) fail(400, "invalid_qty", "Invalid quantity");
      return { itemId: m.id, name: m.name, category: m.category, station: m.station, unitPrice: m.price, qty: i.qty, modifiers: priceModifiers(m, i.modifiers ?? []), notes: i.notes ?? "", addedBy: "staff" };
    });
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
    tx.assert("EXISTS (SELECT 1 FROM sessions WHERE id = ? AND submit_seq = ?)", [s.id, s.submit_seq], 409, "order_changed", "retry");
    const round = s.submit_seq + 1;
    const { orderId } = await addRound(db, ctx, tx, s, lines, round);
    tx.run("UPDATE sessions SET submit_seq = submit_seq + 1, version = version + 1 WHERE id = ?", s.id);
    await tx.commit();
    return { orderId, round };
  });
}

// ── orders ──────────────────────────────────────────────────────────────────

export async function getOrderRow(db: D1Database, id: string) {
  return (await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>()) ?? notFound("Order");
}

export async function orderView(db: D1Database, id: string) {
  const [o, items, pays] = await db.batch([
    db.prepare("SELECT * FROM orders WHERE id = ?").bind(id),
    db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY round, created_at").bind(id),
    db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at").bind(id),
  ]);
  const r = o.results[0] as unknown as OrderRow | undefined;
  if (!r) notFound("Order");
  return {
    id: r!.id,
    number: r!.number,
    type: r!.type,
    status: r!.status,
    seatingId: r!.seating_id,
    ticketId: r!.ticket_id,
    bookingId: r!.booking_id,
    sessionId: r!.session_id,
    parentOrderId: r!.parent_order_id,
    email: r!.email,
    memberId: r!.member_id,
    discountSpec: r!.discount ? JSON.parse(r!.discount) : null,
    subtotal: r!.subtotal,
    discount: r!.discount_amount,
    serviceCharge: r!.service_charge,
    tax: r!.tax,
    rounding: r!.rounding,
    total: r!.total,
    paid: r!.paid,
    refunded: r!.refunded,
    due: Math.max(0, r!.total - r!.paid),
    covers: r!.covers,
    receiptToken: r!.receipt_token,
    createdAt: r!.created_at,
    closedAt: r!.closed_at,
    version: r!.version,
    items: (items.results as unknown as ItemRow[]).map(toOrderItem),
    payments: (pays.results as unknown as PaymentRow[]).map(toPayment),
  };
}

export async function listOrders(db: D1Database, branchId: string, filter: { status?: string; day?: string; limit?: number }) {
  const where = ["branch_id = ?"];
  const params: unknown[] = [branchId];
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.day) {
    where.push("day = ?");
    params.push(filter.day);
  }
  const rows = (
    await db
      .prepare(`SELECT o.*, (SELECT table_ids FROM seatings WHERE id = o.seating_id) AS table_ids FROM orders o WHERE ${where.join(" AND ")} AND status <> 'merged' ORDER BY created_at DESC LIMIT ?`)
      .bind(...params, Math.min(filter.limit ?? 100, 500))
      .all<OrderRow & { table_ids: string | null }>()
  ).results;
  return rows;
}

/** Recompute an order's totals after an item or discount change (in the same batch). */
async function repriceStatements(db: D1Database, ctx: BranchCtx, tx: Tx, o: OrderRow, opts: { voidIds?: string[]; discount?: OrderRow["discount"] | undefined; excludeIds?: string[] }) {
  const items = (await liveItems(db, o.id)).filter((i) => !(opts.voidIds ?? []).includes(i.id) && !(opts.excludeIds ?? []).includes(i.id));
  const discountJson = opts.discount === undefined ? o.discount : opts.discount;
  const t = priceOrder(ctx, o.type, items.map((i) => ({ unitPrice: i.unit_price, qty: i.qty, modifiers: JSON.parse(i.modifiers) })), discountJson ? JSON.parse(discountJson) : null);
  assertVersion(tx, o.id, o.version);
  totalsStmt(tx, o.id, o.version, t);
  if (opts.discount !== undefined) tx.run("UPDATE orders SET discount = ? WHERE id = ?", opts.discount, o.id);
  tx.assert("EXISTS (SELECT 1 FROM orders WHERE id = ? AND paid <= total)", [o.id], 409, "below_paid", "That would make the bill smaller than what's already been paid. Refund first.");
  return t;
}

export async function voidItems(db: D1Database, ctx: BranchCtx, actor: string, orderId: string, itemIds: string[], reason: string) {
  if (!reason.trim()) fail(400, "reason_required", "A void needs a reason");
  return retrying(async () => {
    const o = await getOrderRow(db, orderId);
    if (o.status !== "open") fail(409, "bill_closed", "This bill is already settled");
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
    for (const id of itemIds) tx.assert("EXISTS (SELECT 1 FROM order_items WHERE id = ? AND order_id = ? AND status <> 'void')", [id, orderId], 409, "already_void", "Item already voided");
    tx.run(`UPDATE order_items SET status = 'void', void_reason = ? WHERE id IN (${itemIds.map(() => "?").join(",")})`, reason.slice(0, 120), ...itemIds);
    const t = await repriceStatements(db, ctx, tx, o, { voidIds: itemIds });
    tx.event({ stream: streams.order(orderId), type: "order.items_voided", data: { itemIds, reason } });
    await tx.commit();
    return t;
  });
}

export async function applyDiscount(db: D1Database, ctx: BranchCtx, actor: string, orderId: string, spec: { kind: "percent" | "amount"; value: number; reason: string; code?: string } | null) {
  if (spec && (spec.value < 0 || (spec.kind === "percent" && spec.value > 100))) fail(400, "invalid_discount", "Invalid discount");
  return retrying(async () => {
    const o = await getOrderRow(db, orderId);
    if (o.status !== "open") fail(409, "bill_closed", "This bill is already settled");
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
    const t = await repriceStatements(db, ctx, tx, o, { discount: spec ? JSON.stringify(spec) : null });
    tx.event({ stream: streams.order(orderId), type: "order.discounted", data: { spec } });
    await tx.commit();
    return t;
  });
}

/** Apply a promo code: validity window, minimum spend and a global usage cap enforced atomically. */
export async function applyPromo(db: D1Database, ctx: BranchCtx, actor: string, orderId: string, code: string) {
  const c = code.trim().toUpperCase();
  const promo = await db.prepare("SELECT * FROM promo_codes WHERE tenant_id = ? AND code = ? AND active = 1").bind(ctx.tenant.id, c).first<{
    kind: "percent" | "amount";
    value: number;
    min_spend: number;
    max_uses: number | null;
    valid_from: number | null;
    valid_to: number | null;
    description: string;
  }>();
  if (!promo) fail(404, "invalid_code", "That promo code isn't valid");
  const now = Date.now();
  if ((promo.valid_from && now < promo.valid_from) || (promo.valid_to && now > promo.valid_to)) fail(409, "code_expired", "That promo code has expired");
  return retrying(async () => {
    const o = await getOrderRow(db, orderId);
    if (o.status !== "open") fail(409, "bill_closed", "This bill is already settled");
    if (o.subtotal < promo.min_spend) fail(409, "min_spend", `Minimum spend for ${c} not reached`);
    const spec = { kind: promo.kind, value: promo.value, reason: promo.description || `Promo ${c}`, code: c };
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
    tx.assert("NOT EXISTS (SELECT 1 FROM promo_redemptions WHERE order_id = ?)", [orderId], 409, "promo_already_applied", "A promo code is already applied to this bill");
    tx.assert("EXISTS (SELECT 1 FROM promo_codes WHERE tenant_id = ? AND code = ? AND (max_uses IS NULL OR used < max_uses))", [ctx.tenant.id, c], 409, "code_used_up", "That promo code has been fully redeemed");
    tx.run("UPDATE promo_codes SET used = used + 1 WHERE tenant_id = ? AND code = ?", ctx.tenant.id, c);
    tx.run("INSERT INTO promo_redemptions (tenant_id, code, order_id, created_at) VALUES (?, ?, ?, ?)", ctx.tenant.id, c, orderId, tx.at);
    const t = await repriceStatements(db, ctx, tx, o, { discount: JSON.stringify(spec) });
    tx.event({ stream: streams.order(orderId), type: "order.promo_applied", data: { code: c } });
    await tx.commit();
    return t;
  });
}

/** Split selected items off into their own bill (same table): "I'll pay for mine". */
export async function splitOrder(db: D1Database, ctx: BranchCtx, actor: string, orderId: string, itemIds: string[]) {
  if (!itemIds.length) fail(400, "no_items", "Pick the items to move");
  return retrying(async () => {
    const o = await getOrderRow(db, orderId);
    if (o.status !== "open" || o.paid > 0) fail(409, "bill_locked", "Split before taking any payment");
    const all = await liveItems(db, orderId);
    const moving = all.filter((i) => itemIds.includes(i.id));
    if (moving.length !== itemIds.length) fail(409, "items_changed", "Some items are no longer on this bill");
    if (moving.length === all.length) fail(400, "nothing_left", "Leave at least one item on the original bill");
    const childId = newId("or_");
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
    await repriceStatements(db, ctx, tx, o, { excludeIds: itemIds });
    const ct = priceOrder(ctx, o.type, moving.map((i) => ({ unitPrice: i.unit_price, qty: i.qty, modifiers: JSON.parse(i.modifiers) })), null);
    tx.run(
      `INSERT INTO orders (id, branch_id, tenant_id, number, type, status, seating_id, ticket_id, booking_id, session_id, parent_order_id, subtotal, discount_amount, service_charge, tax, rounding, total, created_at, day)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      childId,
      ctx.branch.id,
      ctx.tenant.id,
      `${o.number}-${String.fromCharCode(65 + (await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE parent_order_id = ?").bind(orderId).first<{ n: number }>())!.n)}`,
      o.type,
      o.seating_id,
      o.ticket_id,
      o.booking_id,
      orderId,
      ct.subtotal,
      ct.discount,
      ct.serviceCharge,
      ct.tax,
      ct.rounding,
      ct.total,
      tx.at,
      o.day,
    );
    tx.run(`UPDATE order_items SET order_id = ? WHERE id IN (${itemIds.map(() => "?").join(",")})`, childId, ...itemIds);
    tx.event({ stream: streams.order(orderId), type: "order.split", data: { childId, itemIds } });
    await tx.commit();
    return { orderId: childId };
  });
}

/** Equal split plan for the remaining balance ("split 3 ways"). */
export async function equalSplitPlan(db: D1Database, orderId: string, ways: number) {
  const o = await getOrderRow(db, orderId);
  return { due: o.total - o.paid, parts: core().splitEqually(o.total - o.paid, ways) };
}

export async function setOrderContact(db: D1Database, ctx: BranchCtx, actor: string, orderId: string, email: string, memberId: string | null) {
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM orders WHERE id = ? AND branch_id = ?)", [orderId, ctx.branch.id], 404, "not_found", "Order not found")
    .run("UPDATE orders SET email = ?, member_id = COALESCE(?, member_id) WHERE id = ?", email.toLowerCase(), memberId, orderId)
    .event({ stream: streams.order(orderId), type: "order.contact_set", data: { memberId } })
    .commit();
}

// ── kitchen ─────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<string, string[]> = {
  held: ["fired", "void"],
  pending: ["fired", "void"],
  fired: ["preparing", "ready", "served"],
  preparing: ["ready", "served"],
  ready: ["served", "preparing"],
  served: [],
  void: [],
};

export async function setItemStatus(db: D1Database, ctx: BranchCtx, actor: string, itemIds: string[], status: "fired" | "preparing" | "ready" | "served") {
  const rows = (
    await db
      .prepare(`SELECT id, status, order_id FROM order_items WHERE branch_id = ? AND id IN (${itemIds.map(() => "?").join(",")})`)
      .bind(ctx.branch.id, ...itemIds)
      .all<{ id: string; status: string; order_id: string }>()
  ).results;
  if (rows.length !== itemIds.length) notFound("Item");
  for (const r of rows) if (!TRANSITIONS[r.status]?.includes(status)) fail(409, "invalid_transition", `Can't move an item from ${r.status} to ${status}`);
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  for (const r of rows) tx.assert("EXISTS (SELECT 1 FROM order_items WHERE id = ? AND status = ?)", [r.id, r.status], 409, "item_changed", "Someone else updated this item");
  tx.run(
    `UPDATE order_items SET status = ?, fired_at = CASE WHEN ? = 'fired' THEN ? ELSE fired_at END, ready_at = CASE WHEN ? = 'ready' THEN ? ELSE ready_at END WHERE id IN (${itemIds.map(() => "?").join(",")})`,
    status,
    status,
    tx.at,
    status,
    tx.at,
    ...itemIds,
  );
  for (const oid of new Set(rows.map((r) => r.order_id))) tx.event({ stream: streams.order(oid), type: `kitchen.${status}`, data: { itemIds: rows.filter((r) => r.order_id === oid).map((r) => r.id) } });
  await tx.commit();
}

export async function kitchenBoard(db: D1Database, branchId: string, station?: string | null) {
  const rows = (
    await db
      .prepare(
        `SELECT i.*, o.number, o.type, s.table_ids FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN seatings s ON s.id = o.seating_id
         WHERE i.branch_id = ? AND i.status IN ('pending','fired','preparing','ready') ${station ? "AND i.station = ?" : ""}
         ORDER BY COALESCE(i.fired_at, i.created_at)`,
      )
      .bind(...(station ? [branchId, station] : [branchId]))
      .all<ItemRow & { number: string; type: string; table_ids: string | null }>()
  ).results;
  const tables = new Map(
    (await db.prepare("SELECT id, label FROM floor_tables WHERE branch_id = ?").bind(branchId).all<{ id: string; label: string }>()).results.map((t) => [t.id, t.label]),
  );
  const tickets = new Map<string, { orderId: string; number: string; type: string; tables: string[]; round: number; firedAt: number | null; items: ReturnType<typeof toOrderItem>[] }>();
  for (const r of rows) {
    const key = `${r.order_id}:${r.round}`;
    if (!tickets.has(key))
      tickets.set(key, {
        orderId: r.order_id,
        number: r.number,
        type: r.type,
        tables: r.table_ids ? (JSON.parse(r.table_ids) as string[]).map((id) => tables.get(id) ?? id) : [],
        round: r.round,
        firedAt: r.fired_at,
        items: [],
      });
    tickets.get(key)!.items.push(toOrderItem(r));
  }
  return [...tickets.values()];
}

// ── payments ────────────────────────────────────────────────────────────────

export interface PaymentInput {
  orderId: string;
  method: "cash" | "card" | "ewallet" | "points" | "voucher";
  amount: number;
  tendered?: number | null;
  ref?: string | null;
  splitLabel?: string | null;
  msgId: string;
  shiftId?: string | null;
  points?: number;
}

/**
 * Take a payment. Guards (all in one batch): the bill is open, the payment can't
 * exceed the balance, and for loyalty points the member's balance can't go below
 * zero (CHECK constraint). Paying in full settles the bill and emits `order.paid`,
 * which drives the e-receipt, loyalty accrual and reporting asynchronously.
 */
export async function addPayment(db: D1Database, ctx: BranchCtx, actor: string, p: PaymentInput) {
  return retrying(async () => {
    const dup = await db.prepare("SELECT data FROM events WHERE msg_id = ?").bind(`pay:${p.msgId}`).first<{ data: string }>();
    if (dup) return { ...JSON.parse(dup.data), duplicate: true };
    const o = await getOrderRow(db, p.orderId);
    if (o.branch_id !== ctx.branch.id) notFound("Order");
    if (o.status !== "open") fail(409, "bill_closed", "This bill is already settled");
    const due = o.total - o.paid;
    let amount = Math.round(p.amount);
    let points = 0;
    const loyalty = loyaltyConfig(ctx.tenant);
    if (p.method === "points") {
      if (!o.member_id) fail(400, "no_member", "Attach a member to pay with points");
      points = Math.ceil(Math.min(amount, due) / loyalty.redeemValue);
      if (points < loyalty.minRedeem) fail(400, "below_min_redeem", `Redeem at least ${loyalty.minRedeem} points`);
      amount = points * loyalty.redeemValue;
    }
    if (amount <= 0) fail(400, "invalid_amount", "Amount must be positive");
    if (amount > due) fail(409, "overpay", `Only ${due} is due`);
    const change = p.method === "cash" && p.tendered ? Math.max(0, p.tendered - amount) : 0;
    if (p.method === "cash" && p.tendered != null && p.tendered < amount) fail(400, "insufficient_cash", "Cash tendered is less than the amount");
    const paymentId = newId("pay_");
    const now = Date.now();
    const settles = o.paid + amount >= o.total;
    const receiptToken = settles ? randomToken(16) : null;
    const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
    tx.assert("EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'open' AND paid + ? <= total AND version = ?)", [o.id, amount, o.version], 409, "order_changed", "The bill changed, retrying");
    tx.run(
      "INSERT INTO payments (id, order_id, branch_id, method, amount, tendered, change, ref, split_label, status, shift_id, created_at, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'captured', ?, ?, ?)",
      paymentId,
      o.id,
      ctx.branch.id,
      p.method,
      amount,
      p.tendered ?? null,
      change,
      p.ref ?? null,
      p.splitLabel ?? null,
      p.shiftId ?? null,
      now,
      localParts(now, ctx.config.timezone).day,
    );
    if (points) {
      tx.run("UPDATE members SET points = points - ?, version = version + 1 WHERE id = ?", points, o.member_id);
      tx.run("INSERT INTO points_ledger (id, member_id, tenant_id, delta, kind, ref, created_at) VALUES (?, ?, ?, ?, 'redeem', ?, ?)", newId("pl_"), o.member_id, ctx.tenant.id, -points, paymentId, now);
      tx.event({ stream: streams.member(o.member_id!), type: "points.redeemed", data: { points, paymentId, orderId: o.id } });
    }
    tx.run(
      `UPDATE orders SET paid = paid + ?, version = version + 1 ${settles ? ", status = 'paid', closed_at = ?, receipt_token = ?" : ""} WHERE id = ?`,
      ...(settles ? [amount, now, receiptToken, o.id] : [amount, o.id]),
    );
    const result = { paymentId, amount, change, points, settled: settles, receiptToken, orderId: o.id };
    tx.event({ stream: streams.order(o.id), type: "payment.captured", data: result, msgId: `pay:${p.msgId}` });
    if (settles) tx.event({ stream: streams.order(o.id), type: "order.paid", data: { orderId: o.id, total: o.total, seatingId: o.seating_id } });
    try {
      await tx.commit();
    } catch (e) {
      if (e instanceof DuplicateCommand) {
        const prev = await db.prepare("SELECT data FROM events WHERE msg_id = ?").bind(`pay:${p.msgId}`).first<{ data: string }>();
        return { ...JSON.parse(prev!.data), duplicate: true };
      }
      throw e;
    }
    return result;
  });
}

export async function refundPayment(db: D1Database, ctx: BranchCtx, actor: string, paymentId: string, amount: number, reason: string, msgId: string) {
  if (!reason.trim()) fail(400, "reason_required", "A refund needs a reason");
  const dup = await db.prepare("SELECT data FROM events WHERE msg_id = ?").bind(`refund:${msgId}`).first<{ data: string }>();
  if (dup) return { ...JSON.parse(dup.data), duplicate: true };
  const pay = await db.prepare("SELECT * FROM payments WHERE id = ? AND branch_id = ?").bind(paymentId, ctx.branch.id).first<PaymentRow>();
  if (!pay) notFound("Payment");
  amount = Math.round(amount);
  if (amount <= 0 || amount > pay.amount - pay.refunded) fail(400, "invalid_amount", `At most ${pay.amount - pay.refunded} can be refunded`);
  const o = await getOrderRow(db, pay.order_id);
  const loyalty = loyaltyConfig(ctx.tenant);
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  tx.assert("EXISTS (SELECT 1 FROM payments WHERE id = ? AND refunded + ? <= amount)", [paymentId, amount], 409, "over_refund", "Already refunded");
  tx.run("UPDATE payments SET refunded = refunded + ?, status = CASE WHEN refunded + ? >= amount THEN 'refunded' ELSE 'partially_refunded' END WHERE id = ?", amount, amount, paymentId);
  tx.run(
    "UPDATE orders SET refunded = refunded + ?, status = CASE WHEN status = 'open' THEN 'open' WHEN refunded + ? >= paid THEN 'refunded' ELSE 'partially_refunded' END, version = version + 1 WHERE id = ?",
    amount,
    amount,
    o.id,
  );
  if (pay.method === "points" && o.member_id) {
    const pts = Math.round(amount / loyalty.redeemValue);
    tx.run("UPDATE members SET points = points + ? WHERE id = ?", pts, o.member_id);
    tx.run("INSERT INTO points_ledger (id, member_id, tenant_id, delta, kind, ref, created_at) VALUES (?, ?, ?, ?, 'refund', ?, ?)", newId("pl_"), o.member_id, ctx.tenant.id, pts, `${paymentId}:${msgId}`, tx.at);
  }
  const result = { paymentId, amount, reason, orderId: o.id };
  tx.event({ stream: streams.order(o.id), type: "payment.refunded", data: result, msgId: `refund:${msgId}` });
  await tx.commit();
  return result;
}

// ── shifts / cash drawer ───────────────────────────────────────────────────

export async function openShift(db: D1Database, ctx: BranchCtx, user: { id: string; name: string }, openingFloat: number) {
  const id = newId("sh_");
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: user.id })
    .assert("NOT EXISTS (SELECT 1 FROM shifts WHERE branch_id = ? AND user_id = ? AND closed_at IS NULL)", [ctx.branch.id, user.id], 409, "shift_open", "You already have an open shift")
    .run("INSERT INTO shifts (id, branch_id, user_id, user_name, opened_at, opening_float) VALUES (?, ?, ?, ?, ?, ?)", id, ctx.branch.id, user.id, user.name, Date.now(), Math.round(openingFloat))
    .event({ stream: streams.shift(id), type: "shift.opened", data: { openingFloat } })
    .commit();
  return id;
}

export async function currentShift(db: D1Database, branchId: string, userId: string) {
  return db.prepare("SELECT * FROM shifts WHERE branch_id = ? AND user_id = ? AND closed_at IS NULL").bind(branchId, userId).first<{ id: string; opened_at: number; opening_float: number }>();
}

export async function closeShift(db: D1Database, ctx: BranchCtx, userId: string, shiftId: string, counted: number) {
  const sh = await db.prepare("SELECT * FROM shifts WHERE id = ? AND branch_id = ?").bind(shiftId, ctx.branch.id).first<{ opening_float: number; closed_at: number | null }>();
  if (!sh) notFound("Shift");
  if (sh.closed_at) fail(409, "shift_closed", "Shift already closed");
  const cash = await db
    .prepare("SELECT COALESCE(SUM(amount - refunded), 0) AS c FROM payments WHERE shift_id = ? AND method = 'cash'")
    .bind(shiftId)
    .first<{ c: number }>();
  const expected = sh.opening_float + (cash?.c ?? 0);
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: userId })
    .assert("EXISTS (SELECT 1 FROM shifts WHERE id = ? AND closed_at IS NULL)", [shiftId], 409, "shift_closed", "Shift already closed")
    .run("UPDATE shifts SET closed_at = ?, closing_count = ?, expected_cash = ? WHERE id = ?", Date.now(), Math.round(counted), expected, shiftId)
    .event({ stream: streams.shift(shiftId), type: "shift.closed", data: { expected, counted, variance: Math.round(counted) - expected } })
    .commit();
  return { expected, counted: Math.round(counted), variance: Math.round(counted) - expected };
}
