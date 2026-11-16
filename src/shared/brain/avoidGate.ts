// The model's reading is kept only when the message says something is avoided. A small model reading a
// guest's message lists the foods it names ("extra peanuts", "got beer?", "the butter prawn damn nice"), and
// no wording of its instruction stops it; this check does. It runs on what applies to this meal
// (`applicable`), and asks for a word of avoiding in the message: an allergy or a reaction, "can't" or
// "don't eat", a diet or a faith, a doctor. "No alcohol" needs "don't drink" or "no alcohol", never a beer
// asked for. Allergies to what isn't food (cats, dust, pollen, a medicine) are not a word of avoiding.
import type { AvoidHint } from "./avoidHint";
import { applicable, deniedDiets } from "../../server/ai/brain/applies";

const NOT_FOOD = /\b(allerg\w*|alergi\w*|alah|sensitive)\s+(to\s+|kepada\s+|dengan\s+)?(cats?|dogs?|pets?|kucing|anjing|dust|habuk|debu|pollen|hay ?fever|penicillin|antibiotics?|medicine|ubat|drugs?|aspirin|latex|perfume|smoke|asap|bees?|mondays?|work|kerja|people|waiting|the cold|cold weather|sun|strawberr\w*|durian|mangoe?s?|kiwis?|pineapples?|nanas|tomato\w*|chocolate|msg|ajinomoto|coriander|garlic|onions?|chill?i\w*|cili)\b|对(猫|狗|花粉|灰尘|尘螨|青霉素|药|榴莲|草莓|芒果|味精)过敏|(花粉|猫毛|灰尘|榴莲|草莓|芒果|味精)过敏/gi;
const SAYS_AVOID =
  /\b(allerg\w*|alergi\w*|alah\w*|intoleran\w*|sensitive|sensitivity|coeliac|celiac|seliak|react\w*|swell\w*|bengkak|itch\w*|gatal|hives|rash\w*|welts?|break[s]? out|breaks? me out|ruam|sesak nafas|throw up|throws up|vomit\w*|muntah|sick|ill|stomach|perut|can t breathe|anaphyla\w*|epipen|a ?& ?e|emergency|hospital|kecemasan|doctor|doktor|dr|gout|uric|larang\w*|pantang|forbidden|not allowed|haram|halal|muslims?|islam|hindu|buddhist|guanyin|kuan ?yin|vegetarian\w*|vegan\w*|vege|veg|veggie|pescatarian|plant based|kosher|religion|religious|agama|puasa|fasting|ramadan|avoid\w*|elak\w*|keep away|stay away|steer clear|must not|mustn t|can t|cant|cannot|can not|couldn t|unable to|tak boleh|tk boleh|x boleh|tidak boleh|tak leh|xleh|tak dapat|tak makan|tk makan|x makan|tidak makan|tak mkn|tk mkn|x mkn|xmkn|tak mkn|tak sentuh|no more|don t eat|dont eat|do not eat|doesn t eat|doesnt eat|don t do|dont do|don t take|doesn t take|never eat|never touch|neither of us|none of us|nobody|no one at|skip anything|have to skip|without any|free from|(gluten|dairy|nut|nuts|peanut|egg|soy|shellfish|seafood|milk|lactose|wheat|meat|pork|allergen) free|bebas)\b|\b(no|tak|tk|x|tidak|without|tanpa|jangan)\s+(mkn\s+|makan\s+|bagi\s+)?(pork|babi|khinzir|lard|beef|lembu|daging|chicken|ayam|lamb|mutton|kambing|duck|itik|meat)\b|过敏|敏感|不耐|起疹|痒|肿|不能|不可以|不行|吃不了|吃不得|唔食|食唔得|唔可以|忌口|戒口|吃素|吃斋|素食|斋|清真|穆斯林|回教|不吃|痛风|尿酸|不碰|别给|不要给|疹|吐|不舒服/i;
const SAYS_NO_ALCOHOL =
  /\b(no|not|without|tanpa|tak|takde|tiada|x|tak nak|dont|don t|do not|doesn t|doesnt|does not|non|cannot|cant|tidak|never|none of us|neither of us|nobody)\s+(\w+\s+)?(minum|drink|drinks|drinking|alcohol|alcoholic|arak|alkohol|liquor|booze|wine|beer)\b(?!\s+(coffee|kopi|tea|teh|soda|milk|susu|coke|juice|jus|sweet|manis|cold|sejuk))|\b(alcohol free|non alcoholic|mocktails?|teetotal\w*|sober)\b|不喝酒|不要酒|不含酒|无酒精|没有酒精|不能喝酒|滴酒不沾|不沾酒|戒酒/i;

// a diet needs its own word ("tak makan sayur" isn't vegetarian, "sugar free" isn't vegan)
const DIET_WORD: Record<string, RegExp> = {
  vegetarian: /\b(vegetarian\w*|vege|veg|veggie|meat|meats|meatless|daging|plant based|buddhist|guanyin|kuan ?yin)\b|吃素|吃斋|素食|斋|初一|十五/i,
  vegan: /\b(vegan\w*|plant based)\b|纯素|全素/i,
  halal: /\b(halal|muslims?|islam|haram|ramadan|puasa)\b|清真|穆斯林|回教|伊斯兰/i,
};

/** `hint` with what the message doesn't say is avoided taken out (empty when it says nothing is). */
export function gateHint(message: string, hint: AvoidHint): AvoidHint {
  const said = applicable(message).toLowerCase().replace(/[’']/g, " ").replace(NOT_FOOD, " ");
  const avoids = SAYS_AVOID.test(said);
  return {
    allergens: avoids ? hint.allergens : [],
    diets: avoids ? hint.diets.filter((d) => DIET_WORD[d]?.test(said) && !deniedDiets(message).includes(d)) : [],
    meats: avoids ? hint.meats : [],
    alcohol: hint.alcohol && SAYS_NO_ALCOHOL.test(said),
  };
}
