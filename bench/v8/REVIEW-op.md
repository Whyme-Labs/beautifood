# v8 held-out set: label review (authors O and P)

Blind review of 497 v8 cases: `o-yong-tau-foo.json` (125), `o-north-indian-tandoor.json` (125),
`p-satay-kajang.json` (122) and `p-cha-chaan-teng.json` (125). It also covers the gold and branch settings
of the four menus (yong-tau-foo, north-indian-tandoor, satay-kajang, cha-chaan-teng). Authors M and N
are reviewed separately.

## Conventions applied (both authors)

Conventions a-f from v2, the ingredient rules and rules g-j from v3, the v4 additions, rule k from v5,
rules l-q from v6 and v7's rulings all apply unchanged:

- (a) A stated allergy or diet plus a question about one dish that breaks it gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. No alternative is required. A safe dish goes
  in `includes`.
- (b) Not on the menu = `maxDishes: 3`.
- (c) An allergen question with nothing stated gets `includes` plus a broad `says`.
- (d) Service, thanks, off-topic and injection = `noDishes`.
- (e) `safetyNote` is only for a stated allergy, coeliac disease, or "cannot eat X" about an allergen.
- (f) `lang: zh` only when the question has Chinese and no Latin text.
- (j) A Muslim guest, or a guest asking whether the place is halal, is shown no `halal: false` dish.
- (k) "I don't eat meat" = vegetarian.
- (l) A single-dish diet question: a failing dish is checked by `says` and not required.
- (m) Mustard as a condiment, seed or oil counts as the allergen; mustard greens do not.
- (o) Kopi beans roasted with butter = milk.
- (q) An impossible request rewards an honest "none".
- Shellfish = crustaceans + molluscs, a seafood allergy adds fish, and "nuts" = tree nuts + peanuts.
- Spice: 0 / mild = 1 / spicy = 2 / very spicy = 3. A chilli condiment with no heat word = 1.

The v8 branch-settings conventions r-w (sold out, timed menus, deals, totals, add-ons, halal standing)
were enforced as written in the author brief.

### Rulings on this set's judgement calls

**1. Halal at a `none` or `pork_free` branch: halal ingredients count as halal (as v6/v7).**
A dish with no pork, lard or alcohol is `halal: true` in the gold, and every `halal: false` dish is
excluded for a Muslim guest or a "is this place halal?" question.

- yong-tau-foo (`pork_free`): the only `halal: false` dish is Stuffed Shiitake (Shaoxing). All seven
  Muslim or halal-place cases exclude it.
- cha-chaan-teng (`none`): 8 dishes are `halal: false` (ham, luncheon meat, the two lard pineapple
  buns, pork chop, wonton and the Shaoxing brisket). Every Muslim or halal-place case excludes all 8.
- Certified branches: north-indian-tandoor (JAIS, valid to 2027-08-31) and satay-kajang (JAKIM, valid
  to 2027-12-31) have every dish `halal: true`, with no pork, lard or alcohol on either menu. Both
  certificates are valid at every case date (the latest is 2027-03-14).

**2. A set's allergens come from its default components only. Add-on bases are not counted.**

- Ampang 6/8-Piece Set: the clear-soup default. The curry laksa base is a +RM2.00 modifier.
- Satay Campur Set: extra kuah kacang is a modifier. The set's own kuah kacang is listed.
- cha-chaan-teng breakfast and tea sets: the default hot HK milk tea or coffee (evaporated milk) counts,
  so every set has `milk`, whichever drink is chosen.

All gold entries already did this.

**3. Spice for a dish served with a chilli condiment on the side = 1 (as v7).** This covers the Ampang
sets, both Chee Cheong Fun and Cucur Udang. The gold already did this. yong-tau-foo-107 (can't take
spicy, which set?) is a rule-q "none" case.

**4. "I only had the X" shares with service and tax: both the sen-exact and the till-rounded share
are accepted.**

- north-indian-005 accepts 40.58 and 40.60.
- cha-chaan-teng-023 accepts 22.62 and 22.60, and also the 19.40 subtotal, because its wording is a
  plain "how much is mine".
- yong-tau-foo (no service, tax inclusive) and satay-kajang (no charges) give the same figure both ways.

**5. Deals beyond the brief: kept, because the menu and cases are consistent with them.**

