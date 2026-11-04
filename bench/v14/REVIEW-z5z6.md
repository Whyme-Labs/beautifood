# v14 held-out set: label review (authors z5 and z6)

Blind review of 494 v14 cases:

- `z5-lanzhou-noodle.json` (124) and `z5-nepali-momo-house.json` (128), by author z5.
- `z6-kristang-eurasian.json` (119) and `z6-sri-lankan-kottu.json` (123), by author z6.

The review also covers the gold and branch-settings files of the four menus (`.txt`, `.gold.json`,
`.extra.json`). Other v14 authors are reviewed separately.

## Conventions applied (both authors)

All of these apply unchanged: conventions a-f from v2, the ingredient rules and rules g-j from v3, the
v4 additions, rule k from v5, rules l-q from v6, the v7 rulings, the v8 rulings (both reviews), the
v10 rulings (both reviews), the v11, v12 and v13 rulings, and conventions r-w from the author briefs.

- (a) A stated allergy or diet plus a question about one dish gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. A safe dish goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`.
- (c) An allergen question with nothing stated = `includes` + a broad `says`. A wrong answer that
  uses the question's own words, the dish's own name or a negation of the fact must not satisfy it
  (v8 rule 7, v10 ruling 2, v11 ruling 5).
- (d) Service, thanks, off-topic and injection = `noDishes`.
- (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat/take X" about an
  allergen.
- (f) `lang: zh` only when the question has Chinese and no Latin text.
- Ingredient rules used here:
  - Soy sauce, light and dark soy, doubanjiang (broad bean chilli paste) = soy + gluten. Taucheo,
    tofu, roasted soybeans and soy milk = soy.
  - Chinkiang-style black vinegar = gluten (v7). Wheat starch and gluten cubes (mianjin) = gluten.
    Beer = gluten. Millet, rice flour, beaten rice (chiura), lentil papad and cornflour are not.
  - Worcestershire = fish + gluten (i). Belacan and prawn blachan = crustaceans. Maldive fish =
    fish.
  - Ghee, yoghurt, paneer, butter, cheddar, condensed milk and buffalo curd = milk. Coconut milk and
    grated coconut are not milk or tree nuts.
  - Mustard oil and mustard seeds = `mustard` (m). Fenugreek, fennel, cumin and timur are not
    listed allergens. Chinese celery = celery.
  - Walnut, cashew and almond = tree nuts. Candlenut = tree nuts (v12 safe reading).
  - Grape wine (port) = sulphites, not halal (h). Rum = not halal, no allergen. Raksi (millet
    spirit) = not halal, no allergen.
  - Sulphite-preserved dried apricots = sulphites (stated on the line).
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" and 坚果 = tree nuts
  + peanuts. Malay "kacang" alone = peanuts + tree nuts. An allergy to one shellfish or one tree nut
  avoids the whole class.
- Spice: 0, mild = 1, spicy = 2, very spicy = 3. A chilli condiment on the side or a "spoon of chilli
  oil" with no heat word = 1.
- (j/w) A Muslim guest or a halal question is shown no `halal: false` dish.
  - `none` branches (nepali-momo-house, kristang-eurasian): a dish with halal ingredients is
    `halal: true`. A Muslim guest is required no dish and gets the not-halal verdict (v10-tu ruling
    4). A plain "is X halal?" requires the passing dish (v11 ruling 1); a failing dish is not
    required and every `halal: false` dish is excluded (v8 ruling 6).
  - `muslim_friendly` branch (lanzhou-noodle): no pork, lard or alcohol anywhere, add-ons included.
    "Is this place halal?" gives the not-certified / Muslim-friendly verdict (v12 ruling 4).
  - Lapsed certificate (sri-lankan-kottu, JAKIM, `validUntil` 2026-09-30): no certificate after that
    date; the kitchen has no pork, lard or alcohol, so every dish stays halal and the answer states
    the lapse (v12 ruling 3). Before the date (sri-063, 15 Sep 2026) it names JAKIM.
- (r/s) Sold-out and not-served dishes are never required and are excluded wherever they would fit.
- (t) Deal prices at the case's time; a percent deal comes off the dish price and options are added
  at full price (v10-vw ruling 2). With two deals on one dish the lower price wins.
- (u) Totals, till totals and splits. (v) Add-ons and sizes. A dish's gold counts its default
  components (v8 ruling 2); an unsafe default with a safe option shows no card (v12 ruling 1).

### Rulings on this set's judgement calls

**1. A timed-menu name the guest has just used is not a fact (rule s with rule 7).** Rule s lets a
"not served now" label accept the menu's name. Where the guest's own question already names it
("what time supper start", "momo lunch set pls", "still can get lunch set now?", "what's on hopper
night?", 圣诞特餐), the bare name matched any answer, including a wrong "sure, one lunch set". Those
alternatives were removed, and the label now needs the start time, the days, or the not-available
verdict. Where the question does not name the menu (sri-003, -051, -055, -056; kristang-053, -057),
the name stays as a valid answer.

**2. An add-on that is not on the menu, when a dish already has that ingredient.** nepali-037 ("momo
with cheese can?"): there is no cheese option, but the Veg Momo is filled with paneer. An answer that
points to it is honest, so the `says` also accepts paneer. The other "not on the menu" add-on cases
(lanzhou-041, kristang-038, sri-042) have no such dish.

**3. Earlier turns that leave out a matching dish the follow-up depends on (v11 ruling 4).** sri-088's
earlier turn ("something under RM20, filling?") listed four dishes and the follow-up asks "the ones
with chicken?". Chicken Curry (RM15.90) and Cheese Kottu (RM18.90, with chicken curry) are both
chicken dishes under RM20, so an honest follow-up naming them used to fail `onlyFrom`. The turn now
lists them. Other partial lists (kristang-074, -086; lanzhou-044) have no follow-up that depends on
the missing dish.

**4. "One with lime soda" in a set order (as nepali-021 and -040).** nepali-072 ("2 sets, one with
lime soda") accepted only the free drink swap. The same words in the author's own nepali-021 and -040
accept a separate drink too, so -072 now accepts both (31.80 / 38.70).

**5. Noodle Tuesday's scope (z5's call, kept).** The rule covers NOODLE SOUPS, DRY NOODLES and
Liangpi. Big Plate Chicken (a chicken stew over noodles) and the two combos are not covered.
lanzhou-032 (Tuesday combos at the grand-opening 10%) and -076 (Liangpi counts) agree with it.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 29
lanzhou-noodle, 32 nepali-momo-house, 30 kristang-eurasian and 31 sri-lankan-kottu, 122 in all. I
found no errors. Spot checks that passed:

- lanzhou-noodle (`muslim_friendly`):
  - Every noodle, bread and dumpling is wheat. Youpo Mian, Smacked Cucumber and Sesame Paste Noodles
    carry gluten from black vinegar as well.
  - Braised Beef Noodle Soup, Knife-cut Noodles, Cold Beef Shank and Cumin Lamb: soy sauce = soy +
    gluten. Lanzhou Beef Noodle Soup and Cumin Lamb Roujiamo name no soy.
  - Big Plate Chicken: dark soy and doubanjiang; no beer or wine named, so halal.
  - Liangpi: wheat starch and gluten cubes, sesame paste. Sesame Paste Noodles: peanut butter.
  - Beef & Celery Dumplings: Chinese celery. Sour Soup Lamb Dumplings: seaweed is not fish.
  - Eight Treasure Tea: walnut pieces and sesame seeds. Apricot Juice: sulphites as stated.
  - The Youpo Combo carries its default Apricot Juice's sulphites; the Noodle & Mo Combo its soy milk.
  - The braised egg named on the beef noodle line is the add-on that is out.
  - No pork, lard or alcohol in any dish or option.
- nepali-momo-house (`none`, no service or tax, 5-sen rounding):
  - Every momo is wheat; Veg Momo has paneer. Jhol Momo: roasted sesame and soybeans. C-Momo: soy
    sauce, very spicy. The tomato achar on the side makes the plain momo spice 1.
  - Momo Platter: the union of its four fillings and the sesame achar, so not halal (pork).
  - Dal bhat sets: ghee dal and mustard oil/seed achar; urad papad is not gluten.
  - Sekuwa, Choila and Aloo Sadeko: mustard oil. Chicken Sekuwa: yoghurt. Sel Roti: rice flour, milk
    and ghee.
  - Lunch sets carry their default masala chiya (milk). Kheer: cashews.
  - Buff-style Beef Momo is beef (not buffalo, no pork): halal by its ingredients.
  - Beers: gluten, not halal. Raksi: millet, not halal, no gluten.
- kristang-eurasian (`none`, no charges block, so 10% service, 6% tax, 5-sen rounding):
  - Curry Debal and Debal Bread Bowl: wheat-and-soy sausages, candlenut, mustard seeds; halal by
    ingredients (chicken, no pork or alcohol).
  - Pork Vindalho: mustard seeds. Seybak and Seybak Bun: dark soy; the milk bun adds milk.
  - Ikan Ambiler and Sambal Lada: belacan. Beef Smoore: Worcestershire.
  - Achar: peanuts and sesame, no belacan named, vegan.
  - Debal Lunch Set: the union of the debal and the egg tart.
  - Sugee Cake: semolina, almonds. Cocada: egg yolk. Christmas Fruit Cake: rum, not halal.
  - Kopi and Teh Tarik: condensed milk (no butter roast stated). Port Wine: sulphites, not halal.
- sri-lankan-kottu (lapsed JAKIM, 5% service, 6% tax, 5-sen rounding):
  - Every kottu is egg-free wheat roti; all but the Vegetable Kottu add egg. Cheese Kottu adds milk.
  - Kottu Meal: the union of Chicken Kottu, two Parippu Vadai and its default milk tea.
  - Egg Hoppers, Kiribath, String Hoppers Set and Hopper Feast: Maldive fish in the sambols on the
    side, so not vegetarian. Plain Hoppers: no toddy, vegan.
  - Lamprais: ghee, breadcrumbs, egg, mustard seeds, Maldive fish and prawn blachan.
  - Devilled Chicken: soy sauce, cornflour (no gluten). Dhal Curry: mustard seeds, not spicy.
  - Wattalapam: egg and cashews, no dairy. Faluda: agar, egg-free ice cream, milk.
  - Ginger Beer is stated non-alcoholic. No pork, lard or alcohol in any dish or option.

### Branch settings: no changes

Every sold-out dish, timed-menu dish, deal dish or category and modifier dish exists on its menu.
Every option is exactly `{name, price}` with an integer price in sen, and every group has
min ≤ max ≤ its number of options. They match what the menus and cases assume:

- lanzhou-noodle:
  - Lamb Noodle Soup is sold out. Braised egg is the add-on that is out and is in no group.
  - Supper runs Fri and Sat 21:00-01:00, past midnight, with three dishes. Sat 00:30 and Sun 00:40
    fall inside the previous evening's window.
  - Grand opening takes 10% off the whole menu Mon-Fri all day, 2026-11-02 to 2026-11-20, so the
    default Wednesday 4 Nov is inside it (Lanzhou Beef Noodle Soup 13.32). Saturday 00:30 is not
    covered.
  - Noodle Tuesday takes 15% off the noodle categories and Liangpi on Tuesdays (12.58 on 24 Nov). On
    10 and 17 Nov the lower 15% wins on noodles, and other dishes take the 10%.
  - Noodle thickness is required on the three noodle soups and the Noodle & Mo Combo.
  - 5% service, 6% tax, 10-sen rounding. Halal `muslim_friendly`.
- nepali-momo-house:
  - Juju Dhau is sold out. Gundruk soup is the add-on that is out.
  - The Lunch set menu runs Mon-Fri 11:30-14:30 with four sets.
  - Momo Monday takes RM3.00 off every MOMO dish, the platter included; the Momo Lunch Set is not
    covered.
  - No service, no tax, 5-sen rounding. Halal `none`.
- kristang-eurasian:
  - Ikan Chuan Chuan is sold out. Vanilla ice cream (Sago Gula Melaka line) is the add-on that is
    out.
  - Christmas specials run daily 11:00-22:00 from 2026-12-01 to 2026-12-31 (off in November).
    Sunday brunch runs Sun 09:00-13:00.
  - Happy hour takes 20% off DRINKS Mon-Fri 17:00-19:00.
  - Achar is both a dish (RM6.00) and an add-on (RM3.00). The cases that leave the reading open
    accept both totals.
  - No `charges` block, so the README defaults apply. Halal `none`.
- sri-lankan-kottu:
  - Isso Vadai is sold out. Mutton curry ("when available") is the add-on that is out.
  - Hopper night runs daily 18:00-22:30 with the three hopper dishes.
  - Kottu lunch takes RM1.00 off every KOTTU dish Mon-Fri 12:00-14:30 (on at the default Wednesday
    13:00); the Kottu Meal is not covered.
  - Hopper Feast takes exactly three curries and the String Hoppers Set exactly two, fish ambul
    thiyal and beef curry +RM3.00.
  - JAKIM certificate `validUntil` 2026-09-30 (lapsed at every case date except sri-063).

### Case labels (38 cases: z5 25, z6 13; none deleted)

lanzhou-noodle (12):

- v14z5-lanzhou-noodle-035 ("must choose noodle thickness ah?"): `includes: [Lanzhou Beef Noodle
  Soup]` → `includesAny` of the four dishes with a required thickness group. The `says` now guards
  "must", "need to", "required", perlu, wajib, 一定要 and 要选 against "not / no / don't / tak / 不 /
  不一定 / 不需". "No, you don't need to choose" and 不一定要选 used to pass.
- v14z5-lanzhou-noodle-040 (fried egg on the liangpi?): the bare `gluten cubes` matched a wrong "yes,
  add fried egg or gluten cubes". It now needs "only … gluten cubes" or "just (extra) gluten cubes".
- v14z5-lanzhou-noodle-048 (chuan not spicy?): `option` is now also not after "no" ("there is no
  option" used to pass).
- v14z5-lanzhou-noodle-050 (走葱走香菜得唔得？要加钱吗？): removed `可以|得`. `得` is the question's own
  word and also matched 唔得. The free-garnish forms stay.
- v14z5-lanzhou-noodle-051 (walnut topping a tree nut?): `tree nut` is now not after "not (a)".
- v14z5-lanzhou-noodle-066 (what's in the dumpling soup? I don't eat fish): two `says` (vinegar AND
  seaweed) → one alternation of the soup's ingredients or the no-fish fact. The guest's point is
  fish; an honest "no fish, it's a sour vinegar and chilli-oil soup" used to fail for not naming the
  seaweed.
- v14z5-lanzhou-noodle-069 (两个那个水饺，打包): the question now ends 多少钱？ (v12 ruling 6). The amount
  is unchanged.
- v14z5-lanzhou-noodle-076 (Noodle Tuesday, liangpi count?): `included`, `termasuk` and `包括` are
  negation-guarded ("not included", "tak termasuk" and 不包括 used to pass).
- v14z5-lanzhou-noodle-085 (sesame paste noodles peanut?): 花生酱 and 含花生 are guarded (没有花生酱 and
  不含花生 used to pass).
- v14z5-lanzhou-noodle-086 (eight treasure tea nuts?): removed the duplicate unguarded `walnut` and
  `核桃`, and `ada kacang` is now not after ti- / tak / tidak. "No, no walnut", 没有核桃 and "tiada
  kacang" used to pass.
- v14z5-lanzhou-noodle-092 (apricot juice sulphite?): `ada sulfit` is now not after ti- ("tiada
  sulfit" used to pass).
- v14z5-lanzhou-noodle-122 (what time supper start ah): removed `supper|宵夜|夜宵` (ruling 1). The 9pm
  forms stay.

nepali-momo-house (13):

- v14z5-nepali-momo-house-037 (momo with cheese?): `says` also accepts paneer (ruling 2).
- v14z5-nepali-momo-house-050 (veg chowmein egg?): `ada telur` guarded against tiada / tak / tidak.
- v14z5-nepali-momo-house-065 (sel roti gluten?): `gluten.?free` is not after "not / n't".
- v14z5-nepali-momo-house-066 (那个糖圈要两份) and -077 (那个汤的要两份，一份素的): the question now ends
  多少钱？ (v12 ruling 6). The amounts are unchanged.
- v14z5-nepali-momo-house-072 (cheapest lunch set ×2, one with lime soda): `says` 31.80 → 31.80 |
  38.70 (ruling 4).
- v14z5-nepali-momo-house-074 (is the buff one buffalo?): the bare `beef` and `牛肉` matched the dish's
  own name (Buff-style Beef Momo / 牛肉馍馍), so a wrong "yes, the Buff-style Beef Momo is buffalo"
  passed. It now needs "is / it's / minced / made with beef", "not buffalo", "bukan kerbau", 是牛肉 or
  不是水牛.
- v14z5-nepali-momo-house-081 (Sat: momo lunch set pls) and -082 (Thu 14:45: still can get lunch set
  now?): removed `lunch|tengah hari|午餐` (ruling 1). -081 gained the weekday and not-available
  forms; -082's bare `over` became `\bover\b` ("however" matched), and it gained "finished",
  "closed" and "not available".
- v14z5-nepali-momo-house-085 (when is momo monday?): `monday|isnin|…` echoed the question. It now
  needs "every Monday", "Mondays", "all day", "setiap Isnin", "sepanjang hari", 全天 or 每周一.
- v14z5-nepali-momo-house-113 (got service charge?): the bare `\bno\b` and `n't` matched any answer
  ("Yes, 10% service. No tax."). It now needs "no service charge", "don't charge service", "no extra
  charges", 0%, "tiada caj", 没有服务费 or an answer that begins with "No".
