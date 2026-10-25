// The readers: small models of the intent model's shape, each answering one question about a
// guest's message. The kind reader: about the food, about the restaurant's service (paying,
// delivery, bookings, the kitchen's halal certificate) or small talk ("hola!", "grazie", the
// football), so a message that isn't about the food isn't answered with dishes. The follow-up
// reader: a new request, about the dishes just shown ("the cheaper one got prawns?"), about the one
// dish being talked about ("is it spicy?"), or the bill ("so how much for everything?"). The rules
// decide what to show; a reader fills in where their word lists miss a phrasing. Trained offline
// (scripts/brain/train-reader.ts), shipped as int8 weights.
import { classify, loadModel, type IntentModel } from "../../../shared/brain/intentModel";
import { READER_WEIGHTS } from "../../../shared/brain/reader.gen";
import { FOLLOWUP_WEIGHTS } from "../../../shared/brain/followup.gen";

export const KINDS = ["food", "service", "smalltalk"] as const;
export type Kind = (typeof KINDS)[number];

export const REFERS = ["new", "those", "that", "bill"] as const;
export type Refers = (typeof REFERS)[number];

let model: IntentModel | null = null;
let followup: IntentModel | null = null;

/** The share of the words (not dish names) a reader learnt. */
const knownShare = (m: IntentModel, toks: string[]) => {
  const words = toks.filter((t) => !t.startsWith("§"));
  return words.length ? words.filter((t) => m.vocab?.has(t)).length / words.length : 1;
};

/**
 * What kind of message the tokens (as the intent model reads them) are, and how sure. `known` is
 * the share of its words the reader learnt: "got har gow or siu mai?" is mostly dish names it has
 * never seen, so what it makes of the rest says little.
 */
export function kindOf(toks: string[]): { kind: Kind; p: number; known: number } {
  const m = (model ??= loadModel(READER_WEIGHTS));
  const g = classify(m, toks);
  return { kind: g.intent as unknown as Kind, p: g.confidence, known: knownShare(m, toks) };
}

/** What the message refers to: a new request, the dishes just shown, the one dish, or the bill. */
export function refersOf(toks: string[]): { refers: Refers; p: number; known: number } {
  const m = (followup ??= loadModel(FOLLOWUP_WEIGHTS));
  const g = classify(m, toks);
  return { refers: g.intent as unknown as Refers, p: g.confidence, known: knownShare(m, toks) };
}