- yong-tau-foo has "Tea time", 10% off SETS from 15:00 to 17:00 daily.
- cha-chaan-teng has "Tea time set", RM2.00 off TEA SETS from 14:00 to 17:00 daily.
- north-indian-tandoor and satay-kajang have no deals.

Every deal price in a case or an earlier turn matches the window at the case's time:

- yong-tau-foo: 10.71 / 14.31.
- cha-chaan-teng: 7.90 / 10.90 / 8.90 inside the window, and full price at 13:40 and 17:20.

No case relies on a deal outside its window.

**6. Not-served dishes in says-only cases.** Rule r/s puts a sold-out or not-served dish in
`excludes` "wherever it would otherwise fit". Author O lists the sold-out pieces in nearly every case.
Author P lists them only where a dish could be shown. Both are correct. In a bill or fact question
about named dishes, no unrelated dish fits. I added the excludes only where a not-served dish would
fit the case's other constraints (satay-086).

**7. Halal-place verdicts.** Under w, a `says` on "is this place halal?" must check the verdict.
Patterns that a wrong "yes, halal, no pork" also matched were narrowed: yong-tau-foo-088 and -093,
and cha-chaan-teng-041 and -043.

**8. An order placed in the same turn.** When the guest orders a dish and asks for a drink in one
message, an honest answer may confirm the order and show that card. So a `category` check is replaced
by an `includesAny` of drinks, as v7 did for sushi-081 (satay-063, -089). Pairing questions that name
an anchor dish without ordering it keep their category, as in earlier sets.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 38
yong-tau-foo, 39 north-indian-tandoor, 33 satay-kajang and 32 cha-chaan-teng, 142 in all. I found no
errors. Spot checks that passed:

- yong-tau-foo:
  - Cheese Tofu (fish surimi), Vegetable Roll (dried shrimp) and Choy Sum (oyster sauce) all sound
    vegetarian and are not.
  - Crab Stick has no crustaceans.
  - Stuffed Shiitake: oyster sauce + Shaoxing, so molluscs, gluten and sulphites, not halal.
  - Kangkung: light soy = soy + gluten, and it is vegan.
  - Leng Chee Kang and Barley Ais (pearl barley) and Milo Ais (malted barley) = gluten.
  - Kopi O = milk (rule o).
  - The 8-piece set adds egg (from the egg tofu).
- north-indian-tandoor:
  - Mustard oil = `mustard` (rule m) on Chicken Tikka and Tandoori Fish.
  - Gram flour and sev are not gluten.
  - Dal Tadka has ghee, so it is not vegan. Vegetable Pulao uses chicken stock, so it is not
    vegetarian.
  - Every naan has egg and yoghurt. Tandoori Roti is vegan.
  - Peshawari Naan: almonds count, coconut does not.
  - Both thalis take the union of their listed components.
  - Basil seeds are not sesame.
- satay-kajang:
  - Every satay carries peanuts + crustaceans from the kuah kacang's belacan, so Satay Tempe is not
    vegetarian.
  - Satay Daging: kicap manis = soy + gluten. Satay Kambing: ghee = milk.
  - Tauhu Bakar (no belacan stated) is vegan.
  - Mee Sup Sayur has ikan bilis broth. Mee Rebus has beef stock, dried shrimp and taucu.
  - Bubur Lambuk has dried shrimp. Coconut milk is not milk.
  - Cucur Udang: chilli sauce = 1.
- cha-chaan-teng:
  - The pineapple bun's lard crust makes it not vegetarian and not halal.
  - HK French Toast has hidden peanuts.
  - Baked Pork Chop Rice: Worcestershire = fish + gluten.
  - Beef Brisket Noodles: chu hou = soy + gluten + sesame (v5), and Shaoxing makes it not halal.
  - Tomato Vegetable Macaroni and Choy Sum are not vegetarian.
  - Horlicks = gluten. Honey Lemon is vegetarian, not vegan.

Branch settings: every sold-out dish, timed-menu dish, deal category and modifier dish names a real
menu item or header.

- Timed windows:
  - Tandoor runs 17:00-23:00 daily and Lunch thali 12:00-15:00 Mon-Fri.
  - Satay runs 17:00-01:00 daily, past midnight.
  - The Ramadan bazaar runs 15:00-19:30, from 2027-02-08 to 2027-03-09.
  - Breakfast sets run 07:00-11:00.
