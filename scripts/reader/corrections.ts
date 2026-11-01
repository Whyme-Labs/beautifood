// The guests' own corrections of the order card, as data for the order reader. Each row is one turn a
// guest fixed (assistant_turns with `said`): their message as typed, the chat just before it, the order
// before it, and the order they left it at. Written in the teacher's format (teacher/teach.py), so
// teacher/check.ts checks and labels them the same way: the turn's changes are worked out from the
// order before and after, applyTurn has to give exactly the guest's order, and each part has to be
// found in the message. A turn whose parts can't be found isn't trained on.
//
// Input: the two dumps the reader-corrections workflow makes (wrangler d1 execute --json):
//   corrections.json  SELECT tenant_id, lang, said, said_context, order_before, order_final FROM assistant_turns WHERE said IS NOT NULL AND order_final IS NOT NULL
//   menus.json        SELECT id, tenant_id, name, price, translations, modifiers FROM menu_items WHERE tenant_id IN (...)
//
//   npx tsx scripts/reader/corrections.ts corrections.json menus.json <out dir>   (then: teacher/check.ts <out dir> <train.jsonl>)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Line = { id: string; count: number; options: { group: string; name: string }[]; owner?: string };
type Row = { tenant_id: string; lang: string; said: string; said_context: string | null; order_before: string | null; order_final: string };
type MenuRow = { id: string; tenant_id: string; name: string; price: number; translations: string; modifiers: string };
type Named = { dish: string; count: number; options: string[]; owner?: string };
type Item = { change: string; dish: string; count?: number; options?: string[]; removeOptions?: string[] };

/** The rows of a `wrangler d1 execute --json` dump. */
const rows = <T>(path: string): T[] => (JSON.parse(readFileSync(path, "utf8")) as { results: T[] }[]).flatMap((r) => r.results ?? []);

/** The turn's changes, from the order before to the guest's: lines matched by dish, add-ons and owner. */
export function changesOf(before: Named[], after: Named[]): Item[] {
  const key = (l: Named) => `${l.dish}|${[...l.options].sort().join(",")}|${l.owner ?? ""}`;
  const b = new Map(before.map((l) => [key(l), l]));
  const a = new Map(after.map((l) => [key(l), l]));
  const items: Item[] = [];
  const gone = [...b.values()].filter((l) => !a.has(key(l)));
  for (const l of a.values()) {
    const was = b.get(key(l));
    if (was) {
      if (l.count > was.count) items.push({ change: "more", dish: l.dish, count: l.count - was.count, options: l.options });
      if (l.count < was.count) items.push({ change: "remove", dish: l.dish, count: was.count - l.count, options: l.options });
      continue;
    }
    // the same dish, as many, with other add-ons: those changed
    const k = gone.findIndex((g) => g.dish === l.dish && g.count === l.count && g.owner === l.owner);
    if (k >= 0) {
      const [g] = gone.splice(k, 1);
      items.push({ change: "modify", dish: l.dish, options: l.options.filter((o) => !g.options.includes(o)), removeOptions: g.options.filter((o) => !l.options.includes(o)) });
    } else items.push({ change: "new", dish: l.dish, count: l.count, options: l.options });
  }
  for (const g of gone) items.push({ change: "remove", dish: g.dish, options: g.options });
  return items;
}

function main() {
  const [corrections, menusPath, out] = process.argv.slice(2);
  if (!corrections || !menusPath || !out) {
    console.error("usage: npx tsx scripts/reader/corrections.ts corrections.json menus.json <out dir>");
    process.exit(2);
  }
  const items = rows<MenuRow>(menusPath);
  const byId = new Map(items.map((i) => [i.id, i]));
  // one teacher-format menu a tenant
  const menus = new Map<string, unknown>();
  for (const i of items) {
    const m = (menus.get(i.tenant_id) as { id: string; name: string; dishes: unknown[] }) ?? { id: i.tenant_id, name: i.tenant_id, dishes: [] };
    const tr = JSON.parse(i.translations || "{}") as Record<string, { name?: string }>;
    const groups = JSON.parse(i.modifiers || "[]") as { name: string; min: number; max: number; options: { name: string; price: number }[] }[];
    m.dishes.push({ name: i.name, zh: tr.zh?.name ?? null, price: i.price / 100, groups: groups.map((g) => ({ ...g, options: g.options.map((o) => ({ name: o.name, price: o.price / 100 })) })) });
    menus.set(i.tenant_id, m);
  }
  const named = (lines: Line[]): Named[] | null => {
    const out: Named[] = [];
    for (const l of lines) {
      const d = byId.get(l.id);
      if (!d) return null;
      out.push({ dish: d.name, count: l.count, options: l.options.map((o) => o.name), ...(l.owner ? { owner: l.owner } : {}) });
    }
    return out;
  };
  const convs: unknown[] = [];
  let skipped = 0;
  for (const r of rows<Row>(corrections)) {
    const before = named(r.order_before ? (JSON.parse(r.order_before) as Line[]) : []);
    const after = named(JSON.parse(r.order_final) as Line[]);
    if (!before || !after || !menus.has(r.tenant_id)) {
      skipped++;
      continue;
    }
    const context = r.said_context ? (JSON.parse(r.said_context) as { role: string; content: string }[]) : [];
    const reply = [...context].reverse().find((m) => m.role === "assistant")?.content ?? null;
    convs.push({
      menu: r.tenant_id, lang: r.lang, source: "guest-correction", before,
      turns: [{ assistant_before: reply, guest: r.said, acts: [before.length ? "change" : "order"], items: changesOf(before, after), order_after: after }],
    });
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/menus.jsonl`, [...menus.values()].map((m) => JSON.stringify(m)).join("\n") + "\n");
  writeFileSync(`${out}/convs.jsonl`, convs.map((c) => JSON.stringify(c)).join("\n") + "\n");
  console.log(`${convs.length} corrected turns written (${skipped} skipped: a dish no longer on the menu), ${menus.size} menus`);
}

if (process.argv[1]?.endsWith("corrections.ts")) main();
