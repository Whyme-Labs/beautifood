# Review of a2 (z9, z10)

Reviewer: a2 label reviewer. Files: `bench/avoid/z9.json`, `bench/avoid/z10.json` (edited in place). This file names items by id only; it quotes no message text, because the set is held out.

## Rules applied

- Gold vocabulary and the brief's LABELLING RULES, applied exactly: shellfish = crustaceans + molluscs; seafood adds fish; unspecified "nuts" = peanuts + tree_nuts; "kacang" alone in an allergy statement = peanuts; vegan is diets.vegan alone; Muslim/halal is diets.halal alone; pescatarian = all five meats; avoidances outside the vocabulary (MSG, spice, garlic, onion, coriander, parsley, sugar, durian, ice) are none; a question alone is none; past, absent or negated people are none; a party member counts.
- kind must match gold (states = at least one gold entry; none = all empty and alcohol false). lang must match the text (zh: Chinese only, no Latin letters; manglish: genuinely mixed or Manglish grammar/particles).
- Duplicates: two items in the same language are near-exact duplicates when they are mostly the same words in the same order, differing only by a pronoun, particle, abbreviation or spelling, a single-word swap, or a trailing clause that adds nothing (an equivalent reason, symptom or restatement). One is removed (the z9 copy was kept in every case). Paraphrases built from different words, and items that differ in who is affected, which food/allergen or which dish, are NOT duplicates and were kept.
- Brief copies: a WHAT TO COVER example reproduced word for word (allowing one noun swapped) is a copy and was reworded. Mapping-list terms used inside an otherwise original sentence are not copies. Translations of brief examples into other languages are not word-for-word copies (see Coverage findings).
- Rewrites kept to a minimum (ambiguity, mismatched reason, brief copy, unnatural phrasing); no rewrites for variety alone.

## Label review result

Every item was read against the rules above. No gold value in either file broke a rule or a mapping, and no kind was inconsistent with its gold, so no gold fields were changed.

## Changes (item kept, field changed)

| id | field | why |
|---|---|---|
| a2z9-146 | lang -> ms | text is colloquial Malay only; manglish label was wrong |
| a2z9-149 | lang -> en | text is plain English with no Manglish features |
| a2z10-145 | lang -> en | text is plain English with no Manglish features |
| a2z10-072 | text | copied the brief typo example word for word with one noun swapped; reworded, same meaning, gold unchanged |
| a2z10-097 | text | fasting before breaking fast implied a Muslim guest, making halal arguable for a none item; reworded to a non-religious fast so none is unambiguous |
| a2z10-114 | text | ordered dishes did not fit the stated reason (the swapped dish was pork, not duck); dish changed, gold unchanged |
| a2z10-129 | text | phrasing was unnatural; reworded, gold unchanged |

## Deletions

All are cross-file duplicates; the z9 item named is the one kept.

| deleted | why |
|---|---|
| a2z10-189 | exact duplicate of a2z9-193 |
| a2z10-086 | exact duplicate of a2z9-087 |
| a2z10-160 | near-exact duplicate of a2z9-158 (pronoun only) |
| a2z10-187 | near-exact duplicate of a2z9-194 (pronoun only) |
| a2z10-188 | near-exact duplicate of a2z9-191 (one adverb) |
| a2z10-158 | near-exact duplicate of a2z9-173 (synonym for the same diet word) |
| a2z10-181 | near-exact duplicate of a2z9-187 (one filler word) |
| a2z10-052 | near-exact duplicate of a2z9-054 (only the symptom clause differs) |
| a2z10-185 | near-exact duplicate of a2z9-190 (same frame, equivalent trailing clause) |
| a2z10-140 | near-exact duplicate of a2z9-154 (z10 text is a subset) |
| a2z10-038 | near-exact duplicate of a2z9-037 (equivalent trailing clause) |
| a2z10-198 | near-exact duplicate of a2z9-200 (same request, z9 adds a reason) |
| a2z10-157 | near-exact duplicate of a2z9-167 (same frame, synonyms) |
| a2z10-090 | near-exact duplicate of a2z9-100 (same request) |
| a2z10-186 | near-exact duplicate of a2z9-189 (synonym plus trailing clause) |
| a2z10-035 | near-exact duplicate of a2z9-040 (same request, equivalent trailing clause) |
| a2z10-137 | near-exact duplicate of a2z9-139 (same frame, spelled out) |
| a2z10-109 | near-exact duplicate of a2z9-112 (same sentence plus trailing clause) |
| a2z10-082 | near-exact duplicate of a2z9-088 (same request, unabbreviated) |
| a2z10-165 | near-exact duplicate of a2z9-172 (identical opening clause; trailing clause only restates the diet) |

No item was deleted for being unfixable.

## Similar pairs reviewed and kept (not duplicates)