- v14z5-nepali-momo-house-120 (teh masala ada susu?): `susu` is also not after "tidak ada", "tak",
  "tak guna" or "bukan".
- v14z5-nepali-momo-house-127 (momo wrapper egg?): `egg.?free` is not after "not / n't".

kristang-eurasian (7):

- v14z6-kristang-eurasian-041 (ice cream on the sago?): the out-add-on `says` gained "n't
  available", "not offered", "out of stock", "ran out", tiada and "tak ada". "Sorry, the ice cream
  isn't available" used to fail.
- v14z6-kristang-eurasian-044 (shellfish allergy, sambal belacan on the pong teh?): the Pong Teh is
  shown, so the `says` is the only check on the add-on. The bare `shrimp|prawn|crustacean|udang|虾`
  matched "it has no shrimp, go ahead". It now needs "shrimp paste", "fermented shrimp" or a
  non-negated shrimp / prawn / udang / 有虾 / 含虾.
- v14z6-kristang-eurasian-052 (圣诞特餐有什么？): the second `says` dropped `christmas|krismas|圣诞`, the
  question's own word (ruling 1). It needs December.
- v14z6-kristang-eurasian-054 (ikan chuan chuan ada?): the sold-out `says` gained "n't available",
  "out of stock", "ran out", tiada and "tak ada".
