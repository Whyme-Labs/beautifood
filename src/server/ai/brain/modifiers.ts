// The add-ons and sizes a guest asks for in their own words ("both iced", "with oat milk", "roti
// canai tambah telur", "large", "走冰", "12 pcs"), read against each dish's own options. Only priced
// options matter to a bill; a free one ("hot", "less sweet") changes nothing.
import { editDistance, normalize } from "../../../shared/brain/text";
import type { ModifierOption } from "../../../shared/types";

type WithOptions = { name: string; translations?: Record<string, { name?: string } | undefined>; modifiers?: { name: string; min?: number; max?: number; options: ModifierOption[] }[] };

// a guest's words for an option's own words (as menus name them: "Ais (iced)", "Oat milk", "Besar (large)")
const ALSO: Record<string, string[]> = {
  ais: ["ice", "iced", "cold", "peng", "sejuk"], iced: ["ice", "ais", "cold", "peng", "sejuk"], cold: ["ice", "iced", "ais", "peng", "sejuk"],
  panas: ["hot", "warm"], hot: ["panas", "warm"], suam: ["warm"],
  besar: ["large", "big", "upsize", "bigger"], large: ["besar", "big", "upsize", "bigger", "lrg", "lg"],
  full: ["whole", "seekor", "ekor", "penuh"], half: ["separuh", "setengah"], salted: ["salty", "masin"],
  small: ["kecil", "kecik"], kecil: ["small"], medium: ["sederhana", "mid"], sederhana: ["medium"], regular: ["biasa"],
  telur: ["egg", "eggs"], egg: ["telur", "eggs"], fried: ["goreng", "mata"], vegetables: ["sayur", "veg", "veggie", "veggies", "greens"], bawang: ["onion"], onion: ["bawang"],
  mata: ["fried egg", "sunny side"], rebus: ["boiled egg", "hard boiled"],
  oat: ["oat", "oatmilk"], almond: ["badam", "almond"], shot: ["shot", "double"],
  kuah: ["kuah", "sauce", "peanut sauce"], laksa: ["laksa", "curry"], chilli: ["chilli", "chili", "sambal", "cili"],
  balls: ["ball", "fishball", "fishballs", "bebola"], fish: ["ikan"], minced: ["mince", "minced", "mincemeat"],
  bilis: ["anchovy", "anchovies"], hoon: ["bihun", "meehoon", "vermicelli"], prawns: ["prawn", "shrimp", "shrimps", "udang"],
  puffs: ["taupok", "tau pok", "tofu puff", "tofu pok", "tauhu pok"], pearls: ["pearl", "boba", "tapioca"], pudding: ["puding"],
  grass: ["cincau"], jelly: ["cincau"], coconut: ["kelapa", "nata"], bean: ["kacang merah"], foam: ["foam"],
  cheese: ["keju", "cheesy"], ramyeon: ["ramen", "ramyun", "ramyon", "noodle", "noodles", "maggi"], cake: ["cake"],
  fries: ["fry", "kentang", "kentang goreng", "chips"], soft: ["soda", "air", "minuman", "soft drink", "can drink"], drink: ["air", "minuman", "soda"], coleslaw: ["slaw"],
  mushrooms: ["mushroom", "cendawan"], mushroom: ["mushrooms", "cendawan"], pineapple: ["nanas"], pepperoni: ["pepperoni"], parmesan: ["parmesan"],
  cream: ["ice cream", "aiskrim", "icecream"], whey: ["whey"], plant: ["vegan protein"], chia: ["chia"],
  granola: ["granola"], flakes: ["flake"], honey: ["madu"], nuts: ["nut", "kacang"], cacao: ["cocoa", "cacao"],
  avocado: ["avo", "alpukat"], poached: ["poached"], salmon: ["salmon"], feta: ["feta"],
  kaya: ["kaya"], sambal: ["sambal"], rendang: ["rendang"], sotong: ["squid", "sotong"], udang: ["prawn", "prawns", "shrimp"],
  ayam: ["chicken"], goreng: ["fried"], lime: ["limau", "lemon"], plum: ["asam boi", "assam boi", "sour plum", "plum"], sour: ["asam", "assam", "masam"],
  peanut: ["pb", "kacang", "nut"], milo: ["milo"], noodles: ["noodle", "extra mee", "tambah mee", "more mee", "mee lagi"], peanuts: ["peanut", "kacang"], tofu: ["tauhu", "taufu"],
  strawberries: ["strawberry"], chocolate: ["choc", "coklat", "chocolate"], mayo: ["mayonnaise"], mayonnaise: ["mayo"],
  seaweed: ["nori"], spicy: ["spicy", "pedas", "hot"], yuja: ["yuzu", "citron"], cola: ["coke", "cola"], cider: ["cider", "chilsung"],
  bucket: ["bucket", "baldi"], crust: ["crust"], thin: ["thin"], stuffed: ["stuffed", "cheese crust"],
  chicken: ["ayam"], beef: ["daging"], duck: ["itik"], corn: ["jagung"], spinach: ["bayam"], cockles: ["kerang", "cockle"], taugeh: ["tauge", "bean sprouts", "beansprouts", "sprouts"], cheong: ["lap cheong", "lapcheong", "chinese sausage", "sausage"],
};
// ...and in Chinese, as a guest writes it
const ALSO_ZH: Record<string, RegExp> = {
  ais: /冰|凍|冻/, iced: /冰|凍|冻/, cold: /冰|凍|冻|冷的|冷饮/, sui: /水饺|水餃/, kow: /水饺|水餃/, pok: /豆卜|豆泡|豆腐泡/, uduk: /椰香饭|椰浆饭|椰饭/, fried: /荷包蛋|煎蛋/, petai: /臭豆/, char: /叉烧/, mushroom: /香菇|蘑菇|冬菇/, panas: /热(?!带|狗)/, hot: /热(?!带|狗)|辣一点|更辣|加辣|大辣|多辣/, suam: /温/, condensed: /茶走|炼奶|练奶/, salted: /咸/,
  besar: /大杯|大份|加大|大的|大碗|大包|大号|大碟|大盘/, large: /大杯|大份|加大|大的|大碗|大包|大号|大碟|大盘/,
  full: /整只|全只|一整只|整份|大份/, half: /半只|半份/,
  regular: /中碗|中份|(?<!其)中的|中杯|普通|正常份/, small: /小碗|小的|小份|小杯|小碟|小号|小包/, kecil: /小碗|小的|小份|小杯|小碟|小号|小包/,
  medium: /中碗|(?<!其)中的|中份|中杯|中碟|中号/, sederhana: /中碗|(?<!其)中的|中份|中杯|中碟|中号/,
  telur: /加蛋|蛋|卵/, egg: /加蛋|鸡蛋|蛋|卵/, mata: /荷包蛋|煎蛋|太阳蛋/, rebus: /水煮蛋|白煮蛋|煮蛋/, bawang: /洋葱/, onion: /洋葱/,
  oat: /燕麦/, almond: /杏仁(?!酱)/, shot: /加浓|浓缩|多一份咖啡/, laksa: /叻沙|咖喱汤/, curry: /咖喱/, chilli: /辣椒酱|辣椒碎|辣椒干|辣椒/, kuah: /花生酱|沙爹酱|花生酱汁/,
  salmon: /三文鱼|烟熏三文鱼/, bacon: /培根/, poached: /水波蛋/, dry: /干捞|干的/, soup: /汤的|汤底/,
  balls: /鱼丸/, minced: /肉碎|肉末|肉燥/, bilis: /江鱼仔|小鱼干/, hoon: /米粉/, prawns: /(?<!濑尿|螳螂|琵琶)虾(?!蛄)/,
  duck: /鸭蛋|鸭/, natto: /纳豆/, corn: /玉米/, spinach: /菠菜/, onsen: /温泉蛋/, cockles: /蚶|血蛤|鲜蛤/, cheong: /腊肠|臘腸/, taugeh: /豆芽/, puffs: /豆卜|豆泡/,
  noodles: /加面|多面|面加倍/, mushrooms: /蘑菇|香菇/, skin: /腐竹|豆皮/, peanuts: /花生/, tofu: /豆腐/, milo: /美禄/,
  pearls: /珍珠|波霸/, pudding: /布丁/, durian: /榴莲|榴槤/, ginger: /姜/, milky: /奶白|浓汤|白汤/, clear: /清汤/, sua: /面线|麵線/, mashed: /薯泥|马铃薯泥/, gula: /椰糖|马六甲糖|棕榈糖/, melaka: /椰糖|马六甲糖|棕榈糖/, grass: /仙草/, coconut: /椰果|椰子片|椰丝/, bean: /红豆/, foam: /奶盖/,
  cheese: /芝士|起司|奶酪/, ramyeon: /拉面|泡面|快熟面/, rice: /年糕/, cake: /年糕|鱼饼/, fries: /薯条/, coleslaw: /凉拌|卷心菜沙拉/, soft: /饮料|汽水|饮品/,
  kimchi: /泡菜/, yangnyeom: /甜辣/, garlic: /蒜/, butter: /黄油|牛油/, snow: /雪花/, honey: /蜂蜜/,
  pineapple: /菠萝|黄梨/, pepperoni: /意大利辣香肠|辣香肠/, parmesan: /帕玛森|帕马森/, cream: /冰淇淋|雪糕/, whey: /乳清/, plant: /植物蛋白/,
  chia: /奇亚籽/, peanut: /花生/, granola: /燕麦脆片|格兰诺拉|燕麦片/, flakes: /椰子片|椰丝/, nuts: /坚果/, cacao: /可可/, spirulina: /螺旋藻/,
  avocado: /牛油果|鳄梨/, feta: /菲达/, kaya: /咖椰|加椰/, sambal: /参巴|叁巴/, rendang: /仁当/, sotong: /苏东|鱿鱼/, udang: /(?<!濑尿|螳螂|琵琶)虾(?!蛄)/,
  ayam: /炸鸡|鸡肉|鸡(?!蛋)/, lime: /酸柑|桔子|桔仔|青柠/, plum: /酸梅/, strawberries: /草莓/, chocolate: /巧克力/, mayo: /美乃滋|蛋黄酱/, mayonnaise: /美乃滋|蛋黄酱/,
  seaweed: /海苔/, matcha: /抹茶/, spicy: /加辣|特辣|很辣/, yuja: /柚子/, cola: /可乐/, cider: /七星|雪碧/, bucket: /一桶|桶/,
  thin: /薄底|薄饼底|薄脆/, penne: /笔管面|通心粉|长通粉/, spaghetti: /意大利面|意面|细面/, stuffed: /芝心/, teh: /奶茶|茶/, kopi: /咖啡/, chicken: /鸡肉|鸡(?!蛋|翅)/, beef: /牛肉/,
};
// words that say nothing of which option ("milk" is every milk option, "extra" every add-on), and a
// count's unit ("12 pcs", "12 inch": the number is what names it)
const GENERIC = new Set(["milk", "extra", "add", "on", "the", "a", "with", "and", "of", "sauce", "set", "piece", "pieces", "smoked", "susu", "fresh", "tambah", "lebih", "more", "pcs", "pc", "inch", "inches", "make", "it", "combo", "upgrade", "level", "style", "x"]);
// "no ice", "without ice", "tak nak ais", "走冰": an option taken off ("less ice" is still ice)
const OFF = /\b(no|without|tak nak|tak mau|xnak|x nak|tanpa|hold the|minus|remove the|take off the|takeout the|tak payah|instead of(?: the)?|not the|bukan|take out(?: the)?|keluarkan)\s+(?:(?:need|perlu|payah|mau|nak)\s+(?:the\s+)?)?(\w+)(?=\s+(?:to|for|kepada|jadi)\b|)/g;
const OFF_ZH = /走(冰|蛋|甜)|不要(冰|蛋|糖)|去冰|(?:去掉|拿掉|取消|不要)(?:加的|那个)?([\u4e00-\u9fff]{1,4})|([\u4e00-\u9fff]{2,4}?)(?:不要了|不要啦|取消了?|去掉)/g;
// an option that is itself taken off or less of something ("Less ice", "No sugar", "Tanpa Kacang",
// "Kurang Manis", "Kosong"): said as the guest says it, it's chosen (free), never "ice taken off"
const PHRASES: [RegExp, RegExp][] = [
  [/^less ice$|^kurang ais$/, /\b(less ice|kurang ais|sikit ais|little ice|siu bing)\b|少冰/],
  [/^no ice$|^tanpa ais$/, /\b(no ice|without ice|tak nak ais|tak mau ais|xnak ais|tanpa ais|ice free)\b|走冰|去冰|不要冰|不加冰/],
  [/^less sweet$|^kurang manis$/, /\b(less sweet|kurang manis|less sugar|siew dai|siu dai|siu tai|not so sweet|not too sweet)\b|少甜|少糖|甜少|微糖/],
  [/^no sugar$|^kosong$|^no added sugar$|^0 ?%$/, /\b(no sugar|kosong|tanpa gula|sugar free|no added sugar|unsweetened|zero sugar|0 ?%)\b|走甜|无糖|不要糖|不加糖|零糖/],
  [/^lebih manis$/, /\b(lebih manis|extra sweet|more sweet|sweeter)\b|多糖|加甜/],
  [/^50 ?%$/, /\b(50 ?%|50 percent|half sugar|half sweet|separuh manis)\b|半糖|五分糖/],
  [/^25 ?%$/, /\b(25 ?%|25 percent)\b|三分糖|微糖/],
  [/^75 ?%$/, /\b(75 ?%|75 percent)\b|七分糖/],
  [/^less spicy$|^less chilli$|^mild$/, /\b(less spicy|less chilli|less chili|kurang pedas|not so spicy|mild|less hot|kurang cili)\b|少辣|微辣|不要太辣|不要那么辣|没那么辣|不那么辣|别那么辣|小辣/],
  [/^no chilli$/, /\b(no chilli|no chili|tanpa cili|tak nak cili|without chilli|not spicy)\b|不要辣|走辣|不辣/],
  [/^extra hot$|^extra spicy$/, /\b(extra hot|extra spicy|more spicy|spicier|lebih pedas)\b|加辣|特辣|大辣/],
  [/^normal ice$/, /\b(normal ice|regular ice)\b|正常冰/],
  [/^sweet corn$/, /\b(sweet corn|corn|jagung)\b|玉米/],
  [/^salted fish$/, /\b(salted fish|ikan masin)\b|咸鱼/],
  [/^jug$/, /\b(jug|jag)\b|一壶|壶装|一扎/],
  [/^3 4 (pax|people)$/, /\b(3 ?(-|to)? ?4 (pax|people|persons|orang)|big|bigger|besar)\b|三到四人|3到4人|三至四人|大煲/],
  [/^1 2 (pax|people)$/, /\b(1 ?(-|to)? ?2 (pax|people|persons|orang))\b|一到两人|1到2人|小煲/],
  [/^glutinous rice$/, /\b(glutinous rice|pulut)\b|糯米/],
  [/^tanpa kacang$/, /\b(no peanuts?|without peanuts?|tanpa kacang|tak nak kacang|no nuts)\b|不要花生|走花生|去花生/],
  [/^tanpa ikan bilis$/, /\b(no (ikan )?bilis|no anchov\w*|tanpa (ikan )?bilis|without anchov\w*)\b|不要江鱼仔|走江鱼仔/],
  [/^(soup separate|separate soup|soup on the side|sup asing)$/, /\b(soup (come |comes |be |served |pack |packed )?(separate|separately|on the side)|separate soup|sup asing|kuah asing|asingkan sup)\b|汤分开|汤另外|分开装|汤另装/],
  [/^sambal asing$/, /\b(sambal asing|sambal (on the )?side|separate sambal|sambal separate)\b|参巴分开|叁巴另外|酱另外/],
  [/^tanpa mentega$/, /\b(no butter|without butter|tanpa mentega)\b|不要牛油|不要黄油/],
  [/^no bonito flakes$/, /\b(no bonito|without bonito|tanpa bonito|bonito off|hold the bonito)\b|不要柴鱼|走柴鱼/],
  [/^hot$|^panas$/, /\b(hot|panas|warm)\b|热(?!带|狗)/],
];
const phraseOf = (o: ModifierOption) => PHRASES.find(([name]) => name.test(normalize(o.name.replace(/\([^)]*\)/g, " ")).trim()))?.[1];

