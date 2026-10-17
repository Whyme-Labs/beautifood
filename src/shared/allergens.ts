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
  gluten: ["wheat", "flour", "noodle", "mee", "bread", "toast", "pasta", "spaghetti", "bun", "roti", "dumpling", "wonton", "batter", "tempura", "cake", "pastry", "croissant", "pau", "barley", "beer", "soy sauce", "kway teow", "kuey teow", "pancake", "waffle", "biscuit", "cookie", "pizza", "udon", "ramen"],
  crustaceans: ["prawn", "shrimp", "crab", "lobster", "crayfish", "udang", "belacan", "har gow", "langoustine"],
  molluscs: ["squid", "sotong", "octopus", "clam", "lala", "mussel", "oyster", "scallop", "cockle", "kerang", "abalone", "calamari"],
  fish: ["fish", "ikan", "salmon", "tuna", "anchovy", "anchovies", "ikan bilis", "cod", "mackerel", "sardine", "fish sauce", "bonito", "otak-otak", "seabass", "snapper", "pomfret"],
  egg: ["egg", "telur", "mayo", "mayonnaise", "custard", "meringue", "omelette", "kaya", "aioli"],
  milk: ["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "ghee", "condensed", "latte", "cappuccino", "susu", "paneer", "whey", "ice cream", "mozzarella", "parmesan", "teh tarik", "milo"],
  peanuts: ["peanut", "groundnut", "kacang", "satay sauce", "satay"],
  tree_nuts: ["almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "macadamia", "praline", "marzipan", "candlenut"],
  soy: ["soy", "soya", "tofu", "taukua", "tempeh", "edamame", "miso", "tau fu", "beancurd", "bean curd", "tau foo"],
  sesame: ["sesame", "tahini", "bijan"],
  celery: ["celery", "celeriac"],
  mustard: ["mustard", "dijon"],
  sulphites: ["wine", "vinegar", "dried fruit", "raisin"],
  lupin: ["lupin"],
};

const MEAT = ["chicken", "ayam", "beef", "daging", "pork", "lamb", "mutton", "kambing", "duck", "itik", "bacon", "ham", "sausage", "char siu", "lap cheong", "meat", "rendang", "satay", "burger", "steak", "lard", "gelatin"];
const SEAFOOD = [...KEYWORDS.fish, ...KEYWORDS.crustaceans, ...KEYWORDS.molluscs, "belacan", "oyster sauce"];
const ANIMAL = [...KEYWORDS.egg, ...KEYWORDS.milk, "honey"];
const SPICY = ["chili", "chilli", "cili", "sambal", "spicy", "pedas", "curry", "kari", "mala", "rendang", "jalapeno", "sriracha", "tom yum", "tomyam", "laksa", "pepper"];
const NOT_HALAL = ["pork", "bacon", "ham", "lard", "char siu", "lap cheong", "wine", "beer", "rum", "sake", "mirin", "babi"];

function has(text: string, words: string[]) {
  return words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text));
}

export function inferAllergens(text: string): Allergen[] {
  const t = text.toLowerCase();
  return ALLERGENS.filter((a) => has(t, KEYWORDS[a]));
}

export function inferDietary(text: string): { dietary: string[]; spiceLevel: number } {
  const t = text.toLowerCase();
  const dietary: string[] = [];
  const meat = has(t, MEAT);
  const seafood = has(t, SEAFOOD);
  if (!meat && !seafood) {
    dietary.push("vegetarian");
    if (!has(t, ANIMAL)) dietary.push("vegan");
  }
  if (!has(t, NOT_HALAL)) dietary.push("halal_friendly");
  if (!inferAllergens(t).includes("gluten")) dietary.push("gluten_free_ingredients");
  let spiceLevel = 0;
  if (has(t, SPICY)) {
    spiceLevel = 1;
    if (/extra spicy|very spicy|super spicy|mala|level 3|🌶🌶/i.test(t)) spiceLevel = 3;
    else if (/sambal|tom ?yum|spicy/i.test(t)) spiceLevel = 2;
  }
  if (spiceLevel > 0) dietary.push("spicy");
  return { dietary, spiceLevel };
}
