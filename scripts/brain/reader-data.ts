// The readers' training data (see ./train-reader.ts): each reader's own utterances, written from
// scratch for it, never from a benchmark, and the intent model's templates mapped to its labels.
//  - kind (./reader-templates.json): about the food, the restaurant's service, or small talk
//  - followup (./followup-templates.json): a new request, about the dishes just shown, about the one
//    dish being talked about, or the bill
import { readFileSync } from "node:fs";
import { hash } from "../../src/shared/brain/text";
import { FILLERS, TEMPLATES } from "./data";

// as in src/server/ai/brain/reader.ts (the weights carry them, so the two can't drift apart unseen)
export const KINDS = ["food", "service", "smalltalk"] as const;
export type Kind = (typeof KINDS)[number];

export const OWN: Record<Kind, string[]> = JSON.parse(readFileSync(new URL("./reader-templates.json", import.meta.url), "utf8"));
const FROM_INTENT: Record<string, Kind> = {
  recommend: "food", dish_allergen: "food", dish_info: "food", compare: "food", pairing: "food", group: "food", refine: "food",
  order_help: "service", about: "service", greeting: "smalltalk", thanks: "smalltalk", out_of_scope: "smalltalk",
};
export const templates: Record<Kind, string[]> = { food: [], service: [], smalltalk: [] };
for (const k of KINDS) templates[k].push(...OWN[k]);
for (const [intent, ts] of Object.entries(TEMPLATES)) templates[FROM_INTENT[intent]].push(...ts);

export const readerDataHash = () => hash(JSON.stringify([OWN, TEMPLATES, FILLERS])).toString(16);

export const REFERS = ["new", "those", "that", "bill"] as const;
export type Refers = (typeof REFERS)[number];

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const FOLLOWUP_OWN: Record<Refers, string[]> = read("./followup-templates.json");
// the intent model's templates: "which of those…" is about the dishes shown, "is it spicy" about the
// one dish, and anything else (a dish named, or none needed) a new request
const PRONOUN = /\b(it|that|this|that one|this one)\b|这个|那个/;
export const followupTemplates: Record<Refers, string[]> = { new: [], those: [], that: [], bill: [] };
for (const k of REFERS) followupTemplates[k].push(...FOLLOWUP_OWN[k]);
for (const [intent, ts] of Object.entries(TEMPLATES))
  for (const t of ts) followupTemplates[intent === "refine" ? "those" : !t.includes("{d") && PRONOUN.test(t) && ["dish_info", "dish_allergen", "pairing", "compare"].includes(intent) ? "that" : "new"].push(t);

export const followupDataHash = () => hash(JSON.stringify([FOLLOWUP_OWN, TEMPLATES, FILLERS])).toString(16);

/** What each reader is trained on, and where its weights go. */
export const READERS = {
  kind: { labels: KINDS, templates, hash: readerDataHash, out: "reader.gen.ts", constant: "READER_WEIGHTS", seed: 23 },
  followup: { labels: REFERS, templates: followupTemplates, hash: followupDataHash, out: "followup.gen.ts", constant: "FOLLOWUP_WEIGHTS", seed: 29 },
} as const;
