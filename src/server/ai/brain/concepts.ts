// Dish concepts: what a dish is, in words every restaurant shares ("curry noodles", "iced citrus",
// "milk tea"), so pairings learnt at one restaurant help another. A dish maps to concepts from
// its name, description and course; the platform learns which concepts guests order together
// (./platform), starting from the teacher's prior below until there are orders to learn from.

export type ConceptId = string;

/** Most specific first: a dish keeps at most its first three matches. Drinks only match drinks. */
const FOOD: [ConceptId, RegExp][] = [
  ["curry_noodles", /curry mee|curry laksa|laksa lemak|curry noodle|kari mee|咖喱面|娘惹叻沙/i],
  ["sour_noodles", /assam laksa|asam laksa|penang laksa|叻沙/i],
  ["fried_noodles", /kway teow|kuey teow|mee goreng|mi goreng|pad thai|fried noodle|hokkien mee|maggi goreng|yaki ?soba|japchae|char kway|炒粿条|炒面|炒河粉/i],
  ["noodle_soup", /wonton noodle|wanton mee|ramen|\bpho\b|noodle soup|\budon\b|\bsoba\b|pan mee|拉面|云吞面/i],
  ["pasta", /spaghetti|pasta|penne|carbonara|aglio|lasagn|marinara|fettuccine|linguine/i],
  ["coconut_rice", /nasi lemak|coconut rice|椰浆饭/i],
  ["chicken_rice", /chicken rice|nasi ayam|鸡饭/i],
  ["fried_rice", /fried rice|nasi goreng|yang ?chow|炒饭/i],
  ["rice_bowl", /\bdon\b|donburi|bibimbap|rice bowl|poke|biryani|briyani|nasi kandar|nasi kerabu|nasi ulam|risotto|basil .*rice|饭/i],
  ["curry", /curry|\bkari\b|rendang|massaman|kapitan|\bdhal\b|\bdal\b|咖喱/i],
  ["spicy_soup", /tom yum|jjigae|asam pedas|sour spicy|冬阴功|泡菜汤/i],
  ["skewers", /satay|\bsate\b|yakitori|skewer|沙爹/i],
  ["grilled_meat", /\bbbq\b|barbecue|char siu|bulgogi|galbi|samgyeopsal|roast duck|roast pork|siu yuk|steak|grilled (chicken|beef|lamb|pork)|叉烧|烧鸭/i],
  ["fried_chicken", /fried chicken|ayam goreng|katsu|karaage|chicken wings|rempah|炸鸡/i],
  ["burger", /burger|汉堡/i],
  ["pizza", /pizza|margherita|pepperoni|formaggi|diavola|披萨/i],
  ["dim_sum", /har gow|siu mai|\bbao\b|dumpling|gyoza|chee cheong fun|turnip cake|lo mai gai|wonton|虾饺|烧卖|包|饺/i],
  ["flatbread", /\broti\b|thosai|dosa|\bnaan\b|murtabak|paratha|chapati|印度煎饼/i],
  ["salad", /salad|rojak|som tam|kerabu|沙拉/i],
  ["seafood", /prawn|\bfish\b|squid|\bcrab\b|salmon|seafood|udang|\bikan\b|sotong|mussel|unagi|\beel\b|tuna|sashimi|sushi|海鲜|鱼|虾/i],
  ["egg_breakfast", /eggs benedict|big breakfast|shakshuka|half.boiled|kaya|pancake|french toast|avocado toast|\btoast\b|早餐|吐司/i],
  ["fries", /\bfries\b|\bchips\b|hash brown|薯条/i],
  ["bread_side", /garlic bread|bruschetta|focaccia/i],
  ["kuih", /\bkuih\b|onde|pulut|lapis|kueh|糕/i],
  ["shaved_ice", /cendol|ais kacang|\babc\b|bingsu|tub tim|shaved ice|煎蕊|红豆冰/i],
  ["cake", /(?<!turnip |radish |fish |pan|rice )cake|cheesecake|tiramisu|brownie|lava|蛋糕/i],
  ["cold_sweet", /ice cream|gelato|panna cotta|pudding|sago|mochi|sticky rice|red bean soup|tong sui|egg tart|糖水|甜品|蛋挞|杨枝甘露/i],
];

