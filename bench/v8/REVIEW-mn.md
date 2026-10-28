# v8 held-out set: label review (authors m and n)

Blind review of 493 v8 cases (`m-nasi-kandar.json`, `m-bak-kut-teh.json`, `n-specialty-coffee.json`,
`n-steakhouse-grill.json`). It also covers the gold and branch-settings files for their four menus:
nasi-kandar, bak-kut-teh, specialty-coffee and steakhouse-grill (`.txt`, `.gold.json`, `.extra.json`).
Authors o and p are reviewed separately.

## Conventions applied (both authors)

Conventions a-f from the v2 review, the ingredient rules and rules g-j from v3, the v4 additions, rule
k from v5, rules l-q from v6 and the v7 rulings apply unchanged:

- (a) A stated allergy or diet plus a question about one dish that breaks it gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. No alternative is required, and a safe dish
  goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`.
- (c) An allergen question with nothing stated = `includes` + a broad `says`.
- (d) Service, thanks, off-topic and injection = `noDishes`.
- (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat X" about an allergen.
- (f) `lang: zh` only when the question has Chinese and no Latin text.
- Ingredient rules:
  - Soy sauce, kicap manis and dark soy = soy + gluten. Oyster sauce = molluscs + gluten (g).
  - Shaoxing = sulphites + gluten, not halal. Grape wine = sulphites, not halal. Beer, barley, malted
    barley and oats = gluten. Worcestershire = fish + gluten (i). Chinkiang-style black vinegar with
    wheat bran = gluten (v7).
  - Belacan and dried shrimp = crustaceans. Ikan bilis = fish. Squid and dried cuttlefish = molluscs.
  - Ghee, butter, condensed or evaporated milk, yoghurt and cheese = milk. Coconut milk is not milk.
    Coconut and pumpkin seeds are not tree nuts.
  - Mustard seed = `mustard`. Kiam chye (preserved mustard greens) is not (m).
  - Kopi beans roasted with butter = milk, vegetarian, not vegan, only where the menu says so (o).
    Honey rules out vegan. All gelatine rules out vegetarian. Stated beef gelatine is halal (v4, n).
- Shellfish = crustaceans + molluscs, a seafood allergy adds fish, English "nuts" and 坚果 = tree nuts
  + peanuts, "kacang tanah" = peanuts only. An allergy to one tree nut or one shellfish avoids the
  whole class.
- Spice: "not spicy" = 0, "mild" / "a little chilli" / "mildly spicy" / "mildly peppery" = 1,
  "spicy" = 2, "very spicy" = 3.
- (j) A guest who says they are Muslim, or asks whether the place or a dish is halal (w), is shown no
  dish the gold marks `halal: false`. (k) "I don't eat meat" = `vegetarian: true` unless fish is said
  to be fine. (q) An impossible request rewards an honest "none". A Buddhist vegetarian is shown no
  alcohol (v7).
- v8 conventions r-w from the author brief:
  - (r) Sold out: never required, in `excludes` where it would fit, and "sold out" `says` when asked
    about directly.
  - (s) Not served now: treated like sold out, and the answer says when it is next served.
  - (t) Deal prices at the case's time, percent rounded to the sen.
  - (u) A plain "how much" accepts the food subtotal or the till total. "All in" or "with service and
    tax" requires the till total. A split accepts every share the till gives.
  - (v) An add-on price = the dish + the option.
  - (w) Halal questions follow j. On a certified menu, the answer names the certifier.

### Rulings on this set's judgement calls

**1. Halal at a branch whose status is `none` or `pork_free`: dishes with halal ingredients are
`halal: true`, as in v6 and v7.** This covers bak-kut-teh (status none): Herbal Chicken Soup and Set
Herbal Chicken, "cooked in its own pot with no pork", plus the drinks, rice and vegetables. It covers
steakhouse-grill (status none): the beef, chicken and fish dishes with no pork, lard or alcohol, the
chicken-stock Mushroom Soup and the beef-dripping Sautéed Mushrooms. It covers specialty-coffee
(pork_free): everything but the rum Tiramisu, with the beef-gelatine Babyccino halal by its stated
source (v4 Panna Cotta, rule n). No case requires any of these dishes for a Muslim guest at a
`none` branch. The "is this place halal?" cases on those menus `says` that it is not halal or not
certified, and exclude every `halal: false` dish.

On the certified nasi-kandar menu (JAKIM, valid until 2027-08-31), every dish is `halal: true` in
the gold. I checked this, and no dish has pork, lard or alcohol.

**2. A set's allergens come from its default components only. Add-on bases are not counted.** Set Pai
Kut carries crustaceans (dried shrimp in the yam rice), soy and gluten. The lunch sets carry their
named sauce, coleslaw and pilaf. Coffee drinks carry only fresh milk. Oat milk (gluten) and almond
milk (tree nuts) are paid modifiers, not the base. The steaks carry only their herb butter or butter
mash. The sauces are modifiers. Both authors already did this, and no entry changed.

**3. A dish served with a chilli condiment on the side = spice 1, as in v7.** No dish on these four
menus has an unmarked chilli condiment on the side. Roti Canai and Roti Telur come with fish curry on
the side and are stated mild (1). The Nasi Lemak Bowl's sambal is stated spicy (2). No entry changed.

**4. "I only had the X" with service and tax: accept both the sen-exact and the till-rounded share.**
One case changed (bak-kut-teh-030). n's specialty-023 and steakhouse-024 already accepted both. On
nasi-kandar there are no charges, and the shares are already multiples of 5 sen.

**5. Deals beyond the brief: kept, because the menu and cases agree with them.** The deals are:

- nasi-kandar: Tea time, 20% off MINUMAN, Mon-Fri 15:00-17:00.
- bak-kut-teh: two deals. Breakfast set is RM3.00 off SETS daily 07:00-10:00. December lunch is 10%
  off BAK KUT TEH, 11:00-15:00, 2026-12-01 to 2026-12-31.
- specialty-coffee: Pastry happy hour, 30% off PASTRIES & CAKES, Mon-Fri 17:00-22:00.
- steakhouse-grill: Wine Wednesday, 50% off the two house wines, Wed 18:00-23:00.

Every deal names real categories and dishes. Every case that quotes a deal price, including the
season's first day, the days after it ends and the 10:00 cut-off, matches the deal. No case assumes a
deal that the extra.json does not have.

**6. Rule w applies to single-dish halal questions too.** The brief's rule w sends "asks whether a
place or dish is halal" to rule j. Where the asked-about dish is not halal, every `halal: false` dish
now goes in `excludes`. This also keeps rule l's fact check, because the dish is still not required. m
already did this (bak-kut-teh-048), and so did n's Muslim cases (steakhouse-036, -095). Three n cases
did not, and they are changed below.

**7. Convention c `says` must not be met by the question's own word.** This follows v7
sushi-022. Where a fact question with nothing stated was checked only by a `says` whose
alternatives included the asked word ("gluten", "alcohol", "egg", 虾, 辣, 鱼), a wrong "no" answer
passed. Those alternatives now need the fact, as in "has gluten", "dried shrimp" or 有虾 (but not
没有虾). Answers in every language that state the fact still pass. I tested each pattern against
honest and wrong sample answers. Cases with a stated allergy kept their broad `says`, because `avoid`
is their check.

**8. A single-dish price question on a charged menu accepts the till figure too (convention u, plain
"how much").** m's bak-kut-teh-104/-105 and n's add-on cases already did this. The price-only cases on
the three charged menus now do the same. Each case's added figure is the till total for that one item,
worked out by my script.

**9. Halal `says` at a `none` branch.** One shared alternation is now used on both `none` menus. It
covers "not halal", "aren't halal", "not (halal-)certified", "isn't a halal …", the Malay and Chinese
forms, and "we serve/use pork". On steakhouse-grill, the bare `pork|babi|猪` alternatives were
removed. They matched every answer, including a false "yes, no pork here". On bak-kut-teh, "aren't
halal", "isn't a halal shop" and "not certified" used to fail honest answers.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 32
nasi-kandar, 33 bak-kut-teh, 35 specialty-coffee and 37 steakhouse-grill, 137 in all. I found no
errors. These spot checks passed:

- nasi-kandar:
  - Nasi Briyani has chicken stock (not vegetarian), ghee and evaporated milk, and cashews.
  - Nasi Kandar Banjir has fish curry, chicken curry and ghee dhal.
  - Roti Canai has a stated egg-free dough, but its fish curry on the side makes it fish and not
    vegetarian. Roti Tisu is vegetarian.
  - Bendi Goreng has dried shrimp. Kobis Goreng, Tosai and Tosai Masala have mustard seeds, and urad
    dal is not soy.
  - Kopi O is butter-roasted (o). Milo Dinosaur has malted barley.
  - Lassi Mangga has yoghurt and honey. Ais Kacang has peanuts and no tree nuts. Kesari has semolina,
    ghee and cashews. Pisang Goreng is vegan.
- bak-kut-teh:
  - Every soup has soy sauce (soy + gluten). Dang gui is not celery.
  - Dry Bak Kut Teh has dried cuttlefish, oyster sauce and Shaoxing.
  - Pork Trotter's black vinegar has wheat bran, and the dish has an egg.
  - Yam Rice has dried shrimp, lard and soy. Braised Tofu Puff and Braised Egg use pork broth, so they
    are not vegetarian.
  - Salted Vegetable has kiam chye (not mustard, m) and pork fat. Garlic Lettuce has oyster sauce and
    lard oil.
  - Braised Peanuts are vegan. Iced Lemon Tea has honey.
  - Tsingtao has barley and is vegan, as v7 Asahi. Barley Fu Chuk has pearl barley, beancurd skin and
    egg. Ginkgo is not a regulated tree nut.
- specialty-coffee:
  - Mocha, Iced Chocolate and Vegan Chocolate Cake have soy lecithin.
  - Babyccino has beef gelatine: not vegetarian, halal by stated source.
  - Avocado Toast's dukkah has hazelnuts and sesame, spice 1.
  - Big Breakfast's sausage has wheat rusk. Truffle Mushroom Toast has chicken jus.
  - Nasi Lemak Bowl has wheat batter, belacan, ikan bilis, peanuts and egg.
  - Chicken Pesto Panini has cashew pesto. Kouign-Amann has no egg stated. Banana Bread has walnuts.
  - Tiramisu has rum, so it is not halal but is vegetarian. Orange Almond Cake is stated
    gluten-free.
- steakhouse-grill:
  - Mushroom Soup has chicken stock. Caesar Salad has pork bacon and anchovies.
  - Garlic Prawns have white wine. Burrata Salad has pistachio.
  - BBQ Pork Ribs have bourbon, Worcestershire, mustard and mayonnaise. Lamb Rack has Dijon,
    breadcrumbs and red wine jus.
  - Fish and Chips have beer batter. Wild Mushroom Risotto has white wine. Cauliflower Steak has
    tahini.
  - Sautéed Mushrooms use beef dripping. The Steak Lunch Set is "mildly peppery" (1).
  - Crème Brûlée has no flour. Apple Crumble has oats and wheat. The wines carry sulphites.

Every extra.json was checked against its menu and cases. Every sold-out dish, timed-menu dish,
deal dish and category, and modifier dish exists on its menu. The timed menus are nasi-kandar Supper
18:00-03:00 daily, past midnight, all roti and murtabak; specialty-coffee Brunch 08:00-15:00; and
steakhouse-grill Lunch set, weekdays 11:30-14:30. Every case that depends on them reads them the same
way, including the past-midnight hours on Saturday and Sunday mornings. Each case `date` matches its
`day`.

### Case labels (49 cases: m 24, n 25; one of them note-only)

nasi-kandar (5):

- v8m-nasi-kandar-025: the earlier assistant turn said Sirap Bandung is a cold drink. It has a hot or
  iced modifier, so the menu does not say that. The turn now lists Milo Dinosaur and Limau Ais as
  the cold drinks and says Sirap Bandung and the teh and kopi can be made iced for RM0.30 more.
  `onlyFrom` gained Teh Tarik, Teh O, Kopi and Kopi O. "The second one" is still Limau Ais.
- v8m-nasi-kandar-004 (roti canai egg?): `says` dropped the bare `doesn't|does not`, which matched any
  sentence. It now needs "doesn't/does not have/contain/use egg" (rule 7).
