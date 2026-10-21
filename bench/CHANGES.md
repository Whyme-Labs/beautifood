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
