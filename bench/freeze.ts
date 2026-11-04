// The fingerprints of the frozen sets: v1's test split and the v2 and v3 held-out sets (v3 with its own
// menus and gold readings). All must match bench/CHANGES.md.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { loadCases } from "./run";

const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v);
for (const set of ["v1", "heldout", "v3", "v4", "v5", "v6", "v7", "v8", "v10", "v11", "v12", "v13", "v14"] as const) {
  const cases = loadCases("test", set).sort((a, b) => a.id.localeCompare(b.id));
  console.log(set, cases.length, createHash("sha256").update(JSON.stringify(sorted(cases))).digest("hex").slice(0, 16));
}
for (const v of ["v3", "v4", "v5", "v6", "v7", "v8", "v10", "v11", "v12", "v13", "v14"]) {
  const dir = new URL(`./${v}/menus/`, import.meta.url);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).sort();
  console.log(`${v} menus`, files.length, createHash("sha256").update(files.map((f) => f + readFileSync(new URL(f, dir), "utf8")).join("\n")).digest("hex").slice(0, 16));
}
// A menu name must be unique across sets: the loader takes the first file it finds, so a reused name reads another set's menu.
const seen = new Map<string, string>();
for (const d of ["menus", ...readdirSync(new URL("./", import.meta.url)).filter((v) => existsSync(new URL(`./${v}/menus/`, import.meta.url))).map((v) => `${v}/menus`)])
  for (const f of readdirSync(new URL(`./${d}/`, import.meta.url)).filter((f) => f.endsWith(".txt"))) {
    const m = f.replace(/\.txt$/, "");
    if (seen.has(m) && seen.get(m) !== d) console.error(`menu name "${m}" is in both ${seen.get(m)} and ${d}`);
    else seen.set(m, d);
  }
