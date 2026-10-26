# v7 held-out set: label review

Blind review of the 466 v7 cases (`k-sushi-donburi.json`, `k-turkish-grill.json`,
`l-chicken-rice-shop.json`, `l-sichuan-mala.json`) and the gold files for the four v7 menus
(sushi-donburi, turkish-grill, chicken-rice-shop, sichuan-mala).

## Conventions applied (both authors)

Conventions a-f from the v2 review (`bench/heldout/REVIEW.md`), the ingredient rules and rules g-j
from v3, the v4 additions, rule k from v5 and rules l-q from v6 apply unchanged:

- (a) stated allergy or diet plus a question about one dish that breaks it: `avoid` (or
  `vegetarian`/`vegan`) plus `safetyNote` for an allergy, with no required alternative. If the dish is
  safe, it goes in `includes`. (b) not on the menu = `maxDishes: 3`. (c) allergen question with
  nothing stated = `includes` plus a broad `says`. (d) service, thanks, off-topic and injection =
  `noDishes`. (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat X" about an
  allergen, not for intolerance or preference wording. (f) `lang: zh` only when the question has
  Chinese and no Latin text.
- Ingredient rules: soy sauce, shoyu, miso, doubanjiang, sweet bean sauce = soy + gluten. Oyster sauce
  = molluscs + gluten (g). Shaoxing = sulphites + gluten, not halal. Mirin, sake and fermented rice
  wine (jiuniang) = not halal, with no allergen (h). Rose wine = not halal, no allergen. Beer, barley,
  bulgur, wheat vermicelli (sehriye) = gluten. Dashi, bonito, kamaboko, tobiko, ikura, mentaiko = fish.
  Surimi stated "no real crab" = fish (+ gluten and egg as stated), no crustaceans. Dried scallop and
  dried octopus = molluscs. Coconut and pumpkin seeds are not tree nuts. Honey rules out vegan. Chinese
  celery = celery.
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" and Chinese 坚果 =
  tree nuts + peanuts. Malay "kacang tanah" = peanuts only. An allergy to one tree nut (walnut,
  hazelnut) avoids the whole tree-nut class.
- Spice: "not spicy" = 0, "mild" / "a little chilli" / "mildly spicy" / a chilli condiment with no
  heat word = 1, "spicy" = 2, "very spicy" = 3.
- (j) A guest who says they are Muslim, or asks whether the restaurant or menu is halal, is shown no
  dish the gold marks `halal: false`. (k) "I don't eat meat" = `vegetarian: true` unless the guest
  says fish is fine. (l) single-dish diet questions with nothing stated: a failing dish is checked
  with `says` and not required; a passing dish goes in `includes`. (m) mustard greens are not the
  `mustard` allergen; mustard as a condiment, seed or oil is. (o) kopi beans roasted with butter =
  milk. (q) impossible requests reward an honest "none".

### Rulings on this set's judgement calls

**Wasabi = `mustard`, and a dish served with wasabi = spice 1 (author k, kept).** The menu states
the wasabi three times as "horseradish and mustard". That is the common blend of horseradish, mustard
powder and colouring sold as wasabi outside Japan. Mustard as a condiment, seed or powder is the
allergen under rule m (only the leaves were excluded), so Salmon Avocado Temaki, Salmon Sashimi and
Sashimi Moriawase carry `mustard`. Salmon Nigiri does not: its menu line names no wasabi, and the gold
reads only what the line says. For spice, a pungent condiment served with the dish and given no heat
word is 1, as v6 did for chilli sauce (dessert-house Chee Cheong Fun). Salmon Avocado Temaki is 1 from
its own "mild". The three wasabi dishes are never required for a guest with `maxSpice: 0`, and
sushi-063 ("which sushi comes without wasabi?") excludes exactly these three.

**Mirin (author k, kept).** Mirin = not halal (rule h), so every dish with mirin, sake or unagi /
kabayaki / tendon / tare sauces that name mirin is `halal: false`: 13 dishes plus the sake and the
beer. These include Tofu Teriyaki Don (vegan but not halal) and the "no pork, no lard" Chicken Katsu
Don and Oyakodon. Teriyaki Chicken Don's "alcohol-free mirin-style seasoning", stated "no alcohol", is
halal. Katsu Curry Rice (stated no alcohol) is halal. Chicken Karaage is not halal for the sake in
its marinade. Calpis = milk (a cultured milk drink, stated "made from milk").

**Kopi O with butter-roasted beans (author l, kept).** Kopi O = `milk`, vegetarian, not vegan (v6
rule o). The chicken-rice Kopi O line says so ("beans roasted with butter and sugar"). The other kopi
are milk anyway from condensed or evaporated milk.

**Chinkiang black vinegar = gluten (author l, kept).** Zhenjiang vinegar is brewed from glutinous
rice with wheat bran and a wheat-based qu starter, so it is not gluten-free. This is what makes
Smashed Cucumber (no soy sauce) and the vegan Suan La Fen (sweet potato noodles) gluten dishes. Wood
Ear Salad uses rice vinegar and stays gluten-free. All eight Chinkiang dishes carry `gluten`.

**Halal from ingredients in a kitchen that serves pork (author l, kept).** As in v3-v6 (v6 open
question 6), a chicken, duck or beef dish with no pork, lard, pork stock or alcohol is `halal: true`.
This applies to the chicken rice plates, Salted Vegetable Duck Soup, Mapo Tofu, Fuqi Feipian,
Shui Zhu Yu and the beef-tallow Vegetable Mala Xiang Guo. Cases that require such a dish for a Muslim
guest (chicken-023, -024; sichuan-031 through minDishes) are kept, because an honest answer that names
the dish with a "not halal-certified, the shop also serves pork" caveat passes them. See open question
1.

**Siu yuk with yellow mustard = `mustard`; pickled mustard greens are not (author l, kept).** The
yellow mustard is the condiment and counts. Siu Yuk Rice, Char Siu and Siu Yuk Rice and Roast Meat
Platter carry it. Kiam chye (Salted Vegetable Duck Soup), ya cai (Dan Dan Noodles, Chongqing Xiao
Mian, Dry-fried Green Beans) and the pickled mustard greens in Suan La Fen do not (rule m).

**Impossible requests (rule q).** I checked every case where nothing fits. Each one has only
constraint checks and requires no dish, so an honest "none" passes:

- sushi-015 (vegetarian soup) and sushi-020 (coeliac donburi).
- turkish-021 (coeliac kebab), -025 and -043 (nut-free dessert) and -079 (tree-nut-free dessert).
- chicken-046 (shellfish + sesame chicken dish) and chicken-073 ("very very spicy").
- sichuan-011 (non-spicy mapo), -042 (peanut-free noodle dish) and -054 (sulphite-free duck).

turkish-079 and sushi-081 were changed so that an honest answer which also recaps the order passes
(below).

**Split bills.** A share must accept the nearest-cent amount, the amount rounded up to cover the bill,
and the unrounded figure. sushi-078 (114.40 / 3) accepts `38\.1[34]`, which matches 38.13, 38.14 and
38.133…. sichuan-092 (110.00 / 3) accepts `36\.6[67]`, which matches 36.66, 36.67 and 36.666…. turkish-075
(61.30) and chicken-083 (17.35) divide evenly. No change was needed. See open question 3 on 5-sen
rounding.

**New in v7: a Buddhist vegetarian is not shown alcohol.** Buddhist vegetarian (zhai) practice
avoids the pungent vegetables and also intoxicants (the fifth precept). Both authors already excluded
the allium dishes. The sake, beer and Tsingtao are tagged vegetarian or vegan in the gold, so the
labels let them through. They are now excluded (sushi-017, sichuan-023). No honest answer is affected.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 35
sushi-donburi, 33 turkish-grill, 36 chicken-rice-shop and 36 sichuan-mala, 140 in all. I found no
errors. Spot checks that passed:

- sushi-donburi:
  - Miso Soup, Tamago Nigiri, Inari Sushi, Agedashi Tofu and Vegetable Tempura Don have dashi, so
    none of them is vegetarian.
  - California Maki: surimi with wheat starch and egg white, so fish + gluten + egg and no
    crustaceans.
  - Chicken Karaage: potato starch has no gluten, but soy sauce does; sake = not halal.
  - Matcha Ice Cream: kinako = soy.
  - Mochi Trio: glutinous rice and potato starch, so the only allergen is sesame.
  - Katsu Curry Rice: milk powder in the roux.
  - Asahi: barley malt = gluten.
  - Oyakodon's mitsuba is not celery.
- turkish-grill:
  - Mercimek Soup and Rice Pilav are made with chicken stock, so not vegetarian. Bulgur Pilav uses
    vegetable stock, so it is vegetarian but not vegan.
  - Every pilav has wheat: sehriye vermicelli or bulgur.
  - Mercimek Kofte is vegan (bulgur = gluten).
  - Haydari (walnuts) and Sutlac (hazelnut) carry hidden tree nuts. Turkish Coffee is served with
    pistachio lokum = tree nuts.
  - Salgam: bulgur = gluten.
  - Beef Doner Wrap: mayo = egg, no milk.
  - Sucuk is beef, so halal.
  - Grilled Sea Bass is the only main with no gluten and no milk.
- chicken-rice-shop:
  - Plain Chicken Rice, Chicken Rice Balls, House Chilli Sauce and Ginger Dip use chicken fat or
    chicken stock, so none of them is vegetarian.
  - Bean Sprouts in Oyster Sauce and Kai Lan in Oyster Sauce: oyster sauce = molluscs + gluten, so
    not vegetarian. Stir-fried Kai Lan with Ginger is stated without it, so it is vegan.
  - Braised Tofu and Egg: pork master stock, so not vegetarian and not halal.
  - Egg Tart: lard pastry, so not vegetarian and not halal.
  - Old Cucumber and Lotus Root soups: pork ribs; dried scallop and octopus = molluscs; Lotus Root
    also has peanuts.
  - Herbal Jelly: honey on the side, so vegetarian but not vegan.
  - Barley Water: pearl barley = gluten.
  - Siu Yuk Rice: five-spice and salt, so no soy and no gluten.
- sichuan-mala:
  - Vegetable Mala Xiang Guo: beef tallow, so not vegetarian; halal from its ingredients.
  - Garlic Bok Choy: oyster sauce, so not vegetarian.
  - Century Egg Tofu: pork floss.
  - Chongqing Xiao Mian: pork bone stock.
  - Yu Xiang Eggplant: no fish, but minced pork.
  - Shui Zhu Yu: egg-white velveting and Chinese celery.
  - Tea-smoked Duck: Shaoxing only, so sulphites + gluten, not spicy.
  - Jiuniang Tangyuan: rice wine (no allergen, not halal) and egg.
  - Brown Sugar Ciba: soybean flour.
  - Sichuan Peppercorn Ice Cream: stated egg-free.

### Case labels (7 cases)

- v7k-sushi-donburi-017 (Buddhist vegetarian, no onion or garlic): `excludes` gained
  `Hakutsuru Junmai Sake` and `Asahi Super Dry`. The gold tags both vegetarian/vegan, and Buddhist
  vegetarian practice avoids alcohol (ruling above).
- v7k-sushi-donburi-022 ("Does the miso soup have gluten?"): `says`
  `gluten|wheat|barley|gandum|麸质|小麦|miso` → `gluten|wheat|barley|gandum|麸质|小麦|大麦`. The `miso`
  alternative matched the dish name, so any answer passed, including a wrong "it's gluten-free".
- v7k-sushi-donburi-081 (shellfish allergy carried, "add a starter, what's the total?"): removed
  `category: STARTER` and `maxDishes: 3`, and added `includesAny` with the six shellfish-free
  starters (Edamame, Spicy Garlic Edamame, Chicken Karaage, Agedashi Tofu, Goma Wakame Salad, Miso
  Soup). An honest answer that recaps the total ("Teriyaki Chicken Don RM19.90 + Edamame RM7.90")
  shows the donburi card again and used to fail the category check. `avoid` and `safetyNote` are
  unchanged.
- v7k-sushi-donburi-115 ("tak pedas for my kid, 不要生鱼"): `excludes` gained the sake and Asahi.
  Alcohol is never an honest answer for a child (v4 taiwanese-084). k already did this in sushi-028
  and -038.
- v7k-turkish-grill-079 (tree-nut allergy carried, "add a dessert, what's the total?"): removed
  `category: DESSERT`. Every dessert has nuts (rule q). The honest answer is "none is safe", maybe with
  a nut-free sweet drink and the unchanged total, and that answer may show the Chicken Doner Wrap or
  Mint Lemonade card, which used to fail the category check. This matches turkish-043, which has no
  category. `avoid` and `safetyNote` are unchanged.
- v7l-sichuan-mala-023 (Buddhist vegetarian, no egg, garlic or onion): `excludes` gained
  `Tsingtao Beer`, which the gold tags vegan (ruling above).
- v7l-sichuan-mala-087 ("Bajet RM20 je, nak makan pedas. Apa ada?"): `maxTotal: 2000` →
  `maxPrice: 2000`. The guest asks what is available, and `maxTotal` counts every dish shown. An honest
  list of two or three spicy dishes under RM20 (for example Liangfen, Suan La Fen and Dan Dan
  Noodles) used to fail. The `includesAny` of spicy dishes under RM20 is unchanged.

Cases removed: none.

### Checked and left as they are (judgement calls)

- Halal fact questions with no diet stated check the fact only, and every dish they require is
  `halal: true`:
  - sushi-049, -050, -051, -056 and -108
  - chicken-025, -026, -030 and -031
  - sichuan-033 and -034
  turkish-052 ("Is everything here halal?") needs no `excludes`, because every dish on the Turkish
  menu is `halal: true`. Its `says: halal` is nearly vacuous but harmless.
- Whole-menu and Muslim cases: the excludes list matches the gold's `halal: false` set exactly on
  every menu (sushi 15, chicken-rice 9, sichuan 14).
- sushi-019 (crab allergy, California Maki) and turkish-032 (milk allergy, Beef Doner Wrap): the dish
  is safe by the gold, so it is shown (convention a).
- sushi-084 and turkish-081: a shared table is treated as free of the stated allergen (v5 poke-067).
  The vegetarian's only main at the sushi table is Tofu Teriyaki Don.
- sushi-101 (sencha → Genmaicha), turkish-096 (shawarma → doner wraps) and turkish-100 (米布丁 →
  Sutlac) require the nearest dish. Each one is a true answer on the menu, not a substitute.
- turkish-044 requires Shepherd Salad as the non-spicy gluten-free starter. It is listed under SIDES,
  but it is the only other gluten-free dish that can start a meal, so a careful server offers it.
- sichuan-027 (我吃素, mapo tofu) requires Vegetarian Mapo Tofu. The menu has a vegetarian version of
  the very dish asked about, so an honest answer names it.
- chicken-042, -036, -049 and -110 (stated allergy, the dish contains it): `avoid` + `safetyNote` only,
  with no `says`. This is allowed by convention a.
- sichuan-070 ("no 花生 can?") and sichuan-077 ("my mum doesn't eat seafood") are preferences:
  `avoid` or `says` without `safetyNote` (convention e).
- Order totals: I recomputed every `says` total from the menu, and all are right:
  - sushi: -074 24.80, -075 44.70, -076 30.70, -077 36.80, -078 38.13/38.14, -079 43.80,
    -080 35.70, -112 21.90.
  - turkish: -071 60.80, -072 54.70, -073 52.50, -074 49.80, -075 61.30, -076 38.70, -077 37.70,
    -078 52.80, -101 4.90, -114 34.90.
  - chicken: -080 32.30, -081 33.60, -082 38.20, -083 17.35, -084 39.40, -085 27.40, -086 56.70,
    -087 29.00.
  - sichuan: -089 32.30, -090 51.60, -091 44.70, -092 110.00 / 36.67, -093 24.90, -094 34.80,
    -095 54.70.

  Running orders with swaps, removals and cancellations (sushi-076, -077; turkish-074; chicken-082,
  -085; sichuan-091, -093) are added up from the changed order, and every running subtotal stated in
  a `before` turn is right.
- Order composition: every `maxTotal` can be met by an order of the stated shape:
  - sushi-069 (main + drink, RM25): Oyakodon + Genmaicha = 24.80.
  - sushi-070 (two donburi + drinks, RM50): Oyakodon + Tofu Teriyaki Don + 2 Genmaicha = 47.60.
  - sushi-082, -083 and -085: groups, fit easily.
  - turkish-068 (main + drink, RM30): Chicken Doner Wrap + Ayran = 25.80.
  - turkish-070, -080 and -082: groups, fit easily.
  - chicken-075 (chicken rice + drink, RM16): Steamed Chicken Rice + Kopi O = 15.20.
  - chicken-077 (4 people, chicken and roast pork, RM80): Roast Meat Platter = 46.00.
  - chicken-088 and -090: fit easily.
  - sichuan-084 (two people, RM50) and sichuan-085 (main + drink, RM30): Mapo Tofu + Sour Plum Drink
    = 29.80.
  - sichuan-086 (Mala Xiang Guo + non-spicy for the kids, RM150) and sichuan-096: fit easily.

  As in v2-v6, `maxTotal` counts each dish shown once.
- Every price quoted in a `before` turn matches the menu (112 quotes, totals included).

## Mechanical checks (all 466)

I checked these with my own throwaway script, kept outside the repository:

- JSON parses, and ids are unique.
- Every menu dish has a gold entry, and every gold entry is a menu dish (menus parsed from the
  `.txt`). Allergen names are in the schema enum, no dish is vegan without being vegetarian, and every
  spice value is 0-3.
- Every named dish exists on its menu.
- Every `includes` dish and every `includesAny` member satisfies all of its case's own constraints:
  avoid, vegetarian, vegan, spice, price, the category regex against the menu's category line,
  excludes and onlyFrom.
- Every `minDishes`, `includes` count and `maxTotal` is satisfiable. No `noDishes` or `maxDishes`
  case conflicts with a dish requirement. Every `says` and `category` regex compiles.
- Every price quoted in a `before` turn matches the menu.
- `lang` is `zh` exactly when the question has Chinese and no Latin text. The mixed questions
  (sushi-115, -116; turkish-120; chicken-056, -068; sichuan-070, -103) are `en`.
- Every allergy, coeliac, "alah", "alergi" or 过敏 statement, including those in earlier turns,
  carries `avoid` and `safetyNote`, and no `safetyNote` appears without `avoid`. Shellfish, seafood
  and "nuts" expand as above. The only flags were the "tree nut" cases turkish-028 and -079, which
  are labelled correctly.
- Every guest who states they are Muslim or asks whether the place is halal excludes all
  `halal: false` dishes. The only flags left were the single-dish fact questions listed above and
  the follow-up sushi-094, whose `onlyFrom` already limits it to four chicken donburi.
- No "don't eat meat" case lacks `vegetarian: true`, except the explicit pescatarian cases
  (sushi-013, turkish-017, chicken-019, sichuan-025). Within each case's category, its `excludes`
  list covers every meat, poultry, meat-stock, chicken-fat, lard and tallow dish.

## Open questions

1. Halal from ingredients in a pork kitchen (v6 open question 6, again). At a chicken rice shop that
   also sells char siu and siu yuk, the chicken is usually chopped on the same board as the pork, and
   Malaysian Muslims generally treat such shops as non-halal. chicken-023, -024, -027, -033 and -090,
   and sichuan-031, -035 and -039, require a dish through `includes`, `includesAny` or `minDishes`.
   An honest answer that names a pork-free dish with a caveat passes them. A flat "this shop is not
   halal" with no card does not. If the project adopts the whole-kitchen reading, these cases should
   drop their dish requirements and the gold should mark the meat dishes `halal: false`, together
   with v6 hakka.
2. Wasabi spice 1. A guest who "can't take spicy" may be happy with sashimi if the wasabi is left on
   the side. On that reading Salmon Sashimi and Sashimi Moriawase would be 0. No case requires either
   of them for a heat-sensitive guest, so only `maxSpice: 0` answers that show them depend on it.
3. Split-bill rounding. The labels accept the nearest-cent share, the share rounded up to cover the
   bill, and the unrounded figure. Malaysia's 5-sen rounding applies to cash bill totals, not
   per-person shares, so 38.15 (sushi-078) and 36.65 (sichuan-092) are not accepted. If the project
   wants them, widen the patterns to `38\.1[345]` and `36\.6[567]`.
4. Commercial Calpis lists soybean polysaccharide as a stabiliser in some markets, and many Japanese
   curry roux blocks (Katsu Curry Rice) contain soy. The gold reads only the menu lines, so neither
   has `soy`. sushi-030 (soy allergy) offers Katsu Curry Rice as one of ten options, and sushi-038
   offers Calpis as one of four, so no case breaks either way.
5. White (shiro) miso is often made with rice koji only, and is then gluten-free. The gold follows the
   shared rule miso = soy + gluten, which is the safe reading.
6. 薏米水 (the Barley Water's Chinese name) is properly Job's tears, which has no gluten. The English
   line says "pearl barley", and the gold follows it (`gluten`).

## Counts

- Cases reviewed: 466 (k: sushi-donburi 117, turkish-grill 120; l: chicken-rice-shop 113,
  sichuan-mala 116)
- Labels changed: 7 cases (sushi-donburi 4, turkish-grill 1, sichuan-mala 2, chicken-rice-shop 0).
  Cases removed: 0.
- Gold fixes: 0 entries. 140 dishes checked.

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, bench/heldout/REVIEW.md, bench/v3/REVIEW.md,
bench/v4/REVIEW.md, bench/v5/REVIEW.md, bench/v6/REVIEW.md and bench/v7/*. I did not open src/,
scripts/, test/, pages/, bench/results/, bench/ANALYSIS.md, bench/CHANGES.md, bench/cases/,
bench/menus/ or any case file of bench/heldout, v3, v4, v5 or v6, and I did not run the engine or any
bench script. My checking scripts are outside the repository. No git commits.
