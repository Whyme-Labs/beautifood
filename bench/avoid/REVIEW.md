# a1 avoid set: label review

Reviewed `bench/avoid/z7.json` (author z7) and `bench/avoid/z8.json` (author z8) against the authors' brief. Nothing else in the repository was read or run.

## Rules applied

- **Gold** follows the brief's labelling rules and mappings exactly:
  - shellfish = crustaceans + molluscs; seafood adds fish.
  - "nuts" with no kind = tree_nuts + peanuts; Malay "kacang" alone in an allergy statement = peanuts.
  - vegan is listed alone (no vegetarian, egg or milk); halal is listed alone (no pork or alcohol).
  - pescatarian = all five meats.
  - Avoidances outside the vocabulary are "none"; a question alone is "none".
  - A past, absent or negated person doesn't count; a person at the table or being ordered for does.
- **Test applied to every item:** would a careful human server act on exactly this gold?
- **kind** must match gold. **lang**: zh is Chinese only (no ASCII or full-width Latin letters); ms is Malay; manglish needs a real mixing marker; en is plain English.
- **Duplicates** (same language):
  - Exact or cosmetic variants of the same message are deleted, keeping one.
  - One-word swaps or light edits of another item's template, with the same avoidance or question, are reworded so each item is distinct.
  - Items that share a template but differ in the food, avoidance, symptom or question are kept.
  - When a pair crossed the two files, the z7 item was kept and the z8 item was deleted or reworded. z7 was simply the first file; neither file was judged better.
  - Candidates came from two checks over both files, per language and including pairs within one file:
    - a pairwise difflib ratio, with every pair at 0.55 or above judged by hand;
    - a shared-run check (a common 4-word run in Latin text, or a common 4-character run in Chinese), which catches a clause reused in a different position.
  - Both checks were re-run after the rewrites. The pairs still flagged differ in gold, or share only a vocabulary phrase or a generic run, such as a1z7-167 and a1z8-047, which share the plain sesame-allergy statement but ask about different dishes.
- **Brief copies:**
  - The example phrasings from the brief's labelling rules 1 to 3 and from its "what to cover" list were matched against every item.
  - Every item that reproduced one word for word was reworded, and so was every item that reproduced one nearly word for word (only an apostrophe, plural, possessive or one word changed). Each kept its gold, language and purpose, and typo items keep a typo.
  - Mapping-list phrases from rule 4 ("tak makan babi", "tak minum arak", "I don't drink", "no pork", "no beef", "makanan halal", "不吃猪肉") count as vocabulary when they sit inside the author's own sentence, and were kept.
  - A message that was only such a phrase plus a courtesy ("please", "thanks", "make sure") was reworded.
  - Single tokens ("vege", "alergic", "nuts", "kacang") are vocabulary.
- **Gold was changed only to fix an error.** No gold errors were found, so no gold was changed.

## Changes

### z7.json: 23 changed

