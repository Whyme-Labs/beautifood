// Side-effect pipeline over the event log (transactional outbox).
//
// Commands write their event in the same batch as the state change. This
// consumer then performs the slow, external work: e-receipts, loyalty accrual,
// notifications. It runs right after a command (waitUntil) and on a cron as a
// safety net. Every handler is idempotent, so at-least-once delivery yields
// exactly-once effects.
import { formatMoney } from "../shared/format";
import { getBranch, type BranchCtx } from "./domain/context";
import { earnForOrder } from "./domain/loyalty";
import { receiptHtml, receiptText, sendEmail, type MailEnv, type ReceiptSnapshot } from "./domain/messaging";
import { orderView } from "./domain/orders";
import { sendPushToTopic, type PushEnv } from "./push";

export interface PipelineEnv extends MailEnv, PushEnv {
  PUBLIC_URL: string;
}

interface EventRow {
  id: number;
  tenant_id: string;
  branch_id: string | null;
  stream: string;
  type: string;
  data: string;
  at: number;
}

const CONSUMER = "side-effects";
const TYPES = ["order.paid", "queue.called", "queue.joined", "booking.created", "queue.seated"];

// Coalesce runs per isolate: during a surge every command kicks the pipeline, but
// only one run executes at a time; kicks that arrive meanwhile schedule one re-run.
let running: Promise<{ processed: number; errors: number }> | null = null;
let rerun = false;

export function processPending(db: D1Database, env: PipelineEnv, limit = 100): Promise<{ processed: number; errors: number }> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    let total = { processed: 0, errors: 0 };
    do {
      rerun = false;
      const r = await runOnce(db, env, limit);
      total = { processed: total.processed + r.processed, errors: total.errors + r.errors };
    } while (rerun);
    return total;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runOnce(db: D1Database, env: PipelineEnv, limit: number): Promise<{ processed: number; errors: number }> {
  await db.prepare("INSERT OR IGNORE INTO consumer_cursors (name, last_id, updated_at) VALUES (?, 0, ?)").bind(CONSUMER, Date.now()).run();
  const cur = (await db.prepare("SELECT last_id FROM consumer_cursors WHERE name = ?").bind(CONSUMER).first<{ last_id: number }>())!.last_id;
  const rows = (
    await db
      .prepare(`SELECT * FROM events WHERE id > ? AND type IN (${TYPES.map(() => "?").join(",")}) ORDER BY id LIMIT ?`)
      .bind(cur, ...TYPES, limit)
      .all<EventRow>()
  ).results;
  let errors = 0;
  let last = cur;
  for (const e of rows) {
    try {
      await handle(db, env, e);
      last = e.id;
    } catch (err) {
      errors++;
      console.error("pipeline", e.type, e.id, err);
      break; // keep order; retry from here next run
    }
  }
  if (last > cur) await db.prepare("UPDATE consumer_cursors SET last_id = MAX(last_id, ?), updated_at = ? WHERE name = ?").bind(last, Date.now(), CONSUMER).run();
  return { processed: rows.length, errors };
}

async function handle(db: D1Database, env: PipelineEnv, e: EventRow) {
  const data = JSON.parse(e.data) as Record<string, string>;
  if (!e.branch_id) return;
  const ctx = await getBranch(db, e.branch_id);
  switch (e.type) {
    case "order.paid":
      return onOrderPaid(db, env, ctx, data.orderId);
    case "queue.called":
      return onTicketCalled(db, env, ctx, data.ticketId);
    case "queue.joined":
      return onTicketJoined(db, env, ctx, data.ticketId);
    case "booking.created":
      return onBookingCreated(db, env, ctx, e.stream.split(":")[1]);
    case "queue.seated":
      return sendPushToTopic(db, env, `ticket:${data.ticketId}`);
  }
}

