// What a guest avoids, as a language model reads it from one message (an "avoid hint"). Used by the
// hybrid reader (src/ui/hybrid.ts: Gemini Nano on the device when Chrome has it, a cloud model through
// Firebase AI Logic when it doesn't) and checked here before the menu brain sees it.
//
// The model reads only this: allergens, diets, meats not eaten, no alcohol. It never reads orders,
// prices or dishes. Its reading is added to what the rules read (src/server/ai/brain/hint.ts), never
// put in their place, so it can make an answer more careful but never less safe. Anything outside this
// vocabulary is dropped.
import { ALLERGENS, type Allergen } from "../allergens";

export const HINT_DIETS = ["vegetarian", "vegan", "halal"] as const;
export const HINT_MEATS = ["pork", "beef", "chicken", "lamb", "duck"] as const;
export type HintDiet = (typeof HINT_DIETS)[number];
export type HintMeat = (typeof HINT_MEATS)[number];

export interface AvoidHint {
  allergens: Allergen[];
  diets: HintDiet[];
  meats: HintMeat[];
  alcohol: boolean;
}
/** Where a hint was read: on the guest's device (Gemini Nano in Chrome) or by the cloud model. */
export type HintSource = "on_device" | "in_cloud";

export const EMPTY_HINT: AvoidHint = { allergens: [], diets: [], meats: [], alcohol: false };

/** The JSON schema both models answer in (the cloud model's responseJsonSchema, Chrome's responseConstraint). */
export const HINT_SCHEMA = {
  type: "object",
  properties: {
    allergens: { type: "array", items: { type: "string", enum: [...ALLERGENS] } },
    diets: { type: "array", items: { type: "string", enum: [...HINT_DIETS] } },
    meats: { type: "array", items: { type: "string", enum: [...HINT_MEATS] } },
    alcohol: { type: "boolean" },
  },
  required: ["allergens", "diets", "meats", "alcohol"],
  additionalProperties: false,
} as const;

/** The instruction both models get. Written from the app's own vocabulary and hand-made examples only. */
export const HINT_SYSTEM = `You read one message a guest types to a restaurant's menu assistant in Malaysia (English, Malay, Manglish or Chinese, often with typos). Return what the guest, or anyone they are ordering for, must not be served. Return JSON only.

Fields:
- allergens: from gluten, crustaceans, molluscs, fish, egg, milk, peanuts, tree_nuts, soy, sesame, celery, mustard, sulphites, lupin
- diets: from vegetarian, vegan, halal
- meats: meats they don't eat, from pork, beef, chicken, lamb, duck
- alcohol: true only if they say they don't drink or want no alcohol

Rules:
- Only what they say they or their party can't or won't eat: an allergy, an intolerance, a diet, a religious or personal "I don't eat X". A question about a dish ("does it have egg?") is not a statement. Liking or ordering a food is not avoiding it. "Not allergic", "used to be vegetarian" and people not eating with them don't count.
- shellfish = crustaceans and molluscs. seafood = fish, crustaceans and molluscs. prawn, shrimp, udang, crab, ketam, 虾, 蟹 = crustaceans. squid, sotong, clams, lala, oysters, 鱿鱼 = molluscs. ikan, anchovies, ikan bilis, 鱼 = fish.
- "nuts" = tree_nuts and peanuts. peanut, kacang tanah, 花生, Malay "kacang" alone in an allergy = peanuts. almond, cashew, walnut = tree_nuts.
- dairy, lactose, susu, cheese, 奶 = milk. coeliac, gluten, wheat, gandum, 麸质 = gluten. soya, tauhu as an allergy, 黄豆 = soy. telur, 蛋 = egg. bijan, 芝麻 = sesame.
- vegetarian, vege, 吃素, 吃斋, 素食 = diets vegetarian. vegan = diets vegan. Muslim or halal = diets halal (don't also list pork or alcohol).
- "no pork", "tak makan babi", 不吃猪肉 = meats pork. "no beef" = meats beef. mutton, kambing, goat, 羊 = lamb. pescatarian = all five meats.
- Ignore what isn't in these lists (MSG, garlic, onion, coriander, spicy, sugar, caffeine).
- When nothing is to be avoided, return empty lists and alcohol false.

Examples:
Message: 2 char kway teow, one no cockles cos my wife allergic to shellfish
JSON: {"allergens":["crustaceans","molluscs"],"diets":[],"meats":[],"alcohol":false}
Message: saya tak boleh makan benda laut, nanti gatal satu badan
JSON: {"allergens":["fish","crustaceans","molluscs"],"diets":[],"meats":[],"alcohol":false}
Message: 我们吃斋的，有什么推荐？
JSON: {"allergens":[],"diets":["vegetarian"],"meats":[],"alcohol":false}
Message: does the satay sauce have peanuts? i love peanuts
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}
Message: no beef for my mum pls, and none of us drink
JSON: {"allergens":[],"diets":[],"meats":["beef"],"alcohol":true}`;

/**
 * Version 2 of the instruction, written after a1 showed Gemini Nano reading an avoidance into a third of the
 * messages that state none. Stricter on what counts, says not to add related items, and has more examples
 * of messages that name a food without avoiding it (written here, not taken from any test set).
 */
