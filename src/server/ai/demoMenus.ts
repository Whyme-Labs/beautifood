// Two all-day demo menus for the menu brain (the /lab/brain page, demo/brain, the tests): timed
// menus (breakfast, weekday lunch sets, dinner, late night), dated seasons, happy hours and promos.
// Written the way a merchant pastes a menu at onboarding; the parser reads allergens, diet and
// spice from the descriptions, as it does for a real merchant (who then reviews them).
import { parseMenuText } from "../../shared/menuParser";
import { menuNow, type Clock, type PriceRule, type TimedMenu } from "../../shared/schedule";
import type { Menu, MenuItem } from "../../shared/types";
import type { AssistantContext } from "./local";

export interface DemoMenu {
  id: string;
  name: string;
  cuisine: string;
  story: string;
  text: string;
  /** Which categories are on which timed menu (a category on none is served all day). */
  menuOf: Record<string, string>;
  menus: TimedMenu[];
  /** Rules cover categories by name here; the runner maps them to ids. */
  rules: PriceRule[];
}

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const menu = (id: string, name: string, zh: string, days: number[], from: string, to: string, dates?: [string, string]): TimedMenu => ({ id, name, translations: { zh: { name: zh } }, windows: [{ days, from, to, ...(dates ? { start: dates[0], end: dates[1] } : {}) }], branches: ["*"], active: true, sort: 0 });
const rule = (id: string, name: string, zh: string, kind: "percent" | "amount", value: number, categories: string[], days: number[], from: string, to: string, dates?: [string, string]): PriceRule => ({ id, name, translations: { zh: { name: zh } }, kind, value, categories, items: [], windows: [{ days, from, to, ...(dates ? { start: dates[0], end: dates[1] } : {}) }], branches: ["*"], active: true });

export const KOPI_KAKI: DemoMenu = {
  id: "kopi-kaki",
  name: "Kopi Kaki",
  cuisine: "Malaysian kopitiam & café",
  story: "A Bangsar kopitiam open from 7am: breakfast sets, weekday lunch sets, dinner from the wok, and durian season every October.",
  text: `BREAKFAST
★ Kaya Butter Toast Set - RM8.90 - charcoal-toasted white bread, kaya, butter, two soft-boiled eggs, kopi or teh | 咖椰牛油吐司套餐
Nasi Lemak Bungkus - RM6.50 - coconut rice, sambal with anchovies, peanuts, half egg, cucumber | 椰浆饭包
Roti Bakar Telur Goyang - RM7.50 - toasted bread, two half-boiled eggs, soy sauce, white pepper
Oat Porridge with Banana - RM9.50 - rolled oats, oat milk, banana, honey, toasted almonds (vegetarian)
Vegan Big Breakfast - RM19.90 - tofu scramble, sauteed mushrooms, baked beans, avocado, sourdough toast (vegan)

LUNCH SETS
★ Nasi Lemak Ayam Berempah Set - RM16.90 - coconut rice, spiced fried chicken, sambal, peanuts, anchovies, egg, iced teh | 香料炸鸡椰浆饭套餐
Curry Laksa Set - RM15.90 - yellow noodles and vermicelli in coconut curry broth, prawns, tofu puffs, cockles, iced lime | 咖喱叻沙套餐
Claypot Chicken Rice Set - RM17.50 - chicken, Chinese sausage, salted fish, dark soy sauce, soup of the day | 瓦煲鸡饭套餐
Vegetarian Mee Goreng Set - RM13.90 - yellow noodles, tofu, cabbage, egg, chilli, iced barley (vegetarian) | 素食炒面套餐

DINNER
★ Kam Heong Lala - RM24.00 - clams wok-fried with curry leaves, dried shrimp, oyster sauce, chilli | 甘香啦啦
Ayam Masak Merah - RM18.90 - chicken braised in spiced tomato chilli gravy, served with rice
Sambal Kangkung - RM14.00 - water spinach, belacan, dried shrimp, chilli | 马拉盏蕹菜
Steamed Tofu with Minced Pork - RM16.00 - silken tofu, minced pork, soy sauce, spring onion | 肉碎蒸豆腐
Butter Prawns - RM32.00 - tiger prawns, butter, curry leaves, egg floss | 牛油虾

ALL DAY
Hainanese Chicken Chop - RM21.90 - breaded fried chicken, brown gravy, fries, coleslaw with mayonnaise | 海南鸡扒
Mee Rebus - RM12.50 - yellow noodles, sweet potato gravy, egg, tofu, green chilli, lime
Vegetable Spring Rolls - RM9.90 - crispy wheat pastry, jicama, carrot, sweet chilli sauce (vegan)

DURIAN SEASON
★ Musang King Durian Cendol - RM15.90 - shaved ice, coconut milk, gula melaka, pandan jelly, Musang King durian | 猫山王榴莲煎蕊
Durian Crepe Cake - RM18.00 - layered crepes, fresh cream, D24 durian (contains egg, milk, wheat) | 榴莲千层蛋糕
Durian Kopi Ais - RM9.90 - iced coffee, condensed milk, durian | 榴莲冰咖啡

DESSERTS
Cendol - RM7.50 - shaved ice, coconut milk, gula melaka, pandan jelly, red beans (vegan) | 煎蕊
Pulut Hitam - RM6.90 - black glutinous rice pudding, coconut milk (vegan)

DRINKS
★ Kopi O Kosong - RM3.50 - black coffee, no sugar (vegan) | 咖啡乌
Teh Tarik - RM4.50 - pulled black tea with condensed milk | 拉茶
Iced Lemon Tea - RM5.50 - black tea, lemon, cane sugar (vegan)
Barley Lime - RM5.00 - barley water, calamansi lime (vegan)
Milo Dinosaur - RM8.50 - iced Milo, condensed milk, heaped Milo powder | 美禄恐龙
Fresh Coconut - RM8.00 - whole young coconut (vegan) | 新鲜椰子
`,
  menuOf: { Breakfast: "breakfast", "Lunch sets": "lunch", Dinner: "dinner", "Durian season": "durian" },
  menus: [
    menu("breakfast", "Breakfast", "早餐", EVERY, "07:00", "11:00"),
    menu("lunch", "Weekday lunch sets", "平日午餐套餐", WEEKDAYS, "11:30", "14:30"),
    menu("dinner", "Dinner", "晚餐", EVERY, "17:30", "22:00"),
    menu("durian", "Durian season", "榴莲季", EVERY, "11:00", "22:00", ["2026-10-01", "2026-11-30"]),
  ],
  rules: [
    rule("hh", "Happy hour drinks -30%", "欢乐时光饮料七折", "percent", 30, ["Drinks"], WEEKDAYS, "15:00", "18:00"),
    rule("lunchpromo", "Lunch set RM3 off", "午餐套餐减RM3", "amount", 300, ["Lunch sets"], WEEKDAYS, "11:30", "13:00"),
    rule("durianweekend", "Durian weekend 15% off", "榴莲周末85折", "percent", 15, ["Durian season"], [0, 6], "11:00", "22:00", ["2026-10-01", "2026-11-30"]),
  ],
};

