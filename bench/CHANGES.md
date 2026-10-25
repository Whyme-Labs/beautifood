# Benchmark changes

The `test` split is frozen. It changes only to fix a wrong label, recorded here with the reason.
`npx tsx bench/freeze.ts` prints the current fingerprint; it must match the latest entry below.

## v1: 2026-10-21

- 6 menus (demo-hawker, bubble-tea, banana-leaf, izakaya, brunch-cafe, zichar), each with ground truth
  per dish (`<menu>.gold.json`).
- 605 cases: 404 test, 201 dev. Written by an author who had not seen the assistant's code, its
  training data or its other tests, then reviewed for label correctness (a sample of 36 read
  before any engine was scored on the final data).
- Test fingerprint: `90ec8b2fc5ce2796` (404 cases).

## v1.1: the split re-drawn at random (before any iteration)

- The author's split (every third case after sorting) wasn't random. Dev scored 58.7% (95% CI
  51.7–65.2) against test's 73.0% (68.8–77.2), a gap with p < 0.001, even though the two splits had
  the same mix of tags, languages and difficulty. Systematic position in the author's writing order
  is the likely cause.
- Re-drawn as a seeded random split (seed 20261021), stratified by menu and primary tag, two thirds
  test. No engine had been tuned on either split. Afterwards: dev 65.2% (58.2–71.6), test 69.8%
  (65.3–74.0), consistent with one distribution.
- Test fingerprint: `1e7283da2d8e1f0f` (404 cases).

## v1.1, unchanged: notes from iteration 3 (no case or label changed)

- **An accidental test run.** `bench/run.ts --help` ran the test split, because the split defaulted
  to `test`. Only the one-line summary was seen (75.2%, 5 unsafe, at a work-in-progress commit), no
  case was read, and the result file was deleted. `--split` is now required.
