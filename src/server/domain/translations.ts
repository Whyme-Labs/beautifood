// Fill in missing menu translations for every registered language. Manual edits by the
// restaurant (source "manual") are never overwritten; machine ones can be refreshed.
import { LOCALES } from "../../i18n/core";
import type { ItemTranslation, ModifierGroup } from "../../shared/types";
import { translateTexts, type Engine, type TranslateEnv } from "../ai/translate";
import { Tx } from "../tx";
import { streams } from "./context";

interface Row {
  id: string;
  name: string;
  description: string;
  story: string;
  modifiers: string;
  translations: string;
}

export interface TranslateResult {
  locales: string[];
  engine: Engine | null;
  items: number;
  translated: number;
  missing: number;
}

export async function translateMenu(db: D1Database, env: TranslateEnv, tenantId: string, actor: string, opts: { locales?: string[]; refresh?: boolean } = {}): Promise<TranslateResult> {
  const tenant = (await db.prepare("SELECT menu_language, story, description, translations FROM tenants WHERE id = ?").bind(tenantId).first<{ menu_language: string; story: string; description: string; translations: string }>())!;
  const from = tenant.menu_language || "en";
  const targets = (opts.locales?.length ? opts.locales : LOCALES.map((l) => l.code)).filter((l) => l !== from && LOCALES.some((x) => x.code === l));
  const [items, cats] = await db.batch([
    db.prepare("SELECT id, name, description, story, modifiers, translations FROM menu_items WHERE tenant_id = ?").bind(tenantId),
    db.prepare("SELECT id, name, translations FROM menu_categories WHERE tenant_id = ?").bind(tenantId),
  ]);
  const itemRows = items.results as unknown as Row[];
  const catRows = cats.results as unknown as { id: string; name: string; translations: string }[];
  let engine: Engine | null = null;
  let translated = 0;
  let missing = 0;
  const tx = new Tx(db, { tenantId, actor });

  for (const to of targets) {
    // Collect every text that needs this language, deduplicated.
    const wanted = new Set<string>();
    const want = (cur: string | undefined, src: string, manual: boolean) => {
      if (!src.trim()) return;
      if (manual) return;
      if (!cur || opts.refresh) wanted.add(src);
    };
    const parsed = itemRows.map((r) => ({ row: r, tr: JSON.parse(r.translations || "{}") as Record<string, ItemTranslation>, mods: JSON.parse(r.modifiers || "[]") as ModifierGroup[] }));
    for (const { row, tr, mods } of parsed) {
      const t = tr[to] ?? {};
      const manual = t.source === "manual";
      want(t.name, row.name, manual);
      want(t.description, row.description, manual);
      want(t.story, row.story, manual);
      for (const g of mods) {
        want(t.modifiers?.[g.name]?.name, g.name, manual);
        for (const o of g.options) want(t.modifiers?.[g.name]?.options?.[o.name], o.name, manual);
      }
    }
    const catTr = catRows.map((c) => ({ row: c, tr: JSON.parse(c.translations || "{}") as Record<string, { name?: string }> }));
    for (const c of catTr) want(c.tr[to]?.name, c.row.name, false);
    const tenantTr = JSON.parse(tenant.translations || "{}") as Record<string, { story?: string; description?: string }>;
    want(tenantTr[to]?.story, tenant.story, false);
    want(tenantTr[to]?.description, tenant.description, false);

    const texts = [...wanted];
    const res = await translateTexts(env, texts, from, to);
    engine = res.engine;
    const map = new Map<string, string>();
    texts.forEach((t, i) => (res.out[i] ? map.set(t, res.out[i]!) : missing++));
    translated += map.size;
    const pick = (cur: string | undefined, src: string) => (cur && !opts.refresh ? cur : (map.get(src) ?? cur));

    for (const { row, tr, mods } of parsed) {
      const t: ItemTranslation = { ...(tr[to] ?? {}) };
      if (t.source === "manual") continue;
      const next: ItemTranslation = {
        name: pick(t.name, row.name),
        description: row.description ? pick(t.description, row.description) : undefined,
        story: row.story ? pick(t.story, row.story) : undefined,
        modifiers: Object.fromEntries(
          mods.map((g) => [
            g.name,
            { name: pick(t.modifiers?.[g.name]?.name, g.name), options: Object.fromEntries(g.options.map((o) => [o.name, pick(t.modifiers?.[g.name]?.options?.[o.name], o.name) ?? o.name])) },
          ]),
        ),
        source: res.engine === "glossary" ? "glossary" : "ai",
      };
      if (JSON.stringify(next) !== JSON.stringify(tr[to])) tx.run("UPDATE menu_items SET translations = ? WHERE id = ?", JSON.stringify({ ...tr, [to]: next }), row.id);
    }
    for (const c of catTr) {
      const name = pick(c.tr[to]?.name, c.row.name);
      if (name && name !== c.tr[to]?.name) tx.run("UPDATE menu_categories SET translations = ? WHERE id = ?", JSON.stringify({ ...c.tr, [to]: { name } }), c.row.id);
    }
    const story = tenant.story ? pick(tenantTr[to]?.story, tenant.story) : undefined;
    const description = tenant.description ? pick(tenantTr[to]?.description, tenant.description) : undefined;
    tenant.translations = JSON.stringify({ ...tenantTr, [to]: { story, description } });
    tx.run("UPDATE tenants SET translations = ? WHERE id = ?", tenant.translations, tenantId);
  }
  tx.event({ stream: streams.menu(tenantId), type: "menu.translated", data: { locales: targets, engine, translated } });
  await tx.commit();
  return { locales: targets, engine, items: itemRows.length, translated, missing };
}

/** Save the restaurant's own translation of one dish (wins over machine translation forever). */
export async function setItemTranslation(db: D1Database, tenantId: string, actor: string, itemId: string, locale: string, tr: Omit<ItemTranslation, "source">) {
  const row = await db.prepare("SELECT translations FROM menu_items WHERE id = ? AND tenant_id = ?").bind(itemId, tenantId).first<{ translations: string }>();
  if (!row) return false;
  const all = JSON.parse(row.translations || "{}") as Record<string, ItemTranslation>;
  all[locale] = { ...all[locale], ...tr, source: "manual" };
  await new Tx(db, { tenantId, actor })
    .run("UPDATE menu_items SET translations = ? WHERE id = ?", JSON.stringify(all), itemId)
    .event({ stream: streams.menu(tenantId), type: "menu.item_translated", data: { itemId, locale } })
    .commit();
  return true;
}