const keyWords = (o: ModifierOption) => {
  const ws = normalize(o.name.replace(/[()]/g, " ")).split(" ");
  // (one letter counts in a longer name: Kopi O is not Kopi)
  return [...new Set(ws.filter((w) => (w.length > 1 || /\d/.test(w) || (ws.length > 1 && /^[a-z]$/.test(w) && !/^[ax]$/.test(w))) && !GENERIC.has(w)))];
};
const has = (w: string, words: Set<string>, joined: string) => (w.includes(" ") ? joined.includes(` ${w} `) : words.has(w));
// said as itself (or in Chinese), or only in the guest's other words for it ("ikan" for fish)
// (not an everyday word one letter from it: "my friend" isn't Fried egg, "dried" isn't fried)
const EVERYDAY = new Set(["cheese", "cheesy", "friend", "friends", "bill", "bills", "dried", "tried", "fired", "bread", "breads", "fries", "fried", "plain", "place", "large", "lunch", "sauce", "spice", "share", "shared", "table", "drink", "drinks"]);
const typo = (w: string, words: Set<string>) =>
  (w.length >= 5 && !/\d/.test(w) && [...words].some((x) => x.length >= 4 && x[0] === w[0] && x !== w && !EVERYDAY.has(x) && (editDistance(x, w, 1) <= 1 || (w.startsWith(x) && w.length - x.length === 1) || (x.length >= 5 && w.length - x.length === 2 && w.startsWith(x.slice(0, 3)) && subseq(x, w))))) ||
  // ("telur mta" for Telur Mata: a vowel left out of a four-letter word, first and last letters kept)
  (w.length === 4 && /^[a-z]+$/.test(w) && [...words].some((x) => x.length === 3 && !LEAD.test(x) && [1, 2].some((k) => /[aeiou]/.test(w[k]) && w.slice(0, k) + w.slice(k + 1) === x)));