- **Overlap with the training templates.** `scripts/brain/leaks.ts` found 27 of the 601 benchmark
  questions reading exactly like a training template once dish names are delexicalised ("what do
  you recommend", "how much is it", "tandas kat mana"). The templates predate the benchmark and its
  author never saw them, so these are common phrasings, not copying. The baseline was trained on
  them, though. From iteration 3b on, any generated training question of three or more words that
  reads like an eval or benchmark question is dropped before training.
- Test fingerprint: `1e7283da2d8e1f0f` (404 cases), unchanged.

## v2 held-out set (bench/heldout/): 2026-10-21

- 510 cases, all `test`, written by two new blind authors who read only the README, the schema and
  the menus: 4 new menus (thai-kitchen, mamak-corner, dim-sum-house, burger-bar, with gold files) at
  180 cases each author, plus 75 fresh cases each on the 6 v1 menus.
- Reviewed by a third blind reviewer (`heldout/REVIEW.md`): all 510 cases and the 4 new gold files
  checked; 17 labels changed for fairness or consistency, no unsafe label, no gold error.
- Frozen before any engine was scored on it. No engine change may be judged on it until a further
  set exists to replace it; it is run once per reported version.
- Overlap with training: 23 of its questions read exactly like a template the current intent model
  was trained on (common phrasings; `scripts/brain/leaks.ts`). Results are also given without them.
- Fingerprint: `e9169a6edf0e3d33` (510 cases).

## v1.2: one convention for "allergic to X, can I have Y?" (label change, both splits)

- v1's author required the asked-about dish as a card in "I'm allergic to X, can I have Y?"
  (`includes` Y plus a warning). The v2 authors and reviewer, independently, required the opposite:
  `avoid` X, so a correct answer warns in text but shows no add-to-order card for Y. The benchmark
  takes the safe convention. The v2 reviewer applied it to v1 (`cases/REVIEW-v1.md`): 28 cases
  changed (19 test, 9 dev), none removed. No other edits.
- Every version was re-scored on v1.2, so the comparison stays like for like.
- Test fingerprint: `2aeecd9888d2ed1a` (404 cases).

## v3 held-out set (bench/v3/): 2026-10-24

- 453 cases, all `test`, on 4 new menus with their own gold readings (`v3/menus/`: nyonya-kitchen,
  korean-grill, hotpot-house, bistro-western). Written by two new blind authors who read only the
  README, the schema, the v2 review's conventions and one example menu, never the engine, its
  training data or the other sets.
- Reviewed by a third blind reviewer (`v3/REVIEW.md`): all 453 cases and 128 gold dishes checked; 4
  gold entries and 4 cases changed, none removed. It settles rules v2 left open, notably oyster sauce
  = molluscs + gluten and Shaoxing wine = sulphites + gluten.
- Frozen, and committed, before any engine was scored on it. Like v2 before it, it is run once per
  reported version, and no engine change may be judged on it until a further set replaces it.
- The menus are new, so it also measures the onboarding parser out of sample
  (`bench/menu-data.ts --set v3`, totals only).
- Fingerprints: cases `e3a1169991e3c969` (453), menus and gold `12ee51326476c385` (8 files).

## v2 held-out becomes dev (2026-10-24)

- With v3 written (blind, before anyone read v2's failures), v2's cases may now be read and iterated
  on. Its 2 unsafe answers were the first thing fixed: "veg here" / "veggie here" weren't read as a
  stated diet, so the asked-about non-vegetarian dish still came as a card. v2's fingerprint is
  unchanged; it is no longer a held-out measure.

## First scores on v3 (once each, 2026-10-24)

| | before (b92c814) | after (47fd11d) |
|---|---|---|
| assistant, gold data | 85.7%, 1 unsafe | 85.7%, 1 unsafe |
| assistant, parser data | 77.5%, 1 unsafe | 82.1%, 1 unsafe |
| parser: missed allergens | 23 (recall 91%) | 17 (recall 93%) |
| parser: false allergens | 46 | 13 |
| parser: vegetarian / vegan right | 94% / 83% | 98% / 97% |
| v1.2 test (reference) | 87.9%, 0 unsafe | 87.9%, 0 unsafe |

The parser fixes carry over to new menus, but far less than in sample (0 missed on the menus they
were made on, 17 on these): its keyword list still lacks ingredients these kitchens use. The one
unsafe v3 answer is not touched by either version; it waits for a set that replaces v3.

## More dev data: six menus by two new authors (2026-10-24)

- economy-rice, indian-vegetarian, ramen-bar, seafood-tzechar, kopitiam-bakery and pho-vietnamese,
  with gold readings of all 207 dishes and 308 `dev` cases (`cases/<menu>.json`). Written by two
  new authors who read only the README, the schema and the v2 and v3 reviews' conventions, never
  the engine or its other sets. They are for iterating (the parser had no dev menus left to learn
  from: it missed nothing on the first ten), not for reporting.
- Engine before any change on them: 87.7%, 3 unsafe (Malay "alah" not read as an allergy; 乳糜泻,
  coeliac disease, read as dairy). Parser: 38 missed allergens.

## Oyster sauce counts as gluten in the older gold files too (label fix)

- The v3 reviewer settled oyster sauce = molluscs + gluten (most commercial oyster sauce has
  wheat) and flagged the older gold files as labelled the other way. 8 dishes gained `gluten`:
  dim-sum-house (Lo Mai Kai, Kai Lan with Garlic), seafood-tzechar (Garlic Broccoli), thai-kitchen
  (Cashew Chicken, Stir-fried Morning Glory) and zichar (Kam Heong Lala, Ginger Spring Onion Beef,
  Claypot Egg Tofu). Vegetarian "mushroom oyster sauce" is unchanged. zichar is a v1 menu, so v1's
  test split is scored on the corrected readings from here on; its cases are unchanged.

## Second scores on v3 (a3f4a42, once, 2026-10-24)

| | b92c814 | 47fd11d | a3f4a42 |
|---|---|---|---|
| assistant, gold data | 85.7%, 1 unsafe | 85.7%, 1 unsafe | 88.7%, 1 unsafe |
| assistant, parser data | 77.5%, 1 unsafe | 82.1%, 1 unsafe | 85.4%, 1 unsafe |
| parser: missed allergens | 23 | 17 | 12 |
| parser: false allergens | 46 | 13 | 12 |
| v1.2 test (reference) | 87.9%, 0 unsafe | 87.9%, 0 unsafe | 88.1%, 0 unsafe |

Between 47fd11d and a3f4a42 the engine was iterated on v1 dev, v2 (now dev) and six new dev
menus only. The one unsafe v3 answer is still there and still unread; v3 has now been scored three
times, so its next use should be as the reference for a v4 that replaces it.

## v4 held-out set (bench/v4/): 2026-10-24

- 495 cases, all `test`, on 4 new menus with gold readings of all 138 dishes (`v4/menus/`:
  arab-mandi, taiwanese-street, padang-nasi, pizzeria-italian). Written by two new blind authors
  who read only the README, the schema and the v2 and v3 reviews, never the engine or the other
  sets; only some dishes have Chinese names, as on real menus. It covers composing an order and
  totals as well as everything v3 did.
- Reviewed blind (`v4/REVIEW.md`): 1 gold entry and 10 cases changed, none removed.
- Frozen and committed before any engine was scored on it. It replaces v3 as the held-out
  measure; v3 becomes dev.
- Fingerprints: cases `81b84ff0a71cb6a1` (495), menus and gold `098e66d187f61051` (8 files).

## First scores on v4 (once each, 2026-10-24)

| | a3f4a42 (deployed this morning) | 0f9cf8b |
|---|---|---|
| assistant, gold data | 86.7%, 4 unsafe | 88.7%, 4 unsafe |
| assistant, parser data | 85.3%, 4 unsafe | 87.3%, 4 unsafe |
| budget questions (51) | 62.7% | 82.4% |
| combined constraints (27) | 66.7% | 88.9% |
| Chinese questions | 74.5% | 76.5% |
| parser: missed allergens | 21 of 138 dishes' (recall 91%) | same parser; 5 of the 21 suggested to the merchant |

The order planner carries over to new menus; the Chinese dictionary only a little (most v4
Chinese questions name dishes the menus do translate, or ask in ways it doesn't cover). The 4
unsafe answers (allergy and diet questions on arab-mandi and padang-nasi) are in both versions,
so none is new; they stay unread until a v5 replaces v4.

## v4's 4 unsafe answers read and fixed (2026-10-24, at the owner's request)

- By decision of the product owner, the 4 unsafe v4 answers were read before a v5 exists (safety
  first). Nothing else in v4 was read. They were: "I don't eat meat" not read as vegetarian (two
  cases; "meat" was also taken as the dish Meat Sambousek), Malay "saya alah kacang" not read as a
  nut allergy, and "allergic to anchovies" not read as fish. All fixed in general form, with unit
  tests; v3's long-standing unsafe answer went with them.
- After: v4 89.5%, 0 unsafe; v3 (dev) 88.7%, 0 unsafe; v1 dev 97.1%, v2 91.4%, 0 unsafe.
- v4 is therefore no longer fully blind on safety: its safety figure from here on is not a clean
  held-out number. v5 replaces it.

## v5 held-out set (bench/v5/): 2026-10-24

- 497 cases, all `test`, on 4 new menus with gold readings of all 138 dishes (`v5/menus/`:
  sarawak-borneo, poke-salad-bar, siu-mei-roast, mexican-cantina), by two new blind authors who
  read only the README, the schema and the v2–v4 reviews. Reviewed blind (`v5/REVIEW.md`): 1 gold
  entry and 8 cases changed, none removed. It settles "I don't eat meat" = vegetarian (no meat,
  poultry or seafood) unless the guest says fish is fine (rule k).
- Its authors were asked to include phrasings like "I don't eat meat" and "allergic to anchovies",
  which v4's unsafe answers had just shown up, so v5 leans a little towards what was just fixed.
- Frozen and committed before any engine was scored on it. It replaces v4; v4 becomes dev.
- Fingerprints: cases `2b4b070e93c06812` (497), menus and gold `e472d02d6f67efe9` (8 files).

## First score on v5 (23ef4c2, the deployed engine, once)

| | v5 |
|---|---|
| assistant, gold data | 82.9%, 2 unsafe (dish allergen questions, poke-salad-bar and siu-mei-roast) |
| assistant, parser data | 82.7%, 1 unsafe |
| allergy / diet / budget questions | 94.4% / 83.3% / 43.9% |
| Chinese questions | 71.1% |
| parser: missed allergens | 29 of 138 dishes' (recall 88%); 2 of the 29 suggested to the merchant |

Lower than v4 (89.5%, with its unsafe answers fixed after reading them): the budget planner, which
took v4's budget questions from 63% to 82%, carries over to only 44% of v5's, and the parser misses
more on these kitchens. The 2 unsafe answers stay unread.

## v5's 2 unsafe answers read and fixed (2026-10-25, at the owner's request)

- Read before a v6 exists, by the owner's decision; nothing else in v5 was read. "Sulphite
  sensitivity" wasn't a stated avoidance (only "sensitive" was), so the dish still came as a card;
  "allergic to octopus" wasn't read as molluscs. Fixed in general form with unit tests; a dash now
  ends a clause (so "sensitivity here - which seafood main?" doesn't avoid the seafood).
- After: v5 83.3%, 0 unsafe; v4 (dev) 89.5%, v3 88.7%, v2 91.4%, v1 dev 97.1%, 0 unsafe everywhere.
- As with v4, v5's safety figure is no longer blind from here on.

## v5 after the order, cheaper, mains and meat work (f807d9b, scored once at the end)

| v5 | 0d49a1b (v5's safety fixes) | f807d9b |
|---|---|---|
| overall | 83.3%, 0 unsafe | 85.7%, 0 unsafe |
| budget questions | 43.9% | 61.0% |
| combined constraints | 36.0% | 64.0% |
| diet questions | 83.3% | 86.5% |
| group questions | 86.7% | 80.0% (one case fewer) |
| Chinese questions | 71.1% | 73.3% |

The changes were made on v3 and v4 (dev) only; v5 was scored before and after, nothing in it read
beyond its two unsafe answers. The Workers AI suggestions at onboarding aren't measured here (the
benchmark has no model).
