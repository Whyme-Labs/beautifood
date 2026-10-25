// The reader's training data (see ./train-reader.ts): its own utterances (./reader-templates.json,
// written from scratch, never from a benchmark) and the intent model's templates, mapped to the
// three kinds of message.
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