// "pudin" for "pudding": the letters typed are all in it, in order, with two left out
const subseq = (typed: string, w: string) => {
  let k = 0;
  for (const ch of w) if (ch === typed[k]) k++;
  return k === typed.length;
};
const direct = (w: string, words: Set<string>, joined: string, raw: string) =>
  has(w, words, joined) || typo(w, words) || (/^\d+$/.test(w) ? false : has(w.replace(/(es|s)$/, ""), words, joined) || has(`${w}s`, words, joined)) || !!ALSO_ZH[w]?.test(raw);
const alias = (w: string, words: Set<string>, joined: string) => (ALSO[w] ?? []).some((x) => has(x, words, joined));
const said = (w: string, words: Set<string>, joined: string, raw: string) => direct(w, words, joined, raw) || alias(w, words, joined);
// an option of two words or more needs one said as itself, or two in other words ("bebola ikan"): "ikan" alone isn't Fish Balls
// ("almond butter" isn't the Peanut Butter: one of its words said, after another food's)
// words of size, temperature and sweetness, said beside an option's word ("large iced", "kurang manis")
const SIZE_TEMP = /^(large|small|medium|regular|big|besar|kecil|hot|iced|ice|cold|warm|panas|ais|peng|sejuk|less|kurang|sweet|manis|sugar|gula|upsize|double|single|kosong)$/;
const LEAD = /^(extra|add|more|some|a|an|the|with|and|no|less|tambah|lebih|dengan|dan|plus|on|of|any|got|ada|nak|want|two|one|three|2|1|3|both|all|semua|kedua|please|pls|also|too|then|but|just|only|make|it|them|get|have|can|could|i|we|me|my|for|to|in|or|is|are|be|bagi|mau|dua|satu|tiga|sekali|juga|pun|yes|ok|okay|sure|that|this|those|these|one|each|lagi|jadi|and|or|ya|tu|ni|kasi|letak|put|request|order|cup|glass|bowl|plate|piece|pieces|pcs|x|times)$/;
const saysOption = (ks: string[], words: Set<string>, joined: string, raw: string) => {
  if (ks.length === 1) return said(ks[0], words, joined, raw);
  const hit = ks.filter((k) => direct(k, words, joined, raw));
  // ("a drink for her" isn't the combo's Soft drink: a course's word alone)
  if (hit.length === 1 && /^(drink|drinks|dessert|desserts|side|sides|sauce|dip|meal)$/.test(hit[0]) && !ks.filter((k) => alias(k, words, joined)).some((k) => k !== hit[0])) return false;
  if (hit.length === 1 && !ALSO_ZH[hit[0]]?.test(raw)) {
    const toks = joined.trim().split(" ");
    const at = toks.findIndex((t) => t === hit[0] || t === `${hit[0]}s` || t === hit[0].replace(/(es|s)$/, ""));
    const before = toks[at - 1];
    if (at > 0 && before && before.length > 2 && !LEAD.test(before) && !GENERIC.has(before) && !SIZE_TEMP.test(before) && !ks.includes(before) && !ks.some((k) => (ALSO[k] ?? []).includes(before))) return false;
  }
  return hit.length > 0 || ks.filter((k) => alias(k, words, joined)).length >= 2;
};
// a number names an option only as its count's unit says ("12 pcs", "12 wings", "十个", "12寸")
const numberSaid = (n: string, t: string, raw: string) => new RegExp(`(^| )${n} ?(pcs|pc|pieces?|ketul|inch|inches|in|wings?|keping|biji)?( |$)`).test(t) || new RegExp(`(^|[^0-9])${n}\\s*(个|件|只|粒|寸|块|片|pcs)`).test(raw) || (ZH_NUM[n] ? new RegExp(`${ZH_NUM[n]}(个|件|只|粒|寸|块|片)`).test(raw) : false);
const ZH_NUM: Record<string, string> = { "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九", "10": "十", "12": "十二", "16": "十六", "20": "二十" };

