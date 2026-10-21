// The taste bridge for guests: "I love BTS, what should I get?" Qloo knows which places fans of
// BTS love around this branch, and what those places are known for ("Korean fried chicken",
// "bubble tea"). The menu brain's dish concepts (../ai/brain/concepts) map that onto this menu's
// own dishes, as a boost to its ranking, so every allergy, diet and budget filter still applies.
// Only the name the guest typed goes to Qloo; the answer says the taste is fans', not theirs.
import { conceptsOf } from "../ai/brain/concepts";
import { normalize } from "../../shared/brain/text";
import { items, usable, type Runner } from "./client";

export interface TasteHint {
  /** What the guest said they love, as they typed it. */
  liked: string;
  /** Dish id → how strongly fans' favourite places point at it. */
  boost: Record<string, number>;
  /** The tags behind the boost, in Qloo's words ("Korean fried chicken"). */
  because: string[];
}

// "I love BTS", "big fan of Studio Ghibli", "into K-pop", "saya suka Siti Nurhaliza", "我喜欢周杰伦"
const LIKE = [
  /\b(?:i|we)\s+(?:really\s+|absolutely\s+|just\s+)?(?:love|like|adore|enjoy|dig)\s+(.+)/i,
  /\b(?:i'?m|i am|we'?re|we are)\s+(?:a\s+|big\s+|huge\s+|really\s+|so\s+|totally\s+)*(?:fans?\s+of|into|obsessed with|crazy about)\s+(.+)/i,
  /\b(?:big\s+|huge\s+)?fans?\s+of\s+(.+)/i,
  /\b(?:big|huge)\s+(.+?)\s+fan\b/i,
  /\b(?:saya|aku|kami)\s+(?:suka|minat|peminat)\s+(.+)/i,
  /(?:我|我们)(?:很|超|最)?(?:喜欢|爱|迷)(.+)/,
];

/** Words too common to tie a tag to a dish on their own ("chicken" in "Korean Fried Chicken"). */
const GENERIC = new Set("chicken fried rice noodle noodles beef pork lamb fish food restaurant korean japanese chinese thai indian western malaysian style house special place cafe coffee shop drinks drink".split(" "));

/** Words that make it about food (the menu brain's business), not a taste to look up. */
const FOODISH = /\b(food|eat|spicy|spice|sweet|sour|noodles?|rice|nasi|mee|chicken|beef|fish|seafood|prawns?|vegetarian|vegan|halal|dessert|drinks?|coffee|tea|curry|soup|cheap|light|filling|pedas|manis|makan|minum|dish|dishes|menu|cuisine)\b|吃|辣|甜|面|饭|菜|喝|茶|咖啡/i;

/** What the guest says they love, when it's a taste to ask Qloo about (not a dish or a flavour). */
export function likedThing(question: string, menuNames: string[] = []): string | null {
  for (const re of LIKE) {
    const m = question.match(re);
    if (!m) continue;
    // up to the next clause: "I love BTS, what should I eat?" → "BTS"
    const thing = m[1].split(/[,.!?;，。！？]|\b(?:and|so|but|what|which|any|anything|do you|can you|got|ada|apa)\b|什么|有什么|推荐/i)[0].trim().replace(/^(the|a|an)\s+/i, "");
    if (thing.length < 2 || thing.length > 60) return null;
    if (FOODISH.test(thing)) return null;
    const n = normalize(thing);
    if (menuNames.some((d) => normalize(d).includes(n) || n.includes(normalize(d)))) return null;
    return thing;
  }
  return null;
}

/** Ask Qloo which places fans of `liked` love near the branch, and turn their tags into dish boosts. */
export async function tasteHint(run: Runner, menu: { id: string; name: string; description?: string; category?: string }[], liked: string, location: string): Promise<TasteHint | null> {
  const e = await run("qloo_recommend", { target_type: "place", signals: [liked], filter_location: location, limit: 10 });
  if (!usable(e)) return null;
  const places = items(e);
  // each tag (and place name) once per place, weighted by rank: the first place counts most
  const weight = new Map<string, number>();
  places.forEach((p, rank) => {
    for (const t of new Set([...p.tags, p.name])) weight.set(t, (weight.get(t) ?? 0) + 1 / (1 + rank * 0.3));
  });
  const tagConcepts = [...weight].map(([tag, w]) => ({ tag, w, concepts: conceptsOf({ name: tag }), drinkConcepts: conceptsOf({ name: tag, category: "Drinks" }), words: new Set(normalize(tag).split(" ").filter((x) => x.length > 3 && !GENERIC.has(x))) }));
  const boost: Record<string, number> = {};
  const because = new Map<string, number>();
  for (const d of menu) {
    const mine = new Set(conceptsOf(d));
    // concepts read the whole dish; plain words only its name ("Ramen" → Tonkotsu Ramen), since a
    // description's "coconut milk" says little about "Milk Tea"
    const text = new Set(normalize(d.name).split(" "));
    let score = 0;
    for (const t of tagConcepts) {
      const hit = [...t.concepts, ...t.drinkConcepts].some((c) => mine.has(c)) || [...t.words].some((w) => text.has(w));
      if (!hit) continue;
      score += t.w;
      because.set(t.tag, (because.get(t.tag) ?? 0) + t.w);
    }
    if (score > 0) boost[d.id] = Math.round(score * 100) / 100;
  }
  if (!Object.keys(boost).length) return null;
  // the place names themselves aren't a reason a guest would follow; the tags are
  const names = new Set(places.map((p) => p.name));
  const reasons = [...because].filter(([t]) => !names.has(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return { liked, boost, because: reasons.slice(0, 3) };
}