| id | what changed (old → new) | why |
|---|---|---|
| a1z7-001 | text: `hi, im allergic to prawns, which noodles are safe for me?` → `hi, I have a prawn allergy, which noodles are safe for me?` | copied brief example 'I'm allergic to prawns' verbatim; reworded, gold unchanged |
| a1z7-004 | text: `I'm coeliac - is the roti canai ok or is there something else?` → `coeliac here - is the roti canai ok or is there something else?` | copied brief example 'I'm coeliac'; reworded, gold unchanged |
| a1z7-009 | text: `allergy to nuts, any dessert that's completely nut free?` → `nuts are a big problem for me (allergic) - any dessert that's completely nut free?` | copied brief short-form example 'allergy to nut(s)'; reworded, gold unchanged |
| a1z7-011 | text: `no seafud pls, alergic` → `pls no seefood, very allergick` | copied brief typo examples 'no seafud' + 'alergic'; reworded with new English misspellings so the item still tests typos; gold unchanged |
| a1z7-032 | text: `does the laksa have prawns?` → `any prawns in the assam laksa or just fish?` | copied brief example 'does the laksa have prawns?' verbatim; reworded, still a bare question (none) |
| a1z7-033 | text: `I love your peanut sauce, can I get extra with the satay?` → `your satay peanut sauce is so good, can I get an extra bowl?` | near-verbatim brief example 'I love peanut sauce'; reworded in plain English, none |
| a1z7-036 | text: `what's your most popular fish dish?` → `what fish dish do your regulars usually order?` | near-verbatim brief example 'what's the most popular fish dish?'; reworded, none |
| a1z7-037 | text: `not allergic, just curious, is there sesame in the dressing?` → `no allergies, I just like knowing what's in my food - is there sesame in the dressing?` | near-verbatim brief example 'not allergic, just asking'; reworded, none |
| a1z7-039 | text: `I used to be vegetarian but I eat everything now, what's your best beef dish?` → `gave up being vegetarian last year, so what's your best beef dish?` | copied brief example 'I used to be vegetarian'; reworded, none |
| a1z7-040 | text: `my friend is vegan but she's not coming tonight, so just a table for 3` → `my vegan housemate was supposed to come but she's down with flu, so table for 3 only` | copied brief example 'my friend is vegan but she's not coming'; reworded, none |
| a1z7-041 | text: `I'm not allergic to anything, surprise me` → `zero allergies, zero restrictions - the chef can decide for us` | copied brief example 'I'm not allergic to anything'; reworded keeping the negated-allergy statement, none |
| a1z7-047 | text: `no MSG please` → `could the kitchen leave out the MSG? it gives me headaches` | message was the brief example 'no MSG' plus 'please'; reworded, none |
| a1z7-053 | text: `saya alah udang, ada menu tanpa udang?` → `udang saya tak boleh, alah. ada menu yang takde udang?` | copied brief example 'saya alah udang'; reworded, gold unchanged |
| a1z7-070 | text: `tak makan babi ye, tolong pastikan` → `babi saya tak makan ye, tolong pastikan` | brief mapping phrase 'tak makan babi' plus a courtesy, same shape as a1z7-158; reworded, gold unchanged |
| a1z7-085 | text: `teh o ais kurang manis ye` → `teh o ais satu, letak gula separuh je ye` | copied rule-1 example 'kurang manis'; reworded, none |
| a1z7-106 | text: `lactose intolerant sikit lah, so kopi tak nak susu can?` → `I ada lactose intolerance lah, so kopi tak nak susu can?` | copied brief example 'lactose intolerant sikit'; reworded, gold unchanged |
| a1z7-139 | text: `no MSG ya boss, later I thirsty` → `ajinomoto don't put ya boss, later I thirsty` | copied brief example 'no MSG'; reworded, none |
| a1z7-140 | text: `no coriander pls, I hate the taste` → `don't put daun ketumbar pls, I hate the taste` | copied brief example 'no coriander'; reworded, none |
| a1z7-154 | text: `我对海鲜敏感，有什么推荐？` → `海鲜我一吃就敏感，有什么推荐？` | copied brief example '我对海鲜敏感' verbatim; reworded, gold unchanged |
| a1z7-155 | text: `我吃斋的，有素菜吗？` → `我长期吃斋，有什么素菜？` | copied brief example '吃斋的'; reworded, gold unchanged |
| a1z7-158 | text: `不吃猪肉，谢谢` → `猪肉我是不吃的，麻烦注意一下` | message was the brief mapping phrase '不吃猪肉' plus thanks; reworded, gold unchanged |
| a1z7-162 | text: `我初一十五吃素，今天刚好十五，有素的吗？` → `我每逢农历初一和十五都吃素，今天刚好十五，有素的吗？` | copied brief cultural example '初一十五吃素'; reworded, gold unchanged |
| a1z7-169 | text: `他对鱿鱼和蚌都过敏` → `我朋友对鱿鱼和蚌都过敏，他那份请注意一下` | bare pronoun '他' left it unclear whether the person is being ordered for; now a friend whose portion is being ordered; gold unchanged |

### z8.json: 27 changed