- At the default Wednesday 13:00:
  - The north-indian Tandoor menu and all satay are off. The thalis are on.
  - The cha-chaan-teng breakfast sets are off.
  - The cases treat them that way.
- Modifier prices match the cases:
  - Curry laksa base +2.00, extra chilli +0.50.
  - Naan butter +1.00, cheese +4.00.
  - Nasi Impit large +1.00, extra kuah kacang +2.00.
  - Iced drink +0.50.

### Case labels (17 cases)

- v8o-yong-tau-foo-018 (prawn allergy carried, "what fried stuff can I add?"): `includesAny` gained
  `Stuffed Tau Pok` (fried tofu puff) and `Stuffed Brinjal` (pan-fried). Both are fried and free of
  crustaceans, and an honest answer that offered only those used to fail.
- v8o-yong-tau-foo-088 (我是穆斯林，这里清真吗？): `says` dropped the bare pork-free alternatives
  (`没有猪|不含猪|无猪|pork.?free`), which a wrong "是清真的，没有猪肉" also matched. It now checks the
  not-certified verdict (`不是清真|没有清真|…|未.*认证|not (halal.)?certified|…`). The excludes are
  unchanged.
- v8o-yong-tau-foo-093 ("Kedai ni halal ke?"): `says` `babi|pork|sijil|certif` → a Malay and English
  not-certified verdict (`tiada sijil|tidak (di)?sijil|…|not (halal.)?certified|…`). `certif` also
  matched "certified".
- v8o-north-indian-tandoor-023 (mustard allergy, "any of those without mustard?"): `onlyFrom` and
  `includesAny` gained `Tandoori Prawns`. The earlier turn lists it, and it has no mustard oil.
- v8o-north-indian-tandoor-030 ("is it halal?" about the rogan josh): `says`
  `JAIS|Jabatan Agama Islam Selangor|雪兰莪` → the same plus `certified|bersijil|认证|\byes\b|\bya\b`.
  Rule w's certifier name is for "is this place halal?". A single-dish question is answered by a yes
  or a mention of the certified kitchen.
- v8o-north-indian-tandoor-033 (RM100 more for extras, 4 people): `maxTotal` 10000 → 13870.
  `maxTotal` counts every dish shown, and an honest answer may recap the Butter Chicken and two Garlic
  Naan already ordered (38.70).
- v8o-north-indian-tandoor-050 (23:30, "one chicken tikka and a naan"): `includes: [Plain Naan]` →
  `includesAny` of the five naans. "A naan" does not pick out the plain one.
- v8o-north-indian-tandoor-074 ("dal makhani vs dal tadka, which one is vegan?"): `says` dropped
  `both`, `tidak`, `bukan` and `两个都`, which matched a wrong "both are vegan". It gained
  `not vegan|dairy|milk|两个都不`.
- v8p-satay-kajang-052 ("Does the kuah kacang have shrimp paste in it?"): `says`
  `belacan|shrimp paste|udang|虾` echoed the question, so "no shrimp paste" passed. It now checks the
  yes (`\byes\b|a little|contains|it has|made with|ada (sedikit )?belacan|…`).
- v8p-satay-kajang-063 (coeliac, "20 ayam then. what drink can I have with it?"): removed
  `category: DRINK`. The guest orders in this turn (ruling 8), and the drinks `includesAny` and
  `avoid` stay.
- v8p-satay-kajang-086 ("Ayam percik pedas tak? Saya tak tahan pedas", November): added
  `excludes: [Bubur Lambuk, Air Katira, Ais Kacang]`. Bubur Lambuk is a spice-0 alternative that is
  not served out of season (rule s).
- v8p-satay-kajang-089 (vegetarian, "I'll take the tofu one. What drink goes with it?"):
  `category: DRINK` + `minDishes: 1` → `includesAny` of the nine served vegetarian drinks, plus
  `excludes: [Ais Kacang, Air Katira]` (ruling 8).
- v8p-cha-chaan-teng-002: removed duplicate names from `excludes`. This has no effect on scoring.
- v8p-cha-chaan-teng-038 (Thu 16:45, running tea-set order): the question "add another one, and a red
  bean ice" → "… a red bean ice. total?". The label `says` a total (25.30 / 29.50), which the guest had
  not asked for.
