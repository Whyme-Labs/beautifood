// What a dish usually has that its menu line may not say: pho broth is seasoned with fish sauce,
// most sambal is made with belacan, sambar is tempered with mustard seeds. These are suggestions
// for the merchant to confirm when they review a menu, never allergens added on their own: a
// wrong one only hides a dish, but a merchant who knows their kitchen should decide.
import { inferAllergens, type Allergen } from "./allergens";

export interface Likely {
  allergen: Allergen;
  /** Why, in a few words, for the merchant ("fish sauce in the broth"). */
  because: { en: string; zh: string };
}

type Rule = [RegExp, Allergen[], string, string];

const RULES: Rule[] = [
  // Malaysian and Singaporean
  [/\bsambal\b/, ["crustaceans"], "most sambal is made with belacan (shrimp paste)", "多数参巴辣椒酱含虾膏"],
  [/\bnasi lemak\b/, ["fish", "peanuts"], "usually served with ikan bilis, peanuts and egg", "通常配江鱼仔、花生和蛋"],
  [/\b(laksa|curry mee|kari mee|mee kari)\b/, ["crustaceans", "fish"], "laksa and curry mee pastes usually have shrimp paste or dried shrimp", "叻沙和咖喱面的酱料通常含虾膏或虾米"],
  [/\b(char kway teow|char koay teow|ckt)\b/, ["crustaceans", "egg", "soy", "gluten"], "usually fried with prawns, egg and soy sauce", "通常加虾、蛋和酱油炒"],
  [/\b(hokkien mee|hokkien char|hokkien prawn mee|prawn mee|hae mee)\b/, ["crustaceans", "gluten", "soy"], "prawn stock, yellow noodles and soy sauce", "虾汤、黄面和酱油"],
  [/\b(wan ?tan mee|wonton noodles?|kolo mee)\b/, ["gluten", "egg", "soy"], "egg noodles, wheat wrappers and soy sauce", "蛋面、面皮和酱油"],
  [/\b(mee rebus|mee siam|mee bandung)\b/, ["crustaceans", "soy", "peanuts"], "the gravy usually has dried shrimp, taucu and peanuts", "汤汁通常含虾米、豆酱和花生"],
  [/\brojak\b/, ["peanuts", "crustaceans"], "rojak dressing is prawn paste (hae ko) with peanuts", "啰惹酱是虾膏加花生"],
  [/\b(roti canai|roti telur|roti tisu|paratha|murtabak|naan)\b/, ["milk", "gluten"], "usually made with ghee or milk, and wheat flour", "通常用酥油或牛奶和面粉制作"],
  [/\b(nasi goreng|fried rice|chao fan)\b/, ["egg"], "usually fried with egg", "通常加蛋炒"],
  [/\b(curry puff|karipap|epok[- ]epok)\b/, ["gluten"], "wheat pastry", "面粉酥皮"],
  [/\begg tarts?\b/, ["gluten", "milk"], "pastry with butter or milk", "含黄油或牛奶的酥皮"],
  [/\bxo sauce\b/, ["crustaceans", "molluscs"], "XO sauce is dried shrimp and dried scallop", "XO酱含虾米和干贝"],
  // Indian
  [/\b(sambar|coconut chutney|rasam|poriyal|thoran|kootu)\b/, ["mustard"], "usually tempered with mustard seeds", "通常用芥菜籽爆香"],
  [/\b(biryani|briyani)\b/, ["milk", "tree_nuts"], "usually cooked with ghee and topped with cashews", "通常用酥油烹调并撒腰果"],
  [/\b(korma|kurma|pasanda)\b/, ["milk", "tree_nuts"], "usually thickened with cream or yoghurt and cashew paste", "通常用奶油或酸奶和腰果酱勾芡"],
  // Thai and Vietnamese
  [/\b(tom yum|tomyam|tom yam)\b/, ["crustaceans", "fish"], "chilli paste with shrimp and fish sauce", "辣椒膏含虾，并加鱼露"],
  [/\b(green curry|red curry|yellow curry|panang|phanaeng|massaman|gaeng|kaeng)\b/, ["crustaceans", "fish"], "Thai curry pastes have shrimp paste; most are seasoned with fish sauce", "泰式咖喱酱含虾膏，多用鱼露调味"],
  [/\bpad thai\b/, ["peanuts", "fish", "egg", "crustaceans"], "peanuts, fish sauce, egg and dried shrimp", "花生、鱼露、蛋和虾米"],
  [/\b(som tam|papaya salad)\b/, ["fish", "crustaceans", "peanuts"], "fish sauce, dried shrimp and peanuts", "鱼露、虾米和花生"],
  [/\bpho\b/, ["fish"], "pho broth is usually seasoned with fish sauce", "河粉汤通常用鱼露调味"],
  [/\b(bun cha|bun thit|com tam|goi cuon|cha gio|nem ran|banh xeo)\b/, ["fish"], "served with nuoc cham (fish sauce)", "配鱼露蘸酱"],
  [/\bbanh mi\b/, ["gluten", "egg", "soy"], "baguette, mayonnaise and Maggi seasoning", "法棍、蛋黄酱和美极酱油"],
  // Japanese, Korean, Chinese
  [/\b(ramen|tsukemen|tantanmen)\b/, ["soy"], "ramen tare is usually soy sauce based", "拉面酱汁通常以酱油为底"],
  [/\b(miso soup|dashi|udon|soba|agedashi|chawanmushi)\b/, ["fish"], "dashi is usually made with bonito", "日式高汤通常用鲣鱼熬制"],
  [/\b(tantanmen|dan ?dan)\b/, ["sesame", "peanuts"], "sesame paste and often peanuts", "芝麻酱，常加花生"],
  [/\b(gyoza|jiaozi|xiao long bao|siu mai|siew mai|wontons?|wantans?|(?<!rice |glutinous rice |milk )dumplings?)\b/, ["gluten"], "wheat wrappers", "面皮"],
  [/\b(karaage|teriyaki|yakitori|katsu|tonkatsu)\b/, ["soy", "gluten"], "soy sauce marinade or wheat coating", "酱油腌制或裹面粉"],
  [/\b(kimchi)\b/, ["fish", "crustaceans"], "kimchi is usually made with fish sauce and salted shrimp", "泡菜通常用鱼露和虾酱"],
  [/\b(gochujang|bibimbap|tteokbokki|ddeokbokki)\b/, ["soy", "gluten"], "gochujang is made with wheat and soybeans", "韩式辣酱含小麦和黄豆"],
  [/\b(bulgogi|galbi|kalbi)\b/, ["soy", "sesame", "gluten"], "soy sauce and sesame oil marinade", "酱油和芝麻油腌制"],
  [/\b(mapo|doubanjiang|kung pao|gong bao)\b/, ["soy", "gluten"], "bean paste and soy sauce", "豆瓣酱和酱油"],
  // Western and Middle Eastern
  [/\bpesto\b/, ["tree_nuts", "milk"], "pine nuts and parmesan", "松子和帕玛森芝士"],
  [/\bcaesar\b/, ["fish", "egg", "milk"], "Caesar dressing is anchovy, egg yolk and parmesan", "凯撒酱含鳀鱼、蛋黄和芝士"],
  [/\btiramisu\b/, ["egg", "milk", "gluten"], "mascarpone, egg and sponge fingers", "马斯卡彭、蛋和手指饼"],
  [/\b(pizza|lasagn[ae]|quattro formaggi)\b/, ["milk", "gluten"], "cheese and wheat dough", "芝士和面团"],
  [/\b(risotto|panna cotta|gelato|bubble tea|milk tea|boba)\b/, ["milk"], "usually made with milk, butter or cream", "通常含牛奶、黄油或奶油"],
  [/\b(hummus|houmous|mutabal|moutabal|baba ganoush|falafel|shawarma)\b/, ["sesame"], "tahini (sesame paste)", "芝麻酱"],
  [/\b(baklava|kunafa|knafeh|kanafeh)\b/, ["gluten", "tree_nuts", "milk"], "pastry, nuts and butter or cheese", "酥皮、坚果和黄油或芝士"],
];

