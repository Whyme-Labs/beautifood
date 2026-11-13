// Scoring an avoid reading against its gold (the a1 set, bench/avoid/): did it miss anything the
// guest said to avoid, and did it add anything they didn't? A stricter reading covers a looser one
// (vegan covers vegetarian, egg and milk; vegetarian covers every meat, fish and shellfish; halal
// covers pork and alcohol), so it is never "missed", and what a gold item implies is never "extra".
import { hintItems, type AvoidHint } from "./avoidHint";

const MEATS = ["meat:pork", "meat:beef", "meat:chicken", "meat:lamb", "meat:duck"];
const IMPLIES: Record<string, string[]> = {
  "diet:vegan": ["diet:vegetarian", "allergen:egg", "allergen:milk", ...MEATS, "allergen:fish", "allergen:crustaceans", "allergen:molluscs"],
  "diet:vegetarian": [...MEATS, "allergen:fish", "allergen:crustaceans", "allergen:molluscs"],
  "diet:halal": ["meat:pork", "alcohol"],
};
/** A set of items with everything they imply. */
export function covers(items: string[]): Set<string> {
  const out = new Set(items);
  for (const x of items) for (const y of IMPLIES[x] ?? []) out.add(y);
  return out;
}

export interface AvoidCase {
  id: string;
  lang: "en" | "ms" | "manglish" | "zh";
  text: string;
  gold: { allergens: string[]; diets: string[]; meats: string[]; alcohol: boolean };
  kind: "states" | "none";
}
export interface AvoidMark {
  /** A stating message where the reading misses some of the gold. */
  missed: boolean;
  /** A message stating nothing where the reading adds something. */
  falseAlarm: boolean;
  /** Items read beyond the gold and what it implies. */
  extra: string[];
}

export function mark(c: AvoidCase, read: string[]): AvoidMark {
  const gold = hintItems(c.gold as AvoidHint);
  const got = covers(read);
  const allowed = covers(gold);
  return {
    missed: gold.length > 0 && gold.some((g) => !got.has(g)),
    falseAlarm: gold.length === 0 && read.length > 0,
    extra: read.filter((x) => !allowed.has(x)),
  };
}

export interface AvoidTally {
  stating: number;
  none: number;
  missed: number;
  falseAlarms: number;
  extra: number;
}
export function tally(cases: AvoidCase[], marks: AvoidMark[]): AvoidTally {
  const t: AvoidTally = { stating: 0, none: 0, missed: 0, falseAlarms: 0, extra: 0 };
  cases.forEach((c, k) => {
    const m = marks[k];
    if (hintItems(c.gold as AvoidHint).length) t.stating++;
    else t.none++;
    if (m.missed) t.missed++;
    if (m.falseAlarm) t.falseAlarms++;
    if (m.extra.length) t.extra++;
  });
  return t;
}
