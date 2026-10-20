import type { Menu, MenuCategory, MenuItem, ModifierGroup } from "../../shared/types";
import { clockAt, menuNow, menusAt, rulesAt, serving, type PriceRule, type Serving, type TimedMenu, type Window } from "../../shared/schedule";
import { fail, notFound } from "../errors";
import { newId } from "../ids";
import { Tx } from "../tx";
import { publicDishFields } from "./customFields";
import { streams, type BranchCtx } from "./context";

interface ItemRow {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  allergens: string;
  dietary: string;
  spice_level: number;
  story: string;
  is_signature: number;
  tags: string;
  station: string;
  modifiers: string;
  active: number;
  sort: number;
  translations?: string | null;
  sold_out?: number | null;
  menu_ids?: string | null;
}

export const toItem = (r: ItemRow): MenuItem => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  description: r.description,
  price: r.price,
  imageUrl: r.image_url,
  allergens: JSON.parse(r.allergens),
  dietary: JSON.parse(r.dietary),
  spiceLevel: r.spice_level,
  story: r.story,
  isSignature: !!r.is_signature,
  tags: JSON.parse(r.tags),
  station: r.station,
  modifiers: JSON.parse(r.modifiers),
  active: !!r.active,
  sort: r.sort,
  soldOut: !!r.sold_out,
  translations: JSON.parse(r.translations || "{}"),
  menuIds: JSON.parse(r.menu_ids || "[]"),
});

interface TimedMenuRow {
  id: string;
  name: string;
  translations: string;
  windows: string;
  branches: string;
  active: number;
  sort: number;
}
interface PriceRuleRow {
  id: string;
  name: string;
  translations: string;
  kind: "percent" | "amount";
  value: number;
  categories: string;
  items: string;
  windows: string;
  branches: string;
  active: number;
}
const toTimedMenu = (r: TimedMenuRow): TimedMenu => ({ id: r.id, name: r.name, translations: JSON.parse(r.translations || "{}"), windows: JSON.parse(r.windows || "[]"), branches: JSON.parse(r.branches || '["*"]'), active: !!r.active, sort: r.sort });
const toPriceRule = (r: PriceRuleRow): PriceRule => ({
  id: r.id,
  name: r.name,
  translations: JSON.parse(r.translations || "{}"),
  kind: r.kind,
  value: r.value,
  categories: JSON.parse(r.categories || "[]"),
  items: JSON.parse(r.items || "[]"),
  windows: JSON.parse(r.windows || "[]"),
  branches: JSON.parse(r.branches || '["*"]'),
  active: !!r.active,
});

const timedStmts = (db: D1Database, tenantId: string) => [
  db.prepare("SELECT * FROM timed_menus WHERE tenant_id = ? ORDER BY sort, name").bind(tenantId),
  db.prepare("SELECT * FROM price_rules WHERE tenant_id = ? ORDER BY name").bind(tenantId),
];

/** Full menu for a tenant; with a branch, sold-out flags are applied. */
export async function getMenu(db: D1Database, tenantId: string, branchId?: string | null, includeInactive = false): Promise<Menu> {
  const [cats, items, ver, lang, menus, rules] = await db.batch([
    db.prepare("SELECT id, name, sort, translations FROM menu_categories WHERE tenant_id = ? ORDER BY sort, name").bind(tenantId),
    db
      .prepare(
        `SELECT i.*, a.sold_out FROM menu_items i LEFT JOIN item_availability a ON a.item_id = i.id AND a.branch_id = ?
         WHERE i.tenant_id = ? ${includeInactive ? "" : "AND i.active = 1"} ORDER BY i.sort, i.name`,
      )
      .bind(branchId ?? "", tenantId),
    db.prepare("SELECT COUNT(*) AS v FROM events WHERE stream = ?").bind(streams.menu(tenantId)),
    db.prepare("SELECT menu_language FROM tenants WHERE id = ?").bind(tenantId),
    ...timedStmts(db, tenantId),
  ]);
  const list = (items.results as unknown as ItemRow[]).map(toItem);
  // the restaurant's own dish fields that guests may see
  const custom = await publicDishFields(db, tenantId, list.map((i) => i.id));
  return {
    language: (lang.results[0] as { menu_language?: string } | undefined)?.menu_language ?? "en",
    version: (ver.results[0] as { v: number }).v,
    categories: (cats.results as unknown as (MenuCategory & { translations: string })[]).map((c) => ({ ...c, translations: JSON.parse(c.translations || "{}") })),
    items: custom.fields.length ? list.map((i) => (custom.values[i.id] ? { ...i, custom: custom.values[i.id] } : i)) : list,
    ...(custom.fields.length ? { fields: custom.fields } : {}),
    menus: (menus.results as unknown as TimedMenuRow[]).map(toTimedMenu),
    rules: (rules.results as unknown as PriceRuleRow[]).map(toPriceRule),
  };
}

