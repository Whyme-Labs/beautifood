// Inventory (src/shared/inventory.ts): ingredients and recipes per restaurant, stock per branch.
//
// Every stock change is a stock_movements row plus the inventory_stock projection, in the same
// batch as whatever caused it (an order round, a void, a delivery). The same batch then decides,
// in SQL against the state it just wrote, what that change means:
//   - inventory.low when an ingredient went down through its low mark;
//   - dishes using an ingredient that just ran out (> 0 → ≤ 0) sell out at that branch, flagged
//     by_inventory, with menu.sold_out;
//   - dishes inventory sold out come back (menu.back_in_stock) once none of their tracked
//     ingredients is at or below zero. A manager's own sold-out flag is never touched, and a
//     manager putting a dish back on overrides inventory until the next time an ingredient runs out.
// A branch tracks an ingredient once someone receives or counts it there; until then, orders
// there use none of it and it never sells a dish out.
import { ENTRY_KINDS, MAX_INGREDIENTS, MAX_QTY, MAX_RECIPE_LINES, UNITS, fromMilli, stockStatus, toMilli, totals, usage, type EntryKind, type Ingredient, type MovementKind, type Unit } from "../../shared/inventory";
import { can } from "../../shared/rbac";
import { AppError, fail, notFound } from "../errors";
import type { Staff } from "../http";
import { newId } from "../ids";
import { Tx } from "../tx";
import { streams, type BranchCtx } from "./context";

// D1 caps bound parameters per statement; IN lists go in slices of this size
const SLICE = 80;
const slices = <T>(xs: T[], n = SLICE) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const marks = (n: number) => Array(n).fill("?").join(",");

interface IngredientRow {
  id: string;
  name: string;
  name_zh: string;
  unit: Unit;
  cost: number | null;
}
const toIngredient = (r: IngredientRow): Ingredient => ({ id: r.id, name: r.name, nameZh: r.name_zh, unit: r.unit, cost: r.cost });

/** Seeing stock takes either inventory permission in the branch. */
export function requireStockAccess(s: Staff) {
  if (!can(s, "inventory.manage") && !can(s, "inventory.stock")) throw new AppError(403, "forbidden", `Your role (${s.roleName}) cannot see inventory`);
}

// ── ingredients ─────────────────────────────────────────────────────────────

export async function listIngredients(db: D1Database, tenantId: string): Promise<Ingredient[]> {
  return (await db.prepare("SELECT id, name, name_zh, unit, cost FROM ingredients WHERE tenant_id = ? AND active = 1 ORDER BY name COLLATE NOCASE").bind(tenantId).all<IngredientRow>()).results.map(toIngredient);
}

async function ownIngredient(db: D1Database, tenantId: string, id: string): Promise<Ingredient> {
  const r = await db.prepare("SELECT id, name, name_zh, unit, cost FROM ingredients WHERE id = ? AND tenant_id = ? AND active = 1").bind(id, tenantId).first<IngredientRow>();
  if (!r) notFound("Ingredient");
  return toIngredient(r);
}

export interface IngredientInput {
  name: string;
  nameZh?: string;
  unit: Unit;
  cost?: number | null;
}

function cleanIngredient(i: IngredientInput) {
  const name = i.name.trim().slice(0, 60);
  if (!name) fail(400, "invalid_ingredient", "Give the ingredient a name");
  if (!UNITS.includes(i.unit)) fail(400, "invalid_ingredient", `Unit must be one of: ${UNITS.join(", ")}`);
  if (i.cost != null && (!Number.isInteger(i.cost) || i.cost < 0)) fail(400, "invalid_ingredient", "Cost is a whole amount in minor units");
  return { name, nameZh: (i.nameZh ?? "").trim().slice(0, 60), unit: i.unit, cost: i.cost ?? null };
}

const nameTaken = "EXISTS (SELECT 1 FROM ingredients WHERE tenant_id = ? AND active = 1 AND name = ? COLLATE NOCASE AND id <> ?)";

