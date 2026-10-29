# v9-dev label review (author r)

Blind review of author r's 258 v9-dev cases: `r-pan-mee-house.json` (129) and
`r-smoothie-acai-bar.json` (129). It also covers the gold and branch settings of the two menus
(`pan-mee-house` and `smoothie-acai-bar`: `.txt`, `.gold.json`, `.extra.json`). Authors q and s are
reviewed separately.

## Conventions applied

Conventions a-f from v2, the ingredient rules and rules g-j from v3, the v4 additions, rule k from v5,
rules l-q from v6, the v7 rulings and the v8 rulings (both v8 reviews) all apply unchanged:

- (a) A stated allergy or diet plus a question about one dish that breaks it gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. No alternative is required, and a safe dish
  goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`. (c) An allergen question with nothing stated = `includes` + a
  `says` that the question's own word cannot meet (v8 rule 7). (d) Service, thanks, off-topic and
  injection = `noDishes`. (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat
  X" about an allergen. (f) `lang: zh` only when the question has Chinese and no Latin text.
- Ingredient rules: soy sauce, light and dark soy = soy + gluten; oyster sauce = molluscs + gluten
  (g); ikan bilis, fish paste, fish sauce, anchovy = fish; belacan, shrimp paste, dried shrimp =
  crustaceans; squid = molluscs; oats, oat milk and pearl barley = gluten; malt (Milo) = gluten;
  condensed and evaporated milk, butter, feta, cheddar, parmesan, cream cheese, whey, yoghurt = milk;
  coconut milk is not milk; coconut, chia, hemp and pumpkin seeds are not tree nuts; honey rules out
  vegan.
- Shellfish = crustaceans + molluscs, a seafood allergy adds fish, English "nuts" and 坚果 = tree nuts
  + peanuts, "kacang tanah" = peanuts only.
- (j)/(w) A Muslim guest, or a guest asking whether the place or a dish is halal, is shown no
  `halal: false` dish. (k) "I don't eat meat" = vegetarian. (l) A single-dish diet question: a failing
  dish is checked by `says` and not required. (o) Kopi O is milk only where the menu says the beans are
  butter-roasted. (q) An impossible request rewards an honest "none".
- v8/v9 branch conventions r-w: sold out and not-served-now (r, s), prices at the case's time (t),
  totals and splits (u), add-ons and sizes (v), halal standing (w).

The seven rulings made for all three v9 authors were applied:

1. Halal at a `none` branch (pan-mee-house): dishes with halal ingredients are `halal: true`. On the
   `muslim_friendly` smoothie-acai-bar every dish must be halal, and it is.
2. A dish's gold is its default components. Add-on allergens are not counted.
3. Totals: a plain "how much"/"total" accepts the food subtotal, the sen-exact or the cash-rounded
   till total; "all in" / "with service and tax" accepts the two till totals only; a split accepts
   every share of either total; "I only had X" accepts that person's share, exact or rounded.
4. Sold-out add-on options: `"soldOut": true` on an option removed, the option taken out of every
   group, and the cases that ask for it relabelled (below).
5. A dish that is also an add-on: no case on these two menus needs the double reading (Braised Egg
   is a side and the egg add-on is "Extra Egg"; Fish Ball Soup is a side and "Fish Balls" an add-on).
6. Kopi O: the pan-mee menu says nothing about butter-roasted beans, so Kopi O has no milk and is
   vegan. The gold already had this.
7. Sizes add their option price; free options never change a total. Here the "Iced" temperature
   option is priced (+RM0.50) on the pan-mee drinks and Breakfast Set, which is common in kopitiams,
   so it is not a free option. Every total adds it where the guest says iced, peng or ais, and adds
   nothing for less sweet, kosong, siew dai, no ice or 走冰.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 30
pan-mee-house and 30 smoothie-acai-bar, 60 in all. I found no errors. Spot checks that passed:

- pan-mee-house:
  - Every pork noodle has soy (minced pork in soy sauce) and fish (ikan bilis). Mee Hoon Kueh is
    stated egg-free.
  - Dry Chilli Pan Mee: the house chilli flakes are fried with dried shrimp (crustaceans).
  - Yee Mee and Fu Chuk Rolls: oyster sauce = molluscs + gluten.
  - Tom Yam Pan Mee: shrimp paste and prawns, squid, fish balls and fish sauce, evaporated milk, and
    no soy. It is `halal: true` from chicken stock and "no pork" (ruling 1). So is Curry Pan Mee
    (dried shrimp, tofu puffs; coconut milk is not milk).
  - Vegetarian Pan Mee and Hakka Lui Cha are vegan. Lui Cha has peanuts, sesame and tofu, and no
    gluten (brown rice).
  - Fried Wantan and Sui Kow: wheat and egg wrappers, prawns, sesame oil. The wantan's mayonnaise =
    egg.
  - Fish Ball Soup: fish only (tapioca starch, no wheat), halal from its ingredients.
  - Blanched Choy Sum (oyster sauce) and Sweet Potato Leaves Belacan are not vegetarian.
  - Breakfast Set takes its default hot kopi (condensed milk), plus kaya (egg), butter and soy from
    the eggs. Barley (pearl barley) and Milo (malt) = gluten. Herbal Jelly: honey on the side, so
    vegetarian and not vegan.
- smoothie-acai-bar:
  - The house granola (oats, honey, coconut) makes Classic, Peanut Butter, Berry Protein and Mini
    Acai Bowl and the Granola Yoghurt Cup gluten and not vegan. Tropical Acai Bowl ("no granola") is
    vegan and allergen-free. Pitaya Bowl's granola is stated gluten-free; its almond milk = tree nuts.
  - Green Goddess Bowl: oat milk = gluten. Green Detox: celery. Avocado Gula Melaka: the ice cream is
    stated to contain egg.
  - Chicken Caesar Wrap: egg yolk and anchovy in the dressing, parmesan, croutons. Breakfast Wrap:
    wheat rusk in the chicken sausage.
  - Energy Balls: cashews and oats, vegan. Chia Pudding: coconut milk, vegan, no allergen.

### Branch settings (2 files changed, ruling 4)

- pan-mee-house.extra.json: the `Meatballs` option (+RM3.00, `"soldOut": true`) was removed from the
  Add-ons group of Soup Pan Mee, Dry Chilli Pan Mee, Ban Mian, Yee Mee and Mee Hoon Kueh. The
  groups' `max` stays 6, now with six options. `soldOut: ["Pork Meatball Soup"]` stays.
- smoothie-acai-bar.extra.json: the `Almond Butter` topping (+RM3.50, `"soldOut": true`) was removed
  from the Toppings group of all six full-size bowls (max 5, now 7 options) and the Mini Acai Bowl
  (max 2, now 5 options).

Everything else checked out against the menu and the cases:

- pan-mee-house: 0% service, 6% tax inclusive, 5-sen rounding, status `none`. Breakfast (Kaya Butter
  Toast, Half-boiled Eggs, Breakfast Set) runs 07:00-11:00 daily. Pork Meatball Soup is sold out.
- smoothie-acai-bar: 10% service, 6% tax on top, 5-sen rounding, `muslim_friendly`. The Tuesday deal
  is RM3.00 off ACAI BOWLS (the five acai bowls, not the two smoothie bowls), all day Tuesday.
- Every modifier dish and option name used by a case exists. Every price is in sen, and every
  `min`/`max` is consistent with its options.

### Case labels (31 cases, 3 of them note-only)

pan-mee-house (17):

- v9r-pan-mee-house-004 ("Do you charge service charge? Is the SST already in the prices?"): the
  service `says` gained "don't charge (a) service", "service charge is zero/none", "zero service" and
  Malay and Chinese forms. A correct "We don't charge service charge" used to fail.
- v9r-pan-mee-house-018: note only. The add-on list no longer names Meatballs (ruling 4).
- v9r-pan-mee-house-020 (Lui Cha, "can add an egg?"): `says` dropped the bare `1.00|1.50`. 1.50 is
  also the noodles' Extra Egg price, so a wrong "yes, +RM1.50" passed. It gained `braised egg|卤蛋|
  telur rebus`, because offering the Braised Egg side is an honest answer.
- v9r-pan-mee-house-025 (vegetarian, Vegetarian Pan Mee with extra egg): `says` gained the Braised
  Egg side (vegetarian, RM2.00) as an honest alternative.
- v9r-pan-mee-house-028 (tom yam, "can make less spicy?"): `says` `less spicy|kurang pedas|少辣|free…`
  → a yes (`yes|boleh|可以`, "can make it less spicy", "less spicy option/is free") or the
  free-option alternatives. The bare words echoed the question, so a wrong "can't make it less spicy"
  passed (v8 rule 7).
- v9r-pan-mee-house-029 ("Can I add meatballs?") and -102 (板面可以加肉丸吗？): `says` → ruling 4's
  alternation `not available|unavailable|sold out|habis|finished|don't have|do not have|no longer|
  没有|卖完|售罄`, plus `isn't/aren't available|out of stock|ran out|tiada lagi|tak ada lagi|tidak ada
  lagi`. "Sorry, meatballs aren't available" is honest and failed ruling 4's list alone.
- v9r-pan-mee-house-030 (curry, "can add prawns?"): `says` gained `tom ?yam|冬炎|东炎`. "Prawns are
  only on the Tom Yam Pan Mee" is an honest answer.
- v9r-pan-mee-house-046 (dry chilli pan mee, egg?): `says` dropped the bare `telur`, `鸡蛋` and
  `egg and`, which matched a wrong "tiada telur" / "没有鸡蛋". It now needs "has/with/comes with
  (a poached) egg", poached or fried egg, egg noodles, `ada telur` (not `tiada`/`tak`/`tidak`),
  `有蛋`/`有鸡蛋` (not `没有`), 水波蛋 or 蛋面 (v8 rule 7).
- v9r-pan-mee-house-071, -086, -087, -116 (halal at a `none` branch): the shared `says` alternation
  now blocks "don't/not/never/no serve/use pork", `tiada babi`, `tak guna babi`, `没有猪肉` and
  similar. The old "(serve|use) pork" and `有猪肉` also matched a wrong "Yes, halal, we don't serve
  pork" or "是清真的，没有猪肉" (v8 ruling 9). The excludes (all 9 `halal: false` dishes) are unchanged.
- v9r-pan-mee-house-110 (那三个哪个没有猪肉？ after the three snacks): `noDishes` + `onlyFrom` →
  `excludes: [Fried Wantan, Fu Chuk Rolls, Sui Kow]`. All three have pork (rule q), and an honest
  answer may offer a pork-free side such as Fish Ball Soup. `says` gained 都含有猪肉, 全都有, 都有肉,
  没有一个, "each has pork" and "all of them contain pork".
- v9r-pan-mee-house-118 (龟苓膏是全素的吗？): `says` `蜂蜜|honey|madu` → 不是全素, 不算全素, 有/配/附/含
  蜂蜜 (not 没有), 旁边有蜂蜜, "not vegan", honey (not "no honey") and `ada madu`. The bare 蜂蜜 passed
  a wrong "是全素的，没有蜂蜜" (v8 rule 7).
- v9r-pan-mee-house-120 (coeliac, 有什么可以吃): `includesAny` gained `Herbal Jelly`. It is
  gluten-free and is food, so an answer that offered it used to fail.
- v9r-pan-mee-house-129: the earlier assistant turn listed only three of the five non-spicy,
  prawn-free noodles as if complete. It now lists all five: 汤板面, 板面条, 伊面 (RM11.90), 面粉粿 and
  素板面. The label (15.90) is unchanged.

smoothie-acai-bar (14):

- v9r-smoothie-acai-bar-006 ("Is the Tuesday acai deal on today?", Wednesday): `says` gained "today
  is Wednesday", `hari ini Rabu`, 今天是星期三, 今天没有 and 今天不. "Today's Wednesday, so no" is
  honest and used to fail.
- v9r-smoothie-acai-bar-017 and -019: notes only. Almond Butter is no longer listed as a topping
  (ruling 4).
- v9r-smoothie-acai-bar-018 ("can add almond butter on top?"), -092 (mentega badam) and -102
  (杏仁酱还有吗？): `says` → ruling 4's alternation with the same additions as pan-mee-029.
- v9r-smoothie-acai-bar-029 (PB Banana Power, "can less sweet?"): the same change as pan-mee-028. A
  yes, "less sweet option/is free", "no added sugar" or the free-option alternatives are accepted.
  The bare echo is no longer accepted.
- v9r-smoothie-acai-bar-030 ("Can I add whey protein to the acai bowl?"): `says` gained `booster`
  and "only for smoothies" forms. "Whey is a smoothie booster, not a bowl topping" is honest.
- v9r-smoothie-acai-bar-037 (Choc Almond Recovery, nuts?): `tree.?nuts?` must no longer follow "no",
  "free of", "without" or "not", or be followed by "free" (v8 rule 7).
- v9r-smoothie-acai-bar-058 ("Is the classic acai bowl vegan?"): `says` `honey|madu|蜂蜜` → honey
  (not after "no", "without" or "free of"), "not vegan", `bukan/tidak vegan`, `ada madu` (not
  `tiada`), `mengandungi madu`, 不是全素, 有蜂蜜 (not 没有). The bare words passed a wrong "vegan, no
  honey".
- v9r-smoothie-acai-bar-065, -066, -067: the earlier assistant turn said "The Mixed Nuts and Almond
  Butter toppings and the Almond Milk option also have tree nuts". Almond Butter is no longer on the
  menu (ruling 4), so the turn now names only the Mixed Nuts topping and the Almond Milk option. The
  labels are unchanged, and -067's note was updated.
- v9r-smoothie-acai-bar-113: question 烟熏三文鱼吐司可以加鳄梨吗？ → 加牛油果吗？. 鳄梨 is the mainland
  word. Malaysians say 牛油果, as the menu does. The test (the add-on, not the Avocado Toast) is the
  same.

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed by my own till script from the menu and extra.json. The script
  takes the deal at the case's time, adds the option prices, then service on the food and tax on
  food + service (each rounded to the sen), then the 5-sen rounding, then equal splits with the
  extra sen first. That covered 63 pan-mee and 54 smoothie amount cases, and all are right. Examples:
  - pan-mee (tax inclusive, no service, so the till is the subtotal): -011 106.20 / 6 = 17.70;
    -008 49.00 / 3 = 16.34/16.33; -015 45.10; -094 58.00 / 4 = 14.50; -104 Saturday breakfast
    sets 18.30.
  - smoothie: -001 27.90 → 32.53 → 32.55; -007 Tuesday 55.70 → 64.95; -009 112.40 / 3 = 37.47/
    37.46; -012 178.40 / 5 = 35.68; -051 67.16 or 67.15 / 2 = 33.58/33.57; -109 98.41 or 98.40 /
    3 = 32.81/32.80; -124 Tuesday 45.30 → 52.82 → 52.80; -128 "含税" accepts only the till figures.
  - Every "all in" case accepts only the two till figures. Every separate-bill case (-010, -093)
    gives each person's own till.
- No bill includes a removed option's price. No case relies on the deal outside Tuesday, and
  -008 (pitaya on Tuesday) and -006 (Wednesday) are labelled as outside the deal.
- Every earlier assistant turn states prices that are right at its time: deal prices only on Tuesday,
  breakfast only 07:00-11:00, and iced drinks at +0.50. Every running subtotal is right: pan-mee
  -032, -033, -048, -049, -050, -054 and smoothie -042, -048, -049, -052.
- References resolve to one dish, or every reading gives the same answer. "The cheaper one" in
  pan-mee-038 is Vegetarian Pan Mee. In smoothie-116, 最便宜那个 is either RM15.90 wrap, and both give
  31.80. In smoothie-046, "those two cheaper ones" is both RM15.90 wraps.
- Add-on vs dish names: pan-mee-010 (grass jelly / Herbal Jelly), -016 (Kopi O in the set / the
  Kopi O drink), -017 (lime / Lime Juice), -021, -085, -098, -127 (fish balls / Fish Ball Soup), and
  smoothie-016, -023, -124 (granola / Granola Yoghurt Cup), -025, -113 (avocado / Avocado Toast), -026
  (smoked salmon / Smoked Salmon Toast), -098, -123, -128 (chia / Chia Pudding). The
  separate dish is in `excludes`, and those excludes are kept. A card is an "add to order" button
  (convention a), so showing the RM2.30 Kopi O card for a free set drink is the error the case tests.
  The answer may still name the option in text. pan-mee-033 keeps the cancelled Fried Wantan in
  `excludes` for the same reason.
- Breakfast items and the sold-out soup are excluded in every case where they would fit, including
  the direct questions pan-mee-007 and -103 (rule s). My script found no unavailable dish that fits a
  case's constraints and is not excluded.
- Single-dish diet and halal facts: pan-mee-074 (curry halal by ingredients) requires the dish and
  excludes the 9 pork dishes. pan-mee-045 (barley gluten) and smoothie-056 (green goddess gluten)
  check the failing fact only (rule l). smoothie-069 and -078 (chicken, muslim-friendly) require the
  dish.
- Rule-q "none" cases have only constraint checks: pan-mee-068 (egg allergy at breakfast) and -076
  (vegetarian vegetable side), and smoothie-074 (shellfish: nothing to watch out for).
- Allergen add-ons (ruling 2): pan-mee-041 (shellfish, chilli flakes with dried shrimp) and
  smoothie-060/-126 (milk allergy, latte or chocolate with oat milk) use `avoid` + `safetyNote` + a
  broad `says`. The base dish has milk, so its card is not shown even though the oat swap removes the
  milk. That follows ruling 2.
- Free vs priced options: Breakfast Set drink choice, noodle type, soup/dry, chilli level, sweetness
  and ice are free. Iced (+0.50), sizes, add-ons and milk swaps are priced. Every total follows that.

## Mechanical checks (all 258)

Checked with my own throwaway scripts in the session scratchpad:

- JSON parses, ids are unique, `split` is `dev`, and every tag is in the schema.
- Every menu dish has gold and every gold entry is a menu dish. Allergens are in the enum, spice is
  0-3, no vegan dish is non-vegetarian, and every smoothie-acai-bar dish is halal.
- Every extra.json dish, category and modifier name exists. No option has a field besides
  name/price.
- Every named dish exists. Every `includes` dish and `includesAny` member meets all of its case's
  constraints at the case's time: avoid, diet, spice, the deal price, category, excludes, onlyFrom,
  and served now (not sold out, inside the breakfast window).
- Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case requires a dish.
- Every `says` and `category` regex compiles. Each changed `says` was tested on honest and wrong
  sample answers in English, Malay and Chinese: 0 problems.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, alah or 过敏 statement, earlier turns included, carries `avoid` and
  `safetyNote`, and no `safetyNote` appears without `avoid`.
- Every Muslim or halal question on pan-mee-house excludes all 9 `halal: false` dishes.

## Open questions

1. Ruling 4's `says` list has no "isn't available" or "out of stock". I added those forms (and
   tiada/tak ada lagi for Malay) to the five cases. If the shared list is meant to be exact, they can
   be dropped again, but an honest "almond butter isn't available" would then fail.
2. Priced "Iced" temperature (+RM0.50) on pan-mee-house. Ruling 7 names temperature among the free
   options. I read that as "free options, such as sugar, ice or temperature when they are free".
   If the project wants every temperature free, every pan-mee total with an iced drink changes.
3. Fish Ball Soup and Blanched Choy Sum are `halal: true` at a pork kitchen (ruling 1, v7 open
   question 1). No case requires them for a Muslim guest. pan-mee-072 asks for a drink only.
4. The pan-mee Chilli Flakes add-on is assumed to be the house chilli flakes (fried with dried
   shrimp) described on the Dry Chilli Pan Mee line. pan-mee-041 depends on it, and the menu does not
   describe the add-on separately.
5. The smoothie Milk group offers oat or almond milk on Mango Tango, Green Detox and Dragon Fruit
   Lychee, which are coconut-water drinks with no milk. It is odd but harmless, and no case uses it.

## Counts

- Cases reviewed: 258 (pan-mee-house 129, smoothie-acai-bar 129).
- Labels changed: 31 cases (pan-mee-house 17, smoothie-acai-bar 14), 3 of them note-only (pan-mee-018,
  smoothie-017, -019). Cases deleted: 0.
- Final cases per file: r-pan-mee-house 129, r-smoothie-acai-bar 129.
- Gold fixes: 0 entries (60 dishes checked). Branch settings: 2 files changed (ruling 4).

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- bench/heldout/REVIEW.md, bench/v3-v7 REVIEW.md, and bench/v8/REVIEW-mn.md and REVIEW-op.md.
- The review brief and author r's brief.
- Author r's files: the pan-mee-house and smoothie-acai-bar menus (.txt, .gold.json, .extra.json) and
  the two case files.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, any earlier set's case files, or authors q's and s's
files. I did not run the engine or any bench script. My checking scripts are in the session
scratchpad. No git commits.