- v14z6-kristang-eurasian-080 (sambal udang gluten?): `gluten.?free` is not after "not / n't / isn't".
- v14z6-kristang-eurasian-111 (波特酒有酒精吗？): `是酒` is not after 不.
- v14z6-kristang-eurasian-119 (anything with beef?): removed `smoore`, the dish name. A wrong "yes,
  Beef Smoore RM27.90" passed. The December forms stay.

sri-lankan-kottu (6):

- v14z6-sri-lankan-kottu-040 (string hoppers with mutton curry?) and -052 (isso vadai ada?): the
  same widening as kristang-041 and -054.
- v14z6-sri-lankan-kottu-053 (what's on hopper night?): the second `says` dropped `hopper night`, the
  question's own words (ruling 1). It needs the 6pm start.
- v14z6-sri-lankan-kottu-083 (string hoppers gluten?): `gluten.?free` is not after "not / n't /
  isn't".
- v14z6-sri-lankan-kottu-088: the earlier turn now also lists Cheese Kottu (RM18.90) and Chicken
  Curry (RM15.90), and `onlyFrom` / `includesAny` gained them (ruling 3).
- v14z6-sri-lankan-kottu-107 (shrimp allergy, lamprais?): `含虾` is not after 不. `avoid` and
  `safetyNote` are unchanged.

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed by my own till script, from my own order spec for each case,
  written from the question and earlier turns rather than the author's note. That covers 197 amount
  patterns in 183 cases.
  - The script works in integer sen: the deal at the case's time (percent rounded half-up to the sen,
    on the dish price; the lower of two deals), then options and sizes, service on the food, tax on
    food + service (each rounded half-up), cash rounding (10 sen at lanzhou, 5 sen elsewhere), and
    equal splits with the extra sen first.
  - Every computed figure is accepted, and every amount in a `says` is one of the computed figures,
    after nepali-072. Every amount pattern was tested in Node for a match and for the left
    boundary. Examples:
    - lanzhou-002 (grand opening): 13.32 + 3.00 + 5.00 + 6.21 = 27.53 → 30.64 / 30.60.
    - lanzhou-009: 86.70 → 96.50, quarters 24.13 / 24.12.
    - lanzhou-017 (Fri 22:30, supper and grand opening): 50.13 → 55.80.
    - lanzhou-018 (Sat 00:30, Friday's supper, no deal): 79.00 → 87.93 / 87.90.
    - lanzhou-032 (Tue 10 Nov, combos not in Noodle Tuesday): 2 × 21.51 → 47.88 / 47.90.
    - lanzhou-077 (Tue 24 Nov): 12.58 → 14.00.
    - nepali-027 (Monday): 13.90 + 1.00 + 9.90 + 2 × 5.90 = 36.60. nepali-028: 66.20 / 4 = 16.55.
    - kristang-004: 86.30 → 100.63 / 100.65. kristang-020 (happy hour): 32.94 → 38.40.
    - kristang-023 (20 Dec): 100.30 → 116.95. kristang-026: 130.13 / 130.15, quarters.
    - sri-007: 52.70 → 58.66 / 58.65. sri-026 (dhal as add-on or dish): halves 24.04 / 24.05 or
      26.77 / 26.78. sri-027: 119.76 / 119.75, quarters 29.94 / 29.93.
- "All in" budgets use the largest food subtotal whose cash-rounded till fits: lanzhou-016 (RM40 →
  3597), kristang-019 (RM120 → 10294) and sri-021 (RM100 → 8987). Food-only budgets (lanzhou-015,
  -110; nepali-020, -124; kristang-031, -109; sri-111) are read as food. Every `maxTotal` can be met
  by an order of the stated shape.
- Every price and subtotal in an earlier assistant turn is right at its time, including the
  grand-opening prices at the default Wednesday (lanzhou-055, -085, -114, -123), the Momo Monday
  turn (nepali-027), the happy-hour turns (kristang-020, -059), the kottu-lunch turn (sri-004) and the
  till totals quoted in kristang-015 and sri-017.
- Two readings accepted where the words allow both: the combo's drink swap or a separate drink
  (lanzhou-024, nepali-021, -040, -072), achar as add-on or dish (kristang-039, -103), pol sambol and
  dhal curry as add-on or dish (sri-043, -046, -026), "one more of that" (kristang-088, sri-090) and
  any filling for 尼泊尔饺子 (nepali-030). Kristang-010's earlier turn already priced the achar as the
  add-on, and kristang-050's 一碟阿杂 orders the dish.
- The out add-ons are braised egg (lanzhou-045), gundruk soup (nepali-039), ice cream
  (kristang-041) and mutton curry (sri-040). Each `says` reports them unavailable, and no bill
  includes them.
- Allergen add-ons on a safe base show the base and rely on `avoid` + `safetyNote`: lanzhou-043
  (walnut topping), nepali-042 (sesame achar), kristang-043 (fried egg), -044 (belacan), sri-047
  (pol sambol on a vegan kottu), -048 (extra egg).
- Rule-q "none" cases: kristang-055 (non-spicy fish, the only one sold out), kristang-079 (soy-free
  mains are all spicy) and sri-084 (sesame: nothing to avoid).
- Halal:
  - Every Muslim, halal-place or single-dish halal case at the two `none` branches excludes every
    `halal: false` dish (6 at nepali, 8 at kristang). The Muslim-guest cases require no dish
    (nepali-078, -091, -106; kristang-067). The plain single-dish questions require the passing dish
    (nepali-092, kristang-094) or check the failing one by `says` (nepali-057, kristang-071).
  - "Is this place halal?" at lanzhou gives the Muslim-friendly / not-certified verdict (-078, -079,
    -119). lanzhou-080 and -081 follow a stated verdict and may name dishes.
  - At sri, every halal-place and Muslim case checks the lapse (-060 to -062, -064, -067); -065
    recommends after the lapse was stated, and -066 (plain single dish) accepts the ingredient fact
    or the lapse.
  - Pork questions without a halal statement keep narrow excludes (nepali-075, -093; kristang-073,
    -104), as v13 ruling 1.
- Buddhist vegetarian: nepali-101 and kristang-082 exclude alcohol and the allium dishes the guest
  named. See open question 1 for sri-081.
- Shared tables and a parent's order are treated as free of the stated allergen (lanzhou-094,
  kristang-075, sri-097), as v5 poke-067.