export async function createIngredient(db: D1Database, tenantId: string, actor: string, input: IngredientInput): Promise<Ingredient> {
  const c = cleanIngredient(input);
  const id = newId("ing_");
  await new Tx(db, { tenantId, actor })
    .assert(`NOT ${nameTaken}`, [tenantId, c.name, id], 409, "ingredient_exists", "There's already an ingredient with that name")
    .assert("(SELECT COUNT(*) FROM ingredients WHERE tenant_id = ? AND active = 1) < ?", [tenantId, MAX_INGREDIENTS], 409, "too_many_ingredients", `Up to ${MAX_INGREDIENTS} ingredients`)
    .run("INSERT INTO ingredients (id, tenant_id, name, name_zh, unit, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, tenantId, c.name, c.nameZh, c.unit, c.cost, Date.now())
    .event({ stream: streams.tenant(tenantId), type: "inventory.ingredient_saved", data: { id, name: c.name, unit: c.unit } })
    .commit();
  return { id, ...c };
}

/** Rename, re-cost, or (while nothing counts or uses it yet) change the unit. */
export async function updateIngredient(db: D1Database, tenantId: string, actor: string, id: string, input: Partial<IngredientInput>): Promise<Ingredient> {
  const cur = await ownIngredient(db, tenantId, id);
  const c = cleanIngredient({ name: input.name ?? cur.name, nameZh: input.nameZh ?? cur.nameZh, unit: input.unit ?? cur.unit, cost: input.cost === undefined ? cur.cost : input.cost });
  const tx = new Tx(db, { tenantId, actor }).assert(`NOT ${nameTaken}`, [tenantId, c.name, id], 409, "ingredient_exists", "There's already an ingredient with that name");
  // quantities already recorded are in the old unit
  if (c.unit !== cur.unit)
    tx.assert(
      "NOT EXISTS (SELECT 1 FROM recipe_lines WHERE ingredient_id = ?) AND NOT EXISTS (SELECT 1 FROM inventory_stock WHERE ingredient_id = ?)",
      [id, id],
      409,
      "unit_in_use",
      "This ingredient is already in recipes or stock, so its unit can't change. Add a new ingredient instead.",
    );
  await tx
    .run("UPDATE ingredients SET name = ?, name_zh = ?, unit = ?, cost = ? WHERE id = ?", c.name, c.nameZh, c.unit, c.cost, id)
    .event({ stream: streams.tenant(tenantId), type: "inventory.ingredient_saved", data: { id, name: c.name, unit: c.unit } })
    .commit();
  return { id, ...c };
}

/** Remove an ingredient: it leaves every recipe (dishes it sold out come back); its stock history stays. */
export async function deleteIngredient(db: D1Database, tenantId: string, actor: string, id: string) {
  await ownIngredient(db, tenantId, id);
  const dishes = (await db.prepare("SELECT item_id FROM recipe_lines WHERE ingredient_id = ? AND tenant_id = ?").bind(id, tenantId).all<{ item_id: string }>()).results.map((r) => r.item_id);
  const tx = new Tx(db, { tenantId, actor })
    .run("UPDATE ingredients SET active = 0 WHERE id = ?", id)
    .run("DELETE FROM recipe_lines WHERE ingredient_id = ?", id)
    .event({ stream: streams.tenant(tenantId), type: "inventory.ingredient_deleted", data: { id } });
  for (const b of await branchIds(db, tenantId)) restoreDishes(tx, b, dishes);
  await tx.commit();
}

const branchIds = async (db: D1Database, tenantId: string) => (await db.prepare("SELECT id FROM branches WHERE tenant_id = ?").bind(tenantId).all<{ id: string }>()).results.map((r) => r.id);

// ── recipes ─────────────────────────────────────────────────────────────────

export interface RecipeView {
  itemId: string;
  lines: { ingredientId: string; qty: number }[];
}

export async function getRecipe(db: D1Database, tenantId: string, itemId: string): Promise<RecipeView> {
  const rows = (
    await db
      .prepare("SELECT r.ingredient_id, r.qty FROM recipe_lines r JOIN ingredients i ON i.id = r.ingredient_id WHERE r.item_id = ? AND r.tenant_id = ? ORDER BY i.name COLLATE NOCASE")
      .bind(itemId, tenantId)
      .all<{ ingredient_id: string; qty: number }>()
  ).results;
  return { itemId, lines: rows.map((r) => ({ ingredientId: r.ingredient_id, qty: fromMilli(r.qty) })) };
}

/** Replace a dish's recipe (qty per serving, in each ingredient's unit). An empty list removes it. */
export async function setRecipe(db: D1Database, tenantId: string, actor: string, itemId: string, lines: { ingredientId: string; qty: number }[]): Promise<RecipeView> {
  if (!(await db.prepare("SELECT 1 FROM menu_items WHERE id = ? AND tenant_id = ?").bind(itemId, tenantId).first())) notFound("Dish");
  if (lines.length > MAX_RECIPE_LINES) fail(400, "invalid_recipe", `Up to ${MAX_RECIPE_LINES} ingredients per dish`);
  const merged = new Map<string, number>();
  for (const l of lines) {
    const q = toMilli(l.qty);
    if (!(q > 0) || l.qty > MAX_QTY) fail(400, "invalid_recipe", "Each ingredient needs a quantity above zero");
    merged.set(l.ingredientId, (merged.get(l.ingredientId) ?? 0) + q);
  }
  const ids = [...merged.keys()];
  if (ids.length) {
    const known = await db.prepare(`SELECT COUNT(*) AS n FROM ingredients WHERE tenant_id = ? AND active = 1 AND id IN (${marks(ids.length)})`).bind(tenantId, ...ids).first<{ n: number }>();
    if (known?.n !== ids.length) fail(400, "unknown_ingredient", "Unknown ingredient");
  }
  const tx = new Tx(db, { tenantId, actor }).run("DELETE FROM recipe_lines WHERE item_id = ? AND tenant_id = ?", itemId, tenantId);
  for (const [ingredientId, qty] of merged) {
    tx.assert("EXISTS (SELECT 1 FROM ingredients WHERE id = ? AND tenant_id = ? AND active = 1)", [ingredientId, tenantId], 400, "unknown_ingredient", "Unknown ingredient");
    tx.run("INSERT INTO recipe_lines (tenant_id, item_id, ingredient_id, qty) VALUES (?, ?, ?, ?)", tenantId, itemId, ingredientId, qty);
  }
  tx.event({ stream: streams.tenant(tenantId), type: "inventory.recipe_saved", data: { itemId, ingredients: ids.length } });
  // without the ingredient that ran out, a dish inventory sold out can be made again (a new recipe never sells a dish out by itself)
  for (const b of await branchIds(db, tenantId)) restoreDishes(tx, b, [itemId]);
  await tx.commit();
  return getRecipe(db, tenantId, itemId);
}

// ── stock at a branch ───────────────────────────────────────────────────────

interface StockRow extends IngredientRow {
  on_hand: number | null;
  low_at: number | null;
  updated_at: number | null;
}

export async function branchStock(db: D1Database, ctx: BranchCtx) {
  const [stock, recipes, avail] = await db.batch([
    db
      .prepare(
        `SELECT i.id, i.name, i.name_zh, i.unit, i.cost, s.on_hand, s.low_at, s.updated_at FROM ingredients i
         LEFT JOIN inventory_stock s ON s.ingredient_id = i.id AND s.branch_id = ?
         WHERE i.tenant_id = ? AND i.active = 1 ORDER BY i.name COLLATE NOCASE`,
      )
      .bind(ctx.branch.id, ctx.tenant.id),
    db.prepare("SELECT r.item_id, r.ingredient_id, m.name FROM recipe_lines r JOIN menu_items m ON m.id = r.item_id WHERE r.tenant_id = ? AND m.active = 1").bind(ctx.tenant.id),
    db.prepare("SELECT item_id, by_inventory FROM item_availability WHERE branch_id = ? AND sold_out = 1").bind(ctx.branch.id),
  ]);
  const soldOut = new Map((avail.results as { item_id: string; by_inventory: number }[]).map((a) => [a.item_id, !!a.by_inventory]));
  const dishes = new Map<string, { id: string; name: string; soldOut: boolean; byInventory: boolean }[]>();
  for (const r of recipes.results as { item_id: string; ingredient_id: string; name: string }[])
    dishes.set(r.ingredient_id, [...(dishes.get(r.ingredient_id) ?? []), { id: r.item_id, name: r.name, soldOut: soldOut.has(r.item_id), byInventory: soldOut.get(r.item_id) ?? false }]);
  const items = (stock.results as unknown as StockRow[]).map((r) => {
    const tracked = r.on_hand !== null;
    const row = tracked ? { onHand: r.on_hand!, lowAt: r.low_at! } : null;
    return {
      ...toIngredient(r),
      tracked,
      onHand: tracked ? fromMilli(r.on_hand!) : null,
      lowAt: tracked ? fromMilli(r.low_at!) : null,
      status: stockStatus(row),
      updatedAt: r.updated_at,
      dishes: dishes.get(r.id) ?? [],
    };
  });
  return { items, low: items.filter((i) => i.status === "low" || i.status === "out").map((i) => i.id) };
}

export async function listMovements(db: D1Database, ctx: BranchCtx, ingredientId?: string | null, limit = 50) {
  const rows = (
    await db
      .prepare(
        `SELECT m.id, m.ingredient_id, i.name, i.name_zh, i.unit, m.kind, m.delta, m.on_hand, m.reason, m.ref, m.cost, m.actor, m.at FROM stock_movements m JOIN ingredients i ON i.id = m.ingredient_id
         WHERE m.branch_id = ? ${ingredientId ? "AND m.ingredient_id = ?" : ""} ORDER BY m.at DESC, m.id DESC LIMIT ?`,
      )
      .bind(...(ingredientId ? [ctx.branch.id, ingredientId, limit] : [ctx.branch.id, limit]))
      .all<{ id: string; ingredient_id: string; name: string; name_zh: string; unit: Unit; kind: MovementKind; delta: number; on_hand: number; reason: string; ref: string | null; cost: number | null; actor: string | null; at: number }>()
  ).results;
  return rows.map((r) => ({ id: r.id, ingredientId: r.ingredient_id, name: r.name, nameZh: r.name_zh, unit: r.unit, kind: r.kind, delta: fromMilli(r.delta), onHand: fromMilli(r.on_hand), reason: r.reason, ref: r.ref, cost: r.cost, actor: r.actor, at: r.at }));
}

export interface EntryInput {
  ingredientId: string;
  kind: EntryKind;
  /** received / wastage: how much (above zero); adjusted: the change (+ or −); counted: what is there now. */
  qty: number;
  reason?: string;
  /** received: what the delivery cost in total, in minor units. */
  cost?: number | null;
}

/** Staff stock entries: a delivery, wastage, a correction, or a count (which sets on hand outright). */
export async function recordEntry(db: D1Database, ctx: BranchCtx, actor: string, e: EntryInput) {
  if (!ENTRY_KINDS.includes(e.kind)) fail(400, "invalid_entry", "Unknown kind of entry");
  const ing = await ownIngredient(db, ctx.tenant.id, e.ingredientId);
  const q = toMilli(e.qty);
  const reason = (e.reason ?? "").trim().slice(0, 120);
  if (!Number.isFinite(q) || Math.abs(e.qty) > MAX_QTY) fail(400, "invalid_qty", "That quantity is out of range");
  if ((e.kind === "received" || e.kind === "wastage") && !(q > 0)) fail(400, "invalid_qty", "Enter a quantity above zero");
  if (e.kind === "adjusted" && q === 0) fail(400, "invalid_qty", "An adjustment changes the stock");
  if (e.kind === "counted" && q < 0) fail(400, "invalid_qty", "A count can't be below zero");
  if ((e.kind === "wastage" || e.kind === "adjusted") && !reason) fail(400, "reason_required", "Say why (spoiled, dropped, miscount…)");
  if (e.cost != null && (e.kind !== "received" || !Number.isInteger(e.cost) || e.cost < 0)) fail(400, "invalid_cost", "Only a delivery has a cost, as a whole amount in minor units");
  const tx = new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor });
  const id = newId("sm_");
  const change: Change =
    e.kind === "counted"
      ? { ingredientId: ing.id, set: q, movementId: id }
      : { ingredientId: ing.id, delta: e.kind === "wastage" ? -q : q };
  // receiving or counting starts tracking an ingredient here; wastage and corrections need it tracked already
  if (e.kind === "received" || e.kind === "counted") ensureTracked(tx, ctx, ing.id);
  else tx.assert("EXISTS (SELECT 1 FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?)", [ctx.branch.id, ing.id], 409, "not_tracked", "Receive or count this ingredient here first");
  move(tx, ctx, { id, ingredientId: ing.id, kind: e.kind, change, reason, ref: null, cost: e.cost ?? null });
  tx.event({ stream: streams.branch(ctx.branch.id), type: `inventory.${e.kind}`, data: { ingredientId: ing.id, qty: e.qty, ...(reason ? { reason } : {}) } });
  await consequences(db, tx, ctx, [{ ...change, name: ing.name, unit: ing.unit }]);
  await tx.commit();
  const now = await db.prepare("SELECT on_hand, low_at FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?").bind(ctx.branch.id, ing.id).first<{ on_hand: number; low_at: number }>();
  return { ingredientId: ing.id, onHand: fromMilli(now?.on_hand ?? 0), lowAt: fromMilli(now?.low_at ?? 0), status: stockStatus(now ? { onHand: now.on_hand, lowAt: now.low_at } : null) };
}

