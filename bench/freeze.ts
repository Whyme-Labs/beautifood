// The fingerprint of the frozen test split: it must match bench/CHANGES.md.
import { createHash } from "node:crypto";
import { loadCases } from "./run";

const cases = loadCases("test").sort((a, b) => a.id.localeCompare(b.id));
const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v);
console.log(cases.length, createHash("sha256").update(JSON.stringify(sorted(cases))).digest("hex").slice(0, 16));