- v8p-cha-chaan-teng-041 ("Is this place halal?") and -043 (这里清真吗？): `says` dropped the bare
  `pork|babi|猪`, which a wrong "yes, halal, no pork" matched. It gained `aren't (halal|certified)`,
  `not a halal`, `bukan (restoran |kedai )?halal`, `serves? pork`, `有猪肉` and similar verdicts. The
  excludes (all 8 `halal: false` dishes) are unchanged.
- v8p-cha-chaan-teng-088 (第三个是猪肉吗？): removed the sold-out `Egg Tart` from `onlyFrom` (rule r).

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed with my own till script. It computes deal prices (percent rounded
  to the sen), service, tax on food plus service, 5-sen cash rounding and equal splits with the extra
  sen first. All amounts are right:
  - yong-tau-foo (no service, tax inclusive, so till = subtotal rounded to 5 sen):
    - Running orders: 17.50, 9.80, 13.90, 14.90, 18.90, 27.80, 6.70, 17.90, 14.70, 58.80, 18.40,
      8.70.
    - Splits: 12.74/12.73, 13.72/13.71 (from 41.15).
    - Tea time: 30.62/30.60, 27.02/27.00, 16.80, 30.80, 10.71, 14.31.
    - Other totals: 15.60, 15.10, 37.40, 23.80.
  - north-indian-tandoor:
    - Food and till pairs: 56.65 (48.60), 32.40/37.80, 30.80/35.90, 43.90/51.20, 33.10, 51.20/59.70,
      39.30, 35.90, 43.50, 49.80/58.05, 40.60, 38.25, 11.00/12.85, 9.90.
    - Splits: 52.05 x 3 (156.15), 27.75 x 2, 30.09/30.08 (90.25), 45.83/45.82 (91.65).
    - Own share: 40.58/40.60.
  - satay-kajang (no charges):
    - Totals: 51.00, 55.90, 31.60, 32.40, 58.20, 46.00, 38.80, 36.20, 19.90, 26.00, 52.00, 29.90,
      24.80, 31.50, 35.00, 41.90, 4.50, 3.00, 14.90.
    - Splits: 23.25, 9.84/9.83, 17.50.
    - Own shares: 21.20, 18.40.
    - The minimum of 10 sticks per order is respected in every order.
  - cha-chaan-teng:
    - Till totals: 45.25, 54.55, 16.30/19.00, 49.20 (before), 42.60/49.65, 33.45, 51.80/60.40,
      24.35, 32.40, 27.65, 58.20/67.85, 12.00/14.00, 19.40/22.60, 24.15, 25.30/29.50, 60.40, 20.75,
      24.50.
    - Splits: 29.62/29.61 (118.45), 26.15 x 3 (78.45), 15.40/17.95.
    - Own share: 19.40/22.60/22.62.
    - Prices: 11.40 and 6.40.
    - cha-chaan-teng-033's `maxPrice: 1280` is right: RM12.80 tills to 14.90, and RM12.90 tills to
      15.05.
- Every `maxTotal` is achievable by an order of the stated shape:
  - yong-tau-foo-040: 6-piece + 8-piece + 2 Kopi O = 32.80. -042 (RM10): pieces + rice.
  - north-indian-042: Dal Tadka + Tandoori Roti + Mineral Water = 21.90.
  - satay-029 (RM15, seafood allergy, 13:00): Tauhu Bakar + Sirap Ais = 10.00.
  - The group budgets fit easily.
- Running orders with changes were added up as a server would. The subtotal of every earlier turn is
  right: removals, swaps, "make that two", iced upgrades, no-ice at no charge, cancelled sold-out items
  and the deal price kept for added tea sets.
- Earlier assistant turns state only what the menu says at that time:
  - Tandoor "from 5pm", thali "Mon-Fri 12-3".
  - Satay "until 1am" at 00:30, and the bazaar "until 7:30pm".
  - Deal prices only inside the window.
  - Sold-out dishes are called sold out.
- north-indian-023's earlier turn lists the spicy tandoor dishes to a mustard-allergic guest without
  flagging the mustard oil. It is accurate menu data, and the follow-up is the mustard question. Kept.
- yong-tau-foo-021, -034, -088, -093, -104, -105 and -115 (halal) all exclude Stuffed Shiitake.
  yong-tau-foo-104 ("Is the egg tart halal?") requires the egg tart under ruling 1.