/** The low-stock mark for an ingredient at this branch (once it's tracked here). */
export async function setLowAt(db: D1Database, ctx: BranchCtx, actor: string, ingredientId: string, lowAt: number) {
  await ownIngredient(db, ctx.tenant.id, ingredientId);
  if (!(lowAt >= 0) || lowAt > MAX_QTY) fail(400, "invalid_qty", "That quantity is out of range");
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .assert("EXISTS (SELECT 1 FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?)", [ctx.branch.id, ingredientId], 409, "not_tracked", "Receive or count this ingredient here first")
    .run("UPDATE inventory_stock SET low_at = ?, updated_at = ? WHERE branch_id = ? AND ingredient_id = ?", toMilli(lowAt), Date.now(), ctx.branch.id, ingredientId)
    .event({ stream: streams.branch(ctx.branch.id), type: "inventory.low_mark_set", data: { ingredientId, lowAt } })
    .commit();
}

// ── orders: use stock as dishes are ordered, return it when they're voided ───

/**
 * Add to an order round's batch: each line uses its dish's recipe from this branch's tracked
 * stock (one movement per line and ingredient, ref = the order item). Never refuses: stock may go negative.
 */
export async function useStock(db: D1Database, ctx: BranchCtx, tx: Tx, lines: { id: string; itemId: string; qty: number }[]) {
  const itemIds = [...new Set(lines.map((l) => l.itemId))];
  if (!itemIds.length) return;
  const recipes: { item_id: string; ingredient_id: string; qty: number; name: string; unit: Unit }[] = [];
  for (const part of slices(itemIds))
    recipes.push(
      ...(
        await db
          .prepare(
            `SELECT r.item_id, r.ingredient_id, r.qty, i.name, i.unit FROM recipe_lines r
             JOIN inventory_stock s ON s.ingredient_id = r.ingredient_id AND s.branch_id = ?
             JOIN ingredients i ON i.id = r.ingredient_id
             WHERE r.tenant_id = ? AND r.item_id IN (${marks(part.length)})`,
          )
          .bind(ctx.branch.id, ctx.tenant.id, ...part)
          .all<{ item_id: string; ingredient_id: string; qty: number; name: string; unit: Unit }>()
      ).results,
    );
  if (!recipes.length) return;
  const uses = usage(recipes.map((r) => ({ itemId: r.item_id, ingredientId: r.ingredient_id, qty: r.qty })), lines);
  for (const u of uses) move(tx, ctx, { id: newId("sm_"), ingredientId: u.ingredientId, kind: "used", change: { ingredientId: u.ingredientId, delta: -u.qty }, reason: "", ref: u.lineId, cost: null });
  const info = new Map(recipes.map((r) => [r.ingredient_id, { name: r.name, unit: r.unit }]));
  await consequences(db, tx, ctx, [...totals(uses)].map(([ingredientId, qty]) => ({ ingredientId, delta: -qty, ...info.get(ingredientId)! })));
}