/** The menu guests see at a branch right now: what is served now, and at what price now. */
export async function menuAt(db: D1Database, ctx: BranchCtx, at = Date.now(), includeInactive = false): Promise<Menu> {
  return menuNow(await getMenu(db, ctx.tenant.id, ctx.branch.id, includeInactive), ctx.branch.id, clockAt(at, ctx.config.timezone));
}

/** Dishes as they stand at `at` (the command's time): the menu row, whether it is served now and its price now. */
export async function itemsAt(db: D1Database, ctx: BranchCtx, ids: string[], at: number): Promise<Map<string, MenuItem & { category: string; serving: Serving }>> {
  const [items, [menus, rules]] = await Promise.all([getItems(db, ctx.tenant.id, ctx.branch.id, ids), db.batch(timedStmts(db, ctx.tenant.id))]);
  const m = menusAt((menus.results as unknown as TimedMenuRow[]).map(toTimedMenu), ctx.branch.id);
  const r = rulesAt((rules.results as unknown as PriceRuleRow[]).map(toPriceRule), ctx.branch.id);
  const c = clockAt(at, ctx.config.timezone);
  return new Map([...items].map(([id, i]) => [id, { ...i, serving: serving(i, m, r, c) }]));
}

// ── timed menus and price rules ─────────────────────────────────────────────

export interface TimedMenuInput {
  id?: string;
  name: string;
  windows: Window[];
  branches: string[];
  active?: boolean;
  sort?: number;
}

export async function saveTimedMenu(db: D1Database, tenantId: string, actor: string, m: TimedMenuInput) {
  const id = m.id ?? newId("tm_");
  await new Tx(db, { tenantId, actor })
    .run(
      `INSERT INTO timed_menus (id, tenant_id, name, windows, branches, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, windows = excluded.windows, branches = excluded.branches, active = excluded.active, sort = excluded.sort
       WHERE timed_menus.tenant_id = excluded.tenant_id`,
      id,
      tenantId,
      m.name,
      JSON.stringify(m.windows),
      JSON.stringify(m.branches.length ? m.branches : ["*"]),
      m.active === false ? 0 : 1,
      m.sort ?? 0,
    )
    .event({ stream: streams.menu(tenantId), type: "menu.timed_saved", data: { id, name: m.name, windows: m.windows } })
    .commit();
  return { id };
}

/** Delete a timed menu; its dishes stay, served all day unless they are on another menu. */
export async function deleteTimedMenu(db: D1Database, tenantId: string, actor: string, id: string) {
  await new Tx(db, { tenantId, actor })
    .run("DELETE FROM timed_menus WHERE id = ? AND tenant_id = ?", id, tenantId)
    .run(
      `UPDATE menu_items SET menu_ids = COALESCE((SELECT json_group_array(value) FROM json_each(menu_items.menu_ids) WHERE value <> ?), '[]')
       WHERE tenant_id = ? AND EXISTS (SELECT 1 FROM json_each(menu_items.menu_ids) WHERE value = ?)`,
      id,
      tenantId,
      id,
    )
    .event({ stream: streams.menu(tenantId), type: "menu.timed_deleted", data: { id } })
    .commit();
}

export interface PriceRuleInput {
  id?: string;
  name: string;
  kind: "percent" | "amount";
  value: number;
  categories: string[];
  items: string[];
  windows: Window[];
  branches: string[];
  active?: boolean;
}

export async function savePriceRule(db: D1Database, tenantId: string, actor: string, r: PriceRuleInput) {
  const id = r.id ?? newId("pr_");
  await new Tx(db, { tenantId, actor })
    .run(
      `INSERT INTO price_rules (id, tenant_id, name, kind, value, categories, items, windows, branches, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, value = excluded.value, categories = excluded.categories, items = excluded.items,
         windows = excluded.windows, branches = excluded.branches, active = excluded.active
       WHERE price_rules.tenant_id = excluded.tenant_id`,
      id,
      tenantId,
      r.name,
      r.kind,
      r.value,
      JSON.stringify(r.categories),
      JSON.stringify(r.items),
      JSON.stringify(r.windows),
      JSON.stringify(r.branches.length ? r.branches : ["*"]),
      r.active === false ? 0 : 1,
    )
    .event({ stream: streams.menu(tenantId), type: "menu.price_rule_saved", data: { id, name: r.name, kind: r.kind, value: r.value } })
    .commit();
  return { id };
}