- cha-chaan-teng-042, -044 and -083 (Muslim guest at a `none` kitchen) require no dish. This is
  consistent with v7 open question 1 under either reading.
- satay-kajang-081 ("Saya tak makan daging") = vegetarian (rule k). See open question 1.
- satay-kajang-047, -090; cha-chaan-teng-046, -047, -075, -076, -091; yong-tau-foo-107 and
  north-indian-108 are rule-q "none" cases. Each one has only constraint checks.
- Halal fact questions with a passing dish (north-indian-030, satay-061, cha-chaan-teng-065) require
  the dish. cha-chaan-teng-064 (brisket alcohol) checks the fact only (rule l).

## Mechanical checks (all 497)

I checked these with my own throwaway script, kept outside the repository:

- JSON parses, ids are unique, and every gold entry matches a menu dish and every menu dish has one.
- Every extra.json dish, category and modifier name exists.
- Every case date matches its weekday.
- Every `includes` dish and every `includesAny` member satisfies all of its case's constraints at the
  case's time: avoid, diet, spice, price at the deal price, category regex, excludes, onlyFrom, and
  served now (not sold out, on a timed menu that is on).
- Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case conflicts with a dish
  requirement.
- No dish that is unavailable at the case's time, and that would fit the case's constraints, is left
  out of `excludes`, except in says-only bill and fact cases (ruling 6).
- Every `says` and `category` regex compiles, and the changed `says` patterns were tested on right and
  wrong sample answers.
- Prices quoted in earlier turns match the menu at the time (per item, quantity or with an add-on).
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah" or 过敏 statement, earlier turns included, carries `avoid` and
  `safetyNote`, and no `safetyNote` appears without `avoid`. The only flags left were "can't take
  spicy" (yong-tau-foo-029, -107; north-indian-097), which is not an allergen.
- Every Muslim or halal-place case excludes all `halal: false` dishes.

## Open questions

1. Malay "tak makan daging" often means beef or red meat. satay-kajang-081 follows rule k
   (vegetarian), as v5 open question 5 notes for the whole benchmark.
2. cha-chaan-teng halal `excludes` lists also name the Satay Beef Noodle Breakfast Set, which the gold
   has as `halal: true`. It is excluded in -066 and -083 at 08:30, when it is served. Those questions
   (a drink, the signatures) are not answered by it, so I left it. If halal-from-ingredients is
   dropped for `none` kitchens (v7 open question 1), the gold should flip it and every pork-free meat
   dish there.
3. Paneer Tikka's "yoghurt spice marinade" names no mustard oil, though tikka marinades often use it.
   The gold reads the line (no `mustard`). Only north-indian-023 and -105 touch tandoor-dish safety for
   mustard, and Paneer Tikka is not in -023's list.
4. Pairing cases with `category: DRINK` (for example yong-tau-foo-068, -070 and cha-chaan-teng-097)
   fail an answer that also shows the anchor dish's card. I kept them as in v2-v7. If the scorer shows
   every dish named, they should become `includesAny` of drinks, as was done for orders placed in the
   same turn (ruling 8).
5. Yong-tau-foo and cha-chaan-teng give no opening hours. yong-tau-foo-060 (Fri 22:15) and -125
   (Tue 08:45) assume the shop is open. The north-indian late-night cases (23:30) do too.
6. Milo and Horlicks often contain soy lecithin, and Malaysian taucu often contains wheat. The gold
   reads only the menu lines, so no `soy` on Milo. Mee Rebus has gluten anyway. No case depends on it.

## Counts

- Cases reviewed: 497 (o: yong-tau-foo 125, north-indian-tandoor 125; p: satay-kajang 122,
  cha-chaan-teng 125).
- Labels changed: 17 cases (yong-tau-foo 3, north-indian-tandoor 5, satay-kajang 4,
  cha-chaan-teng 5). Cases deleted: 0. Final cases per file: 125, 125, 122, 125.
- Gold fixes: 0 entries. 142 dishes checked. Branch settings: no changes.

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- The v2-v7 REVIEW.md files.
- The v8 author brief.
- Authors O's and P's files in bench/v8/: their four menus (.txt, .gold.json, .extra.json) and four
  case files.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, any earlier case file or authors M's and N's files. I did
not run the engine or any bench script. My checking scripts are outside the repository. No git
commits.