/** Add to a void's batch: put back what those order items used (and haven't had back yet). */
export async function returnStock(db: D1Database, ctx: BranchCtx, tx: Tx, orderItemIds: string[]) {
  const used: { ref: string; ingredient_id: string; net: number; name: string; unit: Unit }[] = [];
  for (const part of slices(orderItemIds))
    used.push(
      ...(
        await db
          .prepare(
            `SELECT m.ref, m.ingredient_id, SUM(m.delta) AS net, i.name, i.unit FROM stock_movements m JOIN ingredients i ON i.id = m.ingredient_id
             WHERE m.branch_id = ? AND m.kind IN ('used', 'returned') AND m.ref IN (${marks(part.length)}) GROUP BY m.ref, m.ingredient_id HAVING SUM(m.delta) < 0`,
          )
          .bind(ctx.branch.id, ...part)
          .all<{ ref: string; ingredient_id: string; net: number; name: string; unit: Unit }>()
      ).results,
    );
  if (!used.length) return;
  for (const u of used) move(tx, ctx, { id: newId("sm_"), ingredientId: u.ingredient_id, kind: "returned", change: { ingredientId: u.ingredient_id, delta: -u.net }, reason: "", ref: u.ref, cost: null });
  const info = new Map(used.map((u) => [u.ingredient_id, { name: u.name, unit: u.unit }]));
  const back = totals(used.map((u) => ({ ingredientId: u.ingredient_id, qty: -u.net })));
  await consequences(db, tx, ctx, [...back].map(([ingredientId, qty]) => ({ ingredientId, delta: qty, ...info.get(ingredientId)! })));
}