export async function deletePriceRule(db: D1Database, tenantId: string, actor: string, id: string) {
  await new Tx(db, { tenantId, actor })
    .run("DELETE FROM price_rules WHERE id = ? AND tenant_id = ?", id, tenantId)
    .event({ stream: streams.menu(tenantId), type: "menu.price_rule_deleted", data: { id } })
    .commit();
}

export async function getItems(db: D1Database, tenantId: string, branchId: string, ids: string[]): Promise<Map<string, MenuItem & { category: string }>> {
  if (!ids.length) return new Map();
  const uniq = [...new Set(ids)];
  const rows = (
    await db
      .prepare(
        `SELECT i.*, a.sold_out, c.name AS category FROM menu_items i
         LEFT JOIN item_availability a ON a.item_id = i.id AND a.branch_id = ?
         LEFT JOIN menu_categories c ON c.id = i.category_id
         WHERE i.tenant_id = ? AND i.id IN (${uniq.map(() => "?").join(",")})`,
      )
      .bind(branchId, tenantId, ...uniq)
      .all<ItemRow & { category: string }>()
  ).results;
  return new Map(rows.map((r) => [r.id, { ...toItem(r), category: r.category ?? "" }]));
}

export interface ChosenModifier {
  group: string;
  option: string;
}

/** Validate a selection against the item's modifier groups and price it. */
export function priceModifiers(item: MenuItem, chosen: ChosenModifier[]): { group: string; option: string; price: number }[] {
  const out: { group: string; option: string; price: number }[] = [];
  for (const g of item.modifiers as ModifierGroup[]) {
    const picks = chosen.filter((c) => c.group === g.name);
    if (picks.length < g.min) fail(400, "modifier_required", `Choose ${g.min > 1 ? `${g.min} options` : "an option"} for ${g.name}`);
    if (g.max > 0 && picks.length > g.max) fail(400, "modifier_too_many", `Choose at most ${g.max} for ${g.name}`);
    for (const p of picks) {
      const opt = g.options.find((o) => o.name === p.option);
      if (!opt) fail(400, "modifier_invalid", `${p.option} is not an option for ${g.name}`);
      out.push({ group: g.name, option: opt.name, price: opt.price });
    }
  }
  const unknown = chosen.find((c) => !(item.modifiers as ModifierGroup[]).some((g) => g.name === c.group));
  if (unknown) fail(400, "modifier_invalid", `${unknown.group} doesn't apply to ${item.name}`);
  return out;
}

export interface ItemInput {
  id?: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  allergens?: string[];
  dietary?: string[];
  spiceLevel?: number;
  story?: string;
  isSignature?: boolean;
  tags?: string[];
  station?: string;
  modifiers?: ModifierGroup[];
  active?: boolean;
  sort?: number;
  menuIds?: string[];
}

export async function upsertCategory(db: D1Database, tenantId: string, actor: string, c: { id?: string; name: string; sort?: number }) {
  const id = c.id ?? newId("cat_");
  await new Tx(db, { tenantId, actor })
    .run(
      "INSERT INTO menu_categories (id, tenant_id, name, sort) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort = excluded.sort WHERE menu_categories.tenant_id = excluded.tenant_id",
      id,
      tenantId,
      c.name,
      c.sort ?? 0,
    )
    .event({ stream: streams.menu(tenantId), type: "menu.category_saved", data: { id, name: c.name } })
    .commit();
  return { id, name: c.name, sort: c.sort ?? 0 };
}

export async function deleteCategory(db: D1Database, tenantId: string, actor: string, id: string) {
  await new Tx(db, { tenantId, actor })
    .assert("NOT EXISTS (SELECT 1 FROM menu_items WHERE category_id = ? AND active = 1)", [id], 409, "category_not_empty", "Move or remove the items in this category first")
    .run("DELETE FROM menu_categories WHERE id = ? AND tenant_id = ?", id, tenantId)
    .event({ stream: streams.menu(tenantId), type: "menu.category_deleted", data: { id } })
    .commit();
}

