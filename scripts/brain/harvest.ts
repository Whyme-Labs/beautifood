// Picks the guest questions worth teaching the brain from the assistant's log: bills whose order the
// guest fixed in the order card (order_final: what they meant, beside what it read), ones it wasn't sure
// of, called off-topic, answered with dishes nobody added, or that the model reader read differently
// from the rules (engine "…+reader-differs": the reading the next owned reader most needs to learn). Writes them for labelling
// (./label.ts). The log holds questions only as the model read them (dish names as §dish).
//
// Get a dump of the log (production, last 30 days):
//   npx wrangler d1 execute beautifood-app-db --remote --json \
//     --command "SELECT question, lang, intent, confidence, confident, engine, shown, added, order_read, order_final FROM assistant_turns WHERE created_at > (strftime('%s','now') - 30*86400) * 1000" > turns.json
// or locally: npx void db execute "<the same SELECT>" (and save its rows as JSON).
// Then:
//   npx tsx scripts/brain/harvest.ts turns.json [scripts/brain/to-label.json]
import { readFileSync, writeFileSync } from "node:fs";
import { asReadText, protectedQuestions } from "./evalsets";
import { HARVESTED } from "./data";

interface Row {
  question: string;
  lang: string;
  intent: string;
  confidence: number;
  confident: number;
  engine?: string;
  shown: string;
  added: string;
  order_read?: string | null;
  order_final?: string | null;
}

export interface ToLabel {
  question: string;
  lang: string;
  /** What the brain read it as, and why it's here. */
  intent: string;
  reason: "corrected" | "unsure" | "off_topic" | "not_added" | "readers_differ";
  count: number;
  /** For a bill the guest fixed: the order it read, and theirs. */
  read?: unknown;
  meant?: unknown;
}

/** wrangler --json gives [{ results: [...] }]; a plain array of rows works too. */
export function rowsOf(dump: unknown): Row[] {
  if (Array.isArray(dump) && dump.length && typeof dump[0] === "object" && dump[0] && "results" in dump[0]) return (dump as { results: Row[] }[]).flatMap((d) => d.results);
  return dump as Row[];
}

export function harvest(rows: Row[]): ToLabel[] {
  const guarded = protectedQuestions();
  const known = new Set(HARVESTED.map((h) => asReadText(h.text)));
  const picked = new Map<string, ToLabel>();
  for (const r of rows) {
    const q = asReadText(r.question);
    if (!q || q.length < 2 || guarded.has(q) || known.has(q)) continue;
    const shown = JSON.parse(r.shown || "[]") as string[];
    const added = JSON.parse(r.added || "[]") as string[];
    // (a fixed bill is the plainest label there is: what was said, what it read, what they meant)
    const corrected = !!r.order_read && !!r.order_final && r.order_read !== r.order_final;
    const reason: ToLabel["reason"] | null = corrected ? "corrected" :
      r.intent === "out_of_scope" ? "off_topic" : !r.confident || r.confidence < 600 ? "unsure" : r.engine?.endsWith("+reader-differs") ? "readers_differ" : r.intent === "recommend" && shown.length && !added.length ? "not_added" : null;
    if (!reason) continue;
    const hit = picked.get(q);
    if (hit) hit.count++;
    else picked.set(q, { question: q, lang: r.lang, intent: r.intent, reason, count: 1, ...(corrected ? { read: JSON.parse(r.order_read!), meant: JSON.parse(r.order_final!) } : {}) });
  }
  // fixed bills first, then the most asked: one fix there helps the most guests
  return [...picked.values()].sort((a, b) => Number(b.reason === "corrected") - Number(a.reason === "corrected") || b.count - a.count);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output = "scripts/brain/to-label.json"] = process.argv.slice(2);
  if (!input) {
    console.error("usage: npx tsx scripts/brain/harvest.ts turns.json [to-label.json]");
    process.exit(2);
  }
  const out = harvest(rowsOf(JSON.parse(readFileSync(input, "utf8"))));
  writeFileSync(output, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${out.length} questions to label → ${output}`);
}