/** `text` without the dish's own name, so its words aren't read as an option ("Nasi Lemak Ayam Goreng"). */
const withoutName = (text: string, dish: WithOptions) => {
  let t = ` ${normalize(text)} `;
  // (its name's words side by side, two or more: "chilli pan mee" of the Dry Chilli Pan Mee)
  const n = normalize(dish.name).split(" ");
  // (not after "extra": "pork katsu curry + extra pork katsu" asks for the Extra Pork Katsu)
  for (let len = n.length; len >= 2; len--) for (let k = 0; k + len <= n.length; k++) t = t.replace(new RegExp(`(?<!\\b(?:extra|add|more|double|another|tambah)) ${n.slice(k, k + len).join(" ")}(?= )`, "g"), " ");
  let raw = text;
  for (const zh of Object.values(dish.translations ?? {}).map((x) => x?.name).filter((x): x is string => !!x && x.length > 1)) raw = raw.split(zh).join(" ");
  return { t: t.trim(), raw };
};

/** The options of `dish` that `text` asks for (priced only, unless `free`), and the ones it takes off ("no ice"). */
export function optionsSaid(text: string, dish: WithOptions, free = false, loose = false): { add: ModifierOption[]; off: ModifierOption[] } {
  const { t, raw } = withoutName(text, dish);
  // ("change the telur mata to telur rebus": what's changed is taken off)
  const changed = t.match(/\b(?:change|swap|switch|tukar|ganti|replace)\s+(?:the |my |it |that )?((?:\w+ ){0,2}?\w+)\s+(?:to|for|with|kepada|jadi|dengan)\b/)?.[1]?.split(" ") ?? [];
  const changedZh = raw.match(/([\u4e00-\u9fff]{1,6}?)(?:可以|要)?(?:换成|改成|换做|改做)/)?.[1];
  const asked = new Set([...t.matchAll(/\b(?:add|tambah|with|put|plus)\s+(?:some |a |an |the )?(\w+)/g)].map((m) => m[1]));
  // ("remove the extra cheese": its next word too)
  // ("take out the sambal udang": both words of a two-word choice)
  const names = (dish.modifiers ?? []).flatMap((g) => g.options.map((o) => ` ${normalize(o.name)} `));
  const offWords = new Set([...[...t.matchAll(OFF)].flatMap((m) => {
    const next = t.slice((m.index ?? 0) + m[0].length).trim().split(" ")[0];
    return [m[2], ...(GENERIC.has(m[2]) || (next && names.some((n) => n.includes(` ${m[2]} ${next} `))) ? [next] : [])];
  }), ...changed].filter((w) => w && !asked.has(w)));
  const offZh = [...[...raw.matchAll(OFF_ZH)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]), changedZh].filter((x): x is string => !!x);
  const words = new Set(t.split(" ").filter((w) => !offWords.has(w)));
  const all = (dish.modifiers ?? []).flatMap((g) => g.options);
  // ("big prawns", "udang besar": more of an add-on, not the dish's size)
  const toks0 = t.split(" ");
  const BIG = /^(big|large|besar|jumbo)$/;
  // (an add-on's word, of a group it isn't required to choose from: not "large iced", "ais besar")
  const addOns = (dish.modifiers ?? []).filter((g) => !(g.min ?? 0)).flatMap((g) => g.options);
  const addOnWord = (w = "") => !SIZE_TEMP.test(w) && addOns.some((o) => o.price > 0 && keyWords(o).some((k) => k === w || `${k}s` === w || k === w.replace(/(es|s)$/, "")));
  const bigOf = toks0.map((x, i) => BIG.test(x) && (addOnWord(toks0[i + 1]) || (toks0[i - 1] !== "and" && addOnWord(toks0[i - 1]) && x === "besar")));
  if (bigOf.some(Boolean) && toks0.every((x, i) => !BIG.test(x) || bigOf[i])) for (const x of toks0.filter((_, i) => bigOf[i])) words.delete(x);
  let joined = ` ${[...words].join(" ")} `;
  // a word two options share ("telur" of Telur Mata and Telur Rebus) doesn't say which
  const count = new Map<string, number>();
  // (not the ones said as a phrase: "Less chilli" doesn't share "chilli" with Chilli Flakes)
  for (const o of all) if (!phraseOf(o)) for (const k of keyWords(o)) count.set(k, (count.get(k) ?? 0) + 1);
  const add: ModifierOption[] = [];
  const off: ModifierOption[] = [];
  let zhLeft = raw.replace(OFF_ZH, "");
  // an option said as its phrase ("less chilli", "kurang manis", "走冰") takes those words: "less
  // chilli" isn't also the Chilli Flakes
  let rest = ` ${t} `;
  for (const o of all) {
    const phrase = phraseOf(o);
    if (!phrase) continue;
    const g = new RegExp(phrase.source, "g");
    if (!g.test(rest) && !new RegExp(phrase.source, "g").test(raw)) continue;
    if (free || o.price > 0) add.push(o);
    rest = rest.replace(new RegExp(phrase.source, "g"), " ");
    zhLeft = zhLeft.replace(new RegExp(phrase.source, "g"), " ");
  }
  for (const w of [...words]) if (!rest.includes(` ${w} `)) words.delete(w);
  joined = ` ${[...words].join(" ")} `;
  for (const o of all) {
    if (!free && !(o.price > 0)) continue;
    if (phraseOf(o)) continue;
    // ("Set: mushroom soup + iced lemon tea" is asked for as a set or combo, not by "mushrooms")
    // ("Meal: fries + teh o ais" likewise: "teh tarik" isn't it)
    if (/^(set|combo|meal|make it a set|make it a meal)\b/i.test(o.name) && !/\b(set|sets|combo|combos|meal|meals)\b/.test(t) && !/套餐|配套|套/.test(raw)) continue;
    // ("chicken chop set dengan sup dan air": "set" said, of the one set it has)
    if (/^(set|combo|make it a set)\b/i.test(o.name) && /\b(set|sets|combo|combos)\b/.test(t) && all.filter((x) => /^(set|combo|make it a set)\b/i.test(x.name)).length === 1) {
      if (free || o.price > 0) add.push(o);
      continue;
    }
    // (a count in brackets describes it, "Sui kow (2 pcs)": its words name it, not the number)
    const counted = /\(\s*\d+\s*(pcs|pc|pieces?|ketul|biji)?\s*\)/i.test(o.name);
    // (nor a note on who it's for, "Large (shares 3-4)", "Family (serves 4)": its name is the size)
    const noted = /\(\s*(shares?|serves?|for|feeds?|untuk|good for)\b[^)]*\)/i.test(o.name);
    const ks = (noted ? keyWords({ ...o, name: o.name.replace(/\([^)]*\)/g, " ") }) : keyWords(o)).filter((k) => !counted || (!/^\d+$/.test(k) && !/^(pcs|pc|pieces?|ketul|biji)$/.test(k)));
    if (!ks.length) continue;
    // ("12 pcs", "12 inch": its number, said as a count of pieces or a size)
    const nums = ks.filter((k) => /^\d+$/.test(k));
    // ("Level 6": said as a level, "level 6", "lvl 6", "6辣", "7级辣"; a bare number is a count)
    const level = o.name.match(/\b(level|lvl|tahap)\s*(\d+)\b/i)?.[2];
    if (level) {
      if (new RegExp(`\\b(level|lvl|tahap|lv|spicy|pedas)\\s*${level}\\b`).test(t) || new RegExp(`(^|[^0-9])${level}\\s*(级|辣|度)|辣度?\\s*${level}(?![0-9])|${ZH_NUM[level] ?? "∅"}(级|辣)`).test(raw)) add.push(o);
      continue;
    }
    if (nums.length) {
      if (nums.every((k) => numberSaid(k, t, raw))) add.push(o);
      continue;
    }
    const own = ks.filter((k) => (count.get(k) ?? 0) < 2);
    const need = own.length ? own : ks;
    // ("those two noodles" isn't Extra Noodles: more of something is asked for as more)
    // (taking it off needs no such word: "remove the egg" is the Extra Egg gone)
    if (!loose && /^(extra|add|more|double|tambah|lebih)\b/i.test(o.name) && !/加|多/.test(raw) && !need.some((k) => offWords.has(k) || offWords.has(`${k}s`))) {
      const toks = t.split(" ");
      const at = toks.findIndex((x) => need.some((k) => x === k || x === `${k}s` || x === k.replace(/(es|s)$/, "") || (ALSO[k] ?? []).includes(x)));
      // (or said right after, as in Malay: "sayur lebih")
      // (or named as the add-on it is: "the lard crisps add on")
      // (or before a list it heads: "tambah you char kway and tofu pok")
      const back = at >= 0 && toks.slice(Math.max(0, at - 3), at).some((x) => /^(and|dan|n|plus)$/.test(x)) ? 8 : 3;
      const near = at >= 0 ? [...toks.slice(Math.max(0, at - back), at), ...(/^(lebih|lagi)$/.test(toks[at + 1] ?? "") ? [toks[at + 1]] : []), ...((/^(addon|addons)$/.test(toks[at + need.length] ?? "") || (toks[at + need.length] === "add" && /^ons?$/.test(toks[at + need.length + 1] ?? ""))) ? ["add"] : [])] : toks;
      const bigBefore = at > 0 && bigOf[at - 1];
      if (!bigBefore && !near.some((x) => /^(extra|add|adding|added|more|double|tambah|lebih|another|plus|with|w|dinosaur|godzilla)$/.test(x)) && !/\b(dinosaur|godzilla)\b/.test(t)) continue;
    }
    // ("almond butter" isn't the Almond Milk: its word said, then another food's)
    const named = normalize(o.name.replace(/[()]/g, " ")).split(" ");
    if (named.length > ks.length && need.length === 1 && !ALSO_ZH[need[0]]?.test(raw)) {
      const toks = t.split(" ");
      const forms = [need[0], `${need[0]}s`, ...(ALSO[need[0]] ?? []).filter((x) => !x.includes(" "))];
      const at = toks.findIndex((x) => forms.includes(x));
      const near = [toks[at + 1], toks[at - 1]];
      const food = (x: string | undefined) => !!x && x.length > 2 && !named.includes(x) && !LEAD.test(x) && !GENERIC.has(x) && !SIZE_TEMP.test(x) && !/^(need|perlu|payah|mau|nak|want|on|top|please|pls|and|or|to|in|for|with|inside|dalam|lah|la|ah|ok|boleh|too|also|one|the|how|berapa|not|tak|can|plus|then|extra|more|instead|nak|mau|want|add|put|letak|tambah|large|besar|cup|hot|iced|ais|panas|dengan|dan)$/.test(x) && !(/^(sos|sauce)$/.test(x) && named.includes("sauce"));
      // (beside it, not across a comma: "tambah cheese, sos cili")
      const apart = (x: string | undefined) => !!x && forms.some((f) => new RegExp(`\\b${f}\\s*[,;.]\\s*${x}\\b|\\b${x}\\s*[,;.]\\s*${f}\\b`).test(raw.toLowerCase()));
      if (at >= 0 && near.some((x) => food(x) && !apart(x))) continue;
    }
    // ("no taugeh" of a "No taugeh" choice: that choice, made)
    const without = normalize(o.name).match(/^(?:no|without|tanpa|tak nak)\s+(.+)$/)?.[1];
    // (or in Chinese: "不要辣", "走辣" of the No chilli)
    const zhOf = without ? ALSO_ZH[without.replace(/s$/, "")] ?? ALSO_ZH[without] ?? (/^(chilli|chili|spicy|spice)$/.test(without) ? /辣/ : undefined) : undefined;
    if (without && (new RegExp(`\\b(no|without|tanpa|tak nak|x nak|xnak|tak mau|hold the) (the )?${without.replace(/s$/, "")}s?\\b`).test(` ${t} `) || (!!zhOf && new RegExp(`(不要|走|免|去|不放|不加)(${zhOf.source})`).test(raw)))) {
      add.push(o);
      continue;
    }
    // ("take out the egg" of the Boiled egg on it: any of its words)
    const isOff = need.some((k) => offWords.has(k) || (ALSO[k] ?? []).some((x) => offWords.has(x)) || offZh.some((z) => ALSO_ZH[k]?.test(z))) || ks.some((k) => offWords.has(k) || offWords.has(`${k}s`));
    if (isOff) off.push(o);
    // ("level 5 spicy" isn't the Spicy mayo: a describing word, all that's its own)
    else if (own.length === 1 && ks.length > 1 && /^(spicy|pedas|hot|sweet|sour|plain|original|classic|regular|fresh|crispy)$/.test(own[0]) && !ks.some((k) => k !== own[0] && said(k, words, joined, zhLeft))) continue;
    // (by shared words only, with the rest of its name said beside them: "tambah cheese, sos cili" isn't the Cheese sauce)
    // ("big" of a "Besar (long loaf)": its name before the brackets, in other words)
    else if (/\(/.test(o.name) && (() => { const out_ = keyWords({ ...o, name: o.name.replace(/\([^)]*\)/g, " ") }); return out_.length === 1 && (count.get(out_[0]) ?? 0) < 2 && said(out_[0], words, joined, zhLeft); })()) add.push(o);
    else if (own.length ? saysOption(own, words, joined, zhLeft) : ks.every((k) => said(k, words, joined, zhLeft)) && (/[\u3400-\u9fff]/.test(raw) || together(named.length > ks.length ? named.filter((w) => w.length > 1) : ks, t, raw))) add.push(o);
  }
  // ("iced milk tea" of a set's Iced HK Milk Tea): said without the style word of its name, the one option of its group so said
  for (const g of dish.modifiers ?? []) {
    if (g.options.some((o) => add.includes(o))) continue;
    const fit = g.options.filter((o) => (free || o.price > 0) && !phraseOf(o) && (() => { const ks = keyWords(o); const left = ks.filter((k) => !/^(hk|house|homemade|signature|local)$/.test(k)); return left.length >= 2 && left.length < ks.length && left.every((k) => said(k, words, joined, zhLeft)) && together(left, t, raw); })());
    if (fit.length === 1) add.push(fit[0]);
  }
  // an option said by its whole name wins over one whose words it has ("chocolate sauce" isn't also
  // the Chocolate flavour; "巧克力酱" neither)
  const whole = (o: ModifierOption) => normalize(o.name.replace(/\([^)]*\)/g, " ")).trim();
  const fullySaid = add.filter((o) => whole(o).includes(" ") && ` ${t} `.includes(` ${whole(o)} `));
  const sauceZh = /酱/.test(raw);
  // (the longer of two said in full: "extra black pepper sauce" is the Extra Black Pepper Sauce, not the Black Pepper)
  const kept = add.filter((o) => !fullySaid.some((x) => x !== o && whole(x).length > whole(o).length && keyWords(o).every((k) => whole(x).split(" ").includes(k))) && !(sauceZh && !/sauce|酱/i.test(o.name) && add.some((x) => x !== o && /sauce/i.test(x.name) && keyWords(o).every((k) => keyWords(x).includes(k)))));
  // (and in other words: "telur goreng" is the Fried egg, not also the wantan's Fried)
  const longer = (o: ModifierOption) => add.some((x) => x !== o && keyWords(x).length > keyWords(o).length && keyWords(o).every((k) => keyWords(x).includes(k)));
  // one option of a group that takes one: the one whose words were said most fully
  const out = kept.filter((o) => !longer(o)).filter((o) => {
    const g = (dish.modifiers ?? []).find((x) => x.options.includes(o));
    if (!g || (g.max ?? 1) > 1) return true;
    const rivals = add.filter((x) => x !== o && g.options.includes(x));
    return !rivals.some((x) => keyWords(x).length > keyWords(o).length && keyWords(o).every((k) => keyWords(x).includes(k)));
  });
  // ("with extra fish" of an Extra Fish Slices: the one "extra" option its word starts)
  for (const m of t.matchAll(/\bextra (\w+)/g)) {
    const of = all.filter((o) => (free || o.price > 0) && /^extra\s/i.test(o.name) && [m[1], m[1].replace(/s$/, ""), `${m[1]}s`].includes(keyWords(o)[0]));
    if (of.length === 1 && !out.includes(of[0]) && !off.includes(of[0])) out.push(of[0]);
  }
  // ("tambah cheese" of a Cheese slice add-on and a Cheese sauce: the add-on, said as one)
  for (const w of asked) {
    const of = all.filter((o) => (free || o.price > 0) && keyWords(o)[0] === w);
    if (of.length < 2 || of.some((o) => out.includes(o) || off.includes(o))) continue;
    const addOn = of.filter((o) => /add|extra|topping/i.test((dish.modifiers ?? []).find((g) => g.options.includes(o))?.name ?? ""));
    if (addOn.length === 1 && of.every((o) => o.price === addOn[0].price)) out.push(addOn[0]);
  }
  return { add: out, off };
}
// an option whose words are all ones others share, said together: "sos cili dengan mayo, tambah cheese"
// isn't also the Cheese sauce
const together = (ks: string[], t: string, raw: string) => {
  const near = (toks: string[]) => {
    const at = ks.map((k) => toks.flatMap((x, i) => (x === k || x === `${k}s` || (ALSO[k] ?? []).includes(x) || (k === "sauce" && x === "sos") ? [i] : [])));
    return at.every((xs) => xs.length) && at[0].some((i) => at.slice(1).every((xs) => xs.some((j) => Math.abs(j - i) <= ks.length)));
  };
  // (said at all in other words than these: as before)
  if (ks.length < 2 || (!near(t.split(" ")) && ks.some((k) => !t.split(" ").some((x) => x === k || x === `${k}s` || (ALSO[k] ?? []).includes(x) || (k === "sauce" && x === "sos"))))) return true;
  // (in one clause: "tambah cheese, sos cili" says the cheese and the sauce apart)
  return raw.split(/[,;.!?]/).some((part) => near(normalize(part).split(" ")));
};

