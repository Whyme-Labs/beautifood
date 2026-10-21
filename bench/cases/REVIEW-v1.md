# v1 cases: allergy and diet convention review

This review applies conventions (a), (c) and (e) from `bench/heldout/REVIEW.md` to all 605 v1 cases in
`bench/cases/*.json` (404 test, 201 dev). Ids and splits are unchanged and every file is still valid
JSON. Nothing else was edited.

## Conventions

- **(a) The guest states an allergy, coeliac disease or "can't eat X" (for themselves, someone at the
  table or "someone with ..."), and asks about a dish that contains it.** The case now has `avoid`
  for the stated allergens plus `safetyNote`, and it no longer requires that dish through `includes`
  or `includesAny`. Any `says` fact check about the ingredient is kept, so the answer must still name
  it. The card is an "add to order" button, so the answer must not show the dish as one.
  - v1 had instead required the unsafe dish as a card (`includes` + `says` + `safetyNote`). That is
    the convention this pass removes.
- **If the dish asked about is safe for the stated allergy,** it stays in `includes` and `avoid` is
  added. Under the heldout convention, a stated allergy always carries an `avoid`.
- **(c) An allergen or diet question with no allergy or diet stated** (for example "does the acai
  bowl contain nuts?" or "is the roti canai vegetarian?") keeps `includes` and gets no `avoid`. These
  cases were already labelled this way and are unchanged.
- **(e) `safetyNote` whenever an allergy is stated.** Every v1 case with a stated allergy already had
  it, so none was added. Three cases have `avoid` without `safetyNote`: bananaleaf-059, izakaya-080
  and zichar-051. They express preferences ("nut free", "no sesame", "no shellfish") with no allergy
  stated, so they are unchanged.

## Changes (28)

Of the 28 changes, 22 are case (a): the dish contained the stated allergen, so its requirement was
dropped and `avoid` added. Five are the safe-dish case: `avoid` was added and the dish stays required.
The last one is bubbletea-015.

- bananaleaf-019 (test): `{"includesAny": ["Mutton Biryani", "Vegetable Biryani"], "says": ["cashew"], "safetyNote": true}` → `{"avoid": ["tree_nuts"], "says": ["cashew"], "safetyNote": true}`
- bananaleaf-026 (dev): `{"includes": ["Roti Canai"], "says": ["fish"], "safetyNote": true}` → `{"avoid": ["fish"], "says": ["fish"], "safetyNote": true}`
- bananaleaf-028 (test): `{"includes": ["Mee Goreng Mamak"], "says": ["虾|prawn"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["虾|prawn"], "safetyNote": true}`
- bananaleaf-031 (test): `{"includes": ["Maggi Goreng"], "says": ["oyster"], "safetyNote": true}` → `{"avoid": ["crustaceans", "molluscs"], "says": ["oyster"], "safetyNote": true}`
- bananaleaf-033 (dev): `{"includes": ["Sotong Sambal"], "says": ["belacan|shrimp|udang"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["belacan|shrimp|udang"], "safetyNote": true}`
- bananaleaf-034 (dev): `{"includes": ["Roti Telur"], "says": ["egg|telur"], "safetyNote": true}` → `{"avoid": ["egg"], "says": ["egg|telur"], "safetyNote": true}`
- bananaleaf-036 (test): `{"includes": ["Milo Dinosaur"], "says": ["malt|gluten"], "safetyNote": true}` → `{"avoid": ["gluten"], "says": ["malt|gluten"], "safetyNote": true}`
- brunch-033 (test): `{"includes": ["Laksa Pasta with Prawns"], "says": ["虾|prawn"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["虾|prawn"], "safetyNote": true}`
- brunch-035 (test): `{"includes": ["Coconut Chia Pudding"], "safetyNote": true}` → `{"avoid": ["milk"], "includes": ["Coconut Chia Pudding"], "safetyNote": true}`
- brunch-036 (dev): `{"includes": ["Oat Latte"], "safetyNote": true}` → `{"avoid": ["milk"], "includes": ["Oat Latte"], "safetyNote": true}`
- brunch-037 (test): `{"includes": ["Smashed Avocado Toast"], "says": ["pumpkin seed"], "safetyNote": true}` → `{"avoid": ["peanuts", "tree_nuts", "sesame"], "says": ["pumpkin seed"], "safetyNote": true}`
- bubbletea-015 (test): `{"includes": ["Calamansi Honey Green Tea"]}` → `{"excludes": ["Calamansi Honey Green Tea"]}`
- bubbletea-032 (dev): `{"includes": ["Oolong Cheese Foam Tea"], "says": ["奶|milk|cream|cheese|芝士"], "safetyNote": true}` → `{"avoid": ["milk"], "says": ["奶|milk|cream|cheese|芝士"], "safetyNote": true}`
- bubbletea-034 (test): `{"includes": ["Strawberry Yakult"], "says": ["milk|dairy|susu"], "safetyNote": true}` → `{"avoid": ["milk"], "says": ["milk|dairy|susu"], "safetyNote": true}`
- bubbletea-035 (test): `{"includes": ["Oat Milk Hojicha Latte"], "safetyNote": true}` → `{"avoid": ["milk"], "includes": ["Oat Milk Hojicha Latte"], "safetyNote": true}`
- hawker-031 (dev): `{"includes": ["Char Kway Teow"], "says": ["prawn"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["prawn"], "safetyNote": true}`
- hawker-033 (dev): `{"includes": ["Cendol"], "safetyNote": true}` → `{"avoid": ["milk"], "includes": ["Cendol"], "safetyNote": true}`
- hawker-034 (test): `{"includes": ["Curry Mee"], "says": ["cockle|蚶|蛤|贝"], "safetyNote": true}` → `{"avoid": ["crustaceans", "molluscs"], "says": ["cockle|蚶|蛤|贝"], "safetyNote": true}`
- hawker-035 (test): `{"includes": ["Rojak"], "says": ["belacan|shrimp|udang|虾"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["belacan|shrimp|udang|虾"], "safetyNote": true}`
- hawker-036 (test): `{"includes": ["Penang Assam Laksa"], "says": ["mackerel|fish|ikan"], "safetyNote": true}` → `{"avoid": ["fish"], "says": ["mackerel|fish|ikan"], "safetyNote": true}`
- hawker-039 (test): `{"includes": ["Garden Salad"], "safetyNote": true}` → `{"avoid": ["peanuts", "tree_nuts"], "includes": ["Garden Salad"], "safetyNote": true}`
- izakaya-032 (test): `{"includes": ["Chirashi Don"], "says": ["虾|prawn"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["虾|prawn"], "safetyNote": true}`
- izakaya-034 (test): `{"includes": ["Edamame"], "says": ["soy"], "safetyNote": true}` → `{"avoid": ["soy"], "says": ["soy"], "safetyNote": true}`
- izakaya-035 (dev): `{"includes": ["Chirashi Don"], "says": ["prawn|scallop"], "safetyNote": true}` → `{"avoid": ["crustaceans", "molluscs"], "says": ["prawn|scallop"], "safetyNote": true}`
- zichar-022 (test): `{"includes": ["Vegetable Fried Rice", "Yang Chow Fried Rice"], "says": ["egg|telur"], "safetyNote": true}` → `{"avoid": ["egg"], "says": ["egg|telur"], "safetyNote": true}`
- zichar-033 (test): `{"includes": ["Prawn Paste Chicken"], "says": ["shrimp|udang|prawn"], "safetyNote": true}` → `{"avoid": ["crustaceans"], "says": ["shrimp|udang|prawn"], "safetyNote": true}`
- zichar-034 (dev): `{"includes": ["Ginger Spring Onion Beef"], "says": ["oyster"], "safetyNote": true}` → `{"avoid": ["crustaceans", "molluscs"], "says": ["oyster"], "safetyNote": true}`
- zichar-035 (test): `{"includes": ["Cheng Teng"], "says": ["barley"], "safetyNote": true}` → `{"avoid": ["gluten"], "says": ["barley"], "safetyNote": true}`

Judgement calls:

- **brunch-037** ("does the avocado toast have any nuts or seeds? alergic"): the dish has pumpkin
  seeds, which are not a schema allergen. I treated the toast as possibly unsafe for this guest, so
  it is no longer required. `avoid` holds the schema allergens that "nuts or seeds" can mean
  (peanuts, tree_nuts, sesame), and the `says` check for pumpkin seed is kept.
- **bubbletea-015** ("is the honey calamansi vegan? I don't take honey."): this is a "can't eat X"
  statement about honey, which the schema cannot express as an allergen. Setting `vegan: true` would
  also ban milk, which the guest did not rule out. The label therefore uses `excludes` on the one
  honey dish instead of `includes` it. The case had no `says` check, and none was added.
- **Diet-only cases:** for a stated vegetarian or vegan asking about one dish, I did not add
  `safetyNote`. This matches the heldout set, where that note is reserved for allergies. In practice
  only bubbletea-015 is affected: no other v1 case has a stated vegetarian or vegan asking about a
  single non-vegetarian dish.

## Verification

- Every dish whose requirement was dropped contains the stated allergen according to
  `bench/menus/*.gold.json`. The exception is brunch-037, where the dish has pumpkin seeds, which the
  gold does not track as an allergen (see the judgement calls above).
- Every dish kept in `includes` in the safe-dish cases is free of the added `avoid` allergens.
- Every changed case is satisfiable. All named dishes exist, every required dish meets its case's own
  constraints, and every `minDishes` and `includesAny` can be met. An answer that shows no dishes,
  or only safe dishes, and states the ingredient passes all of them.
- The checker reported nothing new. It still flags 6 cases whose `lang` is `en` but whose question
  contains Chinese text (bananaleaf-009, brunch-009, bubbletea-003, hawker-009, izakaya-003,
  zichar-004). That is outside this pass, so they are left as they are.

## Counts

| | test | dev | total |
|---|---|---|---|
| Cases reviewed | 404 | 201 | 605 |
| Changed: unsafe dish requirement dropped, `avoid` added (incl. brunch-037) | 15 | 7 | 22 |
| Changed: safe dish kept, `avoid` added | 3 | 2 | 5 |
| Changed: honey case moved to `excludes` (bubbletea-015) | 1 | 0 | 1 |
| **Total changed** | **19** | **9** | **28** |
| Removed | 0 | 0 | 0 |

## Reading-rule confirmation

I read only `bench/README.md`, `bench/schema.ts`, `bench/menus/*`, `bench/heldout/*` and
`bench/cases/*.json`. I did not read `src/`, `scripts/`, `test/`, `e2e/`, `docs/`, `bench/results/`,
git history or other `bench/*.md` files. My only git commands were `git status` and `git diff --stat`
on these paths. Nothing is committed.
