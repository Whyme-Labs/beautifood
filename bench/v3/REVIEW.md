# v3 held-out set: label review

Blind review of the 453 v3 cases (`a-korean-grill.json`, `a-nyonya-kitchen.json`,
`b-bistro-western.json`, `b-hotpot-house.json`) and the gold files for the four v3 menus
(korean-grill, nyonya-kitchen, bistro-western, hotpot-house).

## Conventions applied (both authors)

Conventions a-f from the v2 review (`bench/heldout/REVIEW.md`) apply unchanged: stated allergy plus a
question about one dish (a), not on the menu = `maxDishes: 3` (b), allergen question with no allergy
stated = `includes` plus broad `says` (c), service/thanks/off-topic/injection = `noDishes` (d),
`safetyNote` only for a stated allergy, coeliac disease or "cannot eat X", not for intolerance,
sensitivity or preference wording (e), and `lang: zh` only for questions written in Chinese (f).

Ingredient rules used for every gold entry. Rules g-j are new in v3 or were made explicit for it:

- Soy sauce, light/dark soy, kicap (manis), gochujang, doenjang, ssamjang, doubanjiang = soy +
  gluten. Tamari stated gluten-free = soy only. Taucu, tofu, tempeh, beancurd skin, soybean flour = soy.
- Coconut milk/cream is not milk. Glutinous rice, rice noodles, rice cakes, sweet-potato and mung-bean
  glass noodles, cornstarch have no gluten. Oats, barley (pearl barley, malted barley, beer) = gluten
  (EU cereal rule). Buckwheat alone is not gluten, but wheat in the same noodle is.
- Fish balls, surimi, fish paste, fish cake, anchovies, anchovy stock, fish sauce, Worcestershire =
  fish. Belacan, shrimp paste, dried shrimp, salted shrimp, prawn stock = crustaceans. Squid,
  cuttlefish, cockles, clams, mussels, oyster sauce = molluscs. King oyster mushroom is not a mollusc;
  imitation crab stated "no real crab" is not a crustacean.
- Vegan only with no animal product at all (honey, fish sauce, anchovy stock, egg, dairy, ghee,
  oyster sauce, prawn stock all rule it out). Perilla ("sesame leaf") is not sesame.

g. **Oyster sauce = molluscs + gluten.** Most commercial oyster sauce is thickened with wheat flour,
   so the safer reading is used everywhere. It only changes dishes where oyster sauce is the only
   gluten source (hotpot-house Stir-fried Kailan, Garlic Sesame Oil Dip).
h. **Wine.** Grape wine (white wine) = sulphites, not halal, no gluten. Shaoxing (rice wine
   fermented with a wheat starter) = sulphites + gluten, not halal. Mirin = not halal, but no
   sulphites or gluten (rice and rice koji; no sulphite source stated). Beer = gluten, not halal, no
   sulphites.
i. **Worcestershire sauce = fish + gluten** (anchovies, barley malt vinegar). Author b already used
   this rule (bistro-western-014/-015).
j. **Halal questions.** A guest asking for halal food must not be shown any dish that the gold marks
   `halal: false`, including dishes made with alcohol, not only pork. Author a already did this
   (korean-grill-105 excludes LA Galbi for mirin).

## Changes

### Gold files (4 entries in hotpot-house, plus 2 note-only edits)

- hotpot-house / Sichuan Mala Soup: allergens `gluten, soy` → `gluten, soy, sulphites`. Shaoxing
  wine (rule h).
- hotpot-house / Herbal Chicken Soup: allergens `gluten` → `gluten, sulphites`. Shaoxing wine
  (rule h).
- hotpot-house / Stir-fried Kailan: allergens `molluscs` → `molluscs, gluten`. Oyster sauce
  (rule g).
- hotpot-house / Garlic Sesame Oil Dip: allergens `sesame, molluscs` → `sesame, molluscs, gluten`.
  Oyster sauce (rule g).
- Note only: hotpot-house / Marinated Chicken (oyster sauce "+ wheat"; allergens were already right)
  and korean-grill / LA Galbi (mirin rule h recorded; allergens unchanged).

No case depended on the old values: no case shows these four dishes to a gluten- or sulphite-avoiding
guest. hotpot-house-094 (coeliac + soy, dipping sauce) is safety-only, and Shacha Sauce Dip still
satisfies it.