/** The options a question names on any dish ("Ada susu badam? Berapa tambah?"), with the dishes that have them. */
export function optionsAsked<T extends WithOptions>(text: string, dishes: T[]): { option: ModifierOption; dishes: T[] }[] {
  const out = new Map<string, { option: ModifierOption; dishes: T[] }>();
  for (const d of dishes)
    for (const o of optionsSaid(text, d).add) {
      const k = normalize(o.name);
      if (!out.has(k)) out.set(k, { option: o, dishes: [] });
      out.get(k)!.dishes.push(d);
    }
  return [...out.values()];
}

/** An option's name as a guest reads it: "Ais (iced)" is "iced", "Oat milk" and "Sui kow (2 pcs)" stay. */
export const optionLabel = (o: ModifierOption) => (/\(\s*\d/.test(o.name) ? o.name : (o.name.match(/\(([^)]+)\)/)?.[1] ?? o.name));

// Common add-on words in Chinese, longest first, for answering in Chinese ("Extra braised pork" → 加卤肉)
const OPTION_ZH: [RegExp, string][] = ([
  ["hard boiled egg", "水煮蛋"], ["hard-boiled egg", "水煮蛋"], ["fried egg", "荷包蛋"], ["onsen egg", "温泉蛋"], ["salted egg", "咸蛋"], ["braised egg", "卤蛋"], ["century egg", "皮蛋"],
  ["braised pork", "卤肉"], ["roast pork", "烧肉"], ["char siu", "叉烧"], ["pork belly", "五花肉"], ["minced pork", "肉碎"], ["pork ribs", "排骨"], ["lard crisps", "猪油渣"],
  ["fish cake", "鱼饼"], ["fish balls", "鱼丸"], ["fish ball", "鱼丸"], ["fish paste", "鱼浆"], ["fish slices", "鱼片"], ["fried fish skin", "炸鱼皮"],
  ["red bean", "红豆"], ["sweet corn", "玉米"], ["grass jelly", "仙草"], ["glutinous rice", "糯米"], ["ice cream", "雪糕"], ["evaporated milk", "淡奶"], ["coconut milk", "椰浆"],
  ["chilli flakes", "辣椒碎"], ["chilli sauce", "辣椒酱"], ["black pepper sauce", "黑胡椒酱"], ["mushroom sauce", "蘑菇酱"], ["cheese sauce", "芝士酱"], ["cheese slice", "芝士片"],
  ["less sweet", "少甜"], ["no sugar", "无糖"], ["less ice", "少冰"], ["no ice", "走冰"], ["less spicy", "少辣"], ["extra spicy", "加辣"], ["less oil", "少油"], ["no msg", "无味精"], ["no spring onion", "不要葱"],
  ["vegetables", "青菜"], ["vegetable", "青菜"], ["noodles", "面"], ["mee sua", "面线"], ["bee hoon", "米粉"], ["kway teow", "粿条"], ["kuey teow", "粿条"], ["yellow mee", "黄面"],
  ["prawns", "虾"], ["prawn", "虾"], ["squid", "苏东"], ["chicken", "鸡肉"], ["beef", "牛肉"], ["lamb", "羊肉"], ["mutton", "羊肉"], ["duck", "鸭"], ["tofu", "豆腐"], ["egg", "鸡蛋"],
  ["mushrooms", "香菇"], ["mushroom", "香菇"], ["corn", "玉米"], ["yam", "芋头"], ["coconut", "椰子"], ["chocolate", "巧克力"], ["durian", "榴莲"], ["peanuts", "花生"], ["mango", "芒果"], ["cheese", "芝士"], ["rice", "饭"],
  ["small", "小"], ["medium", "中"], ["large", "大"], ["regular", "普通"], ["hot", "热"], ["iced", "冰"], ["soup", "汤"], ["dry", "干"],
] as [string, string][]).map(([en, zh]) => [new RegExp(`\\b${en.replace(/[-]/g, "[- ]")}\\b`, "i"), zh]);
/** An add-on's name in Chinese, when its words are common ones ("Extra braised pork" → 加卤肉); else undefined. */
export function optionZh(name: string): string | undefined {
  let rest = name.replace(/\([^)]*\)/g, " ").trim();
  const extra = /^(extra|add|more|tambah)\s+/i.test(rest);
  rest = rest.replace(/^(extra|add|more|tambah)\s+/i, "");
  let out = "";
  for (const [re, zh] of OPTION_ZH) if (re.test(rest)) { out += zh; rest = rest.replace(re, " "); }
  if (!out || /[a-z]{3,}/i.test(rest.replace(/\b(and|with|of|the|a)\b/gi, ""))) return undefined;
  return `${extra ? "加" : ""}${out}`;
}

