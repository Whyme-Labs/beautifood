# v10 held-out set: label review (authors t and u)

Blind review of 482 v10 cases: `t-curry-laksa-house.json` (116), `t-western-food-hawker.json` (118),
`u-japanese-curry-house.json` (124) and `u-char-kway-teow-stall.json` (124). It also covers the gold and
branch-settings files of the four menus: curry-laksa-house, western-food-hawker, japanese-curry-house and
char-kway-teow-stall (`.txt`, `.gold.json`, `.extra.json`). Authors v and w are reviewed separately.

## Conventions applied (both authors)

Conventions a-f from v2, the ingredient rules and rules g-j from v3, the v4 additions, rule k from v5,
rules l-q from v6, the v7 rulings and the v8 rulings (both v8 reviews) apply unchanged, together with the
v10 brief conventions r-w:

- (a) A stated allergy or diet plus a question about one dish that breaks it gets `avoid` (or
  `vegetarian`/`vegan`), plus `safetyNote` for an allergy. No alternative is required, and a safe dish goes
  in `includes`.
- (b) Not on the menu = `maxDishes: 3`. (c) An allergen question with nothing stated = `includes` + a
  broad `says` that the question's own word cannot satisfy (v8 rule 7). (d) Service, thanks, off-topic and
  injection = `noDishes`. (e) `safetyNote` only for a stated allergy, coeliac disease or "cannot eat X"
  about an allergen. (f) `lang: zh` only when the question has Chinese and no Latin text.
- Ingredient rules: soy sauce, dark soy, sweet soy and sweet bean sauce = soy + gluten. Oyster sauce =
  molluscs + gluten (g). Shaoxing = sulphites + gluten, not halal. Red wine = sulphites, not halal. Mirin
  and sake = not halal, no allergen (h). Beer, barley, pearl barley and malted barley = gluten.
  Worcestershire-style sauce with anchovy = fish + gluten (i). Belacan, hae ko, dried shrimp and shrimp
  paste = crustaceans. Squid, cuttlefish, cockles, clams, mussels and oysters = molluscs. Fish balls, fish
  cake, ikan bilis, bonito dashi and fish sauce = fish. Coconut milk is not milk. Butter-roasted kopi =
  milk (o). Mustard in burger sauce = `mustard` (m).
- Shellfish = crustaceans + molluscs. A seafood allergy adds fish. English "nuts" = tree nuts + peanuts.
  An allergy to one shellfish or one tree nut avoids the whole class.
- Spice: 0 / mild = 1 / spicy = 2 / very spicy = 3. A chilli condiment on the side with no heat word = 1.
- (j, w) A Muslim guest, or a guest asking whether the place is halal, is shown no `halal: false` dish. On
  the certified branch (western-food-hawker, JAKIM) "is this place halal?" `says` the certifier. On the
  `pork_free` (curry-laksa-house) and `none` (japanese-curry-house, char-kway-teow-stall) branches, a
  dish with halal ingredients is `halal: true` in the gold (v8 ruling 1).
- (r) Sold out: never required, in `excludes` wherever it would otherwise fit, "sold out" `says` when asked
  directly. (s) Not served at the case's time: treated the same, and asked directly the answer names the
  menu or its start time. (t) Deal prices at the case's time. (u) Plain totals accept the food subtotal,
  the exact till or the cash-rounded till. "All in" accepts only the till figures. Splits accept every
  share of either till total. (v) Add-on price = dish + option, and free options never change a total.
- A dish's gold counts only its default components. A case about an allergen add-on relies on `avoid` +
  `safetyNote` and, where it matters, `says`.

### Rulings on this set's judgement calls

**1. Not-served dishes in open questions (as v8 O/P ruling 6).** Author u lists the sold-out and
not-served dishes in every case. Author t lists them only where the question asks about them. Both are
right for bill and single-dish questions. I added the `excludes` only where a sold-out or not-served dish
would fit an open recommendation, diet or allergy question at the case's time:

