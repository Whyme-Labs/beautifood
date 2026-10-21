// The taste brief: what the people around a branch love, from Qloo's taste graph, set against what
// the restaurant actually sells, turned into things to do this week. One brief chains several Qloo
// workflows (resolve the cuisine to a Qloo tag, then recommend restaurants, music and TV for the
// branch's area, and, when Qloo knows the restaurant itself, its audience). Every finding keeps
// its source, so the owner (or their own AI agent, through MCP) can see why.
import { items, usable, type Envelope, type Runner, type TasteItem, type TasteTool } from "./client";

export interface BriefInput {
  restaurant: string;
  cuisine: string;
  /** Where the branch is, as Qloo reads places ("Bangsar, Kuala Lumpur"). */
  location: string;
  /** The menu, for spotting what neighbours love that it doesn't serve. */
  menu: { name: string; description?: string; category?: string }[];
  /** Best sellers, most sold first. */
  bestSellers: { name: string; qty: number }[];
}

export interface Finding {
  key: "nearby" | "cuisine" | "music" | "tv" | "audience";
  items: TasteItem[];
  /** Which Qloo workflow, with what, so the owner can see where it came from. */
  source: { tool: TasteTool; asked: string; cached?: boolean };
}

export interface Action {
  kind: "special" | "hours" | "playlist" | "theme_night" | "promo" | "watch";
  /** What the console fills its own (translated) sentence with. */
  vars: Record<string, string | number>;
  /** The same in plain English, for the owner's AI agent; names are Qloo's or the menu's own. */
  text: string;
  why: string;
}

export interface TasteBrief {
  location: string;
  generatedAt: number;
  findings: Finding[];
  actions: Action[];
  /** What a brief can't tell you (shown with it, as the kit asks). */
  limits: string[];
  /** Workflows that returned nothing usable, and why. */
  gaps: { tool: TasteTool; asked: string; status: string; summary?: string }[];
}

/** The part of an address Qloo can place: the last two parts that aren't a unit or postcode. */
export function tasteLocation(address: string, fallback = "Kuala Lumpur"): string {
  const parts = address
    .split(/[,\n]/)
    .map((p) => p.replace(/\b\d{5}\b/g, "").trim())
    .filter((p) => p && !/^(no\.?|lot|unit|level|lvl|g-|#)\s*\w/i.test(p) && !/^\d/.test(p));
  return parts.slice(-2).join(", ") || fallback;
}

/** Tags about when a place is open, not what it serves. */
const HOURS = /late[- ]?night|24[- ]?hours?|all[- ]?night|supper|breakfast|brunch|open late|midnight/i;
/** A tag about what's served: Qloo's genre/cuisine/dish tags, or, without an id, anything not a known vibe or amenity. */
const isFoodTag = (name: string, id?: string) =>
  id ? /:(genre|cuisine|dish|offerings?|category):/i.test(id) : !/friendly|parking|wifi|outdoor|seating|view|romantic|cozy|casual|trendy|kid|family|group|reservation|delivery|takeout|vibe|ambience|service|price/i.test(name);

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z一-鿿]+/).filter((w) => w.length > 2));

export async function tasteBrief(run: Runner, input: BriefInput): Promise<TasteBrief> {
  const loc = input.location;
  const gaps: TasteBrief["gaps"] = [];
  const ask = async (key: Finding["key"], tool: TasteTool, args: Record<string, unknown>, asked: string): Promise<Finding | null> => {
    const e: Envelope = await run(tool, args);
    if (usable(e)) return { key, items: items(e).slice(0, 8), source: { tool, asked, cached: e.cached } };
    gaps.push({ tool, asked, status: e.status, summary: e.summary });
    return null;
  };

  // first, the words Qloo needs: the cuisine as a Qloo tag, the restaurant as a Qloo place
  const [cuisineTag, self] = await Promise.all([
    input.cuisine ? run("qloo_find_tags", { query: `${input.cuisine} restaurant`, limit: 3 }) : null,
    run("qloo_describe", { entity: `${input.restaurant} ${loc}`, type: "place" }),
  ]);
  const tag = cuisineTag && usable(cuisineTag) ? items(cuisineTag)[0] : null;
  const known = usable(self) ? items(self)[0] : null;
  if (cuisineTag && !tag) gaps.push({ tool: "qloo_find_tags", asked: `${input.cuisine} restaurant`, status: cuisineTag.status, summary: cuisineTag.summary });

  const found = await Promise.all([
    ask("nearby", "qloo_recommend", { target_type: "place", signal_location: loc, filter_location: loc, limit: 8 }, `places loved around ${loc}`),
    tag ? ask("cuisine", "qloo_recommend", { target_type: "place", signal_location: loc, filter_location: loc, include_tags: [tag.id], limit: 6 }, `${tag.name} places loved around ${loc}`) : null,
    ask("music", "qloo_recommend", known ? { target_type: "artist", signals: [known.id], limit: 8 } : { target_type: "artist", signal_location: loc, limit: 8 }, known ? `artists fans of ${known.name} love` : `artists loved around ${loc}`),
    ask("tv", "qloo_recommend", known ? { target_type: "tv_show", signals: [known.id], limit: 6 } : { target_type: "tv_show", signal_location: loc, limit: 6 }, known ? `shows fans of ${known.name} love` : `shows loved around ${loc}`),
    known ? ask("audience", "qloo_entity_tags", { entities: [known.id], entity_type: "place", limit: 8 }, `what Qloo says ${known.name}'s fans are like`) : null,
  ]);
  const findings = found.filter((f): f is Finding => !!f);
  return { location: loc, generatedAt: Date.now(), findings, actions: actionsFor(input, findings), limits: LIMITS, gaps };
}