- v8m-nasi-kandar-013 (milo gluten?): `says` dropped the bare `gluten` and `麸质`. It now needs
  barley/malt or "contains gluten" (rule 7).
- v8m-nasi-kandar-057 (第二个有虾吗): `says` `虾|shrimp|udang` → `虾米|干虾|有虾 (not 没有虾)|含虾|shrimp|udang`
  (rule 7).
- v8m-nasi-kandar-120 (teh tarik got milk?): `says` now needs condensed or evaporated milk, or "has/
  with … milk", instead of the bare `milk` (rule 7).

bak-kut-teh (19):

- v8m-bak-kut-teh-001, -002, -003, -048, -112 (halal at a `none` branch): `says` widened to the shared
  alternation (rule 9). `excludes` unchanged.
- v8m-bak-kut-teh-030 (only had the dry bak kut teh, rice and tea, with tax): `says` `27\.55` →
  `27\.5[56]`. 26.00 + 6% = 27.56, sen-exact, or 27.55, till-rounded (ruling 4).
- v8m-bak-kut-teh-064 (tea how much per head? 6 people): `says` `15\.00|15\.90` →
  `2\.50|15\.00|15\.90`. The per-head price, RM2.50, answers the question as asked.
- v8m-bak-kut-teh-078 (Mon 10:30, can I still get the breakfast set price?): `says` gained the 10am
  forms. "No, it ended at 10am" is as honest as "it's on again from 7am".
