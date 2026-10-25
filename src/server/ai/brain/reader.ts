// The reader: a second small model, of the intent model's shape, that tells what kind of message a
// guest sent: about the food, about the restaurant's service (paying, delivery, bookings, the
// kitchen's halal certificate) or small talk ("hola!", "grazie", the football). The rules decide
// what to show; the reader stops a message that isn't about the food from being answered with
// dishes. Trained offline (scripts/brain/train-reader.ts), shipped as int8 weights. (A follow-up
// reader, trained the same way, changed no answer on v6 and isn't shipped: bench/CHANGES.md.)
import { classify, loadModel, type IntentModel } from "../../../shared/brain/intentModel";
import { READER_WEIGHTS } from "../../../shared/brain/reader.gen";

export const KINDS = ["food", "service", "smalltalk"] as const;
export type Kind = (typeof KINDS)[number];

let model: IntentModel | null = null;

/** The share of the words (not dish names) the reader learnt. */
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

