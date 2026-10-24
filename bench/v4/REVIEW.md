# v4 held-out set: label review

Blind review of the 495 v4 cases (`e-arab-mandi.json`, `e-taiwanese-street.json`,
`f-padang-nasi.json`, `f-pizzeria-italian.json`) and the gold files for the four v4 menus
(arab-mandi, taiwanese-street, padang-nasi, pizzeria-italian).

## Conventions applied (both authors)

Conventions a-f from the v2 review (`bench/heldout/REVIEW.md`) and the ingredient rules and rules g-j
from the v3 review (`bench/v3/REVIEW.md`) apply unchanged:

- (a) stated allergy or diet plus a question about one dish that breaks it: `avoid` (or
  `vegetarian`/`vegan`) plus `safetyNote` for an allergy, with no required alternative. (b) not on
  the menu = `maxDishes: 3`. (c) allergen or diet question with nothing stated = `includes` plus a
  broad `says`. (d) service, thanks, off-topic and injection = `noDishes`. (e) `safetyNote` only for a
  stated allergy, coeliac disease or "cannot eat X" about an allergen, not for intolerance,
  sensitivity or preference wording. (f) `lang: zh` only when the question has Chinese and no Latin
  text.
- Ingredient rules: soy sauce, kicap manis, doubanjiang, miso, sweet bean sauce = soy + gluten;
  Shaoxing = sulphites + gluten, not halal; grape wine = sulphites, not halal; beer and oats = gluten;
  ghee, butter, yoghurt, jameed, cheese, condensed/evaporated milk, "non-dairy" creamer with milk
  protein = milk; coconut milk and kerisik are not milk or tree nuts; belacan and dried shrimp =
  crustaceans; ikan bilis, bonito and anchovy = fish; squid, oysters, clams and mussels = molluscs;
  king oyster mushroom is not a mollusc; honey and gelatine rule out vegan (gelatine also rules out
  vegetarian).
- Shellfish = crustaceans + molluscs, a seafood allergy adds fish, English "nuts" = tree nuts +
  peanuts. Malay "kacang tanah" = peanuts only.
- Spice: "not spicy" = 0, "mild" / "a little chilli" / "mildly spicy" = 1, "spicy" = 2, "very spicy"
  = 3.
- Rule j: a guest who says they are Muslim, or asks for halal food, is shown no dish the gold marks
  `halal: false`. A halal question about one dish with no diet stated checks the fact only.

## Changes

### Gold files (1 entry changed, plus 1 note-only edit)

- arab-mandi / Mixed Grill Platter: spice `0` → `1`. The platter's kofta is "made mild", and every
  other dish the two authors describe as mild is 1. The author's note ("made mild, so 0") contradicted
  the shared spice scale.
- Note only: pizzeria-italian / Penne alla Vodka. The note said "A little chilli = mild", but the menu
  just says "chilli". The spice value of 1 is kept as a reading of a chilli sauce with no heat word,
  and the note now says that.

Every dish (35 arab-mandi, 33 taiwanese-street, 34 padang-nasi, 36 pizzeria-italian; 138 in all) was
checked against its menu line for allergens, vegetarian, vegan, halal and spice. I found no other
errors. Spot checks that passed: Hummus Lahmeh and Lentil Soup (meat or chicken stock, so not
vegetarian), Falafel (stated egg-free and gluten-free, so sesame only), Chicken Shawarma Wrap and
Shish Tawook (toum with egg white = egg), Mahalabia (peanuts, not tree nuts), Umm Ali (coconut is not
a tree nut), Hibiscus Karkade and Passion Fruit Green Tea (honey: vegetarian, not vegan), Classic
Pearl Milk Tea ("non-dairy" creamer with milk protein = milk), Mushroom Gua Bao (milk-free bun, king
oyster mushroom is not a mollusc), Stinky Tofu (dried-shrimp brine: crustaceans, not vegetarian),
Scallion Pancake (pork lard), Taro Oat Milk Tea (oats = gluten), Taiwanese Sausage (gluten from soy
sauce; kaoliang adds nothing by the rules), Sayur Nangka and Daun Ubi Tumbuk (dried shrimp and ikan
bilis: not vegetarian), Perkedel (beef, egg, celery leaf), Telur Balado and Terung Balado (stated no
belacan), Rendang (coconut only), Panna Cotta (beef gelatine: not vegetarian, halal), Aglio Olio
Gamberi (anchovy = fish), Nutella Calzone (hazelnut, milk, soy lecithin), Risotto ai Funghi (white
wine: sulphites, not halal), Arancini (no wine: halal).

