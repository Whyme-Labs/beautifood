// The reader: a second small model, of the intent model's shape, that tells what kind of message a
// guest sent: about the food, about the restaurant's service (paying, delivery, bookings, the
// kitchen's halal certificate) or small talk ("hola!", "grazie", the football). The rules decide
// what to show; the reader stops a message that isn't about the food from being answered with
// dishes. Trained offline (scripts/brain/train-reader.ts), shipped as int8 weights.
import { classify, loadModel, type IntentModel } from "../../../shared/brain/intentModel";
import { READER_WEIGHTS } from "../../../shared/brain/reader.gen";

export const KINDS = ["food", "service", "smalltalk"] as const;
export type Kind = (typeof KINDS)[number];

let model: IntentModel | null = null;

/** What kind of message the tokens (as the intent model reads them) are, and how sure. */
export function kindOf(toks: string[]): { kind: Kind; p: number } {
  const g = classify((model ??= loadModel(READER_WEIGHTS)), toks);
  return { kind: g.intent as unknown as Kind, p: g.confidence };
}