// ── the statements ──────────────────────────────────────────────────────────

/** A change to one ingredient's stock in this batch: by a delta, or set outright (a count, recorded as movementId). */
type Change = { ingredientId: string; delta?: number; set?: number; movementId?: string };

/** SQL for "on hand before this batch's change" of `s` (an inventory_stock row), and its parameters. */
const before = (c: Change): [string, unknown[]] => (c.set !== undefined ? ["(SELECT m.on_hand - m.delta FROM stock_movements m WHERE m.id = ?)", [c.movementId]] : ["(s.on_hand - ?)", [c.delta]]);

function ensureTracked(tx: Tx, ctx: BranchCtx, ingredientId: string) {
  tx.run("INSERT INTO inventory_stock (branch_id, ingredient_id, tenant_id, on_hand, low_at, updated_at) VALUES (?, ?, ?, 0, 0, ?) ON CONFLICT DO NOTHING", ctx.branch.id, ingredientId, ctx.tenant.id, tx.at);
}

/** One ledger row and the projection. Untracked ingredients (no stock row here) are skipped by the SQL itself. */
function move(tx: Tx, ctx: BranchCtx, m: { id: string; ingredientId: string; kind: MovementKind; change: Change; reason: string; ref: string | null; cost: number | null }) {
  const b = ctx.branch.id;
  const insert = (deltaSql: string, onHandSql: string, ...p: unknown[]) =>
    tx.run(
      `INSERT INTO stock_movements (id, tenant_id, branch_id, ingredient_id, kind, delta, on_hand, reason, ref, cost, actor, at)
       SELECT ?, ?, ?, ?, ?, ${deltaSql}, ${onHandSql}, ?, ?, ?, ?, ? FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?`,
      m.id,
      ctx.tenant.id,
      b,
      m.ingredientId,
      m.kind,
      ...p,
      m.reason,
      m.ref,
      m.cost,
      tx.actor,
      tx.at,
      b,
      m.ingredientId,
    );
  if (m.change.set !== undefined) {
    // a count: the ledger records the difference from what the system thought, then on hand is what was counted
    insert("? - on_hand", "?", m.change.set, m.change.set);
    tx.run("UPDATE inventory_stock SET on_hand = ?, updated_at = ? WHERE branch_id = ? AND ingredient_id = ?", m.change.set, tx.at, b, m.ingredientId);
  } else {
    tx.run("UPDATE inventory_stock SET on_hand = on_hand + ?, updated_at = ? WHERE branch_id = ? AND ingredient_id = ?", m.change.delta, tx.at, b, m.ingredientId);
    insert("?", "on_hand", m.change.delta);
  }
}