const DRINKS: [ConceptId, RegExp][] = [
  ["milk_tea", /teh tarik|milk tea|thai iced tea|\bteh\b(?! o)|calpis|bubble tea|奶茶|拉茶/i],
  ["coffee", /\bkopi\b|coffee|latte|espresso|flat white|mocha|cold brew|cappuccino|americano|咖啡/i],
  ["iced_citrus", /\blime\b|limau|lemon|calamansi|yuzu|citron|lemonade|orange juice|柠檬|酸柑/i],
  ["herbal_cooler", /barley|chrysanthemum|lemongrass|coconut water|sugarcane|air kelapa|soy milk|green tea|chinese tea|jasmine|pu.?erh|matcha|kombucha|watermelon|juice|\bjus\b|菊花|薏米|豆浆|绿茶|中国茶/i],
  ["sweet_milk", /milo|banana milk|chocolate|bandung|sirap|rose syrup|美禄/i],
  ["soda", /soda|sparkling|\bcola\b|soft drink|汽水/i],
  ["alcohol", /\bbeer\b|wine|\bsake\b|soju|cocktail|啤酒|红酒/i],
];

export const isDrinkCourse = (category = "") => /drink|beverage|minum|饮|juice|coffee|\btea\b|kopi|teh/i.test(category);

/** The concepts a guest's words name, with the words that named them ("pizza", "iced lime"). */
export function conceptTerms(text: string): { id: ConceptId; term: string }[] {
  const out: { id: ConceptId; term: string }[] = [];
  for (const [id, re] of [...FOOD, ...DRINKS]) {
    const m = text.match(re);
    if (m && !out.some((o) => o.id === id)) out.push({ id, term: m[0] });
  }
  return out;
}

/** The concepts a dish belongs to (at most three, most specific first). */
export function conceptsOf(d: { name: string; description?: string; category?: string }): ConceptId[] {
  const drink = isDrinkCourse(d.category);
  // the name decides first; the description only adds what the name doesn't say
  const byName = (drink ? DRINKS : FOOD).filter(([, re]) => re.test(d.name)).map(([c]) => c);
  const byText = (drink ? DRINKS : FOOD).filter(([c, re]) => !byName.includes(c) && re.test(`${d.description ?? ""} ${d.category ?? ""}`)).map(([c]) => c);
  return [...byName, ...byText].slice(0, 3);
}

/**
 * What the teacher knows pairs well, as a lift (how much likelier guests are to order the two
 * together than apart), before any orders exist. Symmetric. 1 means no opinion.
 */
