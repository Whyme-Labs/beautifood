# v9-dev: label review (author S)

Blind review of author S's 242 v9-dev cases: `s-nasi-lemak-stall.json` (119) and
`s-pizza-by-slice.json` (123). It also covers the gold and branch settings of both menus
(`.txt`, `.gold.json`, `.extra.json`). Authors Q and R are reviewed separately.

## Conventions applied

Conventions a-f from v2, the ingredient rules and rules g-j from v3, the v4 additions, rule k from v5,
rules l-q from v6, the v7 rulings, the v8 rulings and conventions r-w from the author brief all apply
unchanged. In short:

- (a) A stated allergy or diet plus a question about one dish gets `avoid` (or `vegetarian`/`vegan`),
  plus `safetyNote` for an allergy. No alternative is required, and a safe dish goes in `includes`.
- (b) Not on the menu = `maxDishes: 3`. (c) A fact question with nothing stated = `includes` + a
  broad `says` that the question's own word cannot meet (v8 rule 7). (d) Service, thanks, off-topic
  and injection = `noDishes`. (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot
  eat X" about an allergen. (f) `lang: zh` only when the question has Chinese and no Latin text.
- Shellfish = crustaceans + molluscs, a seafood allergy adds fish, English "nuts" and 坚果 = tree nuts
  + peanuts, "kacang tanah" = peanuts, "kacang" alone = both. (j) Muslim or halal-place questions
  are shown no `halal: false` dish. (k) "I don't eat meat" = vegetarian. (l) A failing single-dish
  diet question is checked by `says`. (o) Kopi beans roasted with butter = milk. (q) An impossible
  request rewards an honest "none".
- (r)-(w): sold out and not-served-now are never required and are excluded where they would fit;
  prices are taken at the case's time; totals, splits, add-ons and sizes as in the brief.

The seven rulings made for all three v9 authors were applied:

1. Halal: both of S's branches must have every dish halal (nasi-lemak-stall is JAKIM-certified to
   2027-12-31; pizza-by-slice is `muslim_friendly`). They do. No pork, lard, alcohol or gelatine is on
   either menu.
2. A dish's gold is its default components. Add-on allergens (Prawns on the Caesar Salad, the lauk on
   a nasi lemak) are not counted. Cases about an allergen add-on use `avoid` + `safetyNote`, and a
   `says` where `avoid` cannot see the risk (pizza-086, nasi-085 below).
3. Totals: a plain "how much"/"total" accepts the food subtotal, the sen-exact till total or the
   cash-rounded till total; "all in" accepts the till totals only; a split accepts every share of
   either till total; "I only had X" accepts the exact or rounded share. Every amount regex has the
   `(^|[^0-9])` left boundary.
4. Sold-out add-on options: see "Branch settings" below.
5. A dish that is also an add-on is fine at the same price. Where a guest's words allow either
   reading, the total accepts both (nasi-002, -009, -029, -090 already do).
6. Kopi O = milk only where the menu says butter-roasted. The nasi-lemak-stall menu says so.
7. Sizes add their option price. Free options (sugar, ice level, temperature) never change a total.
   On nasi-lemak-stall, Ais is a priced option (+RM0.30, +RM0.20 on Air Kosong) set by the merchant,
   so iced drinks do cost more there; that is a priced option, not a free one.

### My rulings on this set

**R1. A deal-price question cannot accept a till figure that equals the no-deal list price.** On
pizza-by-slice, a Margherita Slice in the slice deal is RM5.90, which tills to RM6.88 and rounds to
RM6.90, the slice's list price. pizza-018 and -023 ask exactly whether the deal applies. With 6.90
accepted, a wrong "no deal, RM6.90" passed. Both now accept 5.90 and 6.88 only. This is a narrow
exception to ruling 3. No other case has the clash: I checked every deal case's accepted figures
against the list prices.

