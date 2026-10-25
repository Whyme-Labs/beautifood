# v6 held-out set: label review

Blind review of the 458 v6 cases (`i-east-coast-malay.json`, `i-plant-based-cafe.json`,
`j-dessert-house.json`, `j-hakka-claypot.json`) and the gold files for the four v6 menus
(east-coast-malay, plant-based-cafe, dessert-house, hakka-claypot).

## Conventions applied (both authors)

Conventions a-f from the v2 review (`bench/heldout/REVIEW.md`), the ingredient rules and rules g-j
from v3, the v4 additions and rule k from v5 apply unchanged:

- (a) stated allergy or diet plus a question about one dish that breaks it: `avoid` (or
  `vegetarian`/`vegan`) plus `safetyNote` for an allergy, with no required alternative. If the dish is
  safe, it goes in `includes`. (b) not on the menu = `maxDishes: 3`. (c) allergen question with
  nothing stated = `includes` plus a broad `says`. (d) service, thanks, off-topic and injection =
  `noDishes`. (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat X" about an
  allergen, not for intolerance or preference wording. (f) `lang: zh` only when the question has
  Chinese and no Latin text.
- Ingredient rules: soy sauce, kicap manis, miso, gochujang and sweet bean sauce = soy + gluten.
  Tamari stated gluten-free = soy only. Oyster sauce = molluscs + gluten (g). Shaoxing = sulphites +
  gluten, not halal. Rice wine, Hakka yellow wine, rose wine and mirin = not halal, with no allergen
  (h). Beer, barley and oats (oat milk, granola) = gluten. Belacan and dried shrimp = crustaceans.
  Ikan bilis, budu, fish floss and fish paste = fish. Squid = molluscs. Coconut milk, kerisik and
  coconut are not milk or tree nuts. King oyster, oyster and lion's mane mushrooms are not molluscs.
  Konjac mock prawns are not crustaceans. Honey rules out vegan.
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" and Chinese 坚果 =
  tree nuts + peanuts. Malay "kacang tanah" = peanuts only, and "kacang" alone = peanuts + tree nuts.
  An allergy to one tree nut (cashew, almond) avoids the whole tree-nut class, as v4 did for oysters.
- Spice: "not spicy" = 0, "mild" / "a little chilli" / "mildly spicy" / a chilli sauce with no heat
  word = 1, "spicy" = 2, "very spicy" = 3.
- (j) A guest who says they are Muslim, or asks whether the restaurant or menu is halal, is shown no
  dish the gold marks `halal: false`. (k) "I don't eat meat" = `vegetarian: true` unless the guest
  says fish is fine.

### Rulings on this set's judgement calls

**l. Single-dish diet questions, nothing stated (made consistent).** "Is the X vegetarian / vegan /
halal?", when X fails that diet, checks the fact with `says` and does not require X as a card. When X
passes, X goes in `includes`. v4 taiwanese-080 set this for halal: a guest asking may well be
Muslim, so not showing the dish is honest. The same reasoning applies to vegetarian and vegan.
Author j already did this (hakka-007, dessert-011). Author i required the failing dish as a card in
four cases, which are changed below. The dish may still be shown, because no diet is checked.

**m. Mustard greens are not the `mustard` allergen.** Author j labelled mui choy (Mui Choy Kau Yuk)
and kiam chye (Salted Vegetable Duck Soup) as `mustard`. Real allergen labelling does not do this:

- EU Regulation 1169/2011 Annex II lists "mustard and products thereof", and the UK FSA guidance
  defines it as liquid mustard, mustard powder and mustard seeds.
- Health Canada's priority allergen is mustard seed.
- The US and Australia/New Zealand do not regulate mustard at all.
- The major mustard allergens (Sin a 1, Bra j 1) are 2S albumin seed-storage proteins.

Preserved Brassica juncea leaves are a vegetable and are not declared as mustard anywhere. Both gold
entries drop `mustard`. That leaves no dish on the hakka menu with `mustard`. Mustard as a condiment,
seed or oil would still count.

The one dependent case, hakka-031 ("I'm allergic to mustard. Is the mui choy kau yuk ok?"), keeps
`avoid: [mustard]` + `safetyNote` (a stated allergy, convention e). It now checks the fact that the
dish contains mustard greens, with a broad `says`. This is a deliberate exception to convention a.
The dish is safe by the gold, but it is not required as a card. The guest is allergic to the same
plant, and some clinicians advise mustard-allergic patients to avoid the greens, so a cautious answer
that does not offer it is honest.

**n. Gelatine of unstated source: not vegetarian, not vegan, not halal.** All gelatine rules out
vegetarian (v4). For halal, gelatine counts as halal only when the menu says so ("halal beef
gelatine", dessert-house Mango Pudding; v4 Panna Cotta "beef gelatine") or names fish. Otherwise
it is `halal: false`. Most commercial gelatine is porcine, and an unstated source is doubtful
(syubhah). Getting it wrong for a Muslim guest is costly, and getting it wrong the other way costs
nothing. This is the same safe reading as the kombucha below. Author j's hakka Almond Jelly is
right. The ruling also keeps it in the hakka pescatarian `excludes` (hakka-012).

**o. Kopi beans roasted with butter = milk; Kopi O is vegetarian, not vegan.** Kampung kopi beans are
roasted with butter (or margarine) and sugar, and the caramelised coating carries milk protein into
the brew. The east-coast menu says "butter", so author i's `milk` on Kopi O and Kopi Susu is the safe
reading, as with any hidden allergen (belacan, chu hou paste). Butter is lacto-vegetarian, so Kopi O
is vegetarian and not vegan. This is consistent with Teh Tarik and the other dairy drinks. It
applies only where the menu says so. The hakka and dessert-house Kopi / Kopi Peng do not mention
butter, and they are `milk` anyway from condensed milk.

**p. Kombucha with trace alcohol (<0.5%) = not halal.** This is the same as v5 poke-salad-bar, and
it is kept for consistency (see open question 3).

**q. Impossible requests reward an honest "none".** When no dish meets the constraints, the label
has only the safety or constraint checks and requires no dish:

- hakka-018: coeliac, "which claypot rice?". Every claypot uses soy sauce.
- hakka-117: "any vegetarian claypot?". The vegetable claypot has lard.
- hakka-036, dessert-046, east-coast-043: no dish has the allergen.
- dessert-075 and -078: no savoury dish is spice 0.
- dessert-110: lactose intolerant, "which bingsu?". Every bingsu has milk.
- plant-066: "I can't take spicy". The nasi lemak is spice 2.
- dessert-076: "very spicy" when nothing is. This one was changed (below).

Under each label, an answer that says none fit and shows no card passes.

## Changes

### Gold files (2 entries changed, plus 1 note-only edit)

- hakka-claypot / Mui Choy Kau Yuk: allergens `mustard, soy, gluten, sulphites` →
  `soy, gluten, sulphites` (rule m).
- hakka-claypot / Salted Vegetable Duck Soup: allergens `mustard` → none (rule m).
- Note only: hakka-claypot / Almond Jelly. The note now cites rule n. The values are unchanged.

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 35
east-coast-malay, 34 plant-based-cafe, 36 dessert-house and 34 hakka-claypot, 139 in all. I found
no other errors. These spot checks passed:

- hakka-claypot:
  - Claypot Vegetable Rice and Braised Egg Tofu with Mushrooms (lard and pork stock / oyster sauce:
    not vegetarian, not halal).
  - Claypot Ginger Chicken Rice (stated no pork, no alcohol: halal).
  - Vegetarian Abacus Seeds (stated soy + wheat). Abacus Seeds (yam/tapioca dough, so its gluten
    comes only from soy sauce).
  - Hakka Wine Chicken (mee sua = gluten; rice wine has no allergen, rule h).
  - Fried Pork Belly with Nam Yu (sweet potato flour: no gluten).
  - Yong Tau Foo (fish paste and ikan bilis: halal from ingredients, spice 1).
  - Almond Jelly (essence, stated no nuts).
  - Iced Barley Lime and the beers (gluten). Guinness is vegan since 2017, so `vegan: true` stands.
- dessert-house:
  - Black Sesame Tang Yuan and Vegetable Curry Puff (lard: not vegetarian, not halal).
  - Mango Pudding (stated halal beef gelatine: halal, not vegetarian).
  - Ginger Milk Curd (stated no egg).
  - Durian Mochi (stated gluten-free; whipped cream = milk).
  - Mango Bingsu (digestive biscuit = gluten).
  - Chee Cheong Fun (stated soy + wheat sauce, vegan, chilli sauce = 1).
  - Oat Milk Latte (oats = gluten).
  - Coconut Soft Serve (coconut is not a tree nut).
- east-coast-malay:
  - Nasi Kerabu Ulam (no meat, but fish floss and budu: not vegetarian).
  - Solok Lada (fish paste).
  - Kerabu Pucuk Paku and Pulut Panggang (dried shrimp: not vegetarian).
  - Keropok Lekor (wheat flour stated).
  - Sayur Lemak Labu (stated without dried shrimp: vegan).
  - Akok and Nekbat (wheat + egg).
  - Sup Ayam Kampung (celery).
  - Kopi O (butter roast, rule o).
- plant-based-cafe:
  - Vegetarian Char Kway Teow (konjac prawns, egg).
  - Lion's Mane Fried Chicken (buttermilk + mayo; gochujang = soy + gluten).
  - Popiah Basah (egg strips; sweet bean sauce).
  - Teriyaki Tofu Don (mirin: not halal).
  - Kale Caesar (miso; stated no anchovy, no parmesan).
  - Tempeh Buddha Bowl (GF tamari: soy, no gluten).
  - Jackfruit Tacos (corn tortillas, BBQ sauce ingredients stated).
  - Honey Coconut Panna Cotta (agar: vegetarian; honey: not vegan).
  - Honey Turmeric Latte (almond milk = tree nuts).
  - House Kombucha (rule p).

### Case labels (12 cases)

- v6j-hakka-claypot-031 (mustard allergy, "is the mui choy kau yuk ok?"): kept `avoid: [mustard]` +
  `safetyNote`, and added `says: mustard green|preserved mustard|mustard leaf|mustard leaves|leaf|leaves|芥菜|sawi`.
  This follows the gold fix (rule m), and the dish is not required (see rule m).
- v6j-dessert-house-003 ("something cold and refreshing"): `includesAny` gained `Tau Foo Fah` ("warm
  or cold") and `Hong Kong Milk Tea` ("hot or iced"). An honest answer that showed only one of them
  used to fail.
- v6j-dessert-house-004 ("something warm"): `includesAny` gained `Hong Kong Milk Tea` (served hot).
- v6j-dessert-house-076 ("Very spicy please"): `maxDishes: 3` + `includesAny: [Nasi Lemak Bungkus]` →
  `maxDishes: 3` + `minSpice: 1`. Nothing on the menu is very spicy, and the old label failed an
  honest "nothing is very spicy here" (rule q). Anything offered as the closest still must have some
  heat.
- v6i-east-coast-malay-009 ("the nasi kerabu ulam says no meat, so it's vegetarian right?"): removed
  `includes: [Nasi Kerabu Ulam]` and kept the `says` on fish floss / budu (rule l).
- v6i-east-coast-malay-014 ("Is the Kopi O vegan?"): removed `includes: [Kopi O]` and kept the `says`
  on butter (rule l).
- v6i-plant-based-cafe-009 ("Is the shakshuka vegan?"): removed `includes: [Shakshuka]` and kept the
  `says` (rule l).
- v6i-plant-based-cafe-013 ("Is the honey turmeric latte vegan?"): removed
  `includes: [Honey Turmeric Latte]` and kept the `says` on honey (rule l).
- v6i-plant-based-cafe-006 ("Do you have mock meat dishes?"): `includesAny` gained `Vegetarian Char
  Kway Teow` (konjac mock prawns), `Tofu Scramble Plate` (tempeh bacon) and `Lion's Mane Fried
  Chicken`. Each is an honest answer.
- v6i-plant-based-cafe-017 (Buddhist vegetarian, avoids onion and garlic): added `excludes: [Jackfruit
  Tacos, Loaded Sweet Potato Fries, Vegetarian Char Kway Teow]`. Their menu lines name pickled red
  onion, spring onion and chives. The old label let them be shown to a guest who said they avoid
  alliums.
- v6i-plant-based-cafe-057 ("Is everything here halal?"): added `excludes: [Teriyaki Tofu Don, House
  Kombucha]` (rule j). This makes it consistent with author j's whole-menu halal questions
  (hakka-053, dessert-066). The `says` is unchanged.
- v6i-plant-based-cafe-098 (芝士通心粉有奶吗？): `says` widened from `腰果|cashew|植物` to also accept
  `no dairy|dairy-free|no milk|不含奶|没有奶|无奶|不含乳|vegan|纯素|全素` (convention c). "没有奶" is a
  correct answer.

Cases removed: none.

### Checked and left as they are (judgement calls)

- Halal fact questions with no diet stated (hakka-056, -057, -062; dessert-068, -071;
  east-coast-060; plant-060) check the fact only. Every dish they require is `halal: true`.
  east-coast-061 ("Is everything here halal?") needs no `excludes`, because every dish on that menu
  is `halal: true`.
- hakka-012 (pescatarian): the `excludes` covers every meat, lard, pork-stock and gelatine dish.
  Kangkung Belacan (shrimp) is allowed.
- dessert-110 ("i cannot take milk one, lactose intolerant lah"): there is no `safetyNote`. The
  guest names intolerance, which overrides "cannot take" (convention e).
- dessert-039 ("Allergic to almonds"): `avoid: [tree_nuts]`, and Peanut Paste is allowed. plant-025
  (cashews) avoids the whole tree-nut class.
- east-coast-027 (egg allergy, "which rice?") requires Nasi Putih. Every nasi set has egg, and plain
  rice is listed under RICE / NASI, so it is a true answer and not a substitute.
- dessert-073 and -077 ("anything spicy?") require Nasi Lemak Bungkus, the only dish described as
  spicy. The other two savoury bites have only chilli sauce (spice 1), as in v2 dim-sum-040.
- hakka-048 ("What's lap cheong?") requires one of the two lap cheong dishes. I kept it, because
  pointing to where it is used is part of an honest answer about a menu ingredient.
- hakka-097 (`says: 16`) and the yes/ya patterns in hakka-107 and dessert-062 are broad, but the dish
  is required anyway. Kept.
- Order totals: I recomputed every `says` total from the menu, and all are right:
  - hakka: -051 19.90, -077 27.10, -078 70.80, -079 18.40, -080 69.20, -110 36.90.
  - dessert: -063 7.50, -084 14.80, -085 66.50, -086 34.60, -087 30.80, -114 16.90.
  - east-coast: -088 20.40, -089 35.70, -090 61.20, -091 16.90, -092 20.60, -093 40.80,
    -094 15.90, -115 18.90.
  - plant: -079 30.80, -080 74.60, -081 30.80, -082 33.90, -083 34.80, -084 29.70,
    -085 73.60 / 36.80, -086 22.90.
- Order composition: every `maxTotal` can be met by an order of the stated shape:
  - hakka-072 (lunch + drink, RM20): Hakka Mee + Kopi = 17.10.
  - hakka-073 (claypot + vegetable, RM60): Claypot Chicken Rice + Garlic Choy Sum = 35.80.
  - hakka-075 (halal lunch + drink, RM25): Claypot Ginger Chicken Rice + Soy Bean Milk = 24.40.
  - hakka-076 (signatures, RM150): all four = 92.60.
  - dessert-080 (two desserts, RM20): e.g. Tau Foo Fah + Ondeh-Ondeh = 12.80.
  - dessert-081 (bingsu + tong sui, RM60): Mango Bingsu + 2 x RM7.50 tong sui = 37.90.
  - dessert-083 (savoury + dessert, RM20): Nasi Lemak Bungkus + Cendol = 15.80.
  - east-coast-081 (meal + drink, RM15): Nasi Tumpang + Teh O Ais Limau = 13.40.
  - east-coast-082 (lunch + drink, RM20): Nasi Dagang Ikan Tongkol + Kopi O = 18.90.
  - east-coast-084 (two people, signatures, RM50): Nasi Kerabu Ayam Percik + Laksam + Teh Tarik
    = 34.30.
  - east-coast-095 (prawn allergy; rice + side + drink, RM30): Nasi Putih + Ayam Percik + Kopi O
    = 24.40.
  - east-coast-097 (family of 4, RM80): fits easily.
  - plant-072 (brunch + coffee, RM35): Smashed Avo Toast + Flat White = 31.90.
  - plant-074 (two mains + drink, RM50): Vegetarian Char Kway Teow + Buddhist Char Siu Rice +
    Lemongrass Pandan Iced Tea = 38.70.

  As in v2-v5, `maxTotal` counts each dish shown once.
- Every price quoted in a `before` turn matches the menu (68 quotes).

## Mechanical checks (all 458)

I checked these with my own throwaway script, kept outside the repository:

- JSON parses, and ids are unique.
- Every menu dish has a gold entry, and every gold entry is a menu dish (menus parsed from the
  `.txt`). Allergen names are in the schema enum, no dish is vegan without being vegetarian, and every
  spice value is 0-3.
- Every named dish exists on its menu.
- Every `includes` dish and every `includesAny` member satisfies all of its case's own constraints
  under the corrected gold: avoid, vegetarian, vegan, spice, price, the category regex against the
  menu's category line, excludes and onlyFrom.
- Every `minDishes`, `includes` count and `maxTotal` is satisfiable. No `noDishes` or `maxDishes`
  case conflicts with a dish requirement. Every `says` and `category` regex compiles.
- Every price quoted in a `before` turn matches the menu.
- `lang` is `zh` exactly when the question has Chinese and no Latin text. The mixed questions
  (hakka-115, dessert-019, east-coast-094, plant-099) are `en`.
- Every allergy, coeliac, "alah" or 过敏 statement, including those in earlier turns, carries `avoid`
  and `safetyNote`. Shellfish, seafood and "nuts" expand as above. The only script flags were the
  typo "alergic" in east-coast-047 and plant-051, which do state an allergy and are labelled
  correctly.
- Every guest who states they are Muslim or asks whether the place is halal excludes all
  `halal: false` dishes. The only flags left were the single-dish fact questions listed above.
- No "don't eat meat" case lacks `vegetarian: true`, except the explicit "fish is fine" cases
  (hakka-012, east-coast-019).

## Open questions

1. Rule m: some clinicians advise mustard-seed-allergic patients to avoid mustard greens, and
   cross-reactivity within Brassicaceae is reported. If the project prefers the plant-level reading,
   both hakka entries should take `mustard` back. hakka-031 already passes either way.
2. Rule n: if the merchant confirms the Almond Jelly gelatine is halal-certified bovine, it becomes
   `halal: true`. It would then leave the 16-dish halal `excludes` lists, and it could be added to
   the pescatarian answer only if the gelatine came from fish.
3. Rule p: as in v5 open question 2, Malaysian fatwa practice tolerates naturally occurring alcohol
   below 1% in non-intoxicating drinks. On that reading House Kombucha would be halal, and plant-057,
   -058, -059, -061 and -062 would drop it from `excludes`.
4. dessert-house Kuih Platter: seri muka's custard layer is often thickened with plain (wheat) flour,
   but the menu says only "pandan egg custard". The gold has no gluten. No case requires the platter
   for a gluten-free guest, so nothing depends on it.
5. Hakka yellow wine and Hakka Wine Chicken: rule h gives rice wine no allergen. Some huangjiu is made
   with a wheat qu starter (like Shaoxing). Hakka niang jiu is usually made with a rice jiu bing, so
   no gluten was added. The Wine Chicken already has gluten from mee sua. Only the glass of Hakka
   Yellow Wine (hakka-020, a gluten-free drink answer) depends on it.
6. Halal from ingredients in a kitchen that serves pork (Salt-baked Chicken, Claypot Ginger Chicken
   Rice, Yong Tau Foo, Salted Vegetable Duck Soup): this follows v3-v5 open question 4. A Muslim guest
   may reasonably avoid a non-halal kitchen entirely. hakka-054, -055, -058 and -060 require one of
   these dishes through `includesAny`, so an answer that turns down the whole kitchen would fail them.
   I kept them, because the menu supports the from-ingredients reading used in v3-v5.
7. Nam yu (fermented red beancurd) is often made with rice wine. It appears only in pork dishes, so it
   does not change halal. Some brands add wheat flour, but the gold keeps soy only. Mui Choy Kau Yuk
   has gluten anyway, from soy sauce and Shaoxing. Fried Pork Belly with Nam Yu would gain `gluten`
   on the wheat reading. It is one of six `includesAny` options in hakka-019 (coeliac main), so no
   case would break.

## Counts

- Cases reviewed: 458 (i: east-coast-malay 115, plant-based-cafe 110; j: dessert-house 116,
  hakka-claypot 117)
- Labels changed: 12 cases (hakka-claypot 1, dessert-house 3, east-coast-malay 2,
  plant-based-cafe 6). Cases removed: 0.
- Gold fixes: 2 entries (hakka-claypot Mui Choy Kau Yuk and Salted Vegetable Duck Soup, mustard),
  plus 1 note-only edit (Almond Jelly). 139 dishes checked.

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, bench/heldout/REVIEW.md, bench/v3/REVIEW.md,
bench/v4/REVIEW.md, bench/v5/REVIEW.md and bench/v6/*. I did not open src/, scripts/, test/, pages/,
bench/results/, bench/ANALYSIS.md, bench/CHANGES.md, bench/cases/, bench/menus/,
bench/heldout/*.json, bench/v3/*.json, bench/v4/*.json or bench/v5/*.json, and I did not run the
engine or any bench script. My checking scripts are outside the repository. No git commits.