/** What this batch's stock changes mean, decided in SQL after them: low alerts, dishes selling out or coming back. */
async function consequences(db: D1Database, tx: Tx, ctx: BranchCtx, changes: (Change & { name: string; unit: Unit })[]) {
  const b = ctx.branch.id;
  const down = changes.filter((c) => c.set !== undefined || c.delta! < 0);
  const up = changes.some((c) => c.set !== undefined || c.delta! > 0);
  const stockOf = "FROM inventory_stock s WHERE s.branch_id = ? AND s.ingredient_id = ?";
  for (const c of down) {
    const [was, p] = before(c);
    tx.eventIf(`EXISTS (SELECT 1 ${stockOf} AND s.on_hand <= s.low_at AND ${was} > s.low_at)`, [b, c.ingredientId, ...p], {
      stream: streams.branch(b),
      type: "inventory.low",
      data: { ingredientId: c.ingredientId, name: c.name, unit: c.unit },
    });
  }
  const ids = changes.map((c) => c.ingredientId);
  const uses: { item_id: string; ingredient_id: string }[] = [];
  for (const part of slices(ids))
    uses.push(...(await db.prepare(`SELECT item_id, ingredient_id FROM recipe_lines WHERE tenant_id = ? AND ingredient_id IN (${marks(part.length)})`).bind(ctx.tenant.id, ...part).all<{ item_id: string; ingredient_id: string }>()).results);
  if (!uses.length) return;
  // ran out in this batch: > 0 before, ≤ 0 now
  const ranOut = (c: Change): [string, unknown[]] => {
    const [was, p] = before(c);
    return [`EXISTS (SELECT 1 ${stockOf} AND s.on_hand <= 0 AND ${was} > 0)`, [b, c.ingredientId, ...p]];
  };
  const dishes = [...new Set(uses.map((u) => u.item_id))];
  for (const d of dishes) {
    const mine = down.filter((c) => uses.some((u) => u.item_id === d && u.ingredient_id === c.ingredientId));
    if (!mine.length) continue;
    const conds = mine.map(ranOut);
    tx.eventIf(`NOT EXISTS (SELECT 1 FROM item_availability WHERE branch_id = ? AND item_id = ? AND sold_out = 1) AND (${conds.map(([s]) => s).join(" OR ")})`, [b, d, ...conds.flatMap(([, p]) => p)], {
      stream: streams.branch(b),
      type: "menu.sold_out",
      data: { itemId: d, by: "inventory" },
    });
  }
  for (const c of down) {
    const [cond, p] = ranOut(c);
    tx.run(
      `INSERT INTO item_availability (branch_id, item_id, sold_out, by_inventory)
       SELECT ?, r.item_id, 1, 1 FROM recipe_lines r WHERE r.tenant_id = ? AND r.ingredient_id = ? AND ${cond}
       ON CONFLICT(branch_id, item_id) DO UPDATE SET sold_out = 1, by_inventory = 1 WHERE item_availability.sold_out = 0`,
      b,
      ctx.tenant.id,
      c.ingredientId,
      ...p,
    );
  }
  if (up) restoreDishes(tx, b, dishes);
}