function itemStmt(tx: Tx, tenantId: string, i: ItemInput & { id: string }) {
  tx.run(
    `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, image_url, allergens, dietary, spice_level, story, is_signature, tags, station, modifiers, active, sort, menu_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, '[]'))
     ON CONFLICT(id) DO UPDATE SET category_id = excluded.category_id, name = excluded.name, description = excluded.description, price = excluded.price,
       image_url = excluded.image_url, allergens = excluded.allergens, dietary = excluded.dietary, spice_level = excluded.spice_level, story = excluded.story,
       is_signature = excluded.is_signature, tags = excluded.tags, station = excluded.station, modifiers = excluded.modifiers, active = excluded.active, sort = excluded.sort,
       menu_ids = CASE WHEN ? IS NULL THEN menu_items.menu_ids ELSE excluded.menu_ids END
     WHERE menu_items.tenant_id = excluded.tenant_id`,
    i.id,
    tenantId,
    i.categoryId,
    i.name,
    i.description ?? "",
    Math.round(i.price),
    i.imageUrl ?? null,
    JSON.stringify(i.allergens ?? []),
    JSON.stringify(i.dietary ?? []),
    i.spiceLevel ?? 0,
    i.story ?? "",
    i.isSignature ? 1 : 0,
    JSON.stringify(i.tags ?? []),
    i.station ?? "kitchen",
    JSON.stringify(i.modifiers ?? []),
    i.active === false ? 0 : 1,
    i.sort ?? 0,
    i.menuIds ? JSON.stringify(i.menuIds) : null,
    i.menuIds ? 1 : null,
  );
}

export async function upsertItem(db: D1Database, tenantId: string, actor: string, i: ItemInput) {
  const id = i.id ?? newId("itm_");
  const tx = new Tx(db, { tenantId, actor }).assert(
    "EXISTS (SELECT 1 FROM menu_categories WHERE id = ? AND tenant_id = ?)",
    [i.categoryId, tenantId],
    400,
    "unknown_category",
    "Unknown category",
  );
  itemStmt(tx, tenantId, { ...i, id });
  await tx.event({ stream: streams.menu(tenantId), type: "menu.item_saved", data: { id, name: i.name, price: i.price } }).commit();
  return { id };
}

export async function deleteItem(db: D1Database, tenantId: string, actor: string, id: string) {
  // soft delete keeps historical orders and reports intact
  await new Tx(db, { tenantId, actor })
    .run("UPDATE menu_items SET active = 0 WHERE id = ? AND tenant_id = ?", id, tenantId)
    .event({ stream: streams.menu(tenantId), type: "menu.item_deleted", data: { id } })
    .commit();
}

export async function setAvailability(db: D1Database, tenantId: string, branchId: string, actor: string, itemId: string, soldOut: boolean) {
  const exists = await db.prepare("SELECT 1 FROM menu_items WHERE id = ? AND tenant_id = ?").bind(itemId, tenantId).first();
  if (!exists) notFound("Item");
  await new Tx(db, { tenantId, branchId, actor })
    .run(
      // staff's own call: inventory won't undo it (src/server/domain/inventory.ts)
      "INSERT INTO item_availability (branch_id, item_id, sold_out, by_inventory) VALUES (?, ?, ?, 0) ON CONFLICT(branch_id, item_id) DO UPDATE SET sold_out = excluded.sold_out, by_inventory = 0",
      branchId,
      itemId,
      soldOut ? 1 : 0,
    )
    .event({ stream: streams.branch(branchId), type: soldOut ? "menu.sold_out" : "menu.back_in_stock", data: { itemId } })
    .commit();
}

export interface ImportItem extends Omit<ItemInput, "categoryId"> {
  category: string;
}

/** Bulk import (onboarding copilot). Creates missing categories; optionally replaces the existing menu. */
export async function importMenu(db: D1Database, tenantId: string, actor: string, items: ImportItem[], replace: boolean) {
  const existing = (await db.prepare("SELECT id, name FROM menu_categories WHERE tenant_id = ?").bind(tenantId).all<{ id: string; name: string }>()).results;
  const catId = new Map(replace ? [] : existing.map((c) => [c.name.toLowerCase(), c.id]));
  const tx = new Tx(db, { tenantId, actor });
  if (replace) {
    tx.run("UPDATE menu_items SET active = 0 WHERE tenant_id = ?", tenantId);
    tx.run("DELETE FROM menu_categories WHERE tenant_id = ?", tenantId);
  }
  let sort = 0;
  for (const it of items) {
    const key = it.category.toLowerCase();
    if (!catId.has(key)) {
      const id = newId("cat_");
      catId.set(key, id);
      tx.run("INSERT INTO menu_categories (id, tenant_id, name, sort) VALUES (?, ?, ?, ?)", id, tenantId, it.category, catId.size);
    }
    itemStmt(tx, tenantId, { ...it, id: newId("itm_"), categoryId: catId.get(key)!, sort: sort++ });
  }
  tx.event({ stream: streams.menu(tenantId), type: "menu.imported", data: { count: items.length, replace } });
  await tx.commit();
  return { categories: catId.size, items: items.length };
}
