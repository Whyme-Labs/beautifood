# Held-out set: label review

Blind review of the 510 held-out cases (`a-*.json`, `b-*.json`) and the gold files for the four new
menus (thai-kitchen, mamak-corner, dim-sum-house, burger-bar).

## Conventions applied (both authors)

a. **Allergy stated, question about one dish that contains it** ("I'm allergic to peanuts, does the
   satay have peanuts?"): label with `avoid` for the stated allergen(s) plus `safetyNote`. The answer
   may name the dish and warn in text, but must not show it as a card, because a card is an "add to
   order" button. Alternatives are welcome but not required. If the asked-about dish is safe, it goes
   in `includes`/`includesAny`. Author a used `avoid` alone. Author b used `avoid` plus a redundant
   `excludes` of the same dish. The two are equivalent, so I kept both. The authors already agreed
   here: no case on either side showed an allergen-containing dish to a guest who had stated that
   allergy. The same rule applies to a stated vegetarian or vegan asking about one non-vegetarian dish
   (`vegetarian`/`vegan`, no required alternative).
b. **Not on the menu**: `maxDishes: 3`, so an honest "no" with a few alternatives passes. I did not
   treat a plain "do you have X?" / "got X?" as yes/no-only. That exception is kept for a guest who
   explicitly asks for only a yes or no, and no case in the set does that. Regex checks for negation
   words were removed: they test wording, and `tak` also matches "take".
c. **Allergen question about a dish with no allergy stated** ("does the liu sha bao have egg?"): the
   dish is shown (`includes`), the fact is checked with a broad `says` (several phrasings and
   languages), and `avoid` is not set.
d. **Thanks, greetings, service, off-topic and injection**: `noDishes`. All such cases already
   complied.
e. **When `safetyNote` is required**: whenever the guest states an allergy, coeliac disease or
   "cannot eat X" (including allergies stated in earlier turns). It is not required for intolerance or
   preference phrasing ("lactose intolerant", "no prawns pls", "dairy free sides?"). Both authors
   already followed this, with one omission (thai-kitchen-028).
f. **`lang`** is `zh` only when the question is written in Chinese. Malay and Manglish are `en`. All
   510 cases were verified automatically.

## Changes

Gold files: **no changes**. Every dish in the four new gold files was checked against its menu line
using the allergen conventions (soy sauce = soy + gluten, oyster sauce = molluscs, fish sauce = fish,
belacan/shrimp paste/dried shrimp = crustaceans, ghee/butter/cheese/condensed or evaporated milk =
milk, wheat noodles/bread/batter/wheat starch = gluten, mayo = egg, beer = gluten, peanuts and
tree_nuts kept apart). Vegetarian, vegan, halal and spice were checked too. I found no missed
allergens and no wrong diet flags.

- Note, not a change, on mamak-corner: Thosai and Chapati are tagged `(vegan)` and served "with
  dhal". The menu's only described dhal (Dhal Curry) is "tempered in ghee". The gold follows the
  merchant's vegan tag (no milk). No case depends on this, but the menu text should be clarified
  before the next menu revision.

Case labels:

- v2a-thai-kitchen-017: added `includes: [Tom Yum Goong]` and changed `says` from `milk` to
  `milk|dairy` (convention c). A correct "yes, it has dairy" answer used to fail.
- v2a-thai-kitchen-028: added `safetyNote: true`. The guest states a fish allergy (convention e).
- v2a-thai-kitchen-029: note only. The old note said there was no egg-free noodle dish, but Yam Woon
  Sen (glass noodle salad) is egg-free. The label was already right.
- v2a-thai-kitchen-058: "what fish do you have?" now accepts Tod Mun Pla (fish cakes) in
  `includesAny`, alongside the two whole seabass dishes.
- v2b-dim-sum-house-036: `says` broadened to `oyster|mollus|蚝油|蚝`.
- v2b-dim-sum-house-057: "any noodles?" now accepts the three cheong fun (rice noodle rolls) in
  `includesAny`. The note already called them acceptable, but the label failed an answer that showed
  only cheong fun.
- v2b-dim-sum-house-079, -080, -081: replaced the negation regex with `maxDishes: 3` (convention b).
- v2b-burger-bar-012: `says` broadened to `cashew|tree.?nut|腰果|坚果|gajus`. "Contains tree nuts"
  is a correct answer.
- v2b-burger-bar-021: `says` broadened to `anchov|fish|ikan|鳀|鱼`. "Yes, the dressing has fish" is a
  correct answer.
- v2b-burger-bar-074, -075, -076: replaced the negation regex with `maxDishes: 3` (convention b).
- v2b-demo-hawker-023: replaced the negation regex with `maxDishes: 3` (convention b).
- v2b-banana-leaf-007: removed `includesAny` (a required alternative roti) from "vegetarian - roti
  canai ok?". This matches author a's equivalent cases (mamak-033/038, thai-038): the safety check
  stays, and alternatives are optional.
- v2b-banana-leaf-021: replaced the negation regex with `maxDishes: 3` (convention b).
- v2b-brunch-cafe-023: replaced the negation regex with `maxDishes: 3` (convention b).

Checked and left as they are (judgement calls):

- dim-sum-house-040 ("what's spicy, I like hot food") requires the Sichuan Wontons. It is the only
  very spicy dish, and the others have only a little red chilli.
- `maxTotal` counts every dish shown, so an answer that offers several alternatives instead of one set
  can exceed the budget. Both authors used it the same way, and the questions ask for a set.

## Mechanical checks (all 510)

Every named dish exists on its menu. Every `includes`/`includesAny` dish satisfies all of its case's
own constraints (avoid, vegetarian, vegan, spice, price, category, excludes, onlyFrom). At least one
acceptable answer exists for every `includesAny` and `minDishes`. No `noDishes` case conflicts with a
dish requirement. Ids are unique. Every price quoted in a `before` turn matches the menu. Every
allergy stated in an earlier turn carries into the case's `avoid`. No case has a stated allergy
without an `avoid`.

## Counts

- Cases reviewed: 510 (a: 255, b: 255)
- Labels changed: 17 cases (plus 1 note-only fix, thai-kitchen-029)
- Cases removed: 0
- Gold fixes: 0 (4 gold files, 115 dishes checked)

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, bench/menus/* and bench/heldout/*. I did not open,
grep or list src/, scripts/, test/, e2e/, docs/, bench/cases/, bench/results/, other bench files or
git history, and I did not run the assistant. My only git commands were `git status` and
`git diff --stat`, limited to bench/heldout and bench/menus, to confirm my own edits. My scratch
checking scripts are outside the repository.