/** A dish none of whose tracked ingredients is at or below zero at the branch. */
const makeable = "NOT EXISTS (SELECT 1 FROM recipe_lines r JOIN inventory_stock s ON s.ingredient_id = r.ingredient_id AND s.branch_id = ? WHERE r.item_id = ? AND s.on_hand <= 0)";

/** Put back on the dishes inventory sold out at a branch that can be made again. */
function restoreDishes(tx: Tx, branchId: string, dishes: string[]) {
  for (const d of dishes)
    tx.eventIf(`EXISTS (SELECT 1 FROM item_availability WHERE branch_id = ? AND item_id = ? AND sold_out = 1 AND by_inventory = 1) AND ${makeable}`, [branchId, d, branchId, d], {
      branchId,
      stream: streams.branch(branchId),
      type: "menu.back_in_stock",
      data: { itemId: d, by: "inventory" },
    });
  for (const part of slices(dishes))
    tx.run(
      `UPDATE item_availability SET sold_out = 0, by_inventory = 0
       WHERE branch_id = ? AND by_inventory = 1 AND item_id IN (${marks(part.length)})
       AND NOT EXISTS (SELECT 1 FROM recipe_lines r JOIN inventory_stock s ON s.ingredient_id = r.ingredient_id AND s.branch_id = item_availability.branch_id WHERE r.item_id = item_availability.item_id AND s.on_hand <= 0)`,
      branchId,
      ...part,
    );
}