- Chinese, Malay and Manglish questions read naturally. Cantonese 几多钱, 唔该, 埋单, 走葱, 得唔得, 冻, 打包;
  Hokkien 头家; Lanzhou 牛大, 毛细, 韭叶, 大宽; Malaysian 桔仔水, 葡挞, teh susu, mee tarik, roti daun
  bawang, sate kambing, kurang manis. Each local name not on the menu names one dish, or the case
  accepts each reading (尼泊尔饺子).
- Safety coverage, counting allergy, diet and dish-allergen cases and pork, alcohol and halal
  questions: lanzhou 27%, nepali 38%, kristang 33%, sri 33%.

## Mechanical checks (all 494)

I ran these with my own throwaway scripts, kept in the session scratchpad:

- JSON parses. Ids are unique and follow `v14z<n>-<menu>-NNN` in order. Every case has split `test`
  and its own menu, and every tag is in the schema. Every `followup` / `memory` case has an earlier
  turn, and `chinese` is tagged exactly on the `zh` cases.
- Every gold entry is a menu dish and every menu dish has one. Allergens are in the enum, no dish is
  vegan without being vegetarian, and spice is 0-3. No dish on the `muslim_friendly` or certified
  branch is `halal: false`.
- Every extra.json dish, category and option is valid (above).
- Every case `date` matches its `day`. Dateless `at` values are read in the week of Wednesday 4 Nov
  2026.