- curry-laksa-house: the breakfast dishes outside 07:00-11:00, and Otak-Otak (sold out).
- western-food-hawker: the Lunch sets outside Mon-Fri 11:30-14:30, and Sirloin Steak (sold out).

**2. Convention c / v8 rule 7 also covers negated phrasing.** Several `says` were passed by a wrong answer
that used the fact word in a negation. Examples are "has no gluten" against `(has|got).{0,15}gluten`,
"tiada susu" against `ada.{0,20}susu`, "tiada lemak babi" against bare `lemak babi`, 没有猪油 against
bare 猪油, and "we charge 10%" against `0 ?%`. These now need the positive fact, with a negative
lookbehind where needed, as v8 did. I tested every changed pattern on honest and wrong sample answers in
English, Malay and Chinese, and none of them gave a wrong result.

**3. Two readings of one order are both accepted (as the brief's "a reference resolves to exactly one
reading").** "Add 1 large rice too" (japanese-011) means a large-rice upgrade (+RM2.00) or a separate
bowl of Japanese Rice (RM3.50). Both totals are now accepted. curry-laksa-026 (加辣 = extra spicy or
extra sambal) and char-kway-teow-034 ("sugarcane lime") already accepted both readings.

**4. Muslim guests at branches that are not halal (`pork_free` and `none`).** These cases cover a
Muslim guest who asks what they can eat, asks about a pork-free dish, or asks for a recommendation after
saying they are Muslim. They require no dish, `says` that the branch is not halal or not certified (the
alternation used on that menu's "is this place halal?" cases), and exclude every `halal: false` dish, as
in v8 cha-chaan-teng-042. This now holds on all three menus:

- curry-laksa-house: -068, -083 and -084 (changed below).
- japanese-curry-house: -069, -095 and -096 (already right).
- char-kway-teow-stall: -061, -080 and -084 (-080 changed below).

A plain "is X halal?" with no Muslim or halal-diet statement checks the fact only. Where the dish passes
it is required (char-kway-teow-083, as in v8 cha-chaan-teng-065), and where it fails it is not required
(curry-laksa-072).

**5. A chilli condiment named on the dish's own line still makes the dish spice 1.** The line's "not
spicy" covers the dish itself. A chilli named on the side of the same line is part of what is served, so
Wat Tan Hor ("not spicy, pickled green chilli on the side") stays spice 1. A line that says "not spicy"
and names no chilli is 0.

## Changes

### Gold files: no changes

I checked every dish against its menu line for allergens, vegetarian, vegan, halal and spice: 29
curry-laksa-house, 35 western-food-hawker, 30 japanese-curry-house and 29 char-kway-teow-stall, 123 in
all. I found no errors. Spot checks that passed:

- curry-laksa-house:
  - Curry Laksa: belacan and dried shrimp = crustaceans, tau pok = soy, and the default mixed noodles =
    gluten + egg.
  - Penang Asam Laksa: hae ko = crustaceans, mackerel = fish, and the rice laksa noodles have no gluten.
  - Vegetarian Curry Laksa (default bihun): soy only, vegan.
  - Penang White Curry Mee: chilli paste on the side = 1.
  - Lor Mee: Shaoxing (sulphites, not halal), plus fish cake and black vinegar with wheat.
  - Popiah: stated no dried shrimp, so vegetarian; sweet bean sauce = soy + gluten; peanuts.
  - Chee Cheong Fun with Curry: dried shrimp curry; stated no pork despite 猪肠粉.
  - Kaya Toast Set: its default hot kopi has milk.
  - Barley Lime and Milo Ais = gluten. Kopi O = vegan (no butter roast stated, so rule o does not
    apply). Tiger Beer is the only other `halal: false` dish.
- western-food-hawker (JAKIM-certified):
  - No pork, lard or alcohol anywhere. The ham and bacon are beef, the root beer is stated
    non-alcoholic, and every dish is `halal: true`.
  - Every black pepper sauce has butter and dark soy (milk, soy, gluten) and is "mildly peppery" (1).
  - Classic and Double Cheese Beef Burger: burger-sauce mustard = `mustard`.
  - Fish Burger: the bun is stated without sesame.
  - Bolognese and the Lunch Spaghetti Set: celery.
  - Seafood Tomyam Spaghetti: shrimp paste, mussels and evaporated milk.
  - Mushroom Soup has chicken stock, so it is not vegetarian. Cheesy Fries has beef bacon.
  - Brownie: walnuts.
  - Grilled Dory Fish is the only gluten-free main.
- japanese-curry-house:
  - Every house curry has a wheat-flour and butter roux in chicken stock.
  - Beef Curry: red wine = sulphites, not halal.
  - Hamburg, Gyusuji, Curry Udon and Chicken Karaage: mirin or sake = not halal. So is the Kids Curry
    Plate (sake-marinated karaage).
  - Chicken Katsu, Seafood and Ebi Fry Curry and Chicken Nanban: halal from their ingredients at a
    `none` branch.
  - Potato Croquette: anchovy tonkatsu sauce = fish, so it is not vegetarian.
  - Onsen Egg and Miso Soup: bonito dashi.
  - Vegetable Curry and Vegetable Curry Udon: stated no dairy and no bonito, so vegan.
  - Yuzu Soda: honey (vegetarian, not vegan). Calpis = milk.
- char-kway-teow-stall:
  - Every lard-fried dish is not vegetarian and not halal.
  - Vegetarian Char Kway Teow: vegetable oil and a shrimp-free paste, so vegetarian (egg).
  - Fried Bihun and Wat Tan Hor: oyster sauce = molluscs + gluten.
  - Fried Carrot Cake (White): fish sauce, no soy. Oyster Omelette: sweet-potato starch has no gluten.
  - Lor Bak: prawn fritter = crustaceans + gluten.
  - Fresh Popiah: dried shrimp.
  - Kopi O: butter-roasted (rule o).
  - Nutmeg Juice: nutmeg is a seed spice, not a regulated tree nut.

### Branch settings: 1 change

- western-food-hawker: the 17 "Soup and Drink Set" options (+RM6.50, on every grill, burger and pasta
  dish) are renamed "Set: mushroom soup + iced lemon tea". The price is unchanged. The new name says what
  western-004 and -016 assume, the same contents as the Lunch sets' default. No earlier turn named the old
  option.

Otherwise:


Every sold-out dish, timed-menu dish, deal dish or category and modifier dish exists on its menu. Every
option is only `{name, price}`, prices are in sen, and every group's min/max is valid. They match what the
menus and cases assume:

- curry-laksa-house:
  - Otak-Otak is sold out. Breakfast runs daily 07:00-11:00 with four dishes.
  - Laksa Wednesday takes RM2.00 off the LAKSA category all day Wednesday.
  - Cockles (the add-on that is out) are in no group.
  - The noodle sizes price the listed price as Small: Regular +RM2.00 (+RM1.50 on asam laksa, lor mee and
    fish ball soup) and Large +RM4.00 (+RM3.00). Every case and earlier turn quotes them that way.
  - 10% service, 6% tax, 5-sen rounding. Halal `pork_free`.
- western-food-hawker:
  - Sirloin Steak is sold out. The Lunch set runs Mon-Fri 11:30-14:30.
  - 15% off DRINKS daily 15:00-18:00.
  - Sauce: one free, and extra sauce is priced. Sides: pick two. Doneness is free.
  - 6% tax inside the prices, no service, 5-sen rounding. JAKIM certificate valid to 2027-06-30, which
    covers every case date.
- japanese-curry-house:
  - Menchi Katsu Curry is sold out. "Dinner only" runs 17:00-22:00 daily for three dishes.
  - Happy hour: 20% off JAPANESE BEER 17:00-19:00.
  - Spice level 1-10 is required, with levels 6-10 priced. Large rice is +RM2.00. Up to 5 toppings.
  - 10% service, 6% tax, 5-sen rounding. Halal `none`.
- char-kway-teow-stall:
  - Fried Carrot Cake (White) is sold out.
  - Supper runs 21:00-02:00 daily, past midnight, so Monday 00:30 and Saturday 01:30 fall inside it.
  - Sugarcane Monday takes RM0.50 off, 00:00-23:59 Monday.
  - Mantis prawn (the add-on that is out) is in no group.
  - 6% tax inside the prices, no service, 5-sen rounding. Halal `none`.

### Case labels (52 cases: t 26, u 26)

curry-laksa-house (12):

- v10t-curry-laksa-house-001 (Mon 12:00, first visit): `excludes` gained the four breakfast dishes
  (ruling 1).
- v10t-curry-laksa-house-057 (Fri 14:00, nasi lemak or else non-spicy): `excludes` gained Kaya Toast,
  Half-boiled Eggs and Kaya Toast Set. They are spice 0 but not served at 14:00 (ruling 1).
- v10t-curry-laksa-house-068 (Muslim, what's safe, Mon 12:30): `excludes` gained Otak-Otak and the four
  breakfast dishes (ruling 1). `includesAny` (four pork-free bowls) was removed, and `says` now needs the
  not-certified verdict (ruling 4).
- v10t-curry-laksa-house-083 (Muslim friend, white curry mee ok?) and -084 (Muslim from the earlier turn,
  noodles not too spicy): the required dish (`includes` / `includesAny`) was removed, and `says` now needs
  the not-certified verdict (ruling 4). The excludes of Lor Mee and Tiger Beer and -084's `maxSpice: 1`
  are unchanged. The notes were updated.
- v10t-curry-laksa-house-085 (seafood allergy, Sat 12:00): `excludes` gained the three seafood-free
  breakfast dishes and Otak-Otak (ruling 1). The note was updated.
- v10t-curry-laksa-house-104 (kids, not spicy, Sat 13:00) and -113 (vegetarian menu, Mon 13:00):
  `excludes` gained Kaya Toast, Half-boiled Eggs and Kaya Toast Set (ruling 1).
- v10t-curry-laksa-house-072 (is the lor mee halal?): `says` `shaoxing|wine|alcohol|arak|绍兴|酒` →
  Shaoxing / 绍兴 / 花雕, wine not after "no", "has/with … alcohol", and 有酒 / 含酒 / 料酒 (not 没有酒).
  The bare `alcohol` and `酒` passed a wrong "yes, no pork or alcohol" (ruling 2).
- v10t-curry-laksa-house-090 (the cheaper ones got milk?): `says` dropped `bandung`. That is the dish's
  own name, so any answer passed. It now needs evaporated milk, "has … milk" (not "neither has milk") or
  有奶 / 含奶 (ruling 2).
- v10t-curry-laksa-house-042 (extra sambal got shrimp?) and -086 (milo ais got gluten?): `says` no longer
  accepts "has no shrimp" / "has no gluten" (ruling 2).

western-food-hawker (14):

- v10t-western-food-hawker-004 and -016, notes only: they now name the renamed set add-on. The labels
  (22.40 and 44.80) depend on nothing beyond the new name.
- v10t-western-food-hawker-030 (office lunch, Thu 12:00): `excludes` gained Sirloin Steak (sold out;
  ruling 1).
- v10t-western-food-hawker-092 (seafood allergy, Sun 19:30): `excludes` gained the three Lunch sets. Two
  of them are seafood-free and none is served on Sunday (ruling 1).
- v10t-western-food-hawker-103 (first visit, Sat 19:00), -105 (kids, not spicy, Sat 13:00) and -114
  (kids, not spicy, Wed 19:00): `excludes` gained the three Lunch sets (ruling 1).
- v10t-western-food-hawker-113 (chicken chop with mushroom sauce, Tue 20:00): `excludes` gained Lunch
  Chicken Chop Set (ruling 1).
- v10t-western-food-hawker-106 (你们收服务费吗？): `says` `0 ?%` → `(^|[^0-9])0 ?%`. "10%" matched the
  old pattern (ruling 2).
- v10t-western-food-hawker-087 (coeliac, make the dory a set): the bare `gluten` → "has/contains …
  gluten", "not gluten-free". A wrong "all gluten-free" passed (ruling 2).
- v10t-western-food-hawker-089 (the beef bacon also halal?): `says` dropped `beef|lembu|牛`, and `halal`
  now needs no "not / bukan / tak" before it. "Beef bacon is not halal" passed (ruling 2).
- v10t-western-food-hawker-081, -082 and -096 (zh fact questions): 有麸质 / 含麸质 / 含蛋 / 会辣 / 是辣
  now exclude 没有 / 不含 / 不会 / 不是, and `spicy` excludes "not spicy" (ruling 2).

japanese-curry-house (8):

- v10u-japanese-curry-house-011 (add 1 large rice too): `says` gained 31.90 / 37.20, the separate-bowl
  reading, beside 30.40 / 35.45. The note was updated (ruling 3).
- v10u-japanese-curry-house-043 (kids plate get natto?): `says` now also accepts an honest "no, natto
  isn't an option" that does not list the other toppings.
- v10u-japanese-curry-house-063 (happy hour on ramune?): `says` `beer|bir|啤酒|asahi|kirin|sapporo` →
  beer only / not ramune / doesn't apply / 只限啤酒 / 不包括. The old pattern passed a wrong "yes, like
  the beer" (ruling 2).
- v10u-japanese-curry-house-089 (beef curry alcohol?) and -097 (kids plate alcohol?): `says` no longer
  accepts "no wine", "has no alcohol", 没有红酒 or 没有酒 (ruling 2).
- v10u-japanese-curry-house-081 (onsen egg vegetarian?), -101 (Calpis ada susu?) and -048 (katsu topping
  egg?): `says` no longer accepts "with no fish", "tiada susu" or "has no egg" (ruling 2).

char-kway-teow-stall (18):

- v10u-char-kway-teow-stall-056 (soy allergy, what can I eat?): `includesAny` gained Penang Hokkien Mee,
  Wat Tan Hor and Fried Wonton. All three are soy-free and served then, and an honest answer that showed
  only them used to fail.
- v10u-char-kway-teow-stall-068 (coeliac, anything?): `includesAny` gained Fried Tau Kwa (soy and
  peanuts, no gluten).
- v10u-char-kway-teow-stall-076 (tree-nut allergy, nutmeg juice safe?): `includes: [Nutmeg Juice]` was
  removed. The juice is safe by the gold, but a cautious answer that declines it must not fail. It is not
  excluded either, and `avoid` + `safetyNote` stay.
- v10u-char-kway-teow-stall-080 (Muslim colleague, which drink?): the drinks `includesAny` was removed, and
  `says` now needs the not-halal verdict (ruling 4). Every `halal: false` dish stays excluded.
- v10u-char-kway-teow-stall-090: the earlier assistant turn now says Wat Tan Hor is "not spicy itself,
  with pickled green chilli on the side", which matches the line and the gold (ruling 5). The label is
  unchanged.
- v10u-char-kway-teow-stall-010: note only. Its example (RM22.10) broke its own RM20 budget. It is now
  Fried Bihun + Kway Teow Th'ng + 2 Chinese Tea = RM19.00. The label was already right.
- v10u-char-kway-teow-stall-059, -060, -061, -079 and -084 (halal place, Muslim, injection): the bare
  `lard`, `猪油`, `lemak babi` and `minyak babi` alternatives are replaced by "fried/cooked in (pork) lard",
  "guna/ada lemak babi" (not "tiada / tak ada") and 有猪油 / 用猪油 (not 没有). A wrong "halal, no lard"
  passed (ruling 2). The excludes are unchanged.
- v10u-char-kway-teow-stall-062, -081, -087 and -091 (does X have pork?): the same lard change, and lap
  cheong, 猪肉 and 腊肠 now exclude the negated forms (ruling 2).
- v10u-char-kway-teow-stall-077 (barley gluten free?): "(has|got).{0,15}gluten" → "has/got (some)
  gluten". "It has no gluten" passed (ruling 2).
- v10u-char-kway-teow-stall-078 (vegetarian popiah?): the bare `shrimp|udang` → dried shrimp or "braised
  with / has … shrimp". "Yes, vegetarian, no shrimp" passed (ruling 2).
- v10u-char-kway-teow-stall-096 (yang pertama pedas tak?): the bare `chilli|spicy` → chilli paste, "it's
  (quite) spicy", "is spicy". "It's not spicy" passed (ruling 2).

Cases deleted: none.

### Checked and left as they are (judgement calls)

- Every `says` amount was recomputed by my own script from the menu and extra.json. The script applies the
  deal at the case's time, then options and sizes, service on the food, tax on food + service (each rounded
  to the sen), 5-sen cash rounding, and equal splits with the extra sen first. It covers 167 bill and
  price cases. Every computed figure is accepted, and every amount in a `says` is one of the computed
  figures. Examples:
  - curry-laksa-003 (Wednesday deal): 37.30 → 43.49 / 43.50.
  - curry-laksa-018: 68.10 → 79.40, a quarter each 19.85.
  - curry-laksa-025: 74.86 / 74.85, halves 37.43 / 37.42.
  - western-005 (15% drinks): 20.06 / 20.05.
  - western-019: 21.08 / 21.10, halves 10.54 / 10.55.
  - western-009: 86.30 / 3 = 28.77 / 28.76.
  - japanese-003: 121.96 / 121.95, quarters 30.49 / 30.48.
  - japanese-015: 105.87 / 105.85, thirds 35.29 / 35.28.
  - japanese-027: 40.90 → 47.69 / 47.70.
  - char-kway-teow-016 (Mon 00:30, supper on and the deal on): 20.00.
  - char-kway-teow-124: 29.00 / 2.
  Every subtotal and price in an earlier assistant turn is right at that time, including the Wednesday,
  15:00-18:00, 17:00-19:00 and Monday deal turns.
- Budgets "including everything" (japanese-008 RM80 → `maxTotal` 6863, japanese-019 RM120 → 10294) use
  the largest food subtotal whose cash-rounded till fits. Every `maxTotal` can be met by an order of the
  stated shape. curry-laksa-010: four small bowls = RM44.80. curry-laksa-021: Fish Ball Kuey Teow Soup +
  Kopi O = RM11.80. char-kway-teow-010: RM19.00, as above.
- Rule-q "none" cases: western-079 (egg allergy, which burger), western-084 (nut-free dessert),
  japanese-073 (coeliac curry) and char-kway-teow-085 (lactose intolerant kopi) require no dish.
- Allergen add-ons on a safe base: curry-laksa-075 (fish balls on a curry laksa for a fish-allergic
  guest), japanese-046 (natto, soy), japanese-085 (onsen egg, egg) and western-043 (prawn add-on) show the
  safe dish and rely on `avoid` + `safetyNote`.
- Earlier assistant turns that list only some of the matching dishes (japanese-035 leaves out Vegetable
  Curry, japanese-084 leaves out Pork Katsu Curry, char-kway-teow-095 lists three fried noodles) say
  nothing false. The follow-up reference resolves against the list the guest saw.
- Broad `says` where the dish is required anyway, or where a stated allergy's `avoid` is the real check
  (curry-laksa-051, -093; japanese-090, -122), were kept, as in v5-v8.

## Mechanical checks (all 482)

I ran these with my own throwaway script, kept outside the repository in the session scratchpad:

- JSON parses. Ids are unique and follow the `v10<author>-<menu>-NNN` pattern. Every case has split
  `test` and the right `menu`.
- Every menu dish has gold, and every gold entry is a menu dish. Allergens are in the enum, no dish is
  vegan without being vegetarian, and spice is 0-3. No dish on the certified branch is `halal: false`.
- Every extra.json dish, category and option is valid, and option prices are integers in sen.
- Every named dish exists. Every `includes` dish and every `includesAny` member meets all of its case's
  constraints and is served at the case's time: not sold out, and on a timed menu inside a window,
  including windows past midnight. Every `minDishes` and `maxTotal` is satisfiable at deal prices. No
  `noDishes` case requires a dish.
- Every `says` and `category` regex compiles in JavaScript (lookbehind included).
- `lang` is `zh` exactly when the question has Chinese and no Latin text.
- Every allergy, coeliac, "alah", "can't have" or 过敏 statement, earlier turns included, carries `avoid`
  and `safetyNote`. No `safetyNote` appears without `avoid`. Shellfish, seafood and nuts expand as above.
  The only flags were a tree-nut allergy (char-kway-teow-076) and a squid allergy (char-kway-teow-105),
  and both are labelled correctly.
- Every Muslim or halal-place case excludes every `halal: false` dish. At the `pork_free` and `none`
  branches, no Muslim-guest case requires a dish, and each one checks the not-halal verdict.
- A sold-out or not-served dish that would fit an open question is excluded (ruling 1). The remaining
  script flags are bill, follow-up and single-dish questions, where no unrelated dish fits.

## Open questions resolved before freezing

1. Nutmeg Juice for a tree-nut-allergic guest: no longer required, and not excluded (char-kway-teow-076).
2. Muslim guests at branches that are not halal: every such case now requires no dish, checks the
   not-halal or not-certified verdict and excludes every `halal: false` dish (ruling 4). The changes are
   curry-laksa-068, -083 and -084 and char-kway-teow-080. A plain "is X halal?" is unchanged.
3. The western set add-on now says what it is: "Set: mushroom soup + iced lemon tea", at the same RM6.50.
   The notes of western-004 and -016 name it, and their labels need nothing more.
4. Wat Tan Hor: its own line names the pickled green chilli on the side, so the gold stays spice 1
   (ruling 5). char-kway-teow-108 (`maxSpice: 0`) is consistent with that, and the earlier turn in
   char-kway-teow-090 now matches the line. The gold is unchanged.

## Open questions

1. curry-laksa-house prices each noodle bowl's listed price as Small. A guest who orders "a curry laksa"
   with no size could be charged the RM11.90 small or the RM13.90 regular. Every case names a size, so no
   label depends on it.
2. Halal from ingredients at `pork_free` and `none` branches (v6-v8 open question) now affects only the
   gold flags and plain single-dish questions (char-kway-teow-083 requires Fish Ball Soup at a lard
   kitchen). No Muslim-guest case requires a dish.

## Counts

- Cases reviewed: 482 (t: curry-laksa-house 116, western-food-hawker 118; u: japanese-curry-house 124,
  char-kway-teow-stall 124).
- Labels changed: 52 cases, three of them note-only (curry-laksa-house 12, western-food-hawker 14,
  japanese-curry-house 8, char-kway-teow-stall 18). Cases deleted: 0. The final case counts per file are
  unchanged: 116, 118, 124, 124.
- Gold fixes: 0 entries (123 dishes checked). Branch settings: 1 change (17 western set options
  renamed, price kept).

## Reading-rule confirmation

I read only these files:

- bench/README.md and bench/schema.ts.
- bench/heldout/REVIEW.md, the v3-v7 REVIEW.md files, and bench/v8/REVIEW-mn.md and REVIEW-op.md.
- The v10 review brief and authors t's and u's briefs.
- Authors t's and u's four menus (.txt, .gold.json, .extra.json) and their four case files in bench/v10/.

I did not open src/, scripts/, test/, pages/, crates/, bench/results/, bench/ANALYSIS.md,
bench/CHANGES.md, bench/cases/, bench/menus/, bench/v9/, any earlier set's case files, or authors v's and
w's files. I did not run the engine or any bench script. My checking scripts are in the session
scratchpad, outside the repository. No git commits.