Every dish (31 bistro-western, 32 hotpot-house, 32 korean-grill, 33 nyonya-kitchen; 128 in
all) was checked against its menu line for allergens, vegetarian, vegan, halal and spice. I found no
other errors. Spot checks that passed: Vegetable Japchae (tamari GF: soy, no gluten), Doenjang Jjigae
(doenjang with wheat), Dak Galbi (perilla, no sesame), Samgyetang and Pulut Inti (glutinous rice, no
gluten), Chap Chye and Nasi Ulam (prawn stock / salted fish, so not vegetarian), Crab Sticks (fish,
gluten, egg; no crustaceans), Almond Tofu Pudding (tree nuts, no soy), Strawberry Oat Shake (gluten),
Chicken Chop Mushroom Sauce and Black Pepper (coleslaw mayo = egg), Pumpkin Soup (celery in stock),
Mussels in White Wine (sulphites, not halal).

### Case labels (4 cases)

- v3b-bistro-western-073 ("Anything with mushroom?"): added `Vegetarian Aglio Olio` (mushrooms) to
  `includesAny`. An honest answer that showed only that dish used to fail.
- v3b-bistro-western-074 ("What chicken dishes do you have?"): added `Buffalo Wings` and
  `Caesar Salad` (grilled chicken) to `includesAny`.
- v3b-hotpot-house-055 ("What seafood do you have?"): added `Fish Ball Platter` and `Crab Sticks`
  (same SEAFOOD & BALLS section) to `includesAny`.
- v3b-hotpot-house-075 ("Ada makanan halal tak? Saya tak makan babi."): `excludes` gained
  `Sichuan Mala Soup`, `Herbal Chicken Soup` and `Tsingtao Beer` (alcohol, `halal: false` in gold).
  This makes it consistent with korean-grill-105 (rule j).

Cases removed: none.

Checked and left as they are (judgement calls):

- korean-grill-037: a sesame-allergic guest may be shown Dak Galbi. Perilla is not sesame and no
  sesame is listed. Both authors' gold agrees.
- bistro-western-023: Mushroom Soup is acceptable for a celery allergy. Its chicken stock may contain
  celery in practice, but the menu does not say so, and it is only one of three `includesAny` options.
- bistro-western-031: sulphite sensitivity, seafood main: Fish & Chips and Grilled Salmon are
  accepted. Capers and gherkins can carry sulphites, but none are stated.
- hotpot-house-046: a gluten-free follow-up question with no allergy stated carries `avoid: gluten`
  without `safetyNote`. The guest asked which dish is gluten-free, so showing a gluten dish would be a
  wrong answer, not just a wording issue.
- nyonya-kitchen-016/-103: Nyonya Laksa (fish balls assumed wheat-free) is allowed but not required
  for a coeliac guest. The gold note records the judgement.
- The `says` patterns were all checked for breadth (several phrasings, English/Malay/Chinese). No
  negation-only regexes remain.

## Mechanical checks (all 453)

JSON parses and ids are unique. Every named dish exists on its menu, and every menu dish has a gold
entry (menus parsed from the `.txt`). Every `includes` dish and every `includesAny` member satisfies
all of its case's own constraints (avoid, vegetarian, vegan, spice, price, category regex against the
menu's category line, excludes, onlyFrom) under the corrected gold. Every `minDishes`, `includes`
count and `maxTotal` is satisfiable. No `noDishes`/`maxDishes` case conflicts with a dish requirement.
Every price quoted in a `before` turn matches the menu. `lang` is `zh` exactly when the question has
Chinese and no Latin text. Every allergy, coeliac or "alah" statement (including earlier turns)
carries `avoid` and `safetyNote`. Shellfish = crustaceans + molluscs, a seafood allergy adds fish, and
"nuts" = tree_nuts + peanuts in every case. The remaining script flags were all false positives
("can't take spicy", "what seafood can she have"), and each was reviewed by hand.

## Open questions

1. Rule g (oyster sauce = molluscs + gluten) is stricter than the v2 conventions, which listed oyster
   sauce = molluscs only. I did not reopen the v2 gold files. If v2 and v3 must share one rule, the v2
   dim-sum-house/thai-kitchen entries whose only gluten source is oyster sauce should be re-checked.
2. Rule h treats mirin as sulphite-free. If the merchant's mirin is a sulphited "aji-mirin", LA Galbi
   should gain `sulphites`. No case depends on it.
3. Signature Dipping Sauce (hotpot-house) uses fermented tofu, which is often made with rice wine.
   The gold keeps `halal: true` as the menu states nothing more. No case depends on it.

## Counts

- Cases reviewed: 453 (a: korean-grill 116, nyonya-kitchen 114; b: bistro-western 111,
  hotpot-house 112)
- Labels changed: 4 cases. Cases removed: 0.
- Gold fixes: 4 entries (all hotpot-house), plus 2 note-only edits. 128 dishes checked.

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, bench/heldout/REVIEW.md and bench/v3/*. I did not
open src/, scripts/, test/, pages/, bench/results/, bench/ANALYSIS.md, bench/CHANGES.md,
bench/cases/ or bench/heldout/*.json, and I did not run the engine or any bench script. My checking
scripts are outside the repository. No git commits.
