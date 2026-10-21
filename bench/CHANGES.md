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