const PRIOR: [ConceptId, ConceptId, number][] = [
  ["coconut_rice", "milk_tea", 2.2], ["coconut_rice", "coffee", 1.8], ["coconut_rice", "shaved_ice", 1.4], ["coconut_rice", "iced_citrus", 1.4],
  ["flatbread", "milk_tea", 2.4], ["flatbread", "coffee", 1.8], ["flatbread", "curry", 2.0],
  ["curry_noodles", "iced_citrus", 2.0], ["curry_noodles", "herbal_cooler", 1.8], ["curry_noodles", "milk_tea", 1.5], ["curry_noodles", "shaved_ice", 1.6],
  ["sour_noodles", "herbal_cooler", 1.8], ["sour_noodles", "iced_citrus", 1.6], ["sour_noodles", "shaved_ice", 1.6],
  ["fried_noodles", "iced_citrus", 1.8], ["fried_noodles", "herbal_cooler", 1.6], ["fried_noodles", "milk_tea", 1.4], ["fried_noodles", "shaved_ice", 1.5],
  ["noodle_soup", "herbal_cooler", 1.5], ["noodle_soup", "dim_sum", 1.6],
  ["chicken_rice", "herbal_cooler", 1.8], ["chicken_rice", "iced_citrus", 1.6],
  ["fried_rice", "iced_citrus", 1.6], ["fried_rice", "herbal_cooler", 1.4],
  ["rice_bowl", "herbal_cooler", 1.5], ["rice_bowl", "milk_tea", 1.3],
  ["curry", "iced_citrus", 1.6], ["curry", "milk_tea", 1.5], ["curry", "herbal_cooler", 1.4],
  ["spicy_soup", "herbal_cooler", 1.8], ["spicy_soup", "cold_sweet", 1.5], ["spicy_soup", "iced_citrus", 1.5],
  ["skewers", "herbal_cooler", 1.6], ["skewers", "iced_citrus", 1.6], ["skewers", "alcohol", 1.8],
  ["grilled_meat", "alcohol", 2.0], ["grilled_meat", "herbal_cooler", 1.6],
  ["fried_chicken", "soda", 1.8], ["fried_chicken", "alcohol", 1.8], ["fried_chicken", "iced_citrus", 1.5], ["fried_chicken", "fries", 1.6],
  ["burger", "fries", 2.4], ["burger", "soda", 2.0], ["burger", "iced_citrus", 1.4],
  ["pizza", "soda", 1.8], ["pizza", "alcohol", 1.8], ["pizza", "bread_side", 1.6], ["pizza", "salad", 1.4],
  ["pasta", "alcohol", 1.8], ["pasta", "bread_side", 1.8], ["pasta", "salad", 1.4], ["pasta", "soda", 1.3],
  ["dim_sum", "herbal_cooler", 2.2], ["dim_sum", "cold_sweet", 1.4],
  ["seafood", "iced_citrus", 1.6], ["seafood", "alcohol", 1.6],
  ["egg_breakfast", "coffee", 2.4], ["egg_breakfast", "iced_citrus", 1.6], ["egg_breakfast", "milk_tea", 1.6],
  ["kuih", "coffee", 2.0], ["kuih", "milk_tea", 2.0],
  ["cake", "coffee", 2.2], ["cake", "milk_tea", 1.6], ["cold_sweet", "coffee", 1.6],
  ["salad", "iced_citrus", 1.4], ["fries", "soda", 1.6],
];

const priorMap = new Map<string, number>();
for (const [a, b, l] of PRIOR) {
  priorMap.set(`${a}|${b}`, l);
  priorMap.set(`${b}|${a}`, l);
}

export const priorLift = (a: ConceptId, b: ConceptId) => priorMap.get(`${a}|${b}`) ?? 1;

/** Concept co-orders across every restaurant, past the privacy threshold (see ./platform). */
export interface PlatformPairs {
  totalOrders: number;
  /** Orders holding each concept. */
  orders: Record<ConceptId, number>;
  /** Orders holding both, keyed "a|b" (both directions). */
  pairs: Record<string, number>;
}

/** Pseudo-orders the prior is worth: real data overrules it once a concept has a few dozen orders. */
const PRIOR_WEIGHT = 30;

/**
 * How much likelier guests are to order concept b with concept a, across all restaurants:
 * the platform's counts, shrunk towards the teacher's prior when they are thin.
 */
export function conceptLift(a: ConceptId, b: ConceptId, platform?: PlatformPairs): { lift: number; learnt: boolean } {
  const prior = priorLift(a, b);
  const na = platform?.orders[a] ?? 0;
  const nb = platform?.orders[b] ?? 0;
  const total = platform?.totalOrders ?? 0;
  if (!total || !na || !nb) return { lift: prior, learnt: false };
  const pb = nb / total;
  const together = platform!.pairs[`${a}|${b}`] ?? 0;
  return { lift: (together + PRIOR_WEIGHT * prior * pb) / (na + PRIOR_WEIGHT) / pb, learnt: together > 0 };
}

/** The best concept-level lift between two dishes, and whether real orders (not the prior) set it. */
export function dishConceptLift(a: ConceptId[], b: ConceptId[], platform?: PlatformPairs): { lift: number; learnt: boolean } {
  let best = { lift: 1, learnt: false };
  for (const x of a) for (const y of b) {
    const l = conceptLift(x, y, platform);
    if (l.lift > best.lift) best = l;
  }
  return best;
}