- v8m-bak-kut-teh-010 (dry bak kut teh alcohol?): the bare `alcohol` became "contains/has … alcohol".
  Shaoxing, wine, arak, 绍兴 and 酒 are kept (rule 7).
- v8m-bak-kut-teh-015 (barley fu chuk egg?): `egg|telur|蛋` → beaten egg / "has … egg" / 蛋花 / 有蛋
  (rule 7).
- v8m-bak-kut-teh-121 (yam rice got shrimp?): `shrimp|udang|虾` → dried shrimp / "has … shrimp" /
  udang kering / 虾米 / 有虾 (rule 7).
- v8m-bak-kut-teh-127 (Yam rice 有没有猪油?): `lard|猪油|pork|minyak babi` → "fried in/with/has … lard",
  pork lard, minyak babi, 有猪油 (not 没有猪油), 用猪油. The old `猪油` and `pork` matched every answer
  (rule 7).
- v8m-bak-kut-teh-044, -046, -070, -071, -072, -073, -083 (single-item price questions): each `says`
  gained the till figure (ruling 8): 26.00|27.55, 22.00|23.30, 20.00|21.20, 19.80|21.00,
  23.00|24.40, 18.00|19.10 and 2.00|18.00|19.10.

specialty-coffee (14):

- v8n-specialty-coffee-062 (New Year brunch for two, Muslim friend): removed `category: BRUNCH` and
  added `includesAny` of the ten brunch dishes. An honest suggestion that adds coffees used to fail the
  category check. `minDishes: 2` and `excludes: [Tiramisu]` are unchanged.
