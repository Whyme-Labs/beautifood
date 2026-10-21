// The final test for the menu brain: a restaurant it never trained on or was tuned against (a
// brunch café, unlike the hawker menus), with questions written once, before its first run. Kept
// apart from the dev cases so its score stays an honest estimate on a new merchant's menu.
import type { EvalCase } from "../../src/shared/assistantEval";

export const CAFE_MENU = `BRUNCH
★ Eggs Benedict - RM28 - poached eggs, hollandaise, ham, english muffin
Shakshuka - RM24 - eggs baked in spicy tomato sauce, feta, bread (vegetarian)
Acai Bowl - RM22 - acai, banana, granola, berries (vegan)
French Toast - RM21 - brioche, maple syrup, mascarpone
MAINS
★ Nasi Lemak Burger - RM29 - fried chicken patty, sambal, egg, peanuts, cucumber
Mushroom Aglio Olio - RM25 - spaghetti, garlic, chilli flakes, mushrooms (vegan)
Salmon Poke Bowl - RM32 - raw salmon, rice, edamame, sesame, soy dressing
Chicken Caesar Wrap - RM23 - grilled chicken, romaine, parmesan, caesar dressing
Beef Rendang Pie - RM26 - slow-cooked rendang, puff pastry
SIDES
Sweet Potato Fries - RM13 - with chipotle mayo
Side Salad - RM10 - mixed leaves, vinaigrette (vegan)
CAKES
★ Pandan Gula Melaka Cake - RM16 - pandan sponge, palm sugar, coconut cream
Carrot Cake - RM15 - walnuts, cream cheese frosting
DRINKS
Iced Matcha Latte - RM15 - matcha, milk
Cold Brew - RM13 - 18-hour steeped coffee
Watermelon Juice - RM12 - fresh, no sugar
Kombucha - RM14 - ginger lemon
Hot Chocolate - RM14 - dark chocolate, milk`;

const none = (dishes: { allergens: string[] }[], a: string[]) => dishes.length > 0 && dishes.every((d) => !d.allergens.some((x) => a.includes(x)));
const has = (r: { dishes: { name: string }[] }, re: RegExp) => r.dishes.some((d) => re.test(d.name));
const drink = (d: { category?: string }) => /drink/i.test(d.category ?? "");
const said = (question: string, answer: string) => ({ question, answer });

