// Demo content used by the dev seed and the onboarding copilot examples.
export const SAMPLE_ABOUT =
  "We started in 1998 as a Penang hawker stall. Today we cook the same family recipes over charcoal and wok-hei in Kuala Lumpur, with the coconut milk squeezed fresh every morning.";

/** The demo restaurant's own words, in the language it is seeded in (?lang=zh on the dev seed). */
export function sampleProfile(name: string, lang: string) {
  return lang === "zh"
    ? { story: `${name}于 1998 年在槟城从一个小贩摊起家。如今我们在吉隆坡用炭火和镬气烹煮同样的家传菜谱，椰浆每天早上新鲜现榨。`, description: "槟城小贩经典，炭火镬气。", cuisine: "马来西亚菜" }
    : { story: `${name} started in 1998 as a Penang hawker stall. Today we cook the same family recipes over charcoal and wok-hei in Kuala Lumpur, with the coconut milk squeezed fresh every morning.`, description: "Penang hawker classics, charcoal wok-hei.", cuisine: "Malaysian" };
}

/** The demo's timed menus (the menu is written in English and translated, like the rest of it). */
export const SAMPLE_TIMED = {
  breakfast: { name: "Breakfast", zh: "早餐" },
  happyHour: { name: "Happy hour", zh: "欢乐时光" },
  category: { name: "Breakfast", zh: "早餐" },
  dishes: [
    { name: "Kaya Butter Toast", price: 650, description: "charcoal-toasted bread, kaya, cold butter", zh: { name: "咖椰牛油吐司", description: "炭烤面包、咖椰酱、冰牛油" } },
    { name: "Half-Boiled Eggs", price: 450, description: "two soft eggs, white pepper, dark soy", zh: { name: "半生熟蛋", description: "两颗溏心蛋、白胡椒、黑酱油" } },
    { name: "Roti Canai with Dhal", price: 550, description: "flaky griddle bread, lentil curry", zh: { name: "印度煎饼配豆咖喱", description: "酥脆煎饼、扁豆咖喱" } },
  ],
};

export const SAMPLE_MENU = `NOODLES
★ Char Kway Teow - RM16.90 - wok-fried flat rice noodles with prawns, egg, bean sprouts, chives and soy sauce
Penang Assam Laksa - RM15.50 - tamarind mackerel broth, chilli, mint, pineapple, shrimp paste (signature)
Curry Mee - RM14.90 - coconut curry broth, yellow noodles, tofu puffs, cockles, chilli
Vegetarian Mee Goreng - RM12.90 - fried yellow noodles, tofu, vegetables

RICE
★ Nasi Lemak Ayam Rempah - RM18.90 - coconut rice, spiced fried chicken, sambal, peanuts, anchovies, egg
Hainanese Chicken Rice - RM15.90 - poached chicken, ginger, chilli sauce, chicken rice
Nasi Kerabu - RM17.50 - blue rice, herbs, salted fish, fried chicken

SIDES
Satay (6 sticks) - RM13.00 - chicken skewers with peanut sauce
Rojak - RM10.50 - fruit, cucumber, shrimp paste, crushed peanuts
Garden Salad - RM9.90 - mixed greens, cucumber, tomato

DESSERTS
Cendol - RM8.50 - shaved ice, coconut milk, palm sugar, green rice jelly
Ais Kacang - RM9.00 - shaved ice, red beans, sweet corn, evaporated milk

DRINKS
Teh Tarik - RM5.50 - pulled milk tea
Kopi O - RM4.50
Fresh Lime Juice - RM6.00
Iced Barley - RM5.00
`;

export const SAMPLE_FLOOR = "8 two-seaters, 6 tables of 4 in the patio that can be pushed together, 2 round tables of 10 that can split into 6 and 4";
