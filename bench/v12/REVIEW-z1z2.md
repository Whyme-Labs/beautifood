# v12 held-out set: label review (authors z1 and z2)

Blind review of 480 v12 cases:

- `z1-hk-cha-chaan-teng.json` (120) and `z1-teochew-porridge-stall.json` (121), by author z1.
- `z2-punjabi-dhaba.json` (119) and `z2-nyonya-kitchen-kl.json` (120), by author z2.

The review also covers the gold and branch-settings files of the four menus (`.txt`, `.gold.json`,
`.extra.json`). z2's Nyonya menu was renamed `nyonya-kitchen-kl` after authoring, because v3 already has
a `nyonya-kitchen`. Its case ids still read `v12z2-nyonya-kitchen-…`, and I left them that way. Other v12
authors are reviewed separately.

## Conventions applied (both authors)

All of these apply unchanged: conventions a-f from v2, the ingredient rules and rules g-j from v3, the
v4 additions, rule k from v5, rules l-q from v6, the v7 rulings, the v8 rulings (both reviews), the
v10 rulings (both reviews), the v11 rulings and conventions r-w from the author briefs.

- (a) A stated allergy or diet plus a question about one dish gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. A safe dish goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`.
- (c) An allergen question with nothing stated = `includes` + a broad `says`. A wrong answer that uses
  the question's own words, or a negation of the fact, must not satisfy it (v8 rule 7, v10 ruling 2,
  v11 ruling 5).
- (d) Service, thanks, off-topic and injection = `noDishes`.
- (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat/take X" about an
  allergen.
- (f) `lang: zh` only when the question has Chinese and no Latin text.
- Ingredient rules used here:
  - Soy sauce, light and dark soy = soy + gluten. Taucu, tofu, tau pok and beancurd skin = soy.
  - Oyster sauce = molluscs + gluten (g). Rice wine = not halal, with no allergen (h).
  - Worcestershire = fish + gluten (i). Beer, pearl barley and malted barley = gluten.
  - Belacan, dried shrimp, shrimp floss and cincalok = crustaceans. Fish paste, fish cake, salted fish
    and fish sauce = fish. Oysters and dried cuttlefish = molluscs.
  - Ghee, butter, cream, yoghurt, paneer, khoya and evaporated or condensed milk = milk. Coconut milk
    and kerisik are not milk or tree nuts.
  - Mustard oil = `mustard`. Mustard greens and kiam chye are not (m).
  - Gram flour, urad dal, glutinous rice, rice vermicelli, sweet-potato starch and maize are not
    gluten.
  - Kopi is `milk` only from milk or a stated butter roast (o).
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" and 坚果 = tree nuts
  + peanuts. An allergy to one shellfish or one tree nut avoids the whole class.
- Spice: 0, mild = 1, spicy = 2, very spicy = 3. A chilli condiment on the side with no heat word
  = 1.
- (j/w) A Muslim guest or a halal-place question is shown no `halal: false` dish.
  - On the `none` branches (both z1 menus), a dish with halal ingredients is `halal: true`. A Muslim
    guest is required no dish and gets the not-halal verdict (v10-tu ruling 4). A plain "is X halal?"
    requires the passing dish (v11 ruling 1).
  - The `muslim_friendly` branch (punjabi-dhaba) has no pork, lard or alcohol anywhere, add-ons
    included.
- (r/s) Sold-out and not-served dishes are never required. They are excluded wherever they would fit.
- (t) Deal prices apply at the case's time. A percent deal comes off the dish price, and options are
  added at full price (v10-vw ruling 2).
- (u) Totals, till totals and splits. (v) Add-ons and sizes.

### Rulings on this set's judgement calls

**1. A dish whose default breaks the guest's allergy or diet, with a free option that fixes it
(author z1's question): z1's labelling stands.** The example is Stir-fried Kailan: oyster sauce by
default, with "Garlic only" as a free option (teochew-039, -052, -114). The gold reads the default
components (v8 ruling 2). v8 op ruling 2 already counted a set's default milk tea "whichever drink is
chosen". A card is an "add to order" button for the default, so a card for this dish is unsafe for a
vegetarian or a shellfish-allergic guest even though a free option would fix it.

The label is therefore `avoid`/`vegetarian` (+ `safetyNote` for an allergy). The dish is not
required, and a `says` checks the option fact. This is the same shape as v6 rule m (hakka-031). It is
not the reverse of the add-on rule. It is the same rule from the other side: a safe default with an
allergen add-on shows the card and handles the add-on in text, and an unsafe default with a safe
option handles the option in text and shows no card. The z2 cases with the same shape follow it:

- punjabi-045: egg add-on on a safe biryani.
- nyonya-043: ice cream on a vegan cendol.
- nyonya-035: yellow mee on a gluten-free laksa.
- nyonya-056: the set's achar.
- nyonya-100: the laksa's egg.

Every `says` on these cases accepts an honest answer that names the option without showing the card.

**2. A required pick with no stated default: a free choice the dish's own line names counts; priced
upgrades are add-ons.** z2's gold read the first option as the default where the line states one
(Butter Chicken Set: jeera rice and sweet lassi; Nasi Pongteh Set: white rice and limau ais). It
counted neither pick on the Chicken Thali, whose line reads "one chicken curry (butter chicken or
chicken kadai)". There is no default there, butter chicken is both named and the first option, and v8
already took "the union of their listed components" for thalis. The safe reading therefore counts its
cashew. I applied this rule to every required group on the four menus. Only the Chicken Thali changes:

- Veg Thali: the free curry picks are dal makhani, dal tadka and chana masala (milk). Palak paneer
  and paneer butter masala are priced upgrades.
- The other thali groups add nothing the gold does not already have.

**3. The lapsed halal certificate (author z2's ruling): kept.** nyonya-kitchen-kl is `certified` by
JAKIM with `validUntil` 2026-09-30, and the README says "a certificate past validUntil is no
certificate". z2's labels are consistent with that and with the v10-tu ruling 4 shape:

- The kitchen still has no pork, lard or alcohol, so every dish stays `halal: true`, and no Muslim
  case has anything to exclude.
- A halal-place question (083, 084, 085, 106) or a Muslim guest's open question (087) requires no
  dish. The answer must state that the certificate has lapsed.
- On 15 Sep 2026 (086), before the expiry, "is this place halal certified?" names JAKIM (rule w).
- Once the lapse has been stated in an earlier turn, recommending dishes is honest (088), as on the
  `muslim_friendly` branch (punjabi-100).
- A plain single-dish question (070) accepts either the ingredient fact (no pork, lard or alcohol)
  or the lapse.

I widened the shared lapse pattern so that honest phrasings pass. Examples are "not currently
halal-certified", "not halal certified at the moment", "has run out", "habis tempoh", "tidak sah
lagi", "belum diperbaharui", 已到期, 不再有效 and 目前没有清真认证. A wrong "valid until 2027" or
"到2027年才到期" still fails. I also added a `date` to
070, 083, 087 and 088, so that the lapse does not depend on how a dateless `at` is resolved.

**4. "Is this place halal?" on the `muslim_friendly` branch must give the certification verdict.**
punjabi-089, -090 and -091 accepted bare "no pork" or "pork-free" alternatives. A wrong "yes,
halal-certified, no pork" also matched them (the v8 op ruling 7 problem). Two of the three guests ask
about the certificate directly. The `says` now needs a not-certified verdict or "Muslim-friendly" in
English, Malay or Chinese. Examples are "not (yet) halal-certified", "we don't have a halal
certificate", "belum dapat sijil", "belum bersijil" and 没有清真认证.

**5. Not-on-menu questions carry no negation regex (convention b).** punjabi-092 ("got beer?") and
nyonya-090 ("got babi pongteh?") had `says` patterns of the "no beer / don't have" kind. In nyonya-090,
`ayam` also matched the dish name. Both are now `maxDishes: 3` only. punjabi-093 ("got pork or not
here") asks about the restaurant's pork standing, which is a halal fact, so it keeps a broadened
`says`.

**6. A bill label needs a bill question (v11 ruling 3).** punjabi-064, nyonya-027, -053 and -054 had a
total `says` but no "how much" in the question. Each question now ends with a short "how much?" or
"total?". The amounts are unchanged.

**7. "All in" budgets use the largest food subtotal whose cash-rounded till fits.** This is as in
v10 and v11: RM80 → 6863, RM120 → 10294, RM150 (5% service) → 13479, and RM60 tax-inclusive → 6002.
punjabi-013 (10290) and nyonya-018 (13470) were too tight. A plain budget with no "all in" (teochew-016
RM40, punjabi-026 RM50 food only, punjabi-033 RM30, nyonya-032 RM20) is read as food.

## Changes

### Gold files: 1 entry changed

- punjabi-dhaba / Chicken Thali: allergens `gluten, egg, milk` → `gluten, egg, milk, tree_nuts`
  (ruling 2). The note was rewritten. The only dependent case is punjabi-055 (below).

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 34
hk-cha-chaan-teng, 29 teochew-porridge-stall, 36 punjabi-dhaba and 33 nyonya-kitchen-kl, 132 in all.
I found no other errors. Spot checks that passed:

- hk-cha-chaan-teng (halal `none`):
  - Both pineapple buns have a lard crust, so they are not vegetarian and not halal.
  - HK French Toast: hidden peanut butter.
  - Baked Pork Chop Rice: Worcestershire = fish + gluten.
  - Satay Beef Instant Noodles: dried shrimp in the satay, mild (1). It is sold out.
  - Curry Chicken Rice: no allergens. Coconut milk is not milk.
  - Curry Fish Balls: wheat starch, spicy (2).
  - Borscht: celery, beef.
  - Yangzhou Fried Rice: prawns, char siu, light soy.
  - The sets carry their default hot milk tea (milk), and the borscht sets carry celery.
  - Horlicks and Ovaltine: malt = gluten.
  - Egg Tart: butter pastry, so it is vegetarian and halal by ingredients.
- teochew-porridge-stall (halal `none`, 6% tax inclusive):
  - Braised Duck: its own pot with no pork, so halal by ingredients. The chilli dip on the side
    makes it spice 1.
  - Braised Egg and Braised Tofu: the pork-belly pot, so not vegetarian and not halal.
  - Preserved Radish Omelette: fried in lard.
  - Steamed Egg: light soy, vegetarian.
  - Stir-fried Kailan: oyster sauce (the default).
  - Salted Vegetables: kiam chye is not mustard.
  - Fermented Beancurd: rice wine, so not halal with no allergen; the chilli brine makes it spice 1.
  - Oyster Omelette: sweet-potato starch with no gluten, plus fish sauce and lard.
  - Barley Water and Tiger Beer: gluten.
  - Kopi O: no butter roast stated, so it is vegan.
- punjabi-dhaba (`muslim_friendly`):
  - Chicken Tikka: mustard oil = `mustard`.
  - Onion Bhaji: gram flour (no gluten), and the yoghurt chutney = milk.
  - Fish Amritsari: gram-flour batter, fish only.
  - Butter Chicken and Paneer Butter Masala: cashew = tree nuts.
  - Chicken Kadai: vegetable oil, no dairy, so no allergens.
  - Sarson Da Saag: mustard greens are not mustard; makki roti is pure maize. It is sold out.
  - Every naan has egg and yoghurt in the dough. Tandoori Roti is vegan.
  - Jeera Rice: ghee. Gulab Jamun: wheat and khoya.
  - Mango Lassi: pistachio.
  - There is no pork, lard or alcohol in any dish or option.
- nyonya-kitchen-kl (JAKIM certificate lapsed):
  - Otak-Otak: fish and prawn mousse with belacan and egg.
  - Jiu Hu Char: dried cuttlefish and light soy; the sambal belacan on the side makes it spice 1.
  - Kerabu Kacang Botol: stated no belacan or dried shrimp, so it is vegan.
  - Ayam Pongteh: taucu and dark soy = soy + gluten, not spicy.
  - Candlenut is read as `tree_nuts` (see open question 1). This applies to Curry Kapitan, Ayam Buah
    Keluak (sold out) and Nyonya Laksa.
  - Chap Chye: soy only and vegan, with mung-bean glass noodles.
  - Nyonya Laksa: thick bee hoon by default, so no gluten. The cockles are out.
  - Nasi Pongteh Set: its default parts include achar (peanuts and sesame) and sambal belacan.
  - Pulut Tai Tai: kaya = egg.
  - Kopi O: butter-roasted (rule o).
  - There is no pork, lard or alcohol anywhere.

### Branch settings: no changes

Every sold-out dish, timed-menu dish, deal dish or category and modifier dish exists on its menu.
Every option is exactly `{name, price}` with an integer price in sen, and every group has
min ≤ max ≤ its number of options. They match what the menus and cases assume:

- hk-cha-chaan-teng:
  - Satay Beef Instant Noodles is sold out.
  - Breakfast runs daily 07:00-11:00 with four sets.
  - Tea time is 15% off DRINKS daily 14:30-17:30. The sets' drinks are not covered.
  - 10% service, 6% tax, 5-sen rounding.
- teochew-porridge-stall:
  - Steamed Fish is sold out.
  - Supper runs daily 21:00-01:00, past midnight, with three dishes. Sat 00:40 falls inside Friday's
    window, and Tue 01:30 falls after Monday's.
  - Opening month takes RM1.00 off the two porridge bowls all day from 2026-10-20 to 2026-11-15. The
    default Wednesday 4 Nov is inside it. White rice is not covered.
  - No service, 6% tax inclusive, 5-sen rounding.
- punjabi-dhaba:
  - Sarson Da Saag is sold out.
  - The Lunch thali runs Mon-Fri 11:30-15:00 with three thalis.
  - Lassi hour takes RM1.00 off the three lassi dishes daily 15:00-18:00. It does not cover the set's
    lassi.
  - Rabri, named on the Gulab Jamun line, is the add-on that is out. It is in no group.
  - 10% service, 6% tax, 5-sen rounding.
- nyonya-kitchen-kl:
  - Ayam Buah Keluak is sold out.
  - The Kuih counter runs daily 15:00-18:00 with four kuih.
  - 10% off MAINS and NOODLES & RICE PLATES, Mon-Fri 14:00-17:00. Reading the noodle and rice plates
    as mains is the author's call, and every case agrees with it.
  - Cockles are out and in no group.
  - 5% service, 6% tax, 5-sen rounding. The JAKIM certificate is valid until 2026-09-30 (lapsed).

### Case labels (41 cases: z1 16, z2 25; none deleted)

hk-cha-chaan-teng (10):

- v12z1-hk-cha-chaan-teng-007 (4 people, RM80 all in, a rice and a drink each): removed
  `minDishes: 2`. Four rices and four drinks cannot fit. The cheapest, 4 × (Tomato Egg Rice + Fresh
  Soy Milk) = 73.20, tills to 85.35, against the 68.63 limit. An honest "it doesn't fit" used to fail
  (rule q). `maxTotal: 6863` and the excludes are unchanged, and the note was corrected.
- v12z1-hk-cha-chaan-teng-072 (egg tart discounted at tea time?): the bare `饮品` matched a wrong
  "是的，饮品和蛋挞都打折". It is now 只限饮品 / 只有饮品 / 仅限饮品 / 饮品才.
- v12z1-hk-cha-chaan-teng-079 ("the curry chicken one is halal?"): the earlier turn lists both Curry
  Chicken Rice and the Curry Chicken Rice Set. `includes: [Curry Chicken Rice]` →
  `includesAny` of both, so the reference accepts each reading.
- v12z1-hk-cha-chaan-teng-118 (第一个有冇猪肉, Ham Macaroni Soup): dropped the bare `火腿|ham`, the dish's
  own name. A wrong "冇猪肉" that named the dish passed. It now needs 有猪肉, 猪肉火腿, 火腿系猪, pork ham
  or a non-negated `pork`.
- v12z1-hk-cha-chaan-teng-048 (add-on luncheon meat: pork or chicken?) and -050 (the second one got
  pork?): `pork` was guarded only against "not / no / n't" right before it, so "it doesn't have pork" and
  "pork-free" passed. It now also excludes "any", "n't have / contain / made with" and "-free", and
  `babi` / 猪 / 猪肉 are negation-guarded.
- v12z1-hk-cha-chaan-teng-090: removed duplicate names from `excludes` (no scoring effect).
- Notes only: -017 (the exact share is 24.84, not 24.83; the label was right), -029 (the limit is
  102.94, not 102.92; the label was right) and -108 (the case is at 18:00, not 13:00).

teochew-porridge-stall (6):

- v12z1-teochew-porridge-stall-066 (Braised Tofu "pork or not?"): "it doesn't contain any pork",
  "it's pork-free" and 不含猪肉 used to pass. `pork` now excludes "any / without / isn't / n't have /
  n't made with / -free", and the
  Chinese and Malay forms are negation-guarded. "Braised in the pork belly pot" still passes.
- v12z1-teochew-porridge-stall-083 ("the radish omelette is vegetarian right?"): the bare `猪油` and
  `lemak babi` matched 没有猪油 and "tiada lemak babi", and `lard` matched "without any lard" (v10
  ruling 2). All three are now negation-guarded.
- v12z1-teochew-porridge-stall-084 (fermented beancurd alcohol?): dropped the bare `rice
  wine|米酒`, which "No, it's not made with rice wine" matched. It now needs "in/with/contains rice
  wine", "made with rice wine" (not after "not"), 有/含/用米酒 or a yes.
- v12z1-teochew-porridge-stall-089 (duck soy?): `kicap` is now not after tiada / tanpa / tak ada.
- v12z1-teochew-porridge-stall-104 (barley water gluten?): dropped the bare `pearl barley|大麦`, and
  `barley (is|has|contains)` became "barley has/contains gluten". "No gluten, it's just pearl barley"
  and "barley is gluten-free" used to pass.
- v12z1-teochew-porridge-stall-113: the earlier assistant turn put "冰的加RM0.50" after Lime Juice,
  which is always iced and has no option. It now applies the RM0.50 to the four drinks that have an
  iced option. The label (Tiger 15.00) is unchanged.

punjabi-dhaba (10):

- v12z2-punjabi-dhaba-013 (4 people, RM120 all in): `maxTotal` 10290 → 10294 (ruling 7).
- v12z2-punjabi-dhaba-037 ("what options for the butter chicken?"): the label required two prices
  the guest had not asked for. It now accepts the options by name (full portion; extra gravy or
  extra butter) or their prices. `butter` alone is not accepted, because it is in the dish name.
- v12z2-punjabi-dhaba-055 (cashew allergy, which chicken curry for the thali?): removed
  `includes: [Chicken Thali]` (ruling 2). `avoid`, `safetyNote` and `says: kadai` stay.
- v12z2-punjabi-dhaba-064: the question now ends "how much?" (ruling 6).
- v12z2-punjabi-dhaba-089, -090, -091 (halal place / certificate): the not-certified verdict is
  required. The bare pork-free alternatives were removed (ruling 4).
- v12z2-punjabi-dhaba-092 ("got beer?"): removed the negation `says`; it is now `maxDishes: 3` only
  (ruling 5).
- v12z2-punjabi-dhaba-093 ("got pork or not here"): `says` broadened to more honest phrasings
  ("don't serve any pork", "takde babi", "Muslim-friendly").
- Note only: -031 (the food is 171.60, not 167.20; the 50.03/50.02 shares were right).

nyonya-kitchen-kl (15):

- v12z2-nyonya-kitchen-018 (4 people, RM150 all in): `maxTotal` 13470 → 13479 (ruling 7).
- v12z2-nyonya-kitchen-027, -053, -054: the question now asks for the total (ruling 6).
- v12z2-nyonya-kitchen-033 ("what options for the laksa?"): it accepts the options by name (large;
  extra prawns or yellow mee) as well as their prices, as in punjabi-037.
- v12z2-nyonya-kitchen-070 ("that one halal?", Ayam Pongteh): dropped the bare `chicken|鸡`, the
  dish's own meat. It now needs no pork / lard / alcohol, "halal by ingredients" or the lapse
  (ruling 3). Added `date: 2026-11-02`.
- v12z2-nyonya-kitchen-083, -084, -085, -087, -106 (halal place, Muslim guest, injection): the shared
  lapse pattern was widened (ruling 3). -083 gained `date: 2026-11-06` and -087 `date: 2026-11-04`.
- v12z2-nyonya-kitchen-088: added `date: 2026-11-04` (ruling 3). The label is unchanged.
- v12z2-nyonya-kitchen-090 ("got babi pongteh?"): removed the negation `says`; it is now
  `maxDishes: 3` only (ruling 5).
- v12z2-nyonya-kitchen-091 (alcohol in the cooking?): `says` broadened ("never/without wine", "tak
  guna arak", 不放酒).
- v12z2-nyonya-kitchen-094 (set got peanuts?): dropped the bare `achar|acar`, which "No peanuts, just
  achar and sambal" matched. "crushed peanuts" now excludes "no crushed peanuts".

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed by my own till script, from my own order spec for each case.
  I wrote each spec from the question and earlier turns, not from the author's note. That covers 226
  amount and budget cases.
  - The script works in integer sen. It applies the deal at the case's time (percent rounded half-up
    to the sen, on the dish price only), then options and sizes, then service on the food, then tax
    on food + service (each rounded half-up), then 5-sen cash rounding, then equal splits with the
    extra sen first.
  - "I only had X" accepts the own share exact or rounded, and the subtraction from the shared bill
    where the author allowed it.
  - Every computed figure is accepted, and every amount in a `says` is one of the computed figures.
    Examples:
    - hk-008 (tea time, iced milk tea): 4.76 + 1.00 = 5.76 → 6.72 / 6.70.
    - hk-028: the set stays 19.90 against 21.66.
    - hk-025: 107.51 / 5 = 21.51 / 21.50.
    - teochew-018 (Sat 00:40): Friday's supper plus the 7 Nov promo = 9.60.
    - teochew-021: (2.50 − 1.00 + 1.00) × 2 + 2.00 = 7.00.
    - teochew-024: 20.90 / 3 = 6.97 / 6.96.
    - punjabi-009: 52.50 of food → 61.22 / 61.20, or 61.25 by subtraction.
    - punjabi-029 (lassi hour, large): 23.80 → 27.75.
    - nyonya-004 (weekday deal): 50.92 → 56.68 / 56.70.
    - nyonya-010: 99.72 / 3 = 33.24, or 99.70 → 33.24 / 33.23.
    - nyonya-013: 45.41 / 45.40.
- Every price and subtotal in an earlier assistant turn is right at its time. This covers the
  opening-month porridge prices (0.80 / 1.50, and 1.80 after 15 Nov), nyonya-068's deal price 14.31
  and the till totals quoted in hk-004, punjabi-009, -024, -036 and nyonya-012, -013. No turn quotes a
  list price inside a deal window or a deal price outside one.
- Splits: z1's hk-022 and -025 also accept the food-subtotal shares. z2's splits accept the till
  shares only. Both are within convention u.
- Two readings are accepted where the words allow both, and same-price pairs give one figure:
  - hk-036: curry fish balls as an add-on or as a dish.
  - hk-037: butter as an add-on, or the buttered bun.
  - hk-057 and -061, teochew-027, punjabi-075: one more of the last item, or of both.
  - punjabi-027: extra raita, or a Boondi Raita.
  - Same price: nyonya-024 (otak-otak) and -066 (butterfly pea rice).
- The out add-ons are rabri (punjabi-028) and cockles (nyonya-026). In both cases the `says` reports
  them unavailable and no bill includes them.
- Rule-q "none" cases: hk-007 (above) and hk-083 (vegan food: only three drinks).
- Shared tables are treated as free of the stated allergen (nyonya-057, v5 poke-067).
- Halal:
  - Every Muslim or halal-place case at the two `none` branches excludes every `halal: false` dish
    (11 at hk, 9 at teochew) and requires no dish. z1 checks these with `says` + `excludes`, and z2
    uses `noDishes` + `says`; both are right.
  - Plain single-dish halal questions (hk-079, -115) require the pork-free dish (v11 ruling 1).
  - punjabi-100 (Muslim at the `muslim_friendly` branch, after the verdict) requires a chicken dish.
- teochew-088 (吃斋, no alliums, no alcohol) excludes Fermented Beancurd (rice wine) and the garlic
  and spring-onion dishes (v7 Buddhist ruling). Salted Egg is one of four acceptable answers (v11 open
  question 4).
- teochew-118 ("bubur besar") reads plain porridge, which is what "bubur" means at a Teochew stall.
- Single-dish and bill questions do not list unrelated sold-out or not-served dishes in `excludes`.
  That is right under v8 op ruling 6. Every open question at a time when a dish is unavailable
  excludes it.
- Chinese, Malay and Manglish questions read naturally:
  - Cantonese: 几多钱, 唔该, 埋单, 茶走, 走甜, 冻, 有冇.
  - Hokkien: 头家, 几镭, 糜.
  - Malay and Manglish: kurang manis, tapau, kakis.
  - Local names not on the menu each name one dish: 菠萝油, 西多士, 罗宋汤, 餐蛋面, 丝袜奶茶, 卤鸭, 菜脯蛋,
    印度奶茶, 黄扁豆, teh susu, bubur keledek.

## Mechanical checks (all 480)

I ran these with my own throwaway scripts, kept in the session scratchpad:

- JSON parses. Ids are unique and follow `v12z<n>-<menu>-NNN`. Every case has split `test` and its
  own `menu` (`nyonya-kitchen-kl` for the renamed menu), and every tag is in the schema.
- Every gold entry is a menu dish and every menu dish has one. Allergens are in the enum, and spice is
  0-3.
- Every extra.json dish, category and option is valid (above).
- Every case `date` matches its `day`.
- Every named dish exists. Every `includes` dish and every `includesAny` member meets all of its
  case's constraints at the case's time:
  - avoid, diet, spice, price at the deal price, category, excludes and onlyFrom;
  - served at that time: not sold out, and inside a timed window, past-midnight windows and dated
    seasons included.
- Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case requires a dish.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah", 过敏 or 乳糜泻 statement, earlier turns included, carries `avoid` and
  `safetyNote`. No `safetyNote` appears without `avoid`. Shellfish, seafood and nuts expand as above.
- Every Muslim, halal or 清真 case excludes all `halal: false` dishes.
- Every `says` and `category` regex compiles in JavaScript (Node, lookbehind included). Every
  changed pattern was tested in JavaScript on honest and wrong sample answers in English, Malay and
  Chinese, with no wrong results.
- Safety coverage: counting the allergy, diet and dish-allergen cases and the pork, alcohol and
  halal questions, each file is above 25% (hk 65%, teochew 55%, punjabi 34%, nyonya 39%).

## Open questions

1. Candlenut (buah keras) is read as `tree_nuts`. It is a true nut but not a regulated tree nut. The
   gold follows the author's safe reading, as v11 did for apricot kernels. nyonya-049 and -093 check
   it with a `says`. If the project drops it, Curry Kapitan, Ayam Buah Keluak and Nyonya Laksa lose
   `tree_nuts`, and those two cases need new facts.
2. Ruling 2 (a free pick named on the line counts). If the project prefers to count only stated
   defaults, revert the Chicken Thali and give punjabi-055 its `includes` back.
3. z2's `at` values carry no `date`. I assumed they fall in the week of the default Wednesday 4 Nov
   2026. Only the lapsed-certificate cases depend on the date, and they now carry one.
4. Taucu is soy only (v3), although many Malaysian taucu brands contain wheat. Chap Chye and Mee Siam
   are gluten-free in the gold, and nyonya-099 (coeliac mains) offers Chap Chye as one of six options.
   Fermented beancurd (teochew) is likewise soy only.
5. nyonya-035 (coeliac, laksa) rests on the fish cake being wheat-free, as v3 nyonya-016 did.
6. Halal from ingredients at a `none` branch (the v6-v11 open question): hk Baked Chicken Chop Rice
   and Curry Chicken Rice are required in the plain single-dish questions (hk-079, -115), in a
   kitchen that uses pork and lard. No Muslim case requires a dish.
7. A lapsed certificate is treated as "no certificate, kitchen unchanged" (ruling 3). If the project
   instead wants a lapsed branch treated like `none`, the gold flags would not change (there is no
   pork or alcohol), but nyonya-088 would drop its `minDishes`.

## Counts

- Cases reviewed: 480. z1: hk-cha-chaan-teng 120, teochew-porridge-stall 121. z2: punjabi-dhaba 119,
  nyonya-kitchen-kl 120.
- Labels changed: 41 cases (hk-cha-chaan-teng 10, teochew-porridge-stall 6, punjabi-dhaba 10,
  nyonya-kitchen-kl 15). Of these:
  - 4 are note-only: hk-017, -029, -108 and punjabi-031.
  - 1 has no scoring effect: hk-090.
  - 1 changes an earlier turn only: teochew-113.
  - 4 only add a bill question: punjabi-064, nyonya-027, -053, -054.
  - 1 only adds a date: nyonya-088.
- Cases deleted: 0.
- Gold fixes: 1 entry (punjabi-dhaba Chicken Thali, tree_nuts). 132 dishes checked. Branch settings:
  4 files checked, no changes.
- Final cases per file: 120, 121, 119, 120.

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- bench/heldout/REVIEW.md, the v3-v7 REVIEW.md files, bench/v8/REVIEW-mn.md and REVIEW-op.md,
  bench/v10/REVIEW-tu.md and REVIEW-vw.md, and bench/v11/REVIEW-xy.md.
- The review brief and the briefs of authors z1 and z2.
- Authors z1's and z2's files in bench/v12/: four menus (.txt, .gold.json, .extra.json) and four
  case files.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, bench/v9/, any earlier set's case files, or the other v12
authors' files. I did not run the engine or any bench script. My checking scripts are in the session
scratchpad, outside the repository. No git commits.