- Every named dish exists. Every `includes` dish and every `includesAny` member meets all of its
  case's constraints at the case's time: avoid, diet, spice, price at the deal price, category,
  excludes, onlyFrom, and served then (not sold out, inside a timed window, past-midnight windows
  and dated seasons included).
- Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case requires a dish.
- No sold-out or not-served dish that would fit an open question is left out of `excludes`. The
  remaining script flags were dishes outside the question's topic.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah", 过敏 or 不能吃麸质 statement, earlier turns included, carries `avoid`
  and `safetyNote`, and no `safetyNote` appears without `avoid`. Shellfish, seafood and nuts expand
  as above; the script flags were single-nut allergies (walnut, peanut) and a fish allergy asking
  about seafood, all labelled correctly.
- Every Muslim, halal or 清真 case excludes all `halal: false` dishes.
- Every `says` and `category` regex compiles in JavaScript (Node, lookbehind included). Every changed
  pattern was tested in Node on honest and wrong sample answers in English, Malay and Chinese, with
  no wrong results.
- Every bill label has a bill question (v12 ruling 6).

## Open questions

1. sri-081 (我吃斋，不吃蛋): `includesAny` accepts Vegetable Kottu (leeks) and Parippu Vadai (onion).
   Many Malaysian 吃斋 guests avoid the five pungent vegetables even when they do not say so (v7, v10
   fish-082). The guest named only egg, so I kept the author's label. If the project reads 吃斋 as
   allium-free, those two should move to `excludes`.
