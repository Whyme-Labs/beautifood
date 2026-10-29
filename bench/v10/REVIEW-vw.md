# v10 held-out set: label review (authors v and w)

Blind review of 474 v10 cases:

- `v-wantan-mee-stall.json` (119) and `v-ayam-penyet-cafe.json` (122), by author v.
- `w-cendol-abc-stall.json` (117) and `w-fish-soup-noodle.json` (116), by author w.

The review also covers the gold and branch-settings files of the four menus (`.txt`, `.gold.json`,
`.extra.json`). Authors t and u are reviewed separately.

## Conventions applied (both authors)

These all apply unchanged: conventions a-f from v2, the ingredient rules and rules g-j from v3, the
v4 additions, rule k from v5, rules l-q from v6, the v7 rulings, the v8 rulings (both reviews) and
conventions r-w from the author briefs.

- (a) A stated allergy or diet plus a question about one dish gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. A safe dish goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`.
- (c) An allergen question with nothing stated = `includes` + a broad `says`.
- (d) Service, thanks, off-topic and injection = `noDishes`.
- (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat/take X" about an
  allergen.
- (f) `lang: zh` only when the question has Chinese and no Latin text.
- Ingredient rules used in this review:
  - Soy sauce, kecap manis and light soy = soy + gluten. Oyster sauce = molluscs + gluten (g).
  - Shaoxing = sulphites + gluten, not halal. Rice wine = not halal, with no allergen (h).
  - Beer and pearl barley = gluten.
  - Belacan, terasi, shrimp paste, prawn-cracker koya and hae ko = crustaceans. Dried sole, ikan
    bilis, fish balls and fish paste = fish. Squid = molluscs.
  - Coconut milk is not milk. Coconut, melinjo (emping), nutmeg and avocado are not tree nuts.
    Basil seeds are not sesame.
  - Yellow mustard as a condiment = `mustard`. Kiam chye is not (m). Dang gui is not celery.
  - Kopi is `milk` only from milk or a stated butter roast (o).
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" = tree nuts +
  peanuts. "Kacang tanah" = peanuts only. An allergy to one shellfish avoids its whole class.
- Spice: 0, mild = 1, spicy = 2, very spicy = 3. A chilli condiment on the side with no heat word
  = 1 (pickled green chilli, sambal on the side, sweet chilli sauce).
- (j/w) A Muslim guest or a halal question is shown no `halal: false` dish. On the certified branch,
  "is this place halal?" `says` the certifier.
- (r/s) Sold out and not-served dishes are never required. They are in `excludes` wherever they would
  fit, and when asked about directly the label `says` sold out, or the menu's name or start time.
- (t) Deal prices at the case's time. (u) Totals, till totals and splits. (v) Add-ons and sizes.
- Rule 7 (v8): a fact `says` must not be met by a wrong answer that uses the question's own words.

### Rulings on this set's judgement calls

**1. A reference with several readings accepts each reading.** "The combo" with no combo named
(ayam-057) accepts any of the three combos at its unchanged price. "Cendol ni halal ke?"
(cendol-069) accepts any cendol served then. "One more of that" after a two-item order (ayam-090)
accepts one more of the last item and one more of both.

**2. A percent deal comes off the dish's price, and options are added at full price.**
wantan-022 (early-bird large Wantan Mee Dry with extra wantan) is 7.65 + 2.00 + 2.50 = 12.15. This
follows the README's order: the deal sets the dish's price, then option prices are added to it. I kept
the author's reading. See open question 1.

**3. An unmarked kopitiam drink is hot.** In Malaysia "kopi", "teh", "teh tarik" and 拉茶 mean the
hot drink, and iced is ordered as "ais", "peng" or 冻. Cases that leave the temperature unsaid are
priced at the hot (first) option, for example wantan-009, ayam-010 and cendol-018. No change was
needed.

**4. Group budgets with `minDishes: 2` were kept** (wantan-015, ayam-015, cendol-011, -029,
fish-009). An honest answer that offers two dishes exists and fits the budget, as in v5 poke-086.

**5. Not-served dishes in `excludes` only where they fit (v8 op ruling 6).** I listed every case where
a sold-out or not-served dish passes all of the case's other constraints. I added `excludes` only
where that dish could be shown as an answer: wantan-015, -051, -101 and -109, and ayam-099, -110 and
-115. Bill and single-dish fact cases were left as they are.

**6. Rule 7 tightening.** Each changed pattern was tested on honest and wrong sample answers (listed
below). Cases where `avoid` is the real check kept their broad `says`.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 33
wantan-mee-stall, 30 ayam-penyet-cafe, 30 cendol-abc-stall and 30 fish-soup-noodle, 123 in all. I
found no errors. Spot checks that passed:

- wantan-mee-stall (halal `none`):
  - Every egg-noodle dish has gluten + egg. Mushroom Noodles is vegetarian but not vegan.
  - The dried-sole broths (both wantan mee, sui kow and wantan soups) carry `fish`. Char Siu Noodles'
    plain pork bone soup does not.
  - Roast Pork, Roast Pork Rice, Two-Meat Rice and Roast Pork Noodles carry `mustard` from the yellow
    mustard condiment.
  - Chicken Feet Noodles and Braised Chicken Feet: oyster sauce. Herbal Duck Drumstick Noodles: rice
    wine, so not halal, no allergen.
  - Curry Chicken Noodles, Braised Chicken Feet and Choy Sum Oyster Sauce are halal from their
    ingredients (v8 ruling 1).
  - Sets take their default components (Wantan Mee Dry with Kopi; Char Siu Rice with Wantan Soup and
    Kopi).
  - Tiger Beer is gluten, vegan and not halal.
- ayam-penyet-cafe (JAKIM, valid to 2027-04-30):
  - Every penyet and Kangkung Terasi has shrimp paste, so Tempe Tahu Penyet is not vegetarian.
  - Ayam Bakar, Nasi Uduk Komplit, Nasi Goreng Jawa and Mie Ayam Jamur get soy + gluten from kecap
    manis.
  - Soto Ayam: koya (prawn crackers) = crustaceans, plus celery leaves.
  - Gado-Gado: peanut sauce (no shrimp paste stated) and egg, so vegetarian but not vegan.
  - Emping, nutmeg and avocado are not tree nuts.
  - Every dish is halal, with no pork, lard or alcohol in any dish or add-on.
- cendol-abc-stall (muslim_friendly):
  - The cendol jelly is rice and mung-bean flour, and glutinous rice has no gluten. Bubur Gandum is
    the one bubur with gluten.
  - The ice cream is stated egg-free, so Cendol Special, Ais Kacang Special and Coconut Shake are milk
    only.
  - Rojak Buah: hae ko, peanuts, tofu puff and you char kway. Keropok Lekor: fish + wheat.
  - Pisang Goreng is vegan (palm oil). Roti Ais Krim: bun with wheat, milk and egg.
  - Laici Kang: basil seeds are not sesame.
  - There is no pork, lard or alcohol anywhere, add-ons included.
- fish-soup-noodle (pork_free):
  - Fish Head Soup: batter, evaporated milk, tofu and Shaoxing, so sulphites + gluten and not halal.
  - Tom Yam: shrimp paste, fish sauce, squid and evaporated milk. Fish Maw Soup: crab meat and egg.
  - Vegetarian Tomato Tofu Soup: kombu is not fish.
  - Blanched Choy Sum: oyster sauce, so not vegetarian. Fried Egg Tofu: egg + soy, vegetarian.
  - Fish Slice Porridge: light soy and sesame oil.
  - Fish Head Steamboat: no wine by default (wine is an add-on).

Branch settings were checked against the menus and every case. They are right as written, with no
changes:

- wantan-mee-stall:
  - Weekend special: Sat-Sun 08:00-14:00, two dishes.
  - Early-bird 10% off NOODLES: Mon-Fri 06:00-10:00, so the sets and the weekend dishes are not
    covered.
  - Curry Chicken Noodles is sold out.
  - Charges: 0% service, 6% tax, 5-sen rounding.
- ayam-penyet-cafe:
  - Lunch combo: Mon-Fri 11:00-15:00.
  - RM1.00 off Es Teh Manis all Friday. The combo's Es Teh is not discounted.
  - Bebek Penyet is sold out. Kerupuk is left out of every add-on group.
  - Charges: 5% service, 6% tax, 5-sen rounding.
- cendol-abc-stall:
  - Durian season: 2026-11-01 to 2026-11-30, 11:00-23:00.
  - Tea time: 20% off CENDOL, 15:00-17:00, which includes Durian Cendol.
  - Keropok Lekor is sold out. Attap seeds are left out of the topping groups.
  - No charges and no rounding.
- fish-soup-noodle:
  - Dinner: 17:00-21:30 daily.
  - RM1.00 off Bitter Gourd Fish Soup on Tuesday.
  - Fish Maw Soup is sold out.
  - Charges: 10% service, 6% tax, 5-sen rounding.
- Modifiers: every group has min ≤ max ≤ its number of options, and every option is exactly
  {name, price}.

### Case labels (39 cases; none deleted)

wantan-mee-stall (12):

- v10v-wantan-mee-stall-015 (3 of us, noodle + drink, RM30, Mon 12:10): `excludes` gained the two
  weekend-special noodles, which are not served then (ruling 5).
- v10v-wantan-mee-stall-036, -037 (an add-on the dish doesn't have / isn't on the menu): `says`
  gained `n't (one of|on|part of|offered|listed|available)` and `not (offered|listed|part of|one of)`.
  "Char siu isn't one of the add-ons" used to fail.