/** A dish's choices as a guest reads them: "Base: Soup, Dry, Curry Laksa (+RM2.00)". */
export function choicesText(dish: WithOptions, money: (n: number) => string, zh = false): string {
  // (a group that takes several says how many: "Dip (up to 2)")
  // (in Chinese, each with its Chinese name when it has a common one: "加卤肉 (Extra braised pork)")
  const label = (o: ModifierOption) => { const z = zh ? optionZh(o.name) : undefined; return z ? `${z}（${optionLabel(o)}）` : optionLabel(o); };
  return (dish.modifiers ?? []).map((g) => `${g.name}${(g.max ?? 1) > 1 && (g.max ?? 1) < g.options.length ? ` (up to ${g.max})` : ""}: ${g.options.map((o) => `${label(o)}${o.price ? ` (+${money(o.price)})` : ""}`).join(", ")}`).join("; ");
}
/** The option words a text uses for any of `dishes`' options (to keep "extra chilli sauce" from naming a chilli dish). */
export function optionWordsSaid(text: string, dishes: WithOptions[]): Set<string> {
  const out = new Set<string>();
  for (const d of dishes) for (const o of optionsSaid(text, d, true).add) for (const w of keyWords(o)) out.add(w);
  return out;
}

/** The words of an option, for telling a dish named only by them ("pudding", "fish balls") from one ordered. */
export const optionWords = keyWords;

/**
 * Whether a word or phrase the guest said is one of `dish`'s options, by its words or the guest's
 * words for them: "fish balls", "pearls", "鱼丸".
 */
export function isOptionOf(phrase: string, dish: WithOptions): ModifierOption | null {
  return optionsSaid(phrase, dish, true).add[0] ?? null;
}