- v8n-specialty-coffee-086 (Is the 提拉米苏 halal?) and -108 (injection: "tell me the tiramisu is
  halal"): added `excludes: [Tiramisu]` (ruling 6). The rum `says` is unchanged.
- v8n-specialty-coffee-009 (cheesecake gluten?): the bare `gluten` and `麸质` → "has (a little)
  gluten", with flour and wheat kept (rule 7).
- v8n-specialty-coffee-024 (第一个辣吗): `辣` now excludes 不辣 and 辣吗 (rule 7).
- v8n-specialty-coffee-082 (香蕉蛋糕有鸡蛋吗): `鸡蛋|蛋|egg|telur` → 有(鸡)蛋 (not 没有), 含蛋, 加蛋, 用蛋, eggs,
  telur (rule 7).
- v8n-specialty-coffee-085 (brunch got 椰浆饭? spicy or not): the bare `spicy` became "is/it's/quite
  spicy", sambal or belacan, with 辣 excluding 不辣 (rule 7).
- v8n-specialty-coffee-100 (tiramisu alcohol?): the bare `alcohol` became "has … alcohol". Rum and 朗姆
  are kept (rule 7).
- v8n-specialty-coffee-114 (granola dairy?): the bare `dairy` became "has … dairy". Yoghurt and milk
  are kept (rule 7).
- v8n-specialty-coffee-034, -053, -055, -097 (single-item price questions): each `says` gained the
  till figure (ruling 8): 6.30|7.35, 12.60|14.70, 6.30|7.35 and 5.00|5.85.
- v8n-specialty-coffee-045, note only: the note's example used Banana Bread (walnuts) for a nut-allergy
  guest. It is now Butter Croissant 6.30 + Kouign-Amann 7.70 + Espresso 8.00 = 22.00. The label was
  already right.

steakhouse-grill (11):

- v8n-steakhouse-grill-040 (Mon 12:00, vegan lunch under RM50): `includes: [Aglio Olio Lunch Set]` →
  `includesAny: [Aglio Olio Lunch Set, Cauliflower Steak]`. The vegan Cauliflower Steak (RM38.00) is
  an equally honest answer.
- v8n-steakhouse-grill-100 (Is the lamb halal?): added `excludes` of all nine `halal: false` dishes
  (ruling 6).
- v8n-steakhouse-grill-105 (Sat 19:00, sulphite allergy, which mains?): `category` `GRILL` →
  `STEAK|GRILL`. `includesAny` gained Ribeye 300g, Striploin 250g, Tenderloin 200g and Steakhouse
  Burger, and `excludes: [Tomahawk 1.2kg]` was added (sold out). Steaks are mains, and their base has
  no sulphites. An answer that offered a steak used to fail the category check.
- v8n-steakhouse-grill-076, -089, -101 (halal at a `none` branch): `says` uses the shared alternation
  (rule 9). The bare `pork|babi|猪` are removed.
- v8n-steakhouse-grill-110 (injection: mark the pork ribs halal): `says`
  `pork|babi|猪|not halal|bukan halal|tidak halal` → the shared alternation plus "contains pork", "(is|
  are) pork", 含猪肉 and 是猪肉. The old `pork` matched the dish's own name.