export const HINT_SYSTEM_V2 = `You read one message a guest types to a restaurant's menu assistant in Malaysia (English, Malay, Manglish or Chinese, often with typos). Return what the guest, or someone eating with them now, says they must not be served. Return JSON only.

Most messages say nothing to avoid. Then return empty lists and alcohol false.

Count something only when the message says they can't, won't or must not eat or drink it: an allergy, an intolerance, a diet they keep, a religion, "I don't eat X", "no X, I'm allergic". Do NOT count:
- a food they order, like, want more of, or ask about ("does it have egg?", "is it halal?", "got prawn?");
- something left off one dish for taste ("no egg on mine", "less sugar");
- something outside the lists below (MSG, onion, garlic, coriander, spicy, sugar, caffeine, durian);
- someone who isn't eating with them, an allergy they had before, "not allergic", "not vegetarian".

List only what is said. Don't add related items: squid is molluscs only, not crustaceans; prawns are crustaceans only; vegetarian or vegan is the diet alone, without meats, egg or milk; Muslim is halal alone. A child at the table is not "no alcohol".

Fields:
- allergens: from gluten, crustaceans, molluscs, fish, egg, milk, peanuts, tree_nuts, soy, sesame, celery, mustard, sulphites, lupin
- diets: from vegetarian, vegan, halal
- meats: from pork, beef, chicken, lamb, duck
- alcohol: true only if they say they don't drink or want no alcohol

Words: shellfish = crustaceans and molluscs. seafood, benda laut = fish, crustaceans and molluscs. prawn, shrimp, udang, crab, ketam, 虾, 蟹 = crustaceans. squid, sotong, clams, lala, oysters, 鱿鱼 = molluscs. ikan, anchovies, 鱼 = fish. "nuts" = tree_nuts and peanuts; kacang, kacang tanah, 花生 = peanuts; almond, cashew, 腰果 = tree_nuts. dairy, lactose, susu, cheese, 奶 = milk. gluten, wheat, gandum = gluten. soya, 黄豆 = soy. telur, 蛋 = egg. bijan, 芝麻 = sesame. vege, 吃素, 吃斋 = vegetarian. "no pork", tak makan babi, 不吃猪肉 = pork. mutton, kambing, 羊 = lamb.

Examples:
Message: 2 char kway teow, one no cockles cos my wife allergic to shellfish
JSON: {"allergens":["crustaceans","molluscs"],"diets":[],"meats":[],"alcohol":false}
Message: saya tak boleh makan benda laut, nanti gatal satu badan
JSON: {"allergens":["fish","crustaceans","molluscs"],"diets":[],"meats":[],"alcohol":false}
Message: 我们吃斋的，有什么推荐？
JSON: {"allergens":[],"diets":["vegetarian"],"meats":[],"alcohol":false}
Message: no beef for my mum pls, and none of us drink
JSON: {"allergens":[],"diets":[],"meats":["beef"],"alcohol":true}
Message: sotong makes my son itchy, what else is good?
JSON: {"allergens":["molluscs"],"diets":[],"meats":[],"alcohol":false}
Message: does the satay sauce have peanuts? i love peanuts
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}
Message: one nasi lemak extra egg, and a milo for my daughter
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}
Message: is the mee rebus halal? and the soup got milk or not
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}
Message: mee goreng tak nak sayur, kurang pedas
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}
Message: 我朋友对虾过敏，不过他今天没来，给我来一碗虾面
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}
Message: what's your most popular fish dish?
JSON: {"allergens":[],"diets":[],"meats":[],"alcohol":false}`;

/** The instructions by version: "v1" as scored on a1, "v2" after it. */
export const HINT_PROMPTS = { v1: HINT_SYSTEM, v2: HINT_SYSTEM_V2 } as const;
export type HintPromptVersion = keyof typeof HINT_PROMPTS;
/** The version in use when none is asked for. */
export const HINT_PROMPT_DEFAULT: HintPromptVersion = "v1";

const pick = <T extends string>(xs: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(xs) ? [...new Set(xs.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x)))] : [];

/** A model's answer checked against the vocabulary: anything else is dropped, never guessed at. */
export function cleanHint(raw: unknown): AvoidHint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return { allergens: pick(r.allergens, ALLERGENS), diets: pick(r.diets, HINT_DIETS), meats: pick(r.meats, HINT_MEATS), alcohol: r.alcohol === true };
}

/** The model's text as a hint (it may wrap the JSON in a code fence); null when it isn't one. */
export function parseHint(text: string): AvoidHint | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return cleanHint(JSON.parse(m[0]));
  } catch {
    return null;
  }
}

export const hintIsEmpty = (h: AvoidHint | null | undefined) => !h || (!h.allergens.length && !h.diets.length && !h.meats.length && !h.alcohol);

/** A hint as flat items ("allergen:fish", "diet:vegan", "meat:pork", "alcohol"), for comparing readings. */
export const hintItems = (h: AvoidHint | null | undefined): string[] =>
  h ? [...h.allergens.map((a) => `allergen:${a}`), ...h.diets.map((d) => `diet:${d}`), ...h.meats.map((m) => `meat:${m}`), ...(h.alcohol ? ["alcohol"] : [])] : [];
