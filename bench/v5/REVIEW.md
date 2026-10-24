# v5 held-out set: label review

Blind review of the 497 v5 cases (`g-poke-salad-bar.json`, `g-sarawak-borneo.json`,
`h-mexican-cantina.json`, `h-siu-mei-roast.json`) and the gold files for the four v5 menus
(poke-salad-bar, sarawak-borneo, mexican-cantina, siu-mei-roast).

## Conventions applied (both authors)

Conventions a-f from the v2 review (`bench/heldout/REVIEW.md`), the ingredient rules and rules g-j
from the v3 review (`bench/v3/REVIEW.md`), and the v4 additions (`bench/v4/REVIEW.md`) apply
unchanged:

- (a) stated allergy or diet plus a question about one dish that breaks it: `avoid` (or
  `vegetarian`/`vegan`) plus `safetyNote` for an allergy, with no required alternative. If the dish is
  safe, it goes in `includes`. (b) not on the menu = `maxDishes: 3`. (c) allergen or diet question
  with nothing stated = `includes` plus a broad `says`. (d) service, thanks, off-topic and injection =
  `noDishes`. (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat X" about an
  allergen. It is not used for intolerance, sensitivity or preference wording ("lactose intolerant",
  "no nuts please", "no seafood for my boy", "sulphite sensitivity"). (f) `lang: zh` only when the
  question has Chinese and no Latin text.
- Ingredient rules: soy sauce, shoyu, ponzu, teriyaki, miso, gochujang, fermented bean paste and chu
  hou paste = soy + gluten. Oyster sauce = molluscs + gluten (g). Shaoxing = sulphites + gluten, not
  halal. Mirin and rice wine (tuak) = not halal, with no allergen (h). Rose wine (mei kuei lu chiew, a
  sorghum spirit) = not halal, with no allergen, like kaoliang. Beer, barley and oats (oat milk,
  granola) = gluten. Worcestershire = fish + gluten (i). Belacan, salted shrimp and kimchi made with
  salted shrimp = crustaceans. Ikan bilis, bonito, dashi, anchovy and fish sauce = fish. Dried scallop,
  dried octopus and squid = molluscs. Imitation crab stated "no real crab" = fish + gluten, no
  crustaceans. Coconut milk, kerisik and coconut are not milk or tree nuts. Pumpkin seeds,
  bambangan seed and chia are not tree nuts. Oyster mushroom is not a mollusc. Honey rules out vegan.
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" and Chinese 坚果 =
  tree nuts + peanuts. Malay "kacang tanah" = peanuts only. Malay "kacang" alone is read broadly as
  peanuts + tree nuts (the safe reading; siu-mei-034, sarawak-050).
- Spice: "not spicy" = 0, "mild" / "a little chilli" / "mildly spicy" = 1, "spicy" = 2, "very spicy"
  = 3.
- Rule j: a guest who says they are Muslim, or asks for halal food, is shown no dish the gold marks
  `halal: false`, including alcohol and mirin dishes. A halal question about one dish with no diet
  stated checks the fact only. If that dish is not halal, no card is required (v4 taiwanese-080).

### k. Meat convention (new in v5)

**"I don't eat meat" = `vegetarian: true`.** No meat, poultry, fish or other seafood, unless the guest
says they are pescatarian or that fish or seafood is fine. Author h already did this, following v4
pizzeria-027. Author g treated it as allowing fish in one case. My reasons:

1. Most Malaysian guests who tell a server "I don't eat meat" mean they are vegetarian. Many are
   Buddhist or Hindu and avoid fish too. A guest who eats fish usually says "pescatarian", "I eat
   fish" or "seafood ok".
2. The two errors do not cost the same. Showing fish to a vegetarian is unsafe under README rule 4.
   Showing only vegetarian dishes to a guest who would have eaten fish costs nothing.
3. It matches the frozen v4 label (pizzeria-027), so the benchmark keeps one rule across versions.

`safetyNote` is not required. A meat restriction is a diet, not an allergen (v4 pizzeria-027).
"No beef" and "no pork" stay narrow `excludes` and do not imply vegetarian. When the guest adds "but
fish is fine" (sarawak-008), they have said they are pescatarian, so the label excludes meat and
poultry only.

Cases this applies to: mexican-008 and siu-mei-007 (already vegetarian, kept), poke-015 (changed),
and sarawak-008 (explicitly "fish is fine", kept as pescatarian).

## Changes

### Gold files (1 entry changed)

- siu-mei-roast / Beef Brisket Hor Fun: allergens `soy, gluten, molluscs, sulphites` →
  `soy, gluten, sesame, molluscs, sulphites`. Chu hou paste is made from fermented soybeans, wheat
  flour and sesame paste, and the major commercial brands list sesame. The author's note gave only
  "soybean + wheat". The safe reading is the hidden-allergen reading, as with belacan and oyster
  sauce. The note was updated.

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 37
mexican-cantina, 34 siu-mei-roast, 34 poke-salad-bar and 33 sarawak-borneo, 138 in all. I found no
other errors. These spot checks passed:

- mexican-cantina: Refried Beans (pork lard, so not vegetarian or halal), Mexican Rice and Tortilla
  Soup (chicken stock), Baja Fish Tacos (beer batter, so gluten and not halal), Michelada
  (Worcestershire, so fish and not vegetarian), Horchata (hidden almonds), Chicken Mole (peanuts,
  almonds and sesame; dairy-free chocolate), Loaded Nachos (wheat in the cheese sauce), Camarones a la
  Diabla (butter), Veggie Burrito (vegan rice, not the chicken-stock rice).
- siu-mei-roast: Soy Sauce Chicken Rice (no pork, but Shaoxing, so not halal), Roast Duck (rose wine,
  so not halal), Plain Congee (pork bones and dried scallop), Lotus Root Peanut Soup (pork ribs and
  octopus), Egg Tofu (egg + soy, and oyster sauce, so not vegetarian), Kai Lan Oyster Sauce (halal,
  not vegetarian), Fish Slice Congee (halal, no meat), Herbal Jelly (honey: vegetarian, not vegan),
  Barley Water (gluten).
- poke-salad-bar: Mentai Salmon Poke (imitation crab, so no crustaceans), Korean Beef Bulgogi Bowl
  (kimchi with salted shrimp), Teriyaki Chicken Bowl (mirin, so not halal), Green Goddess Salad and
  Mushroom Miso Soup (anchovy or bonito, so not vegetarian), Pumpkin Ginger Soup and Cold-Pressed Green
  Juice (celery), Iced Matcha Oat Latte (oats = gluten), Almond Matcha Bliss Balls (stated
  gluten-free; honey).
- sarawak-borneo: Sarawak Laksa (sesame and belacan in the paste; rice vermicelli, so no gluten),
  Kampua Mee (stated egg-free), Bubur Pedas (hidden peanuts), Manok Pansoh (tuak, so not halal) and
  Ayam Pansuh Halal (no alcohol), Midin Belacan and Terung Dayak Sour Soup (not vegetarian), Kuih
  Celorot (coconut milk is not milk), Tomato Kway Teow and Tuaran Mee (oyster sauce).

### Case labels (8 cases)

- v5h-mexican-cantina-033 ("Gluten-free tacos?"): `includesAny` gained `Carnitas Tacos`. They come in
  corn tortillas with no gluten. An honest answer that listed them used to fail.
- v5h-mexican-cantina-037 (shellfish allergy, "which tacos?"): `includesAny` gained `Carnitas Tacos`.
  They have no shellfish, for the same reason.
- v5h-siu-mei-roast-031 (sesame allergy, "which noodles?"): `includesAny: [Shui Gao Noodle Soup, Beef
  Brisket Hor Fun]` → `includes: [Shui Gao Noodle Soup]`. This follows the gold fix (chu hou paste =
  sesame), and Shui Gao is now the only sesame-free noodle. The note was updated.
- v5h-siu-mei-roast-050 ("Which dishes have sesame?"): `includesAny` gained `Beef Brisket Hor Fun`
  (gold fix).
- v5g-poke-salad-bar-015 ("I don't eat meat. Which wraps?"): `excludes: [Chicken Caesar Wrap,
  Peri-Peri Chicken Wrap]` + `includesAny: [Hummus Veggie Wrap, Tuna Mayo Wrap]` →
  `vegetarian: true`, `category: WRAP`, `includes: [Hummus Veggie Wrap]`. This applies the meat
  convention (k), so the tuna wrap may no longer be shown.
- v5g-poke-salad-bar-067 (table of three: one vegan, one coeliac, one eats everything; "one bowl
  each?"): added `avoid: [gluten]`, and `includesAny: [Quinoa Power Bowl, Spicy Tuna Poke, Nasi Ulam
  Bowl]` became `includes: [Quinoa Power Bowl]`. Before, this was the only case with a stated allergy
  and no `avoid`. Every bowl shown is an "add to order" card in front of the coeliac guest, so the
  table is treated as gluten-free, as author g already did for the shared table in sarawak-053. Under
  that rule, Quinoa Power Bowl is the only bowl that is both vegan and gluten-free. The vegan's bowl
  must be it, and the label now checks that.
- v5g-sarawak-borneo-061 (follow-up "which one is not spicy at all?"): the earlier assistant turn
  said "Manok Pansoh (RM24.90) comes with rice", which the menu does not say. Manok Pansoh is not a
  rice dish, and the question was "Any rice or sago dishes?". The turn now offers Bubur Pedas
  (RM13.90, spiced rice porridge) in its place, and `onlyFrom` is `[Bubur Pedas, Nasi Aruk, Ambuyat
  Set]`. The answer is still `Nasi Aruk`: spice 0, against 1 for Bubur Pedas and 2 for Ambuyat Set.
- v5g-sarawak-borneo-097 ("Does kek lapis have nuts?"): `says` widened from `almond|badam|杏仁` to
  also accept `no nut|nut-free|nut free|tiada kacang|tak ada kacang|没有坚果|不含坚果|无坚果`
  (convention c). "The plain Kek Lapis Sarawak has no nuts" is a correct answer.

Cases removed: none.

### Checked and left as they are (judgement calls)

- Meat convention: mexican-008 and siu-mei-007 already use `vegetarian: true` with no `safetyNote`.
  sarawak-008 ("I don't eat meat but fish is fine") stays pescatarian. Its excludes list covers every
  chicken and beef dish.
- Pescatarian cases (mexican-010, siu-mei-009, poke-014, sarawak-009): every meat, poultry and
  meat-stock dish is in `excludes`. That includes Mexican Rice and Tortilla Soup (chicken stock),
  Refried Beans (lard), Plain Congee (pork bones) and the chicken laksa and kway teow.
- Halal fact questions with no diet stated (mexican-014, -015, -016, -116; siu-mei-013, -014, -088;
  poke-027, -029, -032, -033; sarawak-018, -022, -023) check the fact only. Every dish they require
  is `halal: true`. sarawak-023 ("Manok Pansoh vs Ayam Pansuh Halal, what's the difference?")
  requires both dishes. It is a comparison with no diet stated, and its `says` checks the tuak fact.
- poke-salad-bar Ginger Turmeric Kombucha: `halal: false` for trace alcohol under 0.5% is the safer reading. See open
  question 2.
- siu-mei-034 / sarawak-050: Malay "kacang" alone is read as peanuts + tree nuts. sarawak-059 ("kacang
  tanah") is peanuts only. Both follow v4.
- siu-mei-053 ("safe for someone allergic to sulphites?"): the allergy belongs to a third party, and
  `avoid` + `safetyNote` is right.
- siu-mei-038 ("allergic to dried scallop") and siu-mei-054 ("allergic to octopus"): `avoid: molluscs`
  (the whole class), with no crustaceans, as v4 taiwanese-032 did for oysters.
- poke-054 (crab allergy, mentai bowl) and poke-043 (coeliac, bliss balls): the dish is safe, so it is
  shown (convention a).
- poke-047 ("Any dairy-free dessert?"), sarawak-035, mexican-033 and siu-mei-029 (gluten-free
  questions with no allergy stated): `avoid` without `safetyNote`, as in v3 hotpot-046.
- poke-094 (`says: teriyaki`) and sarawak-069 (`says: hinava`) are nearly vacuous, because both
  dishes are already required. They do no harm and were kept.
- poke-086 ("4 of us … everyone wants a bowl") keeps `minDishes: 2`. Showing two bowls to share or
  repeat is an honest answer. Four bowls fit easily: Tofu Miso + Quinoa + Nasi Ulam + Soba = RM88.60.
- Order totals: I recomputed every `says` total from the menu, and all are right. mexican-072 69.60,
  -073 61.70, -074 47.80, -113 21.90, -114 21.90, -117 27.80. siu-mei-069 21.40, -070 36.80, -071
  22.40, -072 54.90 (two bowls of rice), -106 17.90, -108 12.90, -109 14.90, -116 19.40. poke-083
  44.80, -084 107.40, -085 49.70, -087 36.80, -088 29.90/32.90, -089 19.90, -090 18.90.
  sarawak-076 40.60, -077 26.80, -078 53.30, -079 16.80, -080 10.90, -081 24.90, -082 8.90/9.90.
- Order composition: every `maxTotal` can be met by an order of the stated shape. mexican-071 (taco
  plate + drink, RM35): Prawn Tacos + Agua de Jamaica = 33.80, and every taco fits. mexican-075 (four
  people, RM150, halal): fits easily. siu-mei-066 (rice plate + drink, RM20): Char Siu Rice + Barley
  Water = 19.40. siu-mei-067 (share roast meats, RM120): Roast Meat Platter + Half Roast Duck = 81.00.
  siu-mei-073 (halal meal + drink, RM20): Fish Slice Congee + Iced Lemon Tea = 17.40. poke-082 (bowl +
  juice, RM35): Nasi Ulam Bowl + ABC Juice = 33.80. poke-086 (four bowls, RM120): 88.60.
  sarawak-073 (main + drink, RM20): Kolo Mee + Teh C Peng = 17.80. sarawak-074 (two people, RM60,
  signatures): Kolo Mee + Laksa + 2 Teh C = 40.60. sarawak-084 (family of four, RM100, no alcohol):
  fits. As in v2-v4, `maxTotal` counts each dish shown once.
- Every price quoted in a `before` turn matches the menu, including the new sarawak-061 turn.

## Mechanical checks (all 497)

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
  case conflicts with a dish requirement.
- Every price quoted in a `before` turn matches the menu.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah" or 过敏 statement, including those in earlier turns, carries `avoid`
  and `safetyNote`, and no `safetyNote` appears without one. Shellfish, seafood and "nuts" expand as
  above.
- Every guest who states they are Muslim or asks for halal food excludes all `halal: false` dishes.
  The only flags left were the single-dish fact questions listed above.
- No "don't eat meat" case lacks `vegetarian: true`, except the explicit "fish is fine" case.

## Open questions

1. Chu hou paste recipes vary, and some house-made pastes have no sesame. If the merchant confirms
   theirs has none, Beef Brisket Hor Fun can drop `sesame`, and siu-mei-031 can take it back as an
   option.
2. Ginger Turmeric Kombucha is `halal: false` for its stated trace alcohol (under 0.5%). Malaysian
   fatwa practice tolerates naturally occurring alcohol below 1% in non-intoxicating drinks, so a
   lenient reading would make it halal. Only the Muslim cases poke-028, -030 and -031 depend on it,
   and they only exclude it.
3. Hard and fresh cheeses (queso fresco, cotija, Oaxaca, feta, parmesan) keep the merchants'
   `(vegetarian)` tags, as in v4 open question 2. Rennet is not stated.
4. Dishes whose meat has no halal word and no pork or alcohol (Chicken Mole, Korean Beef Bulgogi Bowl,
   Sarawak Kolo Mee and others) are `halal: true` from the ingredients, as in v3 and v4.
5. The meat convention (k) holds that "I don't eat meat" includes fish. If the project later decides
   that Malaysian "tak makan daging" means red meat only, mexican-008, siu-mei-007, poke-015 and v4
   pizzeria-027 should change together.

## Counts

- Cases reviewed: 497 (g: poke-salad-bar 118, sarawak-borneo 138; h: mexican-cantina 121,
  siu-mei-roast 120)
- Labels changed: 8 cases (poke-salad-bar 2, sarawak-borneo 2, mexican-cantina 2, siu-mei-roast 2).
  Cases removed: 0.
- Gold fixes: 1 entry (siu-mei-roast Beef Brisket Hor Fun, sesame). 138 dishes checked.

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, bench/heldout/REVIEW.md, bench/v3/REVIEW.md,
bench/v4/REVIEW.md and bench/v5/*. I did not open src/, scripts/, test/, pages/, bench/results/,
bench/ANALYSIS.md, bench/CHANGES.md, bench/cases/, bench/menus/, bench/heldout/*.json,
bench/v3/*.json or bench/v4/*.json, and I did not run the engine or any bench script. My checking
scripts are outside the repository. No git commits.