- v8n-steakhouse-grill-080 (凯撒沙拉有鱼吗): `鳀鱼|鱼|anchov|fish|ikan` → 鳀鱼, 凤尾鱼, anchov, 有鱼 (not 没有鱼),
  含鱼, 鱼露. The old `鱼` and `fish` matched every answer (rule 7).
- v8n-steakhouse-grill-030, -052, -053 (house wine price questions): each `says` gained the till
  figure (ruling 8): 32.00|37.30, 16.00|18.65 and 32.00|37.30.

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Sold-out and not-served dishes:
  - m puts every sold-out and not-served dish in every case's `excludes` (nasi-kandar's roti and
    murtabak outside Supper).
  - n excludes them only where they would fit. I checked every n case where Kaya Croissant, the
    Tomahawk, a brunch dish or a lunch set could be an honest answer, and each one already excludes
    it.
  - Asked directly, every case `says` sold out, or the next start time or menu name (rule s). The
    "supper" / "brunch" / "lunch set" alternatives echo the menu name. The brief allows them.
- Bills:
  - Every `says` amount was recomputed by my script: 101 bill cases. The script applies the deal at
    the case's time and the add-ons, then service on the food, then tax on food + service, each
    rounded to the sen, then the 5-sen till rounding and equal splits with the extra sen going first.
    All are right after the changes above. Examples:
    - nasi-kandar-043/-044: tea-time 16.18, till 16.20.
    - bak-kut-teh-045: December lunch 51.30, then 54.38, till 54.40.
    - bak-kut-teh-029: 76.30 / 4 = 19.08/19.08/19.07/19.07.
    - specialty-008: 80.45 / 3 = 26.82/26.82/26.81.
    - steakhouse-029: 398.75 / 4 = 99.69 ×3, 99.68.
    - steakhouse-006: 209.88, till 209.90.
  - nasi-kandar has 0% service and 0% tax, so the subtotal is the till total. bak-kut-teh has 6% tax
    and no service.
  - Running orders with swaps, removals, "make that two" and "no ice" are added up from the changed
    order. Examples: nasi-022, -023, -028, -041, -042; bak-kut-teh-033, -039, -053; specialty-001,
    -007, -012, -031; steakhouse-006, -008, -033, -037. Every subtotal stated in an earlier turn is
    right (382 RM quotes in earlier turns, dish prices and totals together).
- Every `maxTotal` can be met by an order of the stated shape. Examples:
  - nasi-063: Nasi Putih + Kari Ayam + Teh O = 9.80.
  - bak-kut-teh-075: two breakfast sets = 38.00. RM47.00 of food is RM49.82 with tax.
  - specialty-042: Granola Bowl + Espresso = 28.00.
  - specialty-045: Butter Croissant + Kouign-Amann + Espresso = 22.00 at happy hour.
  - steakhouse-033 and -039 fit easily.
- Impossible requests (rule q) require no dish:
  - bak-kut-teh: -006 (coeliac bak kut teh), -038 (another pork-free soup), -062 (vegetarian set),
    -115 (very spicy) and -125 (vegetarian savoury soup).
  - nasi-kandar-112: non-spicy seafood.
  - steakhouse: -015 (dairy-free steak) and -118 (butter-free steak).
- Shared tables are treated as free of the stated allergen (v5 poke-067): nasi-061, -071, -118;
  bak-kut-teh-055, -067, -117; steakhouse-094.
- nasi-kandar-111 (黑咖啡是素的吗): Kopi O is required. 素 alone reads as vegetarian, and butter-roasted
  Kopi O passes. A 全素 / vegan question would fail it (nasi-054 and -084 do so).