- a2z9-171 / a2z10-170, a2z9-160 / a2z10-154, a2z9-166 / a2z10-168, a2z9-168 / a2z10-163: same food, different person (self vs family member).
- a2z9-091 / a2z10-087, a2z9-202 / a2z10-195, a2z9-098 / a2z10-100, a2z9-150 / a2z10-139: same frame, different food.
- a2z9-085 / a2z10-083, a2z9-188 / a2z10-182: same question, different dish.
- a2z9-186 / a2z10-166, a2z9-164 / a2z10-166, a2z9-065 / a2z10-063: similar order frame, different food, dish or person.
- a2z9-006 / a2z10-009, a2z9-024 / a2z10-030: shared framing, different allergen.
- a2z9-015 / a2z10-016, a2z9-080 / a2z10-080, a2z9-134 / a2z10-123, a2z9-182 / a2z10-175: both authors used the same celery-in-soup scenario in every language; wording differs, kept.
- a2z9-022 / a2z10-017 (and a2z10-129): lupin flour in bread in both files; wording differs, kept.
- a2z9-055 / a2z10-069, a2z9-162 / a2z10-156, a2z9-036 / a2z10-037, a2z9-086 / a2z10-085, a2z9-089 / a2z10-084: paraphrases built from different words, kept.
- a2z9-161 / a2z10-159: identical opening clause, but the z10 second clause adds a dish-specific instruction, so it is not a restatement; kept.
- a2z9-110 / a2z10-105: same person, allergen and drink, but different wording; kept.
- a2z9-192 / a2z10-183: same request, but the z10 item is Cantonese; dialect items are scarce, kept.
- a2z9-146 / a2z10-088 (both Malay after the relabel): same out-of-vocabulary garnish, different wording; kept.

## Rulings

1. A third party mentioned with no stated absence (a parent, child, spouse, grandparent, friend, colleague) is in the party and counts.
2. Chicken allergy or "doesn't eat chicken" goes to meats.chicken (there is no allergen id for it).
3. Avoiding wine or wine sauces because of sulphites is sulphites only; alcohol stays false (a2z10-015, a2z10-126, a2z10-178).
4. A vegetarian diet kept only for today (lunar 1st/15th, or a guest saying they are eating vegetarian today) counts as vegetarian for this meal.
5. Unspecified nuts, including Chinese 坚果 with no kind, means peanuts + tree_nuts; when the guest explicitly clears peanuts, tree_nuts only.
6. A bare "no X" on one dish with no reason, or with only a taste reason, is none even when X is an allergen food (rule 1 of the brief).
7. Fasting alone does not state halal; where an item implied a Muslim guest only through fasting, it was reworded to remove the ambiguity (a2z10-097) rather than given a halal gold.
8. A past reaction given as the reason for an avoidance that continues now counts; only a past diet or restriction that has ended is none.
9. A health or medical reason for avoiding a meat (doctor's orders, blood pressure) still counts as the meat.
10. Lard counts as pork.
11. Brief-copy test is word for word in the same language; mapping-list terms inside original sentences and translations are not copies.

## Coverage findings (no change made)

- Both authors rendered the brief's hard-none examples into all four languages: the "does this dish have prawns" question, "used to be vegetarian", the absent friend, and "not allergic, just asking". They are translations, not word-for-word copies, and one language's version was not rewritten while leaving the others. After deduplication each pattern still appears at least once in every language (the used-to-be-vegetarian pattern exactly once per language; the absent-person pattern once in zh and twice in the other languages). If the measure should not reward recognising the brief's own templates, these could be replaced with fresh scenarios in a later pass.
- Celery appears almost only as "celery in the soup" and lupin only as "lupin flour in bread"; sulphites mostly via wine sauce or dried fruit.

## Final counts

| lang | total | states | none |
|---|---|---|---|
| en | 102 | 62 | 40 |
| ms | 98 | 60 | 38 |
| manglish | 96 | 61 | 35 |
| zh | 90 | 57 | 33 |
| all | 386 | 240 (62%) | 146 |

Per file: z9 206 items (0 deleted, 2 relabelled, 0 reworded); z10 180 items (20 deleted, 1 relabelled, 4 reworded). Ids were kept as they were; z10 now has gaps.

Validation (scratch script): both files parse; ids unique across both files; every gold id is in the vocabulary with no repeats; kind matches gold everywhere; no zh item contains a Latin letter. Similarity and brief-phrase checks were re-run on the final files, including the reworded items.

## Open questions

- Should the measure accept the brief-template translations above, or should a later pass replace some of them?
- Rulings 1 and 4 assume the guest's party by default and treat a one-day diet as binding for the meal; if the assistant is meant to ask instead, those items' gold would not change but scoring may need a note.
- a2z9-157 keeps an input-method typo in the Chinese word for "allergy"; kept on purpose as realistic.
