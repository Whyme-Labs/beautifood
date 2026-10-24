// The fingerprints of the frozen sets: v1's test split and the v2 and v3 held-out sets (v3 with its own
// menus and gold readings). All must match bench/CHANGES.md.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { loadCases } from "./run";

const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v);
for (const set of ["v1", "heldout", "v3"] as const) {
  const cases = loadCases("test", set).sort((a, b) => a.id.localeCompare(b.id));
  console.log(set, cases.length, createHash("sha256").update(JSON.stringify(sorted(cases))).digest("hex").slice(0, 16));
}
const v3menus = new URL("./v3/menus/", import.meta.url);
const files = readdirSync(v3menus).sort();
console.log("v3 menus", files.length, createHash("sha256").update(files.map((f) => f + readFileSync(new URL(f, v3menus), "utf8")).join("\n")).digest("hex").slice(0, 16));
