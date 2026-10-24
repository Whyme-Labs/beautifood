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