export const SAKE_SMOKE: DemoMenu = {
  id: "sake-smoke",
  name: "Sake & Smoke",
  cuisine: "Japanese izakaya & yakitori bar",
  story: "A charcoal yakitori bar in TTDI: skewers off the binchotan grill, an autumn menu while sanma is in season, and a late-night menu on weekends.",
  text: `SKEWERS
★ Chicken Negima - RM8.90 - chicken thigh and leek, tare glaze of soy sauce and mirin | 葱鸡串
Tsukune - RM9.90 - chicken meatball, egg yolk dip, tare glaze of soy sauce | 鸡肉丸串
Pork Belly Kushi - RM10.90 - pork belly, salt, shichimi | 五花肉串
Shiitake Skewer - RM7.90 - shiitake mushroom, sea salt, yuzu (vegan) | 香菇串
Tiger Prawn Skewer - RM14.90 - tiger prawns, butter, garlic | 虎虾串

SMALL PLATES
★ Chicken Karaage - RM16.90 - fried chicken thigh in wheat flour batter, Japanese mayonnaise | 日式炸鸡
Agedashi Tofu - RM12.90 - fried tofu, dashi broth with bonito, grated daikon | 扬出豆腐
Edamame - RM8.90 - steamed soybeans, sea salt (vegan) | 毛豆
Takoyaki - RM13.90 - octopus balls in wheat batter, mayonnaise, bonito flakes | 章鱼烧

RICE & NOODLES
Yaki Onigiri - RM9.90 - grilled rice ball, soy sauce glaze (vegan) | 烤饭团
Shoyu Ramen - RM26.90 - wheat noodles, chicken broth, soy sauce, chashu pork, soft egg | 酱油拉面
Gyudon - RM28.90 - sliced beef, onion, soy sauce and mirin, rice, onsen egg | 牛丼

AUTUMN MENU
★ Grilled Sanma - RM24.90 - whole Pacific saury, sea salt, grated daikon, sudachi | 盐烤秋刀鱼
Matsutake Dobin Mushi - RM38.00 - matsutake mushroom, prawn and chicken in dashi broth, served in a teapot | 松茸土瓶蒸
Chestnut Rice - RM16.90 - rice cooked with chestnuts and sake (vegan) | 栗子饭

LATE NIGHT
Midnight Ramen - RM19.90 - wheat noodles, spicy miso and soybean paste broth, minced pork, chilli oil | 深夜辣味噌拉面
Cheese Gyoza - RM14.90 - pan-fried wheat dumplings, pork, mozzarella cheese | 芝士煎饺

DESSERTS
Matcha Ice Cream - RM9.90 - matcha, milk, cream | 抹茶冰淇淋
Black Sesame Pudding - RM10.90 - black sesame, soy milk, agar (vegan) | 黑芝麻布丁

BEER & HIGHBALLS
★ Asahi Draft - RM22.00 - Japanese draft beer, wheat and barley malt | 朝日生啤
Suntory Highball - RM24.00 - Japanese whisky, soda, lemon | 三得利嗨棒
Yuzu Sake Sour - RM28.00 - junmai sake, yuzu juice, egg white | 柚子清酒酸

SOFT DRINKS
Calpis Soda - RM8.90 - cultured milk drink, soda | 可尔必思苏打
Yuzu Soda - RM9.90 - yuzu, sparkling water (vegan) | 柚子苏打
Oolong Tea - RM5.00 - iced oolong tea, free refill (vegan) | 乌龙茶
`,
  menuOf: { "Autumn menu": "autumn", "Late night": "late" },
  menus: [
    menu("autumn", "Autumn menu (sanma season)", "秋季限定", EVERY, "17:00", "23:00", ["2026-09-15", "2026-11-15"]),
    menu("late", "Late night", "深夜食堂", [4, 5, 6], "22:00", "01:30"),
  ],
  rules: [
    rule("hh", "Happy hour beer & highballs -30%", "欢乐时光啤酒嗨棒七折", "percent", 30, ["Beer & highballs"], [1, 2, 3, 4, 5, 6], "17:00", "19:30"),
    rule("skewer", "Skewer Tuesday RM2 off every skewer", "串烧星期二每串减RM2", "amount", 200, ["Skewers"], [2], "17:00", "23:00"),
  ],
};