- v10v-wantan-mee-stall-044 (rice plate in large?): `says` now also accepts the verdict itself ("no
  large size", "one size only", 没有大, "tak ada saiz besar"). Before, only an answer that mentioned
  extra rice or extra char siu passed.
- v10v-wantan-mee-stall-051 ("anything spicy?"): `excludes` gained Big Prawn Noodles (spice 1, not
  served Wed 13:00), and `includesAny` gained Wantan Mee Set (spice 1).
- v10v-wantan-mee-stall-054 (大虾面有未呀, Sun 07:30): `says` gained a bare `8:00` ("早上8:00开始" used to
  fail).
- v10v-wantan-mee-stall-061 (breakfast promo when?): the weekday `says` gained `mon\W{1,3}fri`, so
  "Mon–Fri" with an en dash passes.
- v10v-wantan-mee-stall-066 (dry wantan mee pork? lard?): `says` rewritten (rule 7). The old
  `pork lard` alternative matched "it doesn't use pork lard". It now needs a yes, or "tossed in / has
  / uses (pork) lard", with negations excluded.
- v10v-wantan-mee-stall-091 (Mushroom Noodles vegan?): bare `egg|telur|蛋` → "egg noodles", "has/
  contains egg", "not vegan" and similar (rule 7). "Yes, vegan, no egg" used to pass.
- v10v-wantan-mee-stall-096 (cheaper set vegetarian?): the bare `pork|prawn|lard|猪|虾` were replaced
  by "not vegetarian", "has pork/prawn/char siu" and similar (rule 7).
- v10v-wantan-mee-stall-101 ("got laksa?"): `excludes` gained Curry Chicken Noodles. It is the nearest
  dish, and it is sold out.
- v10v-wantan-mee-stall-109 (4 people, not spicy, Fri 19:00): `excludes` gained the weekend-special
  noodles (Herbal Duck is spice 0 and not served).

ayam-penyet-cafe (13):

- v10v-ayam-penyet-cafe-034, -035, -045: the same add-on negative widening as wantan-036.
- v10v-ayam-penyet-cafe-036 (kerupuk?): `says` gained `n't (available|have|offer|carry)`, "out of
  stock", "ran out", "tak ada", "tiada" and "takde". "Kerupuk isn't available today" used to fail.
- v10v-ayam-penyet-cafe-057 (Fri: "does the RM1 off apply to the combo also?"): `includes: [Combo
  Ayam Penyet]` → `includesAny` of the three combos, and `says` 16.90 → 16.90|17.90|12.90 (ruling 1).
- v10v-ayam-penyet-cafe-061 (这里清真吗？): `says` dropped `清真认证|有清真`, which "没有清真认证" matched. It
  now needs the certifier (rule w).
- v10v-ayam-penyet-cafe-064 (Muslim, any pork or alcohol?): dropped the bare `halal`, which "not
  halal" matched. It gained "halal-certified", "certified halal", "all our food is halal" and "tiada
  alkohol".
- v10v-ayam-penyet-cafe-090 ("one more of that and the bill" after Gado-Gado + Es Cendol): `says`
  now also accepts one more of both, 37.60 / 41.85 (ruling 1).
- v10v-ayam-penyet-cafe-096 (Gado-Gado vegan?): bare `egg` → "boiled egg", "has/comes with egg",
  "not vegan" and similar (rule 7).
- v10v-ayam-penyet-cafe-099 (best seller, Sat 12:00) and -110 (signature, Thu 18:30): `excludes`
  gained the three lunch combos (not served) and Bebek Penyet (sold out).
- v10v-ayam-penyet-cafe-115 (one person under RM20, Tue 15:30): `excludes` gained the lunch combos,
  which ended at 15:00. Combo Ayam Penyet (16.90) would otherwise fit.
- v10v-ayam-penyet-cafe-118 (马来风光辣不辣？): `says` widened to 比较/很/挺/有点/会/是辣 (with 不/没 excluded),
  so "比较辣" passes and "不是辣的" no longer does.

cendol-abc-stall (7):

- v10w-cendol-abc-stall-032, -033, -036 (attap chee, oreo, oat milk): `says` gained
  `n't (available|have|offer|carry)`, "out of stock" and "ran out".
- v10w-cendol-abc-stall-048 (milk allergy, desserts, Sun 19:50 in durian season): `includesAny`
  gained Cendol Pulut, Cendol Kacang Merah, Durian Cendol, Durian Pengat and Bubur Gandum. All are
  milk-free and served then.
- v10w-cendol-abc-stall-056 (全素, 红豆冰): bare `奶|milk|susu` → 淡奶, 炼奶, 有奶/含奶 (with 没/不/无
  excluded), 不是全素 and similar (rule 7).
- v10w-cendol-abc-stall-066 (啰惹辣吗): `辣椒` matched "没有辣椒", and `spicy` matched "not spicy". Both are
  now negation-guarded (rule 7).
- v10w-cendol-abc-stall-069 (Cendol ni halal ke?): `includesAny` gained the other served cendols
  (ruling 1).

fish-soup-noodle (7):

- v10w-fish-soup-noodle-008 (Tue: bitter gourd soup vs sliced fish + bitter gourd): 13.90 is both the
  deal price and the Sliced Fish price, so a wrong verdict also passed. A second `says` now needs the
  other side (15.90, or 18.54/18.55) or the 2.00 difference.
- v10w-fish-soup-noodle-031 (yong tau foo add-on): the same negative widening as cendol-032.
- v10w-fish-soup-noodle-049 (苦瓜鱼片汤 discount how much?): the amount `says` began with
  `(^|[^0-9])1`, which matched any number starting with 1. It now needs a standalone 1 / 1.00, 一块,
  一令吉 or 13.90.
- v10w-fish-soup-noodle-053 (fish allergy, anything?): `includesAny` gained Blanched Choy Sum
  (oyster sauce, no fish).
- v10w-fish-soup-noodle-054 (shellfish allergy, which soups?): `category` `SOUP` → `SOUP|NOODLE`, and
  `includesAny` gained Fish Ball Noodles and Mee Hoon Kueh Fish Soup. Both are soups in fish broth
  with no shellfish, and an answer that offered them used to fail the category check.
- v10w-fish-soup-noodle-080 (面粉粿汤底): removed `苏东`. It is sotong (squid), not anchovy, so a wrong
  answer passed.
- v10w-fish-soup-noodle-097: the earlier assistant turn put "（冰的加RM0.50）" right after Calamansi
  Juice, which has no iced option. It now says the iced +RM0.50 applies to Kopi O, Soy Bean Milk and
  Chrysanthemum Tea. The label is unchanged (3 Kopi O = 8.40).

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed with my own till script, from my own order spec for each case.
  That is 176 cases with amounts, including the figures added in ayam-057, ayam-090 and fish-008.
  The script applies the deal at the case's time (percent rounded to the sen), then the options, then service on the food, then
  tax on food + service (each rounded half-up to the sen), then 5-sen cash rounding, then equal splits
  with the extra sen going first. Every amount is right. Examples:
  - wantan-013: early bird 7.65 + 2.30 = 9.95, below the 10.00 set.
  - wantan-023: 41.34 / 41.35 split 3.
  - ayam-009: 92.00 tills to 102.40, so 20.48 each.
  - ayam-004: service 2.685 rounds to 2.69, so 59.77 / 59.75.
  - cendol-013: Durian Cendol at tea time 9.60, plus Ais Kacang (not covered).
  - fish-023: 83.49 / 83.50 split 4.
  - fish-095: two steamboats, 111.94 / 111.95.
- Running orders with removals, swaps, "make it two", "same again" and add-ons taken off are added up
  as a server would: wantan-004 to -008, -025 and -047; ayam-005, -007, -008 and -020; cendol-003,
  -015 and -016; fish-003, -012, -013 and -108. Every price and subtotal in an earlier turn is right
  at its time, including deal prices (cendol-012 and -081, fish-008 and -101) and till totals
  (wantan-005 and -023, ayam-005, -011 and -023, fish-004, -005, -017 and -019).
- An option and a dish at the same price (ayam-018 tahu, ayam-024 perkedel, cendol-043 ice cream,
  fish-029 fish skin) give one figure under either reading. wantan-018 and -038, where they differ,
  accept both.
- Rule q / "none" honest answers: cendol-067 (shrimp-allergic, salty: the only crustacean-free salty
  snack is sold out) and wantan-041 (coeliac wantan mee) require no dish.
- `maxTotal` checks were all met by an order of the stated shape:
  - wantan-015: 3 Mushroom Noodles + 3 Chinese Tea = 27.00.
  - ayam-015: 3 Ayam Penyet = 44.70, which tills to 49.76.
  - ayam-108: 2 combos = 33.80.
  - cendol-011: 5 cold desserts, about 25.00.
  - cendol-021: Cendol Pulut + Limau Ais = 9.50.
  - fish-009: four soups = 48.60.
  - fish-018: Sliced Fish + Kopi O = 16.70.
- fish-065 ("I don't eat meat, the fish soup ok?") keeps `vegetarian: true` under rule k.
- fish-082 (吃斋) excludes Tiger Beer and Fried Egg Tofu (v7 Buddhist ruling). The vegan soup names no
  allium.
- fish-071 (egg allergy, mee hoon kueh): the line states only wheat flour dough, so the dish is
  required. See open question 3.
- cendol-015 adds a durian topping in October. The Durian topping is a plain option and is not on
  the timed menu, so the data allows it.
- Single-option price questions give the price with decimals ("2\.00", "1\.00"), as in v8. See open
  question 2.
- Chinese, Malay and Manglish questions read naturally: Cantonese 几多钱, 有未, 唔该, 走葱 and 冻; Hokkien
  头家. Local names not on the menu (椰青, 雪条, 日本豆腐, 面粉粿, 鱼饼条, 马来风光, 红豆冰, nasi siu yuk, sup peria)
  each name one dish.

## Mechanical checks (all 474)

I checked these with my own throwaway scripts, kept in the session scratchpad:

- JSON parses, ids are unique, and every case has split `test` and its own menu. Every tag is in the
  schema.
- Every gold entry is a menu dish and every menu dish has one. Allergens are in the enum, no dish is
  vegan without being vegetarian, and every spice value is 0-3.
- Every extra.json dish and category exists. Modifier groups are valid, and options are {name, price}
  only.
- Every case `date` matches its `day`.
- Every named dish exists. Every `includes` dish and every `includesAny` member meets all of its
  case's constraints at the case's time: avoid, diet, spice, price at the deal price, category,
  excludes, onlyFrom, and served now (not sold out, inside a timed window and season).
- Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case requires a dish.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah", 过敏 or "cannot take" statement, earlier turns included, carries
  `avoid` and `safetyNote`, and no `safetyNote` appears without `avoid`.
- Every Muslim, halal or 清真 case excludes all `halal: false` dishes. Both branches with
  `halal: false` dishes (wantan-mee-stall and fish-soup-noodle) were covered.
- Every `says` regex compiles. The rewritten patterns pass honest and fail wrong sample answers in
  English, Malay and Chinese.

## Open questions

1. Percent deals and options (ruling 2): if the till applies the early-bird 10% to the whole line
   (dish + options), wantan-022 would be 11.70 / 12.40. Only that case depends on it.
2. Answers that state whole-ringgit prices without decimals ("RM2 more", "RM10") fail patterns like
   `2\.00`. This is the same in every earlier set. If the project wants to accept them, widen all
   `\d+\.00` amounts together.
3. Mee hoon kueh dough is often made with egg. The gold reads the line (wheat flour only), so
   fish-071 shows it to an egg-allergic guest.
4. Halal from ingredients at a `none` branch (v6-v8 open question): Curry Chicken Noodles, Braised
   Chicken Feet and Choy Sum Oyster Sauce are `halal: true` in a kitchen that uses pork lard. No case
   requires them for a Muslim guest. wantan-064 and -065 require no dish.
5. Ayam Bakar is spice 1 because its sambal terasi is on the side (chilli condiment, no heat word).
   ayam-084, -093 and -111 depend on it being milder than Ayam Penyet, which is true either way.

## Counts

- Cases reviewed: 474. v: wantan-mee-stall 119, ayam-penyet-cafe 122. w: cendol-abc-stall 117,
  fish-soup-noodle 116.
- Labels changed: 39 cases (wantan-mee-stall 12, ayam-penyet-cafe 13, cendol-abc-stall 7,
  fish-soup-noodle 7), one of them an earlier-turn text fix only (fish-097). Cases deleted: 0.
- Gold fixes: 0 entries. 123 dishes checked. Branch settings: 4 files checked, no changes.
- Final cases per file: 119, 122, 117, 116.

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- bench/heldout/REVIEW.md, bench/v3-v7 REVIEW.md and bench/v8/REVIEW-mn.md and REVIEW-op.md.
- The briefs of authors v and w.
- Authors v's and w's files in bench/v10/: four menus (.txt, .gold.json, .extra.json) and four case
  files.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, bench/v9/, any earlier case file, or authors t's and
u's files. I did not run the engine or any bench script. My checking scripts are in the session
scratchpad, outside the repository. No git commits.