**R2. The ruling-4 "not available" pattern also takes "n't available" and "out of".** "Sorry, paru
isn't available today" is the most natural honest answer, and the ruling's `not available` does not
match "isn't available". The three relabelled add-on cases use the ruling's alternation plus these
two forms.

**R3. Allergen add-on requests check the verdict.** When the allergen sits only in an add-on
(pizza-086: Prawns on a Caesar Salad), `avoid` cannot fail any card, and a text-only "Sure, RM19.90"
passed with only a generic safety note. The case now `says` the not-safe verdict (avoid, skip, don't
recommend, without the prawns, tak boleh, 不建议, and so on). nasi-085 (shellfish allergy, "add
sambal sotong on the vegetarian nasi lemak") gets the same, since a text-only "added" passed too.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 30
nasi-lemak-stall and 34 pizza-by-slice, 64 in all. I found no errors. Spot checks that passed:

- nasi-lemak-stall:
  - Every nasi lemak set: belacan sambal (crustaceans), ikan bilis (fish), roasted peanuts and half an
    egg. Santan is not milk. Nasi Lemak Sotong and Special add molluscs.
  - Nasi Lemak Vegetarian: no belacan or ikan bilis; tempeh (soy), peanuts and egg, so vegetarian but
    not vegan.
  - Ayam Goreng: rice-flour coating, no allergen. Rendang Daging: kerisik is coconut, not a tree nut.
    Paru Goreng: no flour stated.
  - Telur Separuh Masak and Bihun Goreng: soy sauce / sweet soy = soy + gluten. Bihun is rice
    vermicelli. Lontong: dried shrimp and belacan (crustaceans), tempeh, egg; glass noodles read as
    mung bean.
  - Kuih Seri Muka: custard set with cornstarch, so egg and no gluten (unlike v6 open question 4).
    Karipap: wheat pastry with vegetable shortening, vegan as tagged.
  - Kopi and Kopi O: butter-roasted beans = milk (ruling 6). Milo: malted barley = gluten.
- pizza-by-slice:
  - Every pizza and slice has wheat dough. Every one but the Vegan Garden Pizza has mozzarella (milk).
    The Vegan Garden Pizza's cashew cheese = tree nuts.
  - Spicy Sambal Chicken Pizza: belacan in the base (crustaceans), very spicy (3). Seafood Pizza:
    prawns and squid.
  - Caesar Salad: croutons, parmesan, egg yolk, anchovy (fish, so not vegetarian) and mustard.
    Mushroom Soup: chicken stock, butter, cream, wheat flour and a bread roll.
  - Spaghetti Bolognese: celery in the ragu. Chicken Carbonara: egg yolk, cream, parmesan. Aglio Olio
    Prawns: no cheese or butter stated.
  - Chicken Wings: the BBQ glaze names tomato, honey and brown sugar only, so no allergen and spice 0.
    Potato Wedges: sour cream. Nutella Banana Pizza: hazelnuts, milk, soy lecithin.
  - Four Cheese Pizza keeps the merchant's vegetarian tag (rennet not stated, v4 open question 2).

### Branch settings (2 files changed, ruling 4)

Neither extra.json had a `"soldOut": true` on an option; S kept the sold-out items as ordinary options
in the add-on groups while also listing them in `soldOut`. Under ruling 4 the merchant removes an
option while it is out:

- nasi-lemak-stall: `Paru Goreng` and `Sambal Kerang` removed from the Tambah Lauk group of the five
  nasi lemak sets that had them (Biasa, Ayam Goreng, Rendang Daging, Sotong, Special). Tambah Lauk now
  has six options with max 4. Both dishes stay in `soldOut`.
- pizza-by-slice: `Jalapeños` removed from the Extra Toppings group of all nine whole pizzas. The
  Vegan Garden Pizza's group is left with three options, so its `max` went from 4 to 3. Jalapeños
  stays in `soldOut`.

Everything else matches the menu and the cases. The Pagi timed menu (Roti Bakar Kaya, Telur Separuh
Masak, Bihun Goreng, Lontong) runs 06:30-11:00 daily. The Slice deal is RM1.00 off SLICES 15:00-18:00
daily. Charges are none on the stall (rounding 5 sen) and 10% service + 6% tax on the pizza place.
Sizes are Besar +1.50 on every nasi lemak, Besar +1.00 on the drinks (+1.20 Milo), 12-inch +10.00 to
+14.00 by pizza, Large +1.50 on soft drinks and 10 wings +9.00. The stuffed crust is +6.00, and thin
crust, penne, sweetness and ice level are free. Every modifier dish exists, every group has
0 ≤ min ≤ max ≤ options, and every option is `{name, price}` only.

### Case labels (17 cases: nasi-lemak-stall 6, pizza-by-slice 11; two of them note-only)

nasi-lemak-stall:

- v9s-nasi-lemak-stall-018 ("Nasi lemak biasa tambah paru, how much?"): `says`
  `sold out|habis|finished|not available|unavailable|卖完|售罄|没有了` → the ruling-4 alternation
  plus `n't available|out of` (R2). The note now says no total may include its RM4.00.
- v9s-nasi-lemak-stall-019 (what can I add): note only. The sold-out lauk are no longer options.
- v9s-nasi-lemak-stall-049 (我是穆斯林，参巴苏东可以吃吗？): `says` kept JAKIM and the certificate
  forms, but the bare `可以吃`, `认证` and `halal` now exclude 不可以吃, 没有认证 and "not halal" by
  lookbehind (v8 rule 7). The dish stays required.
- v9s-nasi-lemak-stall-071 ("Does that [rendang] have nuts?"): `says` dropped the bare
  `coconut|kerisik`, which a wrong "yes, kerisik is nuts" matched. It now needs the no-nuts fact
  (no nuts, nut-free, not a nut, tiada kacang, 没有坚果, …).
- v9s-nasi-lemak-stall-085 (shellfish allergy carried, "vegetarian nasi lemak and add sambal sotong"):
  added a `says` on the not-safe verdict (R3). `avoid` and `safetyNote` are unchanged.
- v9s-nasi-lemak-stall-103 ("Is the third one spicy?"): `says` `spicy|pedas|辣` → a verdict form
  (yes, is/quite/a bit spicy, pedas without tak/tidak/kurang, 辣 without 不/没). The bare `spicy` was
  the question's own word, so "it's not spicy" passed. The stray `bill` tag was removed.

pizza-by-slice:

- v9s-pizza-by-slice-018 (Wed 15:00, "Slice deal on now? Margherita slice how much?") and -023 (Mon
  16:20, Malay): `says` `5\.90|6\.88|6\.90` → `5\.90|6\.88` (R1).
- v9s-pizza-by-slice-022 ("slice deal still got or not ah?"): `6[:.]00` and `1(\.00)? off` gained the
  left boundary, so 16.00 or 11 off no longer match.
- v9s-pizza-by-slice-033 (牛肉香肠是猪肉做的吗？): `includes: [Beef Pepperoni Pizza]` →
  `includesAny: [Beef Pepperoni Pizza, Beef Pepperoni Slice, Beef Pepperoni]`. 牛肉香肠 names the
  pepperoni, which is on the slice and is a topping line too.
- v9s-pizza-by-slice-035 (可以加墨西哥辣椒吗？) and -116 ("Add jalapeños to that."): relabelled under
  ruling 4. `says` is the ruling's alternation plus `n't available|out of` (R2). The notes say no
  total includes its RM2.00.
- v9s-pizza-by-slice-014 (what toppings): note updated. Jalapeños is no longer in the group.
- v9s-pizza-by-slice-040 (蘑菇汤是素的吗？): `says` `鸡|chicken|不是素|…` → chicken stock forms, 含鸡 and
  用鸡 (not after 没/不), 不是素, "not vegetarian". The bare 鸡 matched a wrong "是素的，没有鸡".
- v9s-pizza-by-slice-060 (Sayap ayam tu pedas tak?): `says` dropped the bare `BBQ`, which matched
  every answer. It now needs the not-spicy fact in English, Malay or Chinese.
- v9s-pizza-by-slice-086 (prawn allergy, Caesar Salad with prawns added): added a `says` on the
  not-safe verdict (R3).
- v9s-pizza-by-slice-103 ("Is that one very spicy?"): `says` `spicy|pedas|辣` → yes / very spicy (not
  after "not" or "n't") / spiciest / sangat pedas / 很辣 and similar. The old pattern was met by the
  question's own word.

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed by my own till script (deal at the case's time, options, 10%
  service on the food, 6% tax on food + service, each rounded to the sen, 5-sen cash rounding, equal
  splits with the extra sen first): 67 nasi-lemak-stall cases and 73 pizza-by-slice cases. Every
  accepted figure is one the till or the menu gives, and every figure the till gives is accepted,
  apart from R1. Examples:
  - nasi-042: 13.30 / 3 = 4.44 / 4.43 / 4.43. nasi-107: 29.50 / 3 = 9.84 / 9.83 / 9.83.
  - nasi-009: 56.00, or 54.50 with the three ayam packs rung up as the set (ruling 5).
  - pizza-009: 190.40 food, 222.01 exact, 222.00 till. pizza-029: 118.58 / 4 = 29.65 ×2, 29.64 ×2;
    118.60 / 4 = 29.65.
  - pizza-068: 74.97 / 2 = 37.49 / 37.48; 74.95 / 2 = 37.48 / 37.47. pizza-114: 133.74 and 133.75 / 4.
  - pizza-020 (Thu 17:55, deal still on): 28.10, 32.76, 32.75. pizza-019 (18:05, ended): 22.50.
- Every price and running total in an earlier assistant turn was checked against the menu at that
  time: dish prices, sizes, add-ons, the deal prices at 15:30-17:55, and the totals of nasi-050, -065,
  -094, -097, -105 to -109 and pizza-020, -037, -051, -061, -068, -109 to -115. All are right.
- References resolve to one reading: "the first/second/third/last one" against the listed order,
  "the cheaper egg" (Telur Rebus), "those two with seafood" (Sotong and Special, the only sets with a
  seafood lauk), "the cheaper one" (Hawaiian), "same again" and "one more of that".
- Sold out and not served: every case excludes Paru Goreng, Sambal Kerang and Jalapeños, and every
  13:00 nasi case excludes the four Pagi dishes. Asked directly, the cases `says` sold out (nasi-051,
  -112) or the Pagi start time (nasi-014, -016, -039).
- `pizza-036` (埋单！…) accepts only the till figures. 埋单 asks for the bill, which is what is paid.
- `nasi-035`, -054, -067, -089 (peanut or egg allergy, nasi lemak): rule q. "Tanpa Kacang" is a free
  option, but every set's default has peanuts, so no set may be shown.
- `nasi-119` (我不吃花生) and `nasi-068`, `pizza-082` (lactose intolerant) are preferences: `avoid`
  without `safetyNote`.
- `pizza-090` (vegetarian friend, "add chicken to her veggie supreme"): `vegetarian: true` only. The
  guest may know what they are asking for, so no verdict `says` is added.
- `pizza-087` (nut allergy carried, 12-inch Margherita + Nutella pizza, total?): safety checks only.
  The Nutella card fails `avoid`; an honest answer may give the Margherita's price alone.
- `pizza-022` and -027 still accept 6.90 as the deal price of the Beef Pepperoni Slice. That is a
  true deal price on those questions ("is the deal on?"), so R1 does not apply.
- Chinese cases read as Malaysian guests write them: 椰浆饭, 拉茶, 茶乌, 咖啡乌, 走甜, 走冰, 少甜, 头家,
  一粒, 埋单, 几多钱, 唔该, 芝心, 薄底, with 杯/包/份/个/块/片 counters.

## Mechanical checks (all 242)

My throwaway scripts are in the session scratchpad (`v9review-s/`), outside the repository:

- JSON parses, ids are unique, every menu dish has gold and every gold entry is a menu dish. Allergens
  are in the enum, no dish is vegan without being vegetarian, spice is 0-3, and every dish is halal on
  both branches.
- Every extra.json dish, category and modifier dish exists. Every group has
  0 ≤ min ≤ max ≤ options, and no option carries anything but name and price.
- Every case date matches its weekday.
- Every named dish exists. Every `includes` dish and `includesAny` member meets all of its case's
  constraints at the case's time: avoid, diet, spice, price, category, excludes, onlyFrom, not sold
  out and on a timed menu that is on.
- Every `minDishes` and `maxTotal` is satisfiable, and no `noDishes` case conflicts with a dish
  requirement. No unavailable dish that fits a case's constraints is left out of `excludes`.
- Every `says` amount matches the script's figures (above). Every `says` and `category` regex
  compiles in JavaScript, and every changed pattern was tested on honest and wrong sample answers
  in English, Malay and Chinese.
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah" or 过敏 statement, earlier turns included, carries `avoid` and
  `safetyNote`, and no `safetyNote` appears without `avoid`. The only flags were nasi-078 ("tree nut
  allergy", correctly tree nuts only) and pizza-122 (an injection that names shellfish, no allergy
  stated).

## Open questions

1. R1 narrows ruling 3 where the rounded till figure equals the list price. If the project prefers
   ruling 3 without exception, pizza-018 and -023 take 6.90 back, and the deal is then checked only
   by 5.90 / 6.88 being offered as alternatives.
2. Ruling 4 removes the sold-out options from the groups. When Paru Goreng, Sambal Kerang or Jalapeños
   come back, the merchant would re-add them. No case depends on their old prices.
3. Lontong's glass noodles are read as mung bean (no gluten). Some sohun is made with wheat or pea
   starch blends. No gluten case requires Lontong.
4. The pizza dough and the stall's white bread name no milk or egg. Commercial pizza dough and roti
   often have milk powder. The gold reads the lines, and every pizza but the vegan one has milk anyway.
5. Vegan Arrabbiata offers a Chicken add-on (+4.00). Under ruling 2 the dish stays vegan. A vegan
   guest who asks for it should be told, but no case does.

## Counts

- Cases reviewed: 242 (nasi-lemak-stall 119, pizza-by-slice 123).
- Labels changed: 17 cases, two of them note-only (nasi-lemak-stall 6 with -019 note-only,
  pizza-by-slice 11 with -014 note-only). Cases deleted: 0. Final cases per file: 119 and 123.
- Gold fixes: 0 entries, 64 dishes checked. Branch settings: 2 files changed (ruling 4), 19 options
  removed and one `max` lowered.
- Tag counts after review: nasi-lemak-stall bill 62, modifier 47, zh 31, Malay 13, Manglish 11,
  followup 30, multi-turn 46, `at` 9; pizza-by-slice bill 67, modifier 50, zh 31, Malay 12,
  Manglish 10, followup 27, multi-turn 46, `at` 11.

## Reading-rule confirmation

I read only bench/README.md, bench/schema.ts, the heldout and v3-v7 REVIEW.md files,
bench/v8/REVIEW-mn.md, bench/v8/REVIEW-op.md, the review brief, author S's brief, and author S's files
(the two case files and the .txt, .gold.json and .extra.json of nasi-lemak-stall and pizza-by-slice).
One grep for `"soldOut": true` ran over every v9 extra.json and printed only a match count per file;
I did not open or read the other authors' files. I did not open src/, scripts/, test/, pages/,
crates/, bench/results/, bench/ANALYSIS.md, bench/CHANGES.md, bench/cases/, bench/menus/ or any earlier
case file, and I did not run the engine or any bench script. No git commits.