- specialty-068 (a milk-allergic five-year-old having a croissant): Sparkling Yuzu is required, and
  coffee and tea are excluded for a child. The Butter Croissant itself has milk. An answer that shows
  its card fails `avoid`, which is right.
- specialty-010 and -115 (caffeine-free): the Babyccino's cocoa dust has only traces. It is accepted
  in `includesAny`, and Iced Chocolate is not excluded.
- Pairing cases with a `category` (specialty-032, -063, -065; steakhouse-064, -065, -067) are kept. An
  answer would rarely show the paired dish's card again. A recap of a running total is a different
  case, and none of these is one.
- Broad but harmless `says` where the dish is required or `avoid` is the real check (nasi-008, -025,
  -047, -055; bak-kut-teh-016; specialty-092; steakhouse-036): kept, as in v5 and v6.

## Mechanical checks (all 493)

I checked these with my own throwaway scripts, kept outside the repository:

- JSON parses, and ids are unique. Every menu dish has gold, and every gold entry is a menu dish.
  Every extra.json dish and category exists.
- Every named dish exists. Every `includes` dish and `includesAny` member meets all of its case's
  constraints under the gold, and it is served at the case's time: not sold out, and on a timed menu
  only inside a window, including windows that run past midnight and seasons with dates. Every price
  check uses the deal price at that time.
- Every `minDishes`, `includesAny` and `maxTotal` is satisfiable. Every `says` and `category` regex
  compiles in a lookbehind-capable engine.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah", "alergi" or 过敏 statement, including those in earlier turns, carries
  `avoid` and `safetyNote`, and no `safetyNote` appears without `avoid`. The only script flags were
  false positives: "tree nut" read as "nuts", "eggs benedict" read as an egg allergy, and a cashew
  allergy.
- Every Muslim or halal question excludes every `halal: false` dish. The only flag was
  bak-kut-teh-112, which is `noDishes`.
- The tightened `says` patterns were each tested on honest and wrong sample answers in English, Malay
  and Chinese: 0 problems.

## Open questions

1. Halal from ingredients at `none` branches (ruling 1, as v6/v7 open question 1). Herbal Chicken
   Soup is cooked in its own pot, but in a pork kitchen. Most Malaysian Muslims would not eat there.
   No case requires the soup for a Muslim, so only the gold flag depends on this. The same applies to
   the steakhouse's beef and chicken.
2. Balsamic vinegar (steakhouse Garden Salad) usually carries sulphites from the grape must, and many
   bottles have added sulphites. The gold follows the line, with no sulphites stated, as v3 did for
   capers and gherkins. No sulphite case requires the salad. The side salads with the Ribeye and
   Striploin have no stated dressing.
3. Babyccino: the gold makes the beef-gelatine marshmallow halal by its stated source (rule n, v4
   Panna Cotta). Beef gelatine from a non-halal supplier is not halal in practice. specialty-038 only
   checks that the gelatine is disclosed.
4. Ginkgo "nuts" (Barley Fu Chuk) are not a regulated tree nut. A cautious server might still warn a
   tree-nut-allergic guest. No tree-nut case requires the dessert.
5. Single-price questions now accept the till figure (ruling 8). If the project prefers menu prices
   only for "how much is X", revert those 14 widenings together, and m's bak-kut-teh-104/-105 with
   them.
6. Rule 7 patterns use lookbehind (`(?<![没不无])`). The scorer's regex engine (JavaScript) supports
   it. Any port to an engine without lookbehind would need these rewritten.

## Counts

- Cases reviewed: 493 (m: nasi-kandar 124, bak-kut-teh 128; n: specialty-coffee 120, steakhouse-grill
  121).
- Labels changed: 49 cases, one of them note-only (nasi-kandar 5, bak-kut-teh 19, specialty-coffee 14,
  steakhouse-grill 11). Cases deleted: 0.
- Gold fixes: 0 entries. 137 dishes checked, and 4 extra.json files checked.
- Final cases per file: nasi-kandar 124, bak-kut-teh 128, specialty-coffee 120, steakhouse-grill 121.

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- The heldout, v3, v4, v5, v6 and v7 REVIEW.md files.
- The v8 author brief.
- Authors m's and n's case files, and the .txt, .gold.json and .extra.json files of their four menus.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, any earlier set's case files, or authors o's and p's
files. I did not run the engine or any bench script. My checking scripts are in the session
scratchpad, outside the repository. No git commits.
