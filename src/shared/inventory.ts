// Inventory: ingredients per restaurant, a recipe per dish, stock per branch. Ordering a dish
// uses its recipe's ingredients at that branch; when one runs out, the dishes that need it sell
// out there until it is restocked. Stock never blocks a sale: it may go below zero, and shows so.
//
// Quantities are stored as integer thousandths of the ingredient's unit (1.5 kg = 1500), the way
// money is integer minor units, so a day of deductions adds up exactly. The API speaks plain
// decimals in the ingredient's unit.

export const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export type Unit = (typeof UNITS)[number];

/** Ways stock moves. "used" and "returned" come from orders; the rest are staff entries. */
export const MOVEMENT_KINDS = ["received", "used", "returned", "wastage", "adjusted", "counted"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
/** What staff record by hand: deliveries and wastage (kitchen), corrections and stock counts (managers). */
export const ENTRY_KINDS = ["received", "wastage", "adjusted", "counted"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const MAX_INGREDIENTS = 300;
export const MAX_RECIPE_LINES = 30;
/** The largest quantity anyone types: a million units. */
export const MAX_QTY = 1_000_000;

/** A decimal quantity → stored thousandths. */
export const toMilli = (n: number) => Math.round(n * 1000);
/** Stored thousandths → a decimal quantity. */
export const fromMilli = (m: number) => m / 1000;

export interface Ingredient {
  id: string;
  name: string;
  nameZh: string;
  unit: Unit;
  /** Cost of one unit in minor units, when known. */
  cost: number | null;
}

/** One line of a dish's recipe; qty per serving, in thousandths of the ingredient's unit. */
export interface RecipeLine {
  itemId: string;
  ingredientId: string;
  qty: number;
}

export type StockStatus = "untracked" | "ok" | "low" | "out";

/** An ingredient at a branch: not counted here yet, plenty, at or below its low mark, or none left. */
export function stockStatus(row: { onHand: number; lowAt: number } | null | undefined): StockStatus {
  if (!row) return "untracked";
  if (row.onHand <= 0) return "out";
  return row.onHand <= row.lowAt ? "low" : "ok";
}

/**
 * What a round of order lines uses: one entry per (line, ingredient), qty in thousandths.
 * Dishes without a recipe use nothing.
 */
export function usage(recipes: RecipeLine[], lines: { id: string; itemId: string; qty: number }[]): { lineId: string; ingredientId: string; qty: number }[] {
  const byItem = new Map<string, RecipeLine[]>();
  for (const r of recipes) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  const out: { lineId: string; ingredientId: string; qty: number }[] = [];
  for (const l of lines) for (const r of byItem.get(l.itemId) ?? []) if (r.qty > 0 && l.qty > 0) out.push({ lineId: l.id, ingredientId: r.ingredientId, qty: r.qty * l.qty });
  return out;
}

/** Total use per ingredient. */
export function totals(uses: { ingredientId: string; qty: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of uses) m.set(u.ingredientId, (m.get(u.ingredientId) ?? 0) + u.qty);
  return m;
}

/**
 * Dishes that can't be made at a branch: any ingredient of the recipe that the branch tracks is
 * at or below zero. An ingredient the branch doesn't track never makes a dish unavailable.
 */
export function unavailable(recipes: RecipeLine[], onHand: Map<string, number>): Set<string> {
  const out = new Set<string>();
  for (const r of recipes) {
    const have = onHand.get(r.ingredientId);
    if (have !== undefined && have <= 0) out.add(r.itemId);
  }
  return out;
}

/** How many servings of a dish the tracked stock still covers (null: nothing in it is tracked). */
export function servingsLeft(recipe: RecipeLine[], onHand: Map<string, number>): number | null {
  let n: number | null = null;
  for (const r of recipe) {
    const have = onHand.get(r.ingredientId);
    if (have === undefined || r.qty <= 0) continue;
    const s = Math.max(0, Math.floor(have / r.qty));
    n = n === null ? s : Math.min(n, s);
  }
  return n;
}

/** A quantity for people: "1.5 kg", "12 pcs", up to three decimals, no trailing zeros. */
export function showQty(milli: number, unit: Unit | string, locale = "en"): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(fromMilli(milli));
  return `${n} ${unit}`;
}