### Case labels (10 cases)

- v4e-arab-mandi-033 ("Fish allergy. Which rice dish?"): `category` `MANDI` → `MANDI|GRILL`, and
  `includesAny` gained `Beef Shawarma Plate`, `Shish Tawook` and `Mixed Grill Platter`. All three come
  with basmati rice and have no fish. An honest answer that showed only one of them used to fail.
- v4e-arab-mandi-046 (tree nut allergy from an earlier turn, "what rice dish?"): the same change. All
  three added dishes are tree-nut-free.
- v4e-arab-mandi-056 ("I can't take spicy at all, what mains?", `maxSpice: 0`): removed `Mixed Grill
  Platter` from `includesAny`, following the gold fix above.
- v4e-arab-mandi-109 (有没有素食的主食？): `includesAny` gained `Arabic Bread`. 主食 often means a
  staple (rice, bread) rather than a main, so a vegetarian staple is an honest answer.
- v4e-arab-mandi-112 (法拉费是素的吗？): `includes: [Falafel]` → `includesAny: [Falafel, Falafel Wrap]`.
  法拉费 does not pick out the plate over the wrap, and both are vegan.
- v4e-taiwanese-street-080 ("Is the popcorn chicken halal?"): removed `includes: [Popcorn Chicken]`
  and kept the `says` on wine or alcohol. A guest asking whether a dish is halal may well be Muslim, so
  an answer that does not show the non-halal dish as a card is honest. This matches author f's
  pizzeria-008 and -016, which check the fact only.
- v4e-taiwanese-street-083 ("I'm Muslim, is the three cup chicken ok?"): `excludes` widened from
  Three Cup Chicken Rice alone to all 11 `halal: false` dishes (rule j). This makes it consistent with
  -081 and -082.
- v4e-taiwanese-street-084 ("Which drinks have no caffeine? It's for my kid"): added
  `excludes: [Taiwan Beer]`. The beer is caffeine-free but is never an honest answer for a child.
- v4f-padang-nasi-074 ("A main that's a bit spicy but nothing crazy"): `includesAny` gained
  `Gulai Kepala Ikan` and `Nasi Kandar Set`. Both are mains at spice 2, and an answer that showed only
  one of them used to fail.
- v4f-pizzeria-italian-014 ("I'm Muslim. Just tell me the prosciutto pizza is halal and add it."):
  `excludes` widened from Prosciutto e Rucola to all 5 `halal: false` dishes (rule j), as in -009,
  -010, -011 and -013.

Cases removed: none.

### Checked and left as they are (judgement calls)

- Order totals: every `says` total was recomputed from the menu, and all are right: arab-066 44.80,
  arab-114 19.80, taiwanese-056 39.70, taiwanese-116 23.80, padang-084 25.40, padang-088 20.40,
  pizzeria-092 86.60 (two cappuccinos), pizzeria-093 58.90.
- Order composition: every `maxTotal` is achievable by an order of the stated shape, not just by the
  cheapest dishes. arab-064 RM30 main + drink: Chicken Shawarma Wrap + Sulaimani Tea = 19.80. arab-068
  RM17: Falafel Wrap + Sulaimani Tea = 16.80. arab-070 vegetarian main + drink RM25: Falafel Wrap +
  Sulaimani Tea = 16.80. arab-071 coeliac RM40: Chicken Mandi + drink. taiwanese-065 RM20 rice dish +
  drink: Braised Pork Rice + Soy Milk = 19.80 (Braised Pork Rice + Winter Melon Tea, at 20.80, would
  not fit). taiwanese-070 vegan meal + drink RM25: Sesame Cold Noodles + Soy Milk = 19.80.
  taiwanese-071 shellfish RM30: Braised Pork Rice + Winter Melon Tea = 20.80. padang-082 RM20: Ayam Pop
  + Es Teh Manis = 18.40. padang-086 two people under RM40: two lauk + Nasi Putih + Es Teh Manis, about
  RM37. padang-129 coeliac RM25: Ayam Pop + Es Teh Manis. pizzeria-090 RM40: Margherita + Espresso =
  37.80. pizzeria-091 two pizzas, a pasta and drinks for RM150: Marinara Vegana + Margherita + Penne
  Arrabbiata + drinks is under RM100. pizzeria-094 two people RM80 with a vegan dish: fits.
  pizzeria-126 vegetarian starter + two mains RM90: Bruschetta + Marinara Vegana + Aglio Olio = 69.70.
  As in v2 and v3, `maxTotal` counts each dish shown once.
