// The guest assistant's log, for the learning loop (docs/menu-brain.md): what each question was
// read as, what the brain decided, what it showed, and what the guest added from the chat; and for a
// bill, the order it read and the guest's own edit of it in the order card (a labelled turn). It keeps
// the question only as the intent model read it, with dish names as §dish, and with emails and
// phone numbers removed, for 90 days.
import { z } from "zod";
import { newId } from "../../ids";

const KEEP_DAYS = 90;

/** Removes what could identify a guest: email addresses, phone numbers, long digit runs. */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "§email")
    .replace(/\+?\d[\d\s-]{6,}\d/g, "§phone")
    .slice(0, 200)
    .trim();
}

export interface Turn {
  tenantId: string;
  branchId: string;
  lang: string;
  /** The delexicalised question (dish names as §dish, numbers as §num). */
  question: string;
  intent: string;
  confidence: number;
  confident: boolean;
  engine: string;
  shown: string[];
  /** A bill it worked out: its lines. */
  order?: OrderLines;
}

/** An order as the log keeps it: each line's dish, count and add-ons (by group). */
export type OrderLines = { id: string; count: number; options: { group: string; name: string }[]; owner?: string }[];

const OrderLinesSchema = z
  .array(z.object({ id: z.string().min(1).max(64), count: z.number().int().min(1).max(50), options: z.array(z.object({ group: z.string().max(80), name: z.string().max(80) })).max(12), owner: z.string().max(40).optional() }))
  .max(20);
export { OrderLinesSchema };

export async function logTurn(db: D1Database, t: Turn, at = Date.now()): Promise<string> {
  const id = newId("at_");
  await db
    .prepare("INSERT INTO assistant_turns (id, tenant_id, branch_id, created_at, lang, question, intent, confidence, confident, engine, shown, order_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, t.tenantId, t.branchId, at, t.lang.slice(0, 8), scrub(t.question), t.intent, Math.round(t.confidence * 1000), t.confident ? 1 : 0, t.engine, JSON.stringify(t.shown.slice(0, 8)), t.order?.length ? JSON.stringify(t.order.slice(0, 20)) : null)
    .run();
  return id;
}

/** The guest added a dish from a chat answer: counted only when that answer showed it. */
export async function recordAdd(db: D1Database, branchId: string, turnId: string, itemId: string): Promise<boolean> {
  const row = await db.prepare("SELECT shown, added FROM assistant_turns WHERE id = ? AND branch_id = ?").bind(turnId, branchId).first<{ shown: string; added: string }>();
  if (!row) return false;
  const shown = JSON.parse(row.shown) as string[];
  const added = JSON.parse(row.added) as string[];
  if (!shown.includes(itemId) || added.includes(itemId)) return false;
  await db.prepare("UPDATE assistant_turns SET added = ? WHERE id = ?").bind(JSON.stringify([...added, itemId]), turnId).run();
  return true;
}

/**
 * The guest changed the order card of a bill this turn worked out: their order, kept beside the one
 * it read (only for a turn that had one, and only dishes of this branch's menu).
 */
export async function recordCorrection(db: D1Database, branchId: string, turnId: string, final: OrderLines, menuIds: Set<string>): Promise<boolean> {
  const row = await db.prepare("SELECT order_read FROM assistant_turns WHERE id = ? AND branch_id = ?").bind(turnId, branchId).first<{ order_read: string | null }>();
  if (!row?.order_read || final.some((l) => !menuIds.has(l.id))) return false;
  await db.prepare("UPDATE assistant_turns SET order_final = ? WHERE id = ?").bind(JSON.stringify(final), turnId).run();
  return true;
}

const statsCache = new Map<string, { at: number; value: { chatShown: Record<string, number>; chatAdded: Record<string, number> } }>();

/** How often each dish was shown in this branch's chat in the last 30 days, and added from it. */
export async function chatStats(db: D1Database, branchId: string) {
  const hit = statsCache.get(branchId);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  const rows = (
    await db
      .prepare("SELECT shown, added FROM assistant_turns WHERE branch_id = ? AND created_at > ? AND shown <> '[]' ORDER BY created_at DESC LIMIT 3000")
      .bind(branchId, Date.now() - 30 * 86_400_000)
      .all<{ shown: string; added: string }>()
  ).results;
  const chatShown: Record<string, number> = {};
  const chatAdded: Record<string, number> = {};
  for (const r of rows) {
    for (const id of JSON.parse(r.shown) as string[]) chatShown[id] = (chatShown[id] ?? 0) + 1;
    for (const id of JSON.parse(r.added) as string[]) chatAdded[id] = (chatAdded[id] ?? 0) + 1;
  }
  const value = { chatShown, chatAdded };
  if (statsCache.size > 500) statsCache.clear();
  statsCache.set(branchId, { at: Date.now(), value });
  return value;
}

export async function purgeTurns(db: D1Database, now = Date.now()) {
  await db.prepare("DELETE FROM assistant_turns WHERE created_at < ?").bind(now - KEEP_DAYS * 86_400_000).run();
}