const SEAFOOD: Allergen[] = ["fish", "crustaceans", "molluscs"];
const ANIMAL: Allergen[] = [...SEAFOOD, "egg", "milk"];

/** What a dish likely has beyond what its text says, with why; only what isn't already read from it. */
export function likelyAllergens(name: string, description = ""): Likely[] {
  const text = `${name} ${description}`.toLowerCase();
  const said = new Set(inferAllergens(text));
  // a dish the merchant calls vegan has none of the animal ones; vegetarian, no seafood
  const vegan = /\bvegan\b|纯素/.test(text);
  const vegetarian = vegan || /\bvegetarian\b|\bveg\b|素/.test(text);
  const out: Likely[] = [];
  for (const [re, allergens, en, zh] of RULES) {
    if (!re.test(text)) continue;
    for (const allergen of allergens) {
      if (said.has(allergen) || out.some((x) => x.allergen === allergen)) continue;
      if ((vegan && ANIMAL.includes(allergen)) || (vegetarian && SEAFOOD.includes(allergen))) continue;
      // what the text rules out ("no fish sauce", "gluten-free", "without peanuts") stays out
      if (new RegExp(`\\b(no|without|free of|minus)\\s+[^,.;]*\\b(${WORDS[allergen]})`).test(text) || new RegExp(`\\b(${WORDS[allergen]})[\\s-]free\\b`).test(text)) continue;
      out.push({ allergen, because: { en, zh } });
    }
  }
  return out;
}

/** The words a menu uses to rule an allergen out ("no fish sauce", "dairy-free"). */
const WORDS: Record<Allergen, string> = {
  gluten: "gluten|wheat",
  crustaceans: "shrimp|prawn|belacan|shellfish|crustaceans?",
  molluscs: "oyster|squid|molluscs?|shellfish",
  fish: "fish|anchov|bonito|fish sauce",
  egg: "eggs?",
  milk: "milk|dairy|ghee|butter|cream|lactose",
  peanuts: "peanuts?|nuts?",
  tree_nuts: "nuts?|cashews?|tree nuts?",
  soy: "soy|soya",
  sesame: "sesame",
  celery: "celery",
  mustard: "mustard",
  sulphites: "sulphites?|sulfites?|wine",
  lupin: "lupin",
};