const LIMITS = [
  "Qloo describes what an area's or a fan base's tastes lean towards, in aggregate. It is not a count of visits or a prediction about any one guest.",
  "Findings are a starting point for a trial (a weekend special, a playlist, a themed night), to be judged by what then sells.",
];

/** From findings to things to do, each with the finding that suggested it. */
export function actionsFor(input: BriefInput, findings: Finding[]): Action[] {
  const out: Action[] = [];
  const by = (k: Finding["key"]) => findings.find((f) => f.key === k);
  const menuWords = words(input.menu.map((m) => `${m.name} ${m.description ?? ""} ${m.category ?? ""}`).join(" "));

  // tags the area's favourite places share (each place counted once): a cuisine or dish the menu
  // doesn't touch is a special to trial; "late night", "breakfast" and the like are about hours
  const seen = new Set<string>();
  const nearby = [...(by("nearby")?.items ?? []), ...(by("cuisine")?.items ?? [])].filter((p) => !seen.has(p.id) && seen.add(p.id));
  const tagCount = new Map<string, { n: number; id?: string }>();
  for (const it of nearby) it.tags.forEach((t, i) => tagCount.set(t, { n: (tagCount.get(t)?.n ?? 0) + 1, id: it.tagIds[i] }));
  const shared = [...tagCount].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n);
  const hours = shared.find(([t]) => HOURS.test(t));
  const food = shared.filter(([t, v]) => !HOURS.test(t) && isFoodTag(t, v.id) && ![...words(t)].some((w) => menuWords.has(w))).slice(0, 2);
  for (const [t, { n }] of food)
    out.push({ kind: "special", vars: { tag: t, count: n, location: input.location }, text: `Trial a weekend special around "${t}".`, why: `${n} of the places people around ${input.location} love are known for it, and nothing on your menu is.` });
  if (hours) out.push({ kind: "hours", vars: { tag: hours[0], count: hours[1].n }, text: `Try opening for "${hours[0].toLowerCase()}" on your busiest night.`, why: `${hours[1].n} of the places people around ${input.location} love are known for it.` });

  const top = input.bestSellers[0];
  if (top) out.push({ kind: "promo", vars: { dish: top.name, qty: top.qty }, text: `Lead your promotions with ${top.name}.`, why: `It's what already sells best here (${top.qty} in the last 30 days).` });

  const music = by("music")?.items ?? [];
  if (music.length) {
    const artists = music.slice(0, 4).map((a) => a.name).join(", ");
    out.push({ kind: "playlist", vars: { artists }, text: `Build your dining-room playlist around ${artists}.`, why: `Qloo: ${by("music")!.source.asked}.` });
  }

  const tv = by("tv")?.items ?? [];
  if (tv.length) out.push({ kind: "theme_night", vars: { show: tv[0].name }, text: `Try a ${tv[0].name} night: a themed set menu and a screening.`, why: `Qloo: ${by("tv")!.source.asked}.` });

  const cuisine = by("cuisine")?.items ?? [];
  if (cuisine.length) {
    const places = cuisine.slice(0, 3).map((p) => p.name).join(", ");
    out.push({ kind: "watch", vars: { places, cuisine: input.cuisine }, text: `Keep an eye on ${places}.`, why: `Qloo: ${by("cuisine")!.source.asked}.` });
  }
  return out;
}
