import type { Menu, MenuCategory, MenuItem, ModifierGroup } from "../../shared/types";
import { fail, notFound } from "../errors";
import { newId } from "../ids";
import { Tx } from "../tx";
import { streams } from "./context";

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
  sold_out?: number | null;
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
});

/** Full menu for a tenant; with a branch, sold-out flags are applied. */
export async function getMenu(db: D1Database, tenantId: string, branchId?: string | null, includeInactive = false): Promise<Menu> {
  const [cats, items, ver] = await db.batch([
    db.prepare("SELECT id, name, sort FROM menu_categories WHERE tenant_id = ? ORDER BY sort, name").bind(tenantId),
    db
      .prepare(
        `SELECT i.*, a.sold_out FROM menu_items i LEFT JOIN item_availability a ON a.item_id = i.id AND a.branch_id = ?
         WHERE i.tenant_id = ? ${includeInactive ? "" : "AND i.active = 1"} ORDER BY i.sort, i.name`,
      )
      .bind(branchId ?? "", tenantId),
    db.prepare("SELECT COUNT(*) AS v FROM events WHERE stream = ?").bind(streams.menu(tenantId)),
  ]);
  return {
    version: (ver.results[0] as { v: number }).v,
    categories: cats.results as unknown as MenuCategory[],
    items: (items.results as unknown as ItemRow[]).map(toItem),
  };
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
    `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, image_url, allergens, dietary, spice_level, story, is_signature, tags, station, modifiers, active, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category_id = excluded.category_id, name = excluded.name, description = excluded.description, price = excluded.price,
       image_url = excluded.image_url, allergens = excluded.allergens, dietary = excluded.dietary, spice_level = excluded.spice_level, story = excluded.story,
       is_signature = excluded.is_signature, tags = excluded.tags, station = excluded.station, modifiers = excluded.modifiers, active = excluded.active, sort = excluded.sort
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
      "INSERT INTO item_availability (branch_id, item_id, sold_out) VALUES (?, ?, ?) ON CONFLICT(branch_id, item_id) DO UPDATE SET sold_out = excluded.sold_out",
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
