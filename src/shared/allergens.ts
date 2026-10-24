// Allergen & dietary inference from free text (used by the onboarding copilot and
// as a safety cross-check). Merchant review is always required before publish.

export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "molluscs",
  "fish",
  "egg",
  "milk",
  "peanuts",
  "tree_nuts",
  "soy",
  "sesame",
  "celery",
  "mustard",
  "sulphites",
  "lupin",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten (wheat)",
  crustaceans: "Crustaceans (prawn, crab)",
  molluscs: "Molluscs (squid, clams)",
  fish: "Fish",
  egg: "Egg",
  milk: "Milk / dairy",
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  soy: "Soy",
  sesame: "Sesame",
  celery: "Celery",
  mustard: "Mustard",
  sulphites: "Sulphites",
  lupin: "Lupin",
};

const KEYWORDS: Record<Allergen, string[]> = {
  gluten: ["wheat", "flour", "noodle", "mee", "bread", "toast", "pasta", "spaghetti", "bun", "roti", "dumpling", "wonton", "batter", "battered", "breaded", "breadcrumbs", "panko", "tempura", "katsu", "cake", "pastry", "pastries", "croissant", "brioche", "bagel", "muffin", "sourdough", "crouton", "semolina", "couscous", "bulgur", "rye", "spelt", "seitan", "naan", "chapati", "paratha", "murtabak", "pau", "bao", "barley", "malt", "milo", "oat", "oats", "granola", "cereal", "beer", "soy sauce", "dark soy", "light soy", "sweet soy", "soy tare", "tare", "teriyaki", "shoyu", "kicap", "hoisin", "okonomi", "gochujang", "pancake", "waffle", "biscuit", "cookie", "cracker", "pizza", "udon", "ramen", "soba", "oyster sauce", "shaoxing", "hua tiao", "asafoetida", "hing", "maggi seasoning", "baguette", "toastie", "chashu", "ajitama", "takoyaki sauce"],
  crustaceans: ["prawn", "shrimp", "crab", "lobster", "crayfish", "udang", "belacan", "har gow", "langoustine", "cincalok", "hae bee", "heh bee", "rebon", "krill"],
  molluscs: ["squid", "sotong", "octopus", "clam", "lala", "mussel", "oyster", "scallop", "cockle", "kerang", "abalone", "calamari", "escargot", "geoduck"],
  fish: ["fish", "ikan", "salmon", "tuna", "anchovy", "anchovies", "ikan bilis", "cod", "mackerel", "sardine", "fish sauce", "bonito", "katsuobushi", "dashi", "otak-otak", "seabass", "snapper", "pomfret", "eel", "unagi", "saba", "kembung", "roe", "ikura", "tobiko", "caviar", "surimi", "keropok lekor", "budu", "worcestershire", "tilapia", "grouper", "garoupa", "barramundi", "siakap", "tenggiri", "catfish", "keli", "patin", "trout", "sea bream", "carp", "halibut", "sardin", "nuoc cham", "nuoc mam", "niboshi", "takoyaki sauce"],
  egg: ["egg", "telur", "mayo", "mayonnaise", "custard", "meringue", "omelette", "kaya", "aioli", "hollandaise", "carbonara", "tamago", "tamagoyaki", "pavlova", "cheesecake"],
  milk: ["milk", "milkshake", "buttermilk", "dairy", "cheese", "cheesy", "cheesecake", "butter", "buttery", "buttercream", "cream", "creamy", "creamer", "yogurt", "yoghurt", "ghee", "condensed", "latte", "cappuccino", "susu", "paneer", "whey", "ice cream", "gelato", "mozzarella", "parmesan", "feta", "ricotta", "mascarpone", "burrata", "halloumi", "hollandaise", "bechamel", "carbonara", "custard", "lassi", "kulfi", "teh tarik", "milo", "curd", "paneer"],
  peanuts: ["peanut", "groundnut", "kacang", "satay sauce", "satay"],
  tree_nuts: ["almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "macadamia", "praline", "marzipan", "candlenut", "pine nut"],
  soy: ["soy", "soya", "soybean", "tofu", "taukua", "tempeh", "edamame", "miso", "natto", "yuba", "tau fu", "beancurd", "bean curd", "tau foo", "tare", "teriyaki", "shoyu", "kicap", "okonomi", "tauhu", "tahu", "taucu", "tau cheong", "tamari", "hoisin", "maggi seasoning", "doubanjiang", "chashu", "ajitama", "takoyaki sauce"],
  sesame: ["sesame", "tahini", "bijan"],
  celery: ["celery", "celeriac"],
  mustard: ["mustard", "dijon"],
  sulphites: ["wine", "vinegar", "dried fruit", "raisin", "shaoxing", "hua tiao"],
  lupin: ["lupin"],
};

const MEAT = ["chicken", "ayam", "beef", "daging", "pork", "lamb", "mutton", "kambing", "duck", "itik", "goose", "turkey", "quail", "veal", "venison", "wagyu", "brisket", "rib", "liver", "tripe", "bacon", "ham", "sausage", "pepperoni", "salami", "chorizo", "prosciutto", "pancetta", "char siu", "lap cheong", "meat", "rendang", "satay", "burger", "steak", "tonkatsu", "karaage", "yakitori", "lard", "gelatin", "gelatine", "bone broth"];
const SEAFOOD = [...KEYWORDS.fish, ...KEYWORDS.crustaceans, ...KEYWORDS.molluscs, "belacan", "oyster sauce"];
const ANIMAL = [...KEYWORDS.egg, ...KEYWORDS.milk, "honey"];
/** Breads usually made with ghee, butter or milk, so not called vegan without the merchant saying so. */
const ENRICHED = ["roti canai", "roti", "naan", "paratha", "brioche", "croissant", "puff pastry"];
const SPICY = ["chili", "chilli", "cili", "sambal", "spicy", "pedas", "curry", "kari", "mala", "rendang", "jalapeno", "sriracha", "tom yum", "tomyam", "laksa", "pepper"];
const NOT_HALAL = ["pork", "bacon", "ham", "lard", "char siu", "lap cheong", "wine", "beer", "rum", "sake", "mirin", "babi"];

// A word, or its plural, as a whole word: "egg" in "eggs", not in "eggplant"; "butter" not in "butterfly".
function has(text: string, words: string[]) {
  return words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?(?![a-z])`, "i").test(text));
}

/**
 * The text with what a dish leaves out or only looks like taken away, so it isn't read as an
 * ingredient: "no dairy", "made without shrimp paste or fish sauce", "egg-free", "eggless",
 * "coconut milk" (not dairy), "rice noodles" and "rice flour" (no wheat), "fish cake" (no wheat),
 * "vegetarian oyster sauce" (no oyster). What a plant milk is made of still counts ("oat milk": oats).
 */
function ingredients(text: string): string {
  return (
    text
      .toLowerCase()
      // "with or without egg": the egg may be there
      .replace(/\bwith or without\b/g, "with")
      .replace(/\b(?:no|without|free from|free of|minus)\s+((?:[a-z'-]+\s?){1,5}?)(?=[,.;()]|\bwith\b|\bserved\b|\btopped\b|\bplus\b|\bbut\b|$)/g, " ")
      .replace(/\b[a-z]+[\s-]free\b/g, " ")
      .replace(/\b(?:egg|flour|dairy|meat|milk)less\b/g, " ")
      .replace(/\b(coconut|oat|soy|soya|soya bean|soybean|almond|rice|cashew|nut|peanut)[\s-]+(?:milk|cream|butter)\b/g, "$1 plant")
      .replace(/\b(?:cocoa|shea|apple)\s+butter\b/g, " ")
      .replace(/\bvegan\s+(?:cheese|mayo|mayonnaise|butter|cream|sausage|meat|patty)\b/g, "vegan")
      .replace(/\b(?:vegetarian|mushroom|mushroom-based)\s+(?:vegetarian\s+)?(?:mushroom\s+)?oyster sauce\b/g, "mushroom soy sauce")
      .replace(/\bbean\s+curd\b/g, "beancurd")
      .replace(/\boyster mushrooms?\b/g, "mushroom")
      .replace(/\bbutterfly pea\b/g, "pea flower")
      .replace(/\b(?:fish|rice flour|rice|carrot|radish|turnip|yam|taro|water chestnut)\s+cakes?\b/g, (m) => (m.startsWith("fish") ? "fish kuih" : "kuih"))
      .replace(/\b(?:flat\s+)?(?:rice|glass|mung bean|sweet potato|konjac|tapioca)\s+(?:noodle|noodles|vermicelli|noodle rolls?|paper)\b/g, "ricenoodle")
      .replace(/\b(?:bee ?hoon|mee hoon|kway teow|kuey teow|hor fun|cheong fun|chee cheong fun)\b/g, "ricenoodle")
      .replace(/\b(?:glutinous rice|rice|tapioca|corn|soybean|soy|chickpea|gram|almond|coconut|potato|sago)[\s-]+flour\b/g, (m) => m.replace(/flour$/, "starch"))
      .replace(/\bcornflour\b/g, "starch")
      // a batter of those ("gram flour and rice flour batter", "tapioca starch batter"): no wheat
      .replace(/\b(starch|besan)\b([^,.;]{0,40}?)\bbatter\b/g, "$1$2")
      .replace(/\bglutinous rice (?:dumplings?|balls?)\b/g, "kuih")
      // Vietnamese bún is rice vermicelli: bún bò, bún riêu, bún chả
      .replace(/\bbun (?:bo|rieu|cha|ga|thit|nem|mam|ca|oc)\b/g, "ricenoodle")
  );
}

// what a dish is called, never what it's made of: a stated wheat-free ramen has no wheat
const NOODLE_NAMES = ["noodle", "ramen", "mee"];

export function inferAllergens(text: string): Allergen[] {
  let t = ingredients(text);
  if (/\bgluten[\s-]free\b|\bno wheat\b|\bwheat[\s-]free\b/i.test(text)) for (const w of NOODLE_NAMES) t = t.replace(new RegExp(`\\b${w}s?\\b`, "g"), " ");
  return ALLERGENS.filter((a) => has(t, KEYWORDS[a]));
}

export function inferDietary(text: string): { dietary: string[]; spiceLevel: number } {
  const said = text.toLowerCase();
  const t = ingredients(text);
  const dietary: string[] = [];
  const meat = has(t, MEAT);
  const seafood = has(t, SEAFOOD);
  if (!meat && !seafood) {
    dietary.push("vegetarian");
    // a merchant who wrote "vegetarian" and not "vegan" chose the word for a reason (ghee, egg, milk)
    const onlyVegetarian = /\bvegetarian\b/.test(said) && !/\bvegan\b/.test(said);
    if (!has(t, ANIMAL) && !onlyVegetarian && (/\bvegan\b/.test(said) || !has(t, ENRICHED))) dietary.push("vegan");
  }
  if (!has(t, NOT_HALAL)) dietary.push("halal_friendly");
  if (!inferAllergens(text).includes("gluten")) dietary.push("gluten_free_ingredients");
  let spiceLevel = 0;
  const heat = t.replace(/\b(?:not|non)[\s-]?(?:too\s+|very\s+)?spicy\b/g, " ");
  if (has(heat, SPICY)) {
    spiceLevel = 1;
    if (/extra spicy|very spicy|super spicy|mala|level 3|🌶🌶/i.test(heat)) spiceLevel = 3;
    else if (/sambal|tom ?yum|spicy/i.test(heat)) spiceLevel = 2;
  }
  if (spiceLevel > 0) dietary.push("spicy");
  return { dietary, spiceLevel };
}