2. Candlenut = `tree_nuts` (Curry Debal, Debal Bread Bowl, Debal Lunch Set), as v12 open question 1.
   kristang-062 checks it.
3. Port Wine keeps `vegetarian: true`. Ruby port is often fined with gelatine, egg white or casein,
   which the line does not state. No vegetarian case requires it.
4. Halal from ingredients at the `none` branches (the v6-v13 open question): Chicken and Buff-style
   Beef Momo and the chicken dal bhat at nepali, Curry Debal, Pong Teh and the fish curries at
   kristang are `halal: true` in kitchens that cook pork. Only the plain single-dish questions
   (nepali-092, kristang-094) require such a dish, and no Muslim case does.
5. lanzhou-108 (不辣的汤面): the Lanzhou Beef Noodle Soup has a free "No chilli" option, but its
   default (a spoon of chilli oil) is spice 1, so a card fails `maxSpice: 0` (v12 ruling 1).
6. Dried fruit (Eight Treasure Tea's raisins, Kheer's raisins, the Christmas Fruit Cake) is often
   sulphited, and Lanzhou chilli oil often has sesame. The gold reads only what the lines say.
7. kristang-024 (两碗白饭，一个魔鬼咖喱): the label counts two separate bowls of rice on top of the
   debal's own rice, the literal reading. A server might ask whether one is the debal's rice.