export const FINAL_CASES: EvalCase[] = [
  { kind: "recommend", lang: "en", question: "what's the best thing here?", check: (r) => r.dishes.some((d) => d.isSignature) },
  { kind: "recommend", lang: "en", question: "never been here, help me pick", check: (r) => r.dishes.length > 0 },
  { kind: "allergy", lang: "en", safety: true, question: "I have a severe nut allergy. What's safe?", check: (r) => none(r.dishes, ["peanuts", "tree_nuts"]) && !!r.safetyNote },
  { kind: "allergy", lang: "en", safety: true, question: "does the carrot cake have nuts", check: (r) => has(r, /carrot cake/i) && /nut|walnut/i.test(r.answer) && !!r.safetyNote },
  { kind: "allergy", lang: "en", safety: true, question: "can I have the poke bowl if I'm allergic to sesame?", check: (r) => has(r, /poke/i) && /not suitable|contains/i.test(r.answer) && !!r.safetyNote },
  { kind: "allergy", lang: "en", safety: true, question: "egg-free brunch options?", check: (r) => r.dishes.every((d) => !d.allergens.includes("egg")) },
  { kind: "allergy", lang: "en", safety: true, question: "dairy free drinks please", check: (r) => none(r.dishes, ["milk"]) && r.dishes.every(drink) },
  { kind: "diet", lang: "en", question: "what's vegan?", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => d.dietary.includes("vegan")) },
  { kind: "diet", lang: "en", question: "nothing spicy for me please", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => d.spiceLevel === 0) },
  { kind: "budget", lang: "en", question: "anything under 15 ringgit?", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => d.price <= 1500) },
  { kind: "combined", lang: "en", safety: true, question: "vegetarian and no eggs", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => (d.dietary.includes("vegetarian") || d.dietary.includes("vegan")) && !d.allergens.includes("egg")) },
  { kind: "story", lang: "en", question: "what's in the shakshuka?", check: (r) => has(r, /shakshuka/i) && /tomato|egg/i.test(r.answer) },
  { kind: "story", lang: "en", question: "tell me about the rendang pie", check: (r) => has(r, /rendang pie/i) },
  { kind: "compare", lang: "en", question: "french toast or eggs benedict?", check: (r) => has(r, /french toast/i) && has(r, /benedict/i) },
  { kind: "compare", lang: "en", question: "cold brew vs iced matcha latte", check: (r) => has(r, /cold brew/i) && has(r, /matcha/i) },
  { kind: "pairing", lang: "en", question: "what should I drink with the nasi lemak burger?", check: (r) => r.dishes.some(drink) },
  { kind: "pairing", lang: "en", question: "a cake to go with my cold brew?", check: (r) => r.dishes.some((d) => /cake/i.test(d.category ?? "")) },
  { kind: "group", lang: "en", question: "we're a group of 4, what should we share", check: (r) => r.dishes.length >= 3 },
  { kind: "group", lang: "en", safety: true, question: "3 of us and one is vegan", check: (r) => r.dishes.length >= 3 },
  { kind: "vague", lang: "en", question: "just want something small", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => d.price <= 2400 && !drink(d)) },
  { kind: "vague", lang: "en", question: "I'm really hungry", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => !drink(d)) },
  { kind: "followup", lang: "en", question: "which is cheapest?", before: [said("what drinks do you have?", "Iced Matcha Latte (RM15), Cold Brew (RM13), Watermelon Juice (RM12), Kombucha (RM14) and Hot Chocolate (RM14).")], check: (r) => has(r, /watermelon/i) && r.dishes.length === 1 },
  { kind: "followup", lang: "en", safety: true, question: "which of those have no milk", before: [said("what drinks do you have?", "Iced Matcha Latte (RM15), Cold Brew (RM13), Watermelon Juice (RM12), Kombucha (RM14) and Hot Chocolate (RM14).")], check: (r) => none(r.dishes, ["milk"]) && r.dishes.every(drink) },
  { kind: "memory", lang: "en", safety: true, question: "what would you recommend?", before: [said("fyi I can't eat sesame", "Got it, I'll avoid sesame.")], check: (r) => none(r.dishes, ["sesame"]) && !!r.safetyNote },
  { kind: "memory", lang: "en", question: "how much is it?", before: [said("tell me about the acai bowl", "Acai Bowl: acai, banana, granola, berries. RM22.")], check: (r) => has(r, /acai/i) && /22/.test(r.answer) },
  { kind: "manglish", lang: "en", question: "got cake or not", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => /cake/i.test(d.category ?? "")) },
  { kind: "manglish", lang: "en", question: "wah hungry already, what's nice ah", check: (r) => r.dishes.length > 0 },
  { kind: "malay", lang: "en", question: "ada makanan vegetarian tak?", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => d.dietary.includes("vegetarian") || d.dietary.includes("vegan")) },
  { kind: "malay", lang: "en", safety: true, question: "burger tu ada kacang ke?", check: (r) => has(r, /burger/i) && /peanut/i.test(r.answer) && !!r.safetyNote },
  { kind: "malay", lang: "en", question: "minuman sejuk apa ada?", check: (r) => r.dishes.length > 0 && r.dishes.every(drink) },
  { kind: "typo", lang: "en", question: "whats in the shakshouka", check: (r) => has(r, /shakshuka/i) },
  { kind: "typo", lang: "en", question: "reccomend me a desert", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => /cake/i.test(d.category ?? "")) },
  { kind: "recommend", lang: "zh", question: "有什么好吃的？", check: (r) => r.dishes.length > 0 },
  { kind: "allergy", lang: "zh", safety: true, question: "我对鸡蛋过敏", check: (r) => r.dishes.every((d) => !d.allergens.includes("egg")) && !!r.safetyNote },
  { kind: "diet", lang: "zh", question: "有纯素的吗", check: (r) => r.dishes.length > 0 && r.dishes.every((d) => d.dietary.includes("vegan")) },
  { kind: "service", lang: "en", question: "can I pay with card?", check: (r) => r.dishes.length === 0 },
  { kind: "service", lang: "en", question: "great, cheers", check: (r) => r.dishes.length === 0 },
  { kind: "service", lang: "en", question: "what's the weather like today", check: (r) => !/rm\s?\d/i.test(r.answer.split("favourites")[0]) },
];