async function onOrderPaid(db: D1Database, env: PipelineEnv, ctx: BranchCtx, orderId: string) {
  const o = await orderView(db, orderId);
  // loyalty first so the receipt can show the new balance
  let points: ReceiptSnapshot["points"] = null;
  let email = o.email;
  if (o.memberId) {
    const spend = o.total - o.payments.filter((p) => p.method === "points").reduce((s, p) => s + p.amount, 0);
    const r = await earnForOrder(db, ctx.tenant, o.memberId, o.id, Math.max(0, spend), ctx.branch.id);
    const m = await db.prepare("SELECT email, points, tier FROM members WHERE id = ?").bind(o.memberId).first<{ email: string; points: number; tier: string }>();
    if (m) {
      email ??= m.email;
      const earned = r.points || (await db.prepare("SELECT delta FROM points_ledger WHERE member_id = ? AND kind = 'earn' AND ref = ?").bind(o.memberId, o.id).first<{ delta: number }>())?.delta || 0;
      points = { earned, balance: m.points, tier: m.tier };
    }
  }
  const seating = o.seatingId ? await db.prepare("SELECT table_ids FROM seatings WHERE id = ?").bind(o.seatingId).first<{ table_ids: string }>() : null;
  const tableIds = seating ? (JSON.parse(seating.table_ids) as string[]) : [];
  const labels = tableIds.length
    ? (await db.prepare(`SELECT label FROM floor_tables WHERE id IN (${tableIds.map(() => "?").join(",")})`).bind(...tableIds).all<{ label: string }>()).results.map((r) => r.label)
    : [];
  const token = o.receiptToken!;
  const snap: ReceiptSnapshot = {
    restaurant: ctx.tenant.name,
    branch: ctx.branch.name,
    address: ctx.branch.address,
    orderNumber: o.number,
    type: o.type,
    tables: labels,
    closedAt: o.closedAt ?? Date.now(),
    currency: ctx.config.currency,
    timezone: ctx.config.timezone,
    items: o.items
      .filter((i) => i.status !== "void")
      .map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, modifiers: i.modifiers, lineTotal: (i.unitPrice + i.modifiers.reduce((s, m) => s + m.price, 0)) * i.qty })),
    subtotal: o.subtotal,
    discount: o.discount,
    discountLabel: o.discountSpec?.reason ?? null,
    serviceCharge: o.serviceCharge,
    serviceChargePct: ctx.config.serviceChargePct,
    tax: o.tax,
    taxPct: ctx.config.taxPct,
    rounding: o.rounding,
    total: o.total,
    payments: o.payments.map((p) => ({ method: p.method, amount: p.amount, change: p.change, splitLabel: p.splitLabel })),
    points,
    url: `${env.PUBLIC_URL.replace(/\/$/, "")}/receipt/${token}`,
  };
  await db
    .prepare("INSERT INTO receipts (token, order_id, tenant_id, branch_id, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET snapshot = excluded.snapshot")
    .bind(token, o.id, ctx.tenant.id, ctx.branch.id, JSON.stringify(snap), Date.now())
    .run();
  if (email && ctx.config.modules.eReceipt) {
    await sendEmail(db, env, {
      tenantId: ctx.tenant.id,
      fromName: ctx.tenant.name,
      to: email,
      subject: `Your receipt from ${ctx.tenant.name} — ${formatMoney(o.total, ctx.config.currency)}`,
      html: receiptHtml(snap),
      text: receiptText(snap),
      kind: "receipt",
      ref: o.id,
    });
  }
}

async function onTicketJoined(db: D1Database, env: PipelineEnv, ctx: BranchCtx, ticketId: string) {
  const t = await db.prepare("SELECT number, email, party_size FROM tickets WHERE id = ?").bind(ticketId).first<{ number: string; email: string | null; party_size: number }>();
  if (!t?.email) return;
  await sendEmail(db, env, {
    tenantId: ctx.tenant.id,
    fromName: ctx.tenant.name,
    to: t.email,
    subject: `You're in the queue at ${ctx.branch.name}: ${t.number}`,
    html: `<p>Hi! Your queue number at <b>${ctx.tenant.name} ${ctx.branch.name}</b> is <b style="font-size:20px">${t.number}</b> (party of ${t.party_size}).</p><p>We'll email you when your table is ready.</p>`,
    text: `Your queue number at ${ctx.branch.name} is ${t.number}.`,
    kind: "ticket_joined",
    ref: ticketId,
  });
}

async function onTicketCalled(db: D1Database, env: PipelineEnv, ctx: BranchCtx, ticketId: string) {
  const t = await db.prepare("SELECT number, email, held_table_ids FROM tickets WHERE id = ?").bind(ticketId).first<{ number: string; email: string | null; held_table_ids: string | null }>();
  if (!t) return;
  await sendPushToTopic(db, env, `ticket:${ticketId}`);
  if (!t.email) return;
  await sendEmail(db, env, {
    tenantId: ctx.tenant.id,
    fromName: ctx.tenant.name,
    to: t.email,
    subject: `Your table is ready — ${t.number}`,
    html: `<p><b style="font-size:20px">${t.number}</b>, your table at <b>${ctx.branch.name}</b> is ready! Please come to the host stand within ${ctx.config.holdCalledMinutes} minutes.</p>`,
    text: `${t.number}: your table at ${ctx.branch.name} is ready. Please come within ${ctx.config.holdCalledMinutes} minutes.`,
    kind: "ticket_called",
    ref: ticketId,
  });
}

async function onBookingCreated(db: D1Database, env: PipelineEnv, ctx: BranchCtx, bookingId: string) {
  const b = await db.prepare("SELECT name, email, party_size, slot_start FROM bookings WHERE id = ?").bind(bookingId).first<{ name: string; email: string | null; party_size: number; slot_start: number }>();
  if (!b?.email) return;
  const when = new Intl.DateTimeFormat("en-MY", { timeZone: ctx.config.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(b.slot_start));
  await sendEmail(db, env, {
    tenantId: ctx.tenant.id,
    fromName: ctx.tenant.name,
    to: b.email,
    subject: `Booking confirmed at ${ctx.tenant.name} ${ctx.branch.name}`,
    html: `<p>Hi ${b.name}, your table for <b>${b.party_size}</b> on <b>${when}</b> is confirmed. You can preorder from your booking page so food is ready when you arrive.</p>`,
    text: `Booking confirmed for ${b.party_size} on ${when}.`,
    kind: "booking_created",
    ref: bookingId,
  });
}

