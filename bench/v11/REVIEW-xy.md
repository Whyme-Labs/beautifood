# v11 held-out set: label review (authors x and y)

Blind review of 492 v11 cases:

- `x-hokkien-mee-stall.json` (120) and `x-ramly-burger-stall.json` (124), by author x.
- `y-claypot-chicken-rice.json` (123) and `y-ikan-bakar-seafood.json` (125), by author y.

The review also covers the gold and branch-settings files of the four menus (`.txt`, `.gold.json`,
`.extra.json`). Other v11 authors are reviewed separately.

## Conventions applied (both authors)

These all apply unchanged: conventions a-f from v2, the ingredient rules and rules g-j from v3, the
v4 additions, rule k from v5, rules l-q from v6, the v7 rulings, the v8 rulings (both reviews), the
v10 rulings (both reviews) and conventions r-w from the author briefs.

- (a) A stated allergy or diet plus a question about one dish gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. A safe dish goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`. (c) An allergen question with nothing stated = `includes` +
  a broad `says` that a wrong answer using the question's own words cannot satisfy (v8 rule 7, v10
  ruling 2). (d) Service, thanks, off-topic and injection = `noDishes`. (e) `safetyNote` only for a
  stated allergy, coeliac disease or "cannot eat/take X" about an allergen. (f) `lang: zh` only when
  the question has Chinese and no Latin text.
- Ingredient rules used here: soy sauce, dark soy, kicap manis and Maggi seasoning = soy + gluten;
  oyster sauce = molluscs + gluten (g); Shaoxing = sulphites + gluten, not halal; rose wine = not
  halal, no allergen; beer, pearl barley and malted barley = gluten; Worcestershire = fish + gluten
  (i); belacan and dried shrimp = crustaceans; ikan bilis, fish cake, fish balls, salted fish and
  fish sauce = fish; squid, clams, oysters, dried scallop and dried octopus = molluscs; butter,
  cheese and condensed or evaporated milk = milk; coconut milk is not milk; yellow mustard = `mustard`
  (m); dang gui is not celery; Chinese celery is celery; kopi is `milk` only from milk or a stated
  butter roast (o).
- Shellfish = crustaceans + molluscs; a seafood allergy adds fish; English "nuts" and 坚果 = tree nuts
  + peanuts; "kacang tanah" = peanuts only; an allergy to one shellfish avoids its class.
- Spice: 0, mild = 1, spicy = 2, very spicy = 3; a chilli condiment on the side with no heat word = 1.
- (j/w) A Muslim guest or a halal-place question is shown no `halal: false` dish. On the certified
  branch (ramly, JAKIM) "is this place halal?" `says` the certifier. On the `none` branches (hokkien,
  claypot) a dish with halal ingredients is `halal: true` in the gold, and a Muslim guest is required
  no dish and gets the not-halal verdict (v10-tu ruling 4). The `muslim_friendly` branch (ikan) has no
  pork, lard or alcohol anywhere, add-ons included, so every dish is halal.
- (r/s) Sold out and not-served dishes are never required, and are excluded wherever they would fit.
  (t) Deal prices at the case's time; a percent deal comes off the dish price and options are added
  at full price (v10-vw ruling 2). (u) Totals, till totals and splits. (v) Add-ons and sizes.

### Rulings on this set's judgement calls

**1. "Is X halal?" about a pork-free dish at a `none` branch (author x's note): not tightened.** For
hokkien-075 and -092 (Fried Fish Ball, Seafood Hokkien Mee) the dish is halal by its ingredients and
the stall is not certified and cooks with pork and lard. A plain "yes, no pork or alcohol" and a
"not halal-certified" caveat are both honest, so the `says` accepts either, as in v8
cha-chaan-teng-065 and v10 char-kway-teow-083. The real checks are the `includes` (the asked dish is
shown) and the `excludes` of all 12 `halal: false` dishes. Requiring the caveat would test wording.
Neither case has a Muslim or halal-diet statement in any turn; where one does (hokkien-090, -091;
claypot-076, -098), no dish is required (v10-tu ruling 4).

**2. The `mixed` tag (author y's note).** `mixed` has no required count. The one mixed case per y menu
(claypot-038, ikan-037) and x's three (hokkien-038, -054; ramly-049) are `lang: en`, as convention f
requires.

**3. A bill label needs a bill question.** Where an order-change turn ("make it two", "one more of
that", "swap the egg for mushroom", "change one of them to medium") carried a `says` total but the
guest had not asked for one, the question now ends with a short "how much?" / "total?" in the guest's
language, as v8 cha-chaan-teng-038 did. The labels are unchanged. This affects 9 claypot and 18 ikan
cases.

**4. Earlier assistant turns must not leave out a dish that answers the guest's question when the
follow-up depends on the list.** Three earlier turns answered a filtering question but missed a
matching dish, which an honest follow-up answer could then name (hokkien-069, -070; ramly-030). Each
turn now lists it; references ("the last one", "the ones with prawns") resolve as before or are
widened to match.

**5. Rule 7 negation guards (v8 rule 7, v10 ruling 2).** Several `says` were met by a wrong answer
in a negated form (不会辣 against `会辣`, 不是辣的 against `辣的`, 没有用猪油 against `用猪油`, 没有黄芥末
against `黄芥末`, "tiada kacang" against `ada kacang`, "we don't use pork" against `use pork`, "not
very spicy" against `very spicy`), or by an echo of the dish's own description ("Sambal Kangkung",
"soy sauce", "oyster sauce", "lap cheong"). These now need the positive fact. Every changed pattern
was tested on honest and wrong sample answers in English, Malay and Chinese, and compiles in
JavaScript. Each rewritten verdict pattern was tried on at least five honest phrasings, including
ones that name the dish instead of saying "vegetarian" or "spicy".

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 30
hokkien-mee-stall, 33 ramly-burger-stall, 32 claypot-chicken-rice and 35 ikan-bakar-seafood, 130 in
all. I found no errors. Spot checks that passed:

- hokkien-mee-stall (halal `none`):
  - KL Hokkien Mee: wheat noodles, dark soy, prawns, squid; sambal belacan on the side = crustaceans
    and spice 1. Fried Bee Hoon: rice vermicelli, gluten only from soy sauce.
  - Penang Hokkien Prawn Mee: prawn-head and pork rib broth, egg, spicy (2). Loh Mee: fish cake and
    egg, no chilli named (0).
  - Seafood Hokkien Mee (No Pork) and Kam Heong Lala: no pork, lard or alcohol, so halal from their
    ingredients (v8 ruling 1). Kam Heong Lala: clams and oyster sauce, dried shrimp, butter.
  - Vegetarian Fried Bee Hoon: egg and beancurd puffs, vegetarian, not vegan. Sang Har Mee: Shaoxing,
    sulphites, not halal (sold out).
  - Hokkien Mee Set: the union of its default parts (small KL Hokkien Mee, Fried Fish Ball, Kopi Ais).
  - Oyster Omelette: sweet potato starch, no gluten; lard. Braised Egg: pork stock, not vegetarian.
  - Kopi O and Teh O are vegan (no butter roast stated); Milo and Barley Ais carry gluten.
- ramly-burger-stall (JAKIM, valid to 2027-09-30):
  - Every patty: soy protein and wheat filler, Maggi seasoning and Worcestershire = soy, gluten,
    fish. The "vegetable margarine" is milk-free, and the sauces are a min-0 group, so no egg or milk
    in the base burger.
  - Burger Special: egg wrap. Burger Ikan: egg batter. Burger Sayur: stated egg- and dairy-free bun,
    vegan. Burger Telur: vegetarian.
  - Roti John: mayonnaise = egg, chilli sauce = 1. Hot Dog Ayam: yellow mustard = `mustard`.
  - Burger Oblong: cheese and butter = milk, "mildly peppery" = 1. Maggi Goreng Daging: spicy (2).
  - No pork, lard or alcohol in any dish or option.
- claypot-chicken-rice (halal `none`):
  - Claypot Chicken Rice: oyster sauce, soy, Shaoxing, sesame oil, salted fish; not halal.
  - Claypot Mixed Meat Rice and Pan-fried Lap Cheong: rose wine, so not halal, with no allergen.
  - Claypot Chicken & Mushroom Rice, Claypot Dried Chilli Chicken, Black Chicken Herbal Soup and the
    vegetables: no pork and no wine, so halal from their ingredients.
  - Claypot Tofu: house egg tofu, prawns, oyster sauce. Vegetarian Claypot Tofu: stated no egg, vegan.
  - Watercress Soup: Chinese almonds (apricot kernels) = `tree_nuts` (see open question 2).
  - Old Cucumber and Lotus Root soups: dried scallop and dried octopus = molluscs; peanuts.
  - Mixed Meat Lunch Set: the union of the rice and the dried-scallop soup.
- ikan-bakar-seafood (`muslim_friendly`):
  - Ikan Pari and Kembung: belacan marinade. Ikan Siakap: stated no belacan, mild (1).
  - Sotong Bakar: kicap manis. Udang Bakar: butter = milk.
  - The platters: the union of their grills and named dips (the Kampung platter's sambal belacan, the
    Besar platter's three dips).
  - Tom Yam Ayam: fish sauce, chilli paste stated without shrimp; oyster mushroom is not a mollusc.
    Sup Ikan: Chinese celery.
  - Ayam Goreng Berempah: rice flour, no gluten. Sayur Campur: oyster sauce, not vegetarian.
  - Air Asam: no belacan, vegan, spicy (2). Sambal Belacan: very spicy (3).

### Branch settings: no changes

Every sold-out dish, timed-menu dish, deal dish or category and modifier dish exists on its menu.
Every option is exactly `{name, price}` with an integer price in sen, and every group has
min ≤ max ≤ its number of options. They match what the menus and cases assume:

- hokkien-mee-stall: Sang Har Mee is sold out. Supper runs daily 22:00-02:00, past midnight, with
  three dishes (Sat 00:30 and Sun 00:45 fall inside it). Happy hour takes RM1.00 off COLD DRINKS
  Mon-Fri 14:00-17:00; it does not reach the set's drink or the beer. The add-on that is out is
  Extra squid, which is in no group. 0% service, 6% tax, 5-sen rounding.
- ramly-burger-stall: Burger Kambing is sold out. Late night runs daily 21:00-01:00 with three
  dishes. Roti john is 20% off 17:00-19:00 daily. Sauces: pick up to two, cheese sauce +RM1.00.
  No service, no tax, 5-sen rounding.
- claypot-chicken-rice: Claypot Prawns with Glass Noodles is sold out. Lunch sets run Mon-Fri
  11:00-14:30 (so they are on at the default Wednesday 13:00). The weekend soup deal is 10% off
  HERBAL SOUPS on Saturday and Sunday. Waxed duck leg, named on the Claypot Chicken Rice line, is the
  add-on that is out and is in no group. 10% service, 6% tax, 5-sen rounding.
- ikan-bakar-seafood: Ikan Kembung Bakar is sold out. The Dinner menu (the three platters) runs daily
  18:00-23:00, so it is off at the default Wednesday 13:00. RM3.00 off the three grilled fish on
  Mondays (not the platters). Dips: one or two, free. 10% service, 6% tax, 5-sen rounding.

### Case labels (61 cases: x 18, y 43; none deleted)

hokkien-mee-stall (13):

- v11x-hokkien-mee-stall-039 (lard crisps on the pork-free mee?): `says` gained `n't (be )?(offered|
  available|an option|possible|part of)`. "Lard crisps aren't an option for it" used to fail.
- v11x-hokkien-mee-stall-051 ("no pork" prawn mee becomes halal?): `pork (rib )?(broth|stock)` now
  excludes "no / without pork broth" (ruling 5).
- v11x-hokkien-mee-stall-052 (mix 3 noodles?): `says` also accepts "can't mix / cannot choose",
  "tak boleh", 不能 and 不可以. "You can't mix three" used to fail.
- v11x-hokkien-mee-stall-069 (not spicy under RM15, then "the ones with prawns?"): the earlier turn
  left out Fried Kuey Teow (spice 0, RM10.00, with prawns). It now lists it; `onlyFrom` gained it and
  `includes` is now Fried Bee Hoon, Fried Kuey Teow and the seafood hokkien mee (ruling 4).
- v11x-hokkien-mee-stall-070 ("which one has squid also?"): the earlier turn left out the seafood
  hokkien mee, which has squid. It now names it first, so "the last one" is still Fried Kuey Teow
  and the label (20.00 / 21.20) is unchanged (ruling 4).
- v11x-hokkien-mee-stall-071: the earlier turn called the prawn mee 有点辣 (a little spicy). The line
  says spicy (2), so it now says 是辣的. The label is unchanged.
- v11x-hokkien-mee-stall-077 (第二个辣吗), -106 (马来风光辣不辣): 会辣 / 是辣 / 辣的 now exclude 不会 / 不是 /
  没有, a bare 辣 as its own word ("辣。") and 有一点辣 / 偏辣 are accepted, and -106 dropped the bare
  `sambal` (the dish's own name, Sambal Kangkung), 虾米 and 峇拉煎 (ruling 5).
- v11x-hokkien-mee-stall-079 (the cheaper one got gluten?): dropped the bare `soy sauce|kicap|酱油`,
  which "no gluten, it's rice vermicelli with soy sauce" matched. It now needs wheat, "has gluten",
  "gluten from the soy", "not gluten-free" or 含(有)麸质 / 有麸质.
- v11x-hokkien-mee-stall-099 (choy sum anything non-vegetarian?): the bare `oyster sauce`, which
  "it's vegetarian, choy sum with oyster sauce" matched, became the verdict ("yes", "not
  vegetarian", 不是素, 素食者不适合) or the oyster fact ("made from oysters", "contains oyster
  extract", 蚝油是/含).
- v11x-hokkien-mee-stall-104 (can't take spicy, lala very spicy?): `very spicy` matched "not very
  spicy", and the bare `chilli` matched "only a little chilli". It now needs "is / quite / very spicy"
  not after "not", a yes, a non-negated `pedas`, or the guarded Chinese forms. `maxSpice: 0` stays.
- v11x-hokkien-mee-stall-105 (mee udang pedas tak?): it needed a qualifier ("agak pedas"), so a plain
  "Ya, pedas" failed, and the bare `sambal` matched "tak pedas, sambal asing". It now accepts `pedas`
  not after tak / tidak / kurang / berapa / terlalu / bukan, "is spicy", or a yes.
- v11x-hokkien-mee-stall-107 (蚝煎有猪油吗): 用猪油 now excludes 没有用 / 不用 (ruling 5).

ramly-burger-stall (5):

- v11x-ramly-burger-stall-015 (4 kids, RM30, a burger and a drink each): `includesAny` widened from
  the three cheapest burgers to every served burger. Four Burger Ikan or Burger Sayur with mineral
  water come to exactly RM30.00, and a mixed order can include any burger. `maxTotal` is unchanged.
- v11x-ramly-burger-stall-030 ("what burgers got egg inside"): the earlier turn left out Burger Ikan
  (egg batter). It now names it first; "the last one" is still Burger Telur (7.00) (ruling 4).
- v11x-ramly-burger-stall-076 (第一个有没有芥末): `黄芥末` now excludes 没有 / 不含 (ruling 5).
- v11x-ramly-burger-stall-077 (第二个辣吗): the Chinese spice pattern is negation-guarded and accepts a
  bare 辣, as in hokkien-077 (ruling 5).
- v11x-ramly-burger-stall-104 (tak tahan pedas, Maggi goreng pedas sangat?): the same `pedas` rewrite
  as hokkien-105. "Tak pedas sangat" used to pass, and "Ya, pedas" used to fail.

claypot-chicken-rice (20):

- v11y-claypot-chicken-rice-007, -009, -010, -048, -090, -095, -096, -097, -104: the question now
  asks for the total (ruling 3). The amounts are unchanged.
- v11y-claypot-chicken-rice-026 (under RM25, one claypot rice plus a drink): removed `minDishes: 2`.
  The Chicken Rice Lunch Set (RM18.50, rice with tea) answers the question as one dish and is in the
  `includesAny`.
- v11y-claypot-chicken-rice-066, -075, -076, -085 (halal place, Muslim, injection): `(serve|use|cook)
  pork` now excludes "don't / not / never", `(guna|ada|hidang) babi` excludes "tak / tiada / tidak",
  and 含猪肉 / 用猪肉 exclude 不 / 没 / 没有. "We don't use pork" and 不用猪肉 used to pass (ruling 5).
  The excludes are unchanged.
- v11y-claypot-chicken-rice-072 (芥兰是素的吗): the bare 蚝油 / oyster sauce matched "是素的，用蒜蓉和蚝油炒".
  It now needs the verdict (不是素, 不算素, 吃素的不能吃, 素食者不适合, not vegetarian) or the oyster fact
  (蚝油是/含/由, made from oysters) (ruling 5).
- v11y-claypot-chicken-rice-078 (nasi claypot ayam ada babi?) and -102 (yang kedua ada babi?): the
  bare `lap cheong`, `sosej` and `sausage` are replaced by "pork sausage", "sosej babi", "lap cheong
  (pork)", a non-negated "ada babi" or a yes. "Tiada babi, cuma … lap cheong" used to pass.
- v11y-claypot-chicken-rice-092 ("those two are vegetarian?" about Garlic Kai Lan and Garlic Choy
  Sum): Garlic Choy Sum passes (vegan) and is now in `includes` (rule l). The `says` `oyster sauce`
  matched "both are vegetarian, the kai lan has oyster sauce"; it now needs a verdict on the kai lan
  ("not vegetarian", "only the choy sum", "kai lan … is not / no", 不是素) or the oyster fact
  ("contains oyster extract", "made from oysters").
- v11y-claypot-chicken-rice-098 (Muslim from the earlier turn, "the first one got alcohol or not?"):
  the earlier assistant turn already gave the not-certified verdict, and the guest asks one fact. The
  `says` now checks that fact (no wine or alcohol in Claypot Chicken & Mushroom Rice) instead of a
  repeat of the verdict. No dish is required, and every `halal: false` dish stays excluded.
- v11y-claypot-chicken-rice-123 (dried chilli chicken very spicy? can't tahan): removed the second
  `says` (mild / less spicy). It required the answer to bring up the spice-level option, which the
  guest did not ask about. An honest "yes, it's spicy, try X instead" used to fail. The spicy `says`
  stays.

ikan-bakar-seafood (23):

- v11y-ikan-bakar-seafood-005, -006, -007, -008, -009, -010, -011, -032, -041, -046, -092, -094,
  -095, -096, -097, -105, -109, -110: the question now asks for the total or price (ruling 3). The
  amounts are unchanged.
- v11y-ikan-bakar-seafood-061 (ikan pari still RM19 today? Tuesday): `says` gained the till figure
  25.65 beside 22.00 (v8 ruling 8).
- v11y-ikan-bakar-seafood-067 (椰浆饭有花生吗): `ada kacang` matched "tiada kacang". It is now guarded,
  and "with / has peanuts" excludes "no" (ruling 5).
- v11y-ikan-bakar-seafood-072 (冬炎汤有没有加奶): 冬炎汤 names both tom yams (冬炎海鲜汤 and 冬炎鸡汤), and
  both are clear broths with no milk. `includes: [Tom Yam Campur]` → `includesAny` of both.
- v11y-ikan-bakar-seafood-087 (Muslim, first visit, recommend): the `says` also accepts the
  pork- and alcohol-free fact (no pork, pork-free, 没有猪肉 / 不用酒, tiada babi). On a
  `muslim_friendly` branch that is the honest point of the answer. A plain recommendation with neither
  fact still fails.
- v11y-ikan-bakar-seafood-104 (第二个辣吗): the Chinese pattern is negation-guarded and accepts a bare 辣,
  and the bare `pedas` is now not after tak / tidak / kurang (ruling 5).

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed by my own till script from my own order spec for each case,
  which I wrote from the question and earlier turns, not from the author's note. That covers 192
  cases with amounts. The script applies the deal at the case's time (percent rounded to the sen, on
  the dish price only), then the options and sizes, service on the food, tax on food + service (each
  rounded half-up to the sen), 5-sen cash rounding, and equal splits with the extra sen first. Every
  computed figure is accepted, and every amount in a `says` is one of the computed figures. Examples:
  - hokkien-007: 41.50 → 43.99 / 44.00, thirds 14.67 / 14.66. hokkien-024: 64.87 / 64.85, quarters
    16.22 / 16.21. hokkien-017 (happy hour, large): (1.80 + 1.00) x 2 + 1.50 = 7.10 → 7.53 / 7.55.
    hokkien-030 (Sun 00:45, inside Saturday's supper): 37.10, halves 18.55.
  - ramly-009 (roti john deal): 13.92 / 13.90, thirds 4.64 / 4.63. ramly-018: 5.60 + 3.00 + 1.00 =
    9.60. ramly-032: 21.92 / 21.90, quarters 5.48 / 5.47.
  - claypot-012: 69.20 → 80.69 / 80.70, thirds 26.90 / 26.89. claypot-029 (Sunday soups): 39.22 →
    45.73 / 45.75, halves 22.87 / 22.86 / 22.88. claypot-034: 79.22 → 92.37 / 92.35.
  - ikan-004 (Monday siakap): 65.00 → 75.79 / 75.80. ikan-028: 91.53 / 91.55, thirds 30.51 / 30.52.
    ikan-033: 71.13 / 71.15, halves 35.57 / 35.56 / 35.58.
- Comparisons and "how much more" questions (hokkien-011, -012, -013, -014; ramly-003, -013, -014;
  claypot-016, -017, -018, -025; ikan-016 to -019, -048) give menu prices or differences. That is how
  a guest compares, and I kept them so.
- ikan-015 also accepts 38.47, the share found by taking the friend's exact share from the exact
  total. hokkien-010, -028 and claypot-014 ("what do I pay?", "我要给多少", "how much is my part?")
  accept the food subtotal too, as v8 cha-chaan-teng-023 did for plain wording.
- "All in" budgets use the largest food subtotal whose cash-rounded till fits: hokkien-029 (RM20 →
  1889), claypot-019 (RM100 → 8578), claypot-031 (RM200 → 17154) and ikan-020 (RM250 → 21443).
  Every `maxTotal` can be met by an order of the stated shape.
- Two readings accepted where the words allow both: "add fried wantan" (add-on 4.00 or side 8.00,
  hokkien-026, -042), "tambah telur" (egg add-on or Burger Telur, ramly-039), "1 lap cheong"
  (add-on or Pan-fried Lap Cheong, claypot-043), "one more of the maggi" (ramly-024) and the first
  of the cold drinks hot or iced (ikan-095). Same-price pairs (ikan Telur goreng 2.00, Ayam goreng
  berempah 9.00) give one figure.
- The out add-ons: hokkien-041 (extra squid) and claypot-042 (waxed duck leg) `says` not available,
  and no bill includes them.
- Rule-q "none" cases: hokkien-093 (coeliac noodles), claypot-088 (soy-free claypot rice).
- Allergen add-ons on a safe base: ramly-042 (mayo, egg), ramly-043 (cheese slice, milk), claypot-046
  (salted fish, fish), ikan-044 (sambal belacan dip, shellfish) rely on `avoid` + `safetyNote` and,
  where the label has one, a `says` on the add-on.
- hokkien-090, -091 and claypot-076, -098 (Muslim at a `none` branch) require no dish. The claypot
  halal `excludes` lists also name Vegetarian Lunch Set, which is `halal: true`. That is stricter than
  needed but no honest answer is affected, so I left it.
- hokkien-097 (吃斋) requires Vegetarian Fried Bee Hoon, which has egg (open question 4).
- Earlier assistant turns that list only some matching dishes without a follow-up that depends on the
  missing one (hokkien-075, -083, -084; ramly-067, -069; ikan-105) say nothing false and were kept.
- Every price and subtotal in an earlier assistant turn is right at its time, including the
  happy-hour turns (hokkien-017, -080), the roti john deal turns (ramly-009, -017, -032, -080), the
  weekend soup turns (claypot-029, -097) and the Monday turn (ikan-033).
- Safety coverage: counting the allergy, diet and dish-allergen cases and the pork and alcohol fact
  questions, each file is at least 25% safety-relevant (hokkien 33%, ramly 27%, claypot 28%, ikan
  26%).

## Mechanical checks (all 492)

I checked these with my own throwaway scripts, kept in the session scratchpad:

- JSON parses. Ids are unique and follow `v11<author>-<menu>-NNN` in order. Every case has split
  `test` and its own menu, and every tag is in the schema.
- Every gold entry is a menu dish and every menu dish has one. Allergens are in the enum, no dish is
  vegan without being vegetarian, and spice is 0-3. No dish on the certified or `muslim_friendly`
  branch is `halal: false`.
- Every extra.json dish, category and option is valid (above).
- Every named dish exists. Every `includes` dish and every `includesAny` member meets all of its
  case's constraints at the case's time: avoid, diet, spice, price at the deal price, category,
  excludes, onlyFrom, and served now (not sold out, inside a timed window, past-midnight windows
  included). Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case requires a dish.
- No sold-out or not-served dish that would fit an open question is left out of `excludes`.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah", 过敏 or 乳糜泻 statement, earlier turns included, carries `avoid` and
  `safetyNote`, and no `safetyNote` appears without `avoid`.
- Every Muslim, halal or 清真 case excludes all `halal: false` dishes.
- Every `says` and `category` regex compiles in JavaScript (lookbehind included). The changed
  patterns pass honest and fail wrong sample answers.

## Open questions

1. Percent deal and options (v10-vw open question 1): if the till takes the roti john 20% off the
   whole line, ramly-018 would be 8.80 and ramly-080 13.12. Only those two depend on it.
2. Watercress Soup's apricot kernels (南北杏) are read as `tree_nuts`, the safe reading given their
   cross-reactivity with almond; they are not a regulated tree nut. claypot-074 (nut allergy) avoids
   them, and no case requires the soup for a tree-nut-allergic guest.
3. The roti john lines say only "margarine", not "vegetable margarine" as the burgers do. Some
   margarines contain whey. The gold reads the line (no `milk`), and no milk-allergy case requires a
   roti john.
4. 吃斋 (hokkien-097): many Malaysian Buddhist vegetarians avoid egg, and the only vegetarian noodle
   (Vegetarian Fried Bee Hoon) has egg. The case requires it, as the honest answer with an egg note.
   If the project reads 吃斋 as egg-free, drop the `includes`.
5. ikan's dip group is min 1, max 2, while the menu says "choose up to two". No total depends on it
   (the dips are free), and ikan-038 and -046 agree with either reading.
6. Halal from ingredients at a `none` branch (v6-v10 open question): Seafood Hokkien Mee, Fried Fish
   Ball, Kam Heong Lala and the claypot chicken dishes are `halal: true` in kitchens that use pork and
   lard. Only the plain single-dish questions (hokkien-075, -092) require such a dish, and no Muslim
   case does.

## Counts

- Cases reviewed: 492. x: hokkien-mee-stall 120, ramly-burger-stall 124. y: claypot-chicken-rice 123,
  ikan-bakar-seafood 125.
- Labels changed: 61 cases (hokkien-mee-stall 13, ramly-burger-stall 5, claypot-chicken-rice 20,
  ikan-bakar-seafood 23). 27 of them only add a "how much?" to the question (ruling 3), and three
  only correct an earlier turn (hokkien-070, -071 and ramly-030). Cases deleted: 0.
- Gold fixes: 0 entries (130 dishes checked). Branch settings: 4 files checked, no changes.
- Final cases per file: 120, 124, 123, 125.

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- bench/heldout/REVIEW.md, the v3-v7 REVIEW.md files, bench/v8/REVIEW-mn.md and REVIEW-op.md, and
  bench/v10/REVIEW-tu.md and REVIEW-vw.md.
- The review brief and the briefs of authors x and y.
- Authors x's and y's files in bench/v11/: four menus (.txt, .gold.json, .extra.json) and four case
  files.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, bench/v9/, any earlier set's case files, or the other
v11 authors' files. I did not run the engine or any bench script. My checking scripts are in the
session scratchpad, outside the repository. No git commits.