| id | what changed (old → new) | why |
|---|---|---|
| a1z8-002 | text: `what time do you close on Sundays?` → `are you open on Sundays, and till what time?` | one-word swap of a1z7-051; reworded, none |
| a1z8-010 | text: `saya memang tak makan itik` → `saya memang tak sentuh itik sejak kecil` | near-duplicate of a1z7-073 ('saya tak makan itik'); reworded, gold unchanged |
| a1z8-013 | text: `我乳糖不耐，奶茶可以换成别的吗？` → `饮料里面不要加奶，我乳糖不耐` | shared its closing clause (奶茶换成别的) with a1z7-164, same gold; reworded, gold unchanged |
| a1z8-021 | text: `boleh bayar guna duitnow?` → `nak bayar pakai DuitNow QR, boleh?` | one-word swap of a1z7-097; reworded, none |
| a1z8-036 | text: `我有麸质过敏，不能吃小麦` → `我麸质过敏，面类都不能吃，有米粉吗？` | same second clause as a1z7-165 ('不能吃小麦'); reworded, gold unchanged |
| a1z8-040 | lang: `manglish` → `en` | plain English with no Malay/Chinese marker; relabelled manglish -> en |
| a1z8-071 | text: `our 3yo breaks out in hives after eggs, could the kids' fried rice be made without them?` → `our 3yo can't have egg, she swells up - can the kids' fried rice be done without?` | light edit of a1z7-003 (breaks out after eggs / fried rice); reworded, gold unchanged |
| a1z8-080 | text: `我对核桃过敏，这个蛋糕有核桃吗` → `我吃核桃会过敏，这个布朗尼有放吗？` | one-word swap of a1z7-170; reworded, gold unchanged |
| a1z8-081 | text: `I don't eat mutton, is there another protein for the curry?` → `mutton is something I never eat - what else can go in the curry?` | light edit of a1z7-016 ('I don't eat mutton' + curry); reworded, gold unchanged |
| a1z8-083 | text: `sotong I cannot eat ah, last time eat then vomit` → `sotong no ah for me, every time eat sure vomit` | same template as a1z7-129 ('cannot take squid ah, last time ate...'); reworded, gold unchanged |
| a1z8-096 | text: `anak saya kalau makan kacang terus bengkak mata` → `kacang jangan bagi anak saya, mata dia terus bengkak kalau termakan` | same template as a1z7-055 (and a first rewrite collided with a1z7-072); reworded, gold unchanged |
| a1z8-098 | text: `i not allergic to anything lah, just asking whether the kuih got nuts` → `i no allergy one lah, curious only, the kuih got nuts?` | copied brief examples 'not allergic to anything' + 'just asking'; reworded, none |
| a1z8-102 | text: `whenever I eat seafood my throat gets tight, so nothing like that for me thanks` → `seafood closes up my throat, so nothing like that for me thanks` | shared the run 'every time/whenever I eat seafood my ...' with a1z7-002, same gold; reworded, gold unchanged |
| a1z8-109 | text: `aiyo I cannot take seafood one, later itchy whole body` → `aiyo seafood all cannot for me, my skin sure kena rashes` | one-word swap of a1z7-111 template ('cannot take X one, later itchy whole body'); reworded, gold unchanged |
| a1z8-129 | text: `isteri saya tak boleh minum susu, perut dia meragam` → `isteri saya ada masalah laktosa, jangan bagi dia apa-apa yang ada susu` | near-duplicate wording of a1z7-063; reworded, gold unchanged |
| a1z8-131 | text: `sy x blh mkn ketam, nnti sesak nafas` → `sy alergi ketam, jgn msk ketam dlm nasi goreng sy, nnti sesak nafas` | same template and allergen as a1z7-054 ('x boleh mkn ketam, nnti ...'); reworded with short forms kept, gold unchanged |
| a1z8-134 | text: `my friend don't eat duck one, so the duck rice change to roast chicken rice can?` → `duck my friend won't touch one, can change the duck rice to roast chicken rice?` | same template as a1z7-121 ('X don't eat duck one, so the ... duck'); reworded, gold unchanged |
| a1z8-145 | text: `我吃鱼会起疹子` → `鱼一吃就起疹子，鱼类都不要` | shared the opening 我吃鱼会 with a1z7-176, same gold; reworded, gold unchanged |
| a1z8-161 | text: `鱿鱼和蚌我都不能吃，会过敏` → `墨鱼和蚬我都不能吃，会过敏` | same pair 鱿鱼和蚌 + 过敏 as a1z7-169, same gold; reworded with other molluscs, gold unchanged |
| a1z8-171 | text: `my daughter reacts to sesame, is there sesame oil in the cold noodles?` → `my daughter reacts to sesame, pls tell the kitchen no sesame seeds on her bun` | light edit of a1z7-015 (daughter, sesame, sesame oil in dish); reworded, gold unchanged |
| a1z8-175 | text: `my wife last time allergic to prawn but she grow out of it already, so can order the butter prawn` → `my wife had prawn allergy as a kid but she outgrew it, so can order the butter prawn` | same template 'my wife last time allergic to ...' as a1z7-132; reworded, none |
| a1z8-177 | text: `tree nut allergy (cashew, almond, walnut) - peanuts are fine though` → `tree nut allergy (cashew, almond, walnut), groundnuts no problem though` | same allergens and ending as a1z7-021 ('peanuts are fine though'); reworded, gold unchanged |
| a1z8-180 | text: `酒就免了，我滴酒不沾，来杯果汁` → `酒就免了，我从来不喝，来杯果汁` | shared the idiom 滴酒不沾 plus a soft-drink request with a1z7-160, same gold; reworded, gold unchanged |
| a1z8-187 | text: `黄豆过敏，豆腐和豆浆都不能碰` → `我对大豆过敏，豆浆不要给我` | same structure as a1z7-171 (黄豆过敏 + 豆腐 也不能); reworded, gold unchanged |
| a1z8-189 | text: `saya tak makan daging lembu` → `daging lembu saya tak sentuh, ada lauk ayam?` | subset wording of a1z7-081 ('saya tak makan daging lembu'); reworded, gold unchanged |
| a1z8-191 | text: `I react badly to mustard, which of the sauces should I stay away from?` → `mustard and I don't get along - which of the sauces should I stay away from?` | shared the clause 'I react badly to mustard' with a1z7-025, same gold; reworded, gold unchanged |
| a1z8-207 | text: `squid and octopus make me really sick, I can't eat them` → `squid, octopus, even calamari rings - all make me ill, keep them off my plate` | light edit of a1z7-020 (squid/octopus make ... really sick); reworded, gold unchanged |

## Deletions (16, all in z8.json)

| id | why |
|---|---|
| a1z8-008 | near-exact duplicate of a1z7-177 (zh pescatarian, one word dropped) |
| a1z8-025 | near-exact duplicate of a1z7-038 (kids can't handle chilli) |
| a1z8-026 | near-exact duplicate of a1z7-159 (食品 vs 食物) |
| a1z8-042 | near-exact duplicate of a1z7-064 (same sentence minus the trailing question) |
| a1z8-048 | exact duplicate of a1z7-090 |
| a1z8-082 | near-exact duplicate of a1z7-099 (mee goreng, no egg, same preference) |
| a1z8-092 | near-exact duplicate of a1z7-168 (synonym swaps only) |
| a1z8-110 | exact duplicate of a1z7-200 |
| a1z8-112 | near-exact duplicate of a1z7-137 (beer / Tiger) |
| a1z8-113 | near-exact duplicate of a1z7-076 (gluten, mee kuning -> bihun) |
| a1z8-172 | near-exact duplicate of a1z7-174 (peanuts + other nuts, reordered) |
| a1z8-176 | near-exact duplicate of a1z7-088 (does the soup use milk) |
| a1z8-186 | near-exact duplicate of a1z7-069 (apa-apa vs apa2) |
| a1z8-194 | near-exact duplicate of a1z7-134 (curry mee got cockles) |
| a1z8-211 | near-exact duplicate of a1z7-028 (lupin flour in breads) |
| a1z8-214 | near-exact duplicate of a1z7-057 (same sentence reordered) |

## Final counts

z7.json has 205 items and z8.json has 198 (403 in total). Ids keep their gaps.

| lang | states | none |
|---|---|---|
| en | 63 | 42 |
| ms | 59 | 38 |
| manglish | 64 | 37 |
| zh | 61 | 39 |
| **all** | **247 (61%)** | **156** |

## Rulings of my own

- A relative or companion named in an ordering chat with no sign they are absent counts as a party member (e.g. a1z7-166, a1z7-172, a1z8-046, a1z8-076, a1z8-101). Only a bare pronoun with no context (a1z7-169) was rewritten.
- An allergy to something outside the vocabulary (durian, cat hair) is "none" (a1z7-052, a1z7-096, a1z7-147, a1z7-193).
- A religious context with no stated restriction is "none": a Ramadan or buka puasa booking or question that doesn't ask for halal (a1z7-050, a1z7-101, a1z7-153), and a question about whether the place is halal for an absent colleague (a1z8-099).
- A stated Muslim identity or "must be halal" gives halal only. "No pork and no alcohol" without "halal" or "Muslim" gives pork + alcohol, not halal (a1z8-019, a1z8-170).
- A diet kept only today (Buddhist 初一/十五, "today my vege day", "today my mum eat chai") counts as vegetarian for this meal.
- Avoidances for health reasons count: gout means seafood, high blood pressure means mutton, a doctor's ban on chicken means chicken, and pregnancy means alcohol (a1z7-117, a1z7-065, a1z8-138, a1z8-168).
- "x makan daging, ayam, ikan semua, sayur je" (a1z7-080) is vegetarian, not a list of meats.
- A plain request to leave a food off one dish, with no reason given, is a preference and so "none", even for common allergens (a1z8-147, a1z8-206, a1z8-024, a1z8-154).
- The cross-file twin kept is always the z7 one (see Rules applied).

## Open questions

- 芥末 alone usually means wasabi in Chinese. a1z7-180 says 芥末籽 (mustard seed), so mustard is right there. A future item that says only 芥末 should not be labelled mustard without checking what the guest means.
- a1z7-022 asks whether a fish head curry contains crab for a mother allergic to crab. It was kept as crustaceans only. A server might also warn about the shared seafood kitchen, but that is not a gold matter.
- The same-scenario pairs below are worded differently and were kept, but they test the same thing twice. A maintainer may want to thin them:
  - a1z7-008 and a1z8-200 (Australian visitor, shellfish)
  - a1z7-013 and a1z8-015 (Ramadan booking, halal)
  - a1z7-006 and a1z8-086 (Hindu, no beef, curries)
  - a1z7-012 and a1z8-208 (milk, oat latte)
- a1z7-007 closely paraphrases the brief's multi-restriction example, but not word for word. It was kept unchanged.
