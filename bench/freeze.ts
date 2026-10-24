// The fingerprints of the frozen sets: v1's test split and the v2 held-out set. Both must match bench/CHANGES.md.
import { createHash } from "node:crypto";
import { loadCases } from "./run";

const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v);
for (const set of ["v1", "heldout", "v3"] as const) {
  const cases = loadCases("test", set).sort((a, b) => a.id.localeCompare(b.id));
  console.log(set, cases.length, createHash("sha256").update(JSON.stringify(sorted(cases))).digest("hex").slice(0, 16));
}