## Counts

- Cases reviewed: 494. z5: lanzhou-noodle 124, nepali-momo-house 128. z6: kristang-eurasian 119,
  sri-lankan-kottu 123.
- Labels changed: 38 cases (lanzhou-noodle 12, nepali-momo-house 13, kristang-eurasian 7,
  sri-lankan-kottu 6). Of these, 3 only add a bill question (lanzhou-069, nepali-066, -077), and 1
  also corrects an earlier turn (sri-088). Cases deleted: 0.
- Gold fixes: 0 entries (122 dishes checked). Branch settings: 4 files checked, no changes.
- Final cases per file: 124, 128, 119, 123.

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- bench/heldout/REVIEW.md, the v3-v7 REVIEW.md files, bench/v8/REVIEW-mn.md and REVIEW-op.md,
  bench/v10/REVIEW-tu.md and REVIEW-vw.md, bench/v11/REVIEW-xy.md, bench/v12/REVIEW-z1z2.md and
  bench/v13/REVIEW-z3z4.md.
- The review brief and the briefs of authors z5 and z6.
- Authors z5's and z6's files in bench/v14/: four menus (.txt, .gold.json, .extra.json) and four case
  files.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, bench/v9/, any earlier set's case files, or the other
v14 authors' files. I did not run the engine or any bench script. My checking scripts are in the
session scratchpad, outside the repository. No git commits.