export const DEMO_MENUS = [KOPI_KAKI, SAKE_SMOKE];

/** The merchant's menu as the app stores it: categories, dishes, timed menus and price rules. */
export function toMenu(d: DemoMenu): Menu {
  const zh = new Map<string, string>();
  const text = d.text
    .split("\n")
    .map((line) => {
      const [main, cn] = line.split(" | ");
      if (cn) zh.set(main.replace(/^★\s*/, "").split(" - ")[0].trim(), cn.trim());
      return main;
    })
    .join("\n");
  const parsed = parseMenuText(text);
  const cats = parsed.categories.map((name, n) => ({ id: `cat_${n}`, name, sort: n }));
  const catId = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
  const items: MenuItem[] = parsed.items.map((p, n) => {
    const menuId = Object.entries(d.menuOf).find(([c]) => c.toLowerCase() === p.category.toLowerCase())?.[1];
    return {
      id: `${d.id}-${n + 1}`,
      categoryId: catId.get(p.category.toLowerCase())!,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: null,
      allergens: p.allergens,
      dietary: p.dietary,
      spiceLevel: p.spiceLevel,
      story: "",
      isSignature: p.isSignature,
      tags: [],
      station: p.station,
      modifiers: [],
      active: true,
      sort: n,
      menuIds: menuId ? [menuId] : [],
      translations: zh.has(p.name) ? { zh: { name: zh.get(p.name)! } } : undefined,
    } as MenuItem;
  });
  const rules = d.rules.map((r) => ({ ...r, categories: r.categories.map((c) => catId.get(c.toLowerCase()) ?? c) }));
  return { language: "en", version: 1, categories: cats, items, menus: d.menus, rules };
}

/** The assistant context at a moment, as server/ai/index.ts builds it from the database. */
export function contextAt(d: DemoMenu, clock: Clock): AssistantContext {
  const m = menuNow(toMenu(d), "br_main", clock);
  const catName = new Map(m.categories.map((c) => [c.id, c.name]));
  return {
    restaurant: { name: d.name, cuisine: d.cuisine, story: d.story, description: "" },
    branchName: "Main",
    currency: "MYR",
    menuLanguage: "en",
    now: m.now,
    menus: m.menus,
    rules: m.rules,
    clock,
    items: m.items.map((i) => ({ ...i, category: catName.get(i.categoryId), popularity: 0 })),
  } as AssistantContext;
}