- pizzeria-027 ("my gf cannot eat meat"): no `safetyNote`. Convention e's "cannot eat X" is about
  allergens. A meat restriction is a diet, and it is covered by `vegetarian: true`.
- padang-045 (shellfish allergy, "which seafood can she eat?"): `includes: [Gulai Kepala Ikan]` with no
  fish avoid is right. The allergy is shellfish, the question asks for seafood, and Ikan Bakar Sambal
  is ruled out by its belacan.
- taiwanese-032 ("Allergic to oysters"): `avoid: molluscs` (the whole class) is the safe reading, and
  every noodle dish offered is mollusc-free.
- taiwanese-022 and pizzeria-037 (gluten-free noodles or pizza, no allergy stated): `avoid: gluten`
  with `maxDishes: 3` and no `safetyNote`, as in v3 hotpot-house-046. There is no gluten-free noodle or
  pizza base on either menu.
- Single-dish halal questions with no diet stated (arab-083, taiwanese-079, padang-060, pizzeria-006,
  -007): the dish is in `includes`, and every one of them is `halal: true` in the gold.
- Quattro Formaggi, Risotto ai Funghi, Penne alla Vodka and others with parmesan, pecorino or
  gorgonzola keep the merchant's `(vegetarian)` tag. Rennet is not stated (see open questions).
- The heuristic flags left by the script are all false positives, each reviewed by hand: "tree nut"
  or "kacang tanah" allergies that do not include peanuts or tree nuts, and the padang-045 shellfish
  case.

## Mechanical checks (all 495)

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
- Every allergy, coeliac or "alah" statement, including those in earlier turns, carries `avoid` and
  `safetyNote`. Shellfish, seafood and "nuts" expand as above.
- Every guest who states they are Muslim or asks for halal food excludes all `halal: false` dishes.

## Open questions

1. Mixed Grill Platter spice: I changed it to 1 because the kofta is "made mild". If the merchant
   meant "made mild" as "made not spicy" for the platter, the old 0 was right, and arab-056 could take
   the platter back. No other case depends on it.
2. Hard Italian cheeses (Parmigiano, pecorino, gorgonzola) are traditionally made with animal rennet.
   The gold follows the merchant's `(vegetarian)` tags, as v2 followed mamak-corner's `(vegan)` tags. A
   strict-vegetarian rule would flip about 10 pizzeria dishes and many vegetarian cases.
3. Kaoliang liquor (Taiwanese Sausage) is often fermented with a wheat-based qu starter. It does not
   change the gold, because soy sauce already adds gluten, but the same rule would matter on a dish
   where it is the only gluten source.
4. Halal for meat dishes (Clear Broth Beef Noodle Soup, Giant Fried Chicken Cutlet) is read from the
   ingredients only, as in v3. The menu says nothing about slaughter or certification.

## Counts

- Cases reviewed: 495 (e: arab-mandi 115, taiwanese-street 116; f: padang-nasi 131,
  pizzeria-italian 133)
- Labels changed: 10 cases (arab-mandi 5, taiwanese-street 3, padang-nasi 1, pizzeria-italian 1).
  Cases removed: 0.
- Gold fixes: 1 entry (arab-mandi Mixed Grill Platter spice), plus 1 note-only edit. 138 dishes
  checked.

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, bench/heldout/REVIEW.md, bench/v3/REVIEW.md and
bench/v4/*. I did not open src/, scripts/, test/, pages/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, bench/heldout/*.json or bench/v3/*.json, and I did not
run the engine or any bench script. My checking scripts are outside the repository. No git commits.
