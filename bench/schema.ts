// The guest assistant benchmark: what a case is. Each case is a guest's question (with any earlier
// turns) about one menu, and what must hold of the answer. Checks are about facts in the menu data
// (the dishes shown and what they contain), never about wording, so any engine can be scored.

export type Lang = "en" | "zh";

/** What the case exercises (several may apply). */
export type Tag =
  | "recommend" | "signature" | "diet" | "allergy" | "dish_allergen" | "spice" | "budget" | "course"
  | "combined" | "dish_info" | "compare" | "pairing" | "group" | "followup" | "memory" | "not_on_menu"
  | "search" | "service" | "smalltalk" | "off_topic" | "adversarial"
  | "typo" | "manglish" | "malay" | "chinese" | "mixed"
  | "easy" | "medium" | "hard";

export type Allergen = "gluten" | "crustaceans" | "molluscs" | "fish" | "egg" | "milk" | "peanuts" | "tree_nuts" | "soy" | "sesame" | "celery" | "mustard" | "sulphites" | "lupin";

export interface Expect {
  /** No dish shown may contain any of these (per the menu's data). A safety check. */
  avoid?: Allergen[];
  /** Every dish shown must be vegetarian (or vegan) / vegan / halal per the menu's data. A safety check. */
  vegetarian?: boolean;
  vegan?: boolean;
  /** Every dish shown has spice level at most / at least this (0 = not spicy, 3 = very). */
  maxSpice?: number;
  minSpice?: number;
  /** Every dish shown costs at most this, in sen (RM10 = 1000). */
  maxPrice?: number;
  /** The dishes shown cost at most this in total, in sen (a group's budget). */
  maxTotal?: number;
  /** Every dish shown is from a category whose name matches this (case-insensitive regex source), e.g. "drink". */
  category?: string;
  /** Dish names the answer must show, all of them / at least one of them. Exact names from the menu. */
  includes?: string[];
  includesAny?: string[];
  /** Dish names the answer must not show. */
  excludes?: string[];
  /** Every dish shown must be one of these (a follow-up about earlier dishes). */
  onlyFrom?: string[];
  /** How many dishes the answer shows. */
  minDishes?: number;
  maxDishes?: number;
  /** The answer must show no dishes (service questions, thanks). */
  noDishes?: boolean;
  /** The answer's text must match each of these (case-insensitive regex source). Use sparingly, for facts. */
  says?: string[];
  /** The answer must carry the allergen safety note. */
  safetyNote?: boolean;
}

export interface Case {
  /** Unique, e.g. "bubbletea-031". */
  id: string;
  /** Which menu (bench/menus/<menu>.txt). */
  menu: string;
  /** "test" is frozen and only ever reported; "dev" is for iterating. */
  split: "test" | "dev";
  /** The language the guest reads replies in. */
  lang: Lang;
  tags: Tag[];
  /** Earlier turns, oldest first: what the guest said and what the assistant replied. */
  before?: { user: string; assistant: string }[];
  question: string;
  expect: Expect;
  /** Why this expectation is right, in a few words (for reviewers). */
  note?: string;
}
