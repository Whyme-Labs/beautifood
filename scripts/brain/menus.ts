// Restaurants the intent model trains on. None of them is the eval menu (src/server/dev/sample.ts),
// so the eval measures how the brain does on a menu it has never seen. A " | 名字" suffix gives a
// dish a Chinese name, for questions asked in Chinese.
import { parseMenuText } from "../../src/shared/menuParser";
import type { Dish } from "../../src/server/ai/brain/understand";

const MENUS = [
  `RAMEN
★ Tonkotsu Ramen - RM28 - pork bone broth, chashu, egg, spring onion | 豚骨拉面
Spicy Miso Ramen - RM29 - miso broth, chilli oil, minced pork, corn | 辣味噌拉面
Shoyu Ramen - RM26 - soy sauce broth, chicken chashu, bamboo shoots | 酱油拉面
Vegetable Ramen - RM24 - kombu broth, tofu, seasonal vegetables (vegetarian)
DONBURI
Chicken Katsu Don - RM24 - breaded chicken cutlet, egg, onion, rice | 炸鸡排饭
Salmon Don - RM32 - fresh salmon sashimi on sushi rice
Unagi Don - RM38 - grilled eel, sweet soy glaze, rice
SIDES
Gyoza - RM14 - pan-fried pork dumplings | 煎饺
Edamame - RM9 - salted soy beans (vegan)
Takoyaki - RM13 - octopus balls, mayo, bonito
DESSERTS
Matcha Ice Cream - RM10 - green tea ice cream
Mochi - RM9 - rice cake with red bean
DRINKS
Green Tea - RM4 - hot or cold | 绿茶
Yuzu Soda - RM9 - citrus soda
Calpis - RM8 - milky soft drink
Sake - RM25 - warm or cold`,
  `BREAKFAST
★ Big Breakfast - RM32 - eggs, bacon, sausage, toast, beans, hash brown
Avocado Toast - RM22 - sourdough, smashed avocado, poached egg, feta (vegetarian)
Pancake Stack - RM19 - buttermilk pancakes, maple syrup, berries
MAINS
★ Wagyu Burger - RM38 - wagyu patty, cheddar, caramelised onion, fries
Grilled Chicken Salad - RM26 - chicken breast, greens, honey mustard
Aglio Olio - RM24 - spaghetti, garlic, chilli flakes, parsley (vegetarian)
Fish and Chips - RM29 - battered dory, fries, tartar sauce
Truffle Mushroom Risotto - RM34 - arborio rice, mushrooms, truffle oil, parmesan
SIDES
Truffle Fries - RM15 - fries, truffle oil, parmesan
Soup of the Day - RM12 - ask our team
DESSERTS
Burnt Cheesecake - RM16 - basque style
Chocolate Lava Cake - RM18 - with vanilla ice cream
DRINKS
Flat White - RM12 - double shot espresso, milk
Iced Latte - RM13 - espresso, cold milk
Iced Lemon Tea - RM9 - black tea, lemon
Orange Juice - RM12 - freshly squeezed
Mocha - RM14 - espresso, chocolate, milk`,
  `DIM SUM
★ Har Gow - RM14 - prawn dumplings | 虾饺
★ Siu Mai - RM13 - pork and prawn dumplings | 烧卖
Char Siu Bao - RM11 - barbecue pork buns | 叉烧包
Chee Cheong Fun - RM12 - rice noodle rolls with soy sauce | 猪肠粉
Lo Mai Gai - RM13 - sticky rice in lotus leaf | 糯米鸡
Egg Tart - RM9 - flaky pastry, custard | 蛋挞
Turnip Cake - RM10 - pan-fried radish cake | 萝卜糕
MAINS
Wonton Noodle Soup - RM15 - egg noodles, shrimp wontons, broth | 云吞面
Roast Duck Rice - RM22 - cantonese roast duck | 烧鸭饭
Yang Chow Fried Rice - RM18 - egg, shrimp, char siu, peas | 扬州炒饭
Stir-fried Kailan - RM16 - garlic, oyster sauce | 炒芥兰
DESSERTS
Mango Sago - RM11 - mango, pomelo, sago | 杨枝甘露
Red Bean Soup - RM8 - sweet red bean | 红豆沙
DRINKS
Chinese Tea - RM3 - pu-erh or jasmine | 中国茶
Chrysanthemum Tea - RM5 - iced or hot | 菊花茶
Soy Milk - RM5 - homemade | 豆浆`,
  `ROTI
★ Roti Canai - RM2.50 - flaky flatbread with dhal and curry | 印度煎饼
Roti Telur - RM3.50 - with egg
Roti Tisu - RM5 - paper thin, sugar
Thosai - RM3 - fermented rice crepe, chutney (vegetarian)
RICE
★ Nasi Kandar - RM14 - rice, mixed curries, fried chicken | 扁担饭
Nasi Briyani Kambing - RM18 - basmati rice, mutton curry
Nasi Goreng Kampung - RM10 - village fried rice, anchovies, chilli
NOODLES
Mee Goreng Mamak - RM9 - fried yellow noodles, potato, squid, chilli
Maggi Goreng - RM8 - fried instant noodles, egg
SIDES
Murtabak Ayam - RM10 - stuffed pancake with chicken, egg, onion
Samosa - RM4 - potato and pea pastry (vegetarian)
DRINKS
★ Teh Tarik - RM3 - pulled milk tea | 拉茶
Milo Ais - RM4 - iced chocolate malt
Limau Ais - RM3 - iced lime
Kopi Susu - RM3 - coffee with condensed milk
Sirap Bandung - RM3.50 - rose syrup, milk`,
  `SMALL PLATES
Som Tam - RM16 - green papaya salad, peanuts, chilli, lime | 青木瓜沙拉
Chicken Satay - RM18 - with peanut sauce
Fish Cakes - RM15 - red curry, kaffir lime
MAINS
★ Tom Yum Goong - RM28 - hot and sour prawn soup, lemongrass | 冬阴功汤
★ Pad Thai - RM22 - rice noodles, egg, tofu, peanuts, tamarind | 泰式炒河粉
Green Curry Chicken - RM24 - coconut milk, thai basil, eggplant | 绿咖喱鸡
Basil Pork Rice - RM19 - minced pork, holy basil, chilli, fried egg
Pineapple Fried Rice - RM21 - cashews, raisins, prawns
Massaman Beef - RM29 - peanut curry, potato
Stir-fried Morning Glory - RM14 - garlic, chilli, soy (vegan)
DESSERTS
Mango Sticky Rice - RM15 - coconut cream | 芒果糯米饭
Tub Tim Grob - RM12 - water chestnut rubies, coconut milk
DRINKS
Thai Iced Tea - RM9 - sweet milk tea
Lemongrass Juice - RM8 - chilled
Coconut Water - RM10 - whole young coconut`,
  `PIZZA
★ Margherita - RM32 - tomato, mozzarella, basil (vegetarian)
Pepperoni - RM38 - beef pepperoni, mozzarella
Quattro Formaggi - RM40 - four cheeses (vegetarian)
Diavola - RM39 - spicy salami, chilli, olives
PASTA
★ Carbonara - RM34 - spaghetti, egg yolk, beef bacon, pecorino
Seafood Marinara - RM42 - prawns, mussels, squid, tomato
Pesto Penne - RM30 - basil pesto, pine nuts, parmesan
Lasagna - RM36 - beef ragu, bechamel
STARTERS
Bruschetta - RM18 - tomato, garlic, basil on toast (vegan)
Caesar Salad - RM22 - romaine, croutons, parmesan, anchovy dressing
Garlic Bread - RM12 - butter, garlic, herbs
DESSERTS
Tiramisu - RM20 - mascarpone, espresso, cocoa
Panna Cotta - RM18 - vanilla cream, berry compote
DRINKS
Sparkling Water - RM8
Fresh Lemonade - RM12 - lemon, mint
Espresso - RM8
House Red Wine - RM30 - by the glass`,
  `KOREAN BBQ
★ Samgyeopsal - RM45 - grilled pork belly set
Beef Bulgogi - RM42 - marinated beef, onion | 韩式烤牛肉
Spicy Chicken Galbi - RM36 - gochujang marinated chicken
STEWS
★ Kimchi Jjigae - RM26 - kimchi stew, tofu, pork | 泡菜汤
Sundubu Jjigae - RM27 - soft tofu stew, seafood, chilli
Doenjang Jjigae - RM24 - soybean paste stew, vegetables (vegetarian)
RICE AND NOODLES
Bibimbap - RM25 - rice, vegetables, egg, gochujang | 石锅拌饭
Japchae - RM22 - glass noodles, vegetables, beef
Tteokbokki - RM18 - spicy rice cakes, fish cake
Korean Fried Chicken - RM34 - crispy, soy garlic or spicy | 韩式炸鸡
SIDES
Kimchi Pancake - RM20 - kimchi, scallion
Steamed Egg - RM12 - fluffy egg custard
DRINKS
Soju - RM28
Barley Tea - RM4 - roasted barley, iced
Banana Milk - RM7
Citron Tea - RM9 - yuja honey tea`,
  `NYONYA
★ Ayam Pongteh - RM24 - braised chicken, fermented soy beans, potato
★ Laksa Lemak - RM19 - coconut curry noodles, prawns, cockles | 娘惹叻沙
Nyonya Kari Kapitan - RM26 - chicken curry, coconut, lime leaf
Asam Pedas Ikan - RM28 - sour spicy fish stew, okra | 亚参辣鱼
Jiu Hu Char - RM18 - stir-fried jicama, cuttlefish
Otak-otak - RM14 - spiced fish custard in banana leaf
Pie Tee - RM14 - crispy cups, turnip, prawn
Nasi Ulam - RM16 - herb rice, salted fish
KUIH
Kuih Lapis - RM6 - layered rice cake (vegan)
Onde-onde - RM6 - pandan balls, palm sugar, coconut
Pulut Tai Tai - RM7 - blue rice cake with kaya
DRINKS
Air Bandung - RM6 - rose syrup, milk
Calamansi Juice - RM7 - with sour plum
Barley Lime - RM6 - iced
Kopi O Kosong - RM4 - black coffee, no sugar`,
];

export interface TrainingMenu {
  items: Dish[];
}

export function trainingMenus(): TrainingMenu[] {
  return MENUS.map((text, m) => {
    const zh = new Map<string, string>();
    const clean = text
      .split("\n")
      .map((line) => {
        const [main, cn] = line.split(" | ");
        if (cn) zh.set(main.replace(/^★\s*/, "").split(" - ")[0].trim(), cn.trim());
        return main;
      })
      .join("\n");
    const items = parseMenuText(clean).items.map((p, n) => ({
      id: `m${m}d${n}`,
      name: p.name,
      category: p.category,
      description: p.description,
      price: p.price,
      allergens: p.allergens,
      dietary: p.dietary,
      spiceLevel: p.spiceLevel,
      isSignature: p.isSignature,
      translations: zh.has(p.name) ? { zh: { name: zh.get(p.name)! } } : undefined,
    }));
    return { items };
  });
}
