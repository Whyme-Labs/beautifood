# The menu brain

The guest menu assistant runs on our own Worker with no language model, so it costs nothing per
question, for us or for the restaurant. It answers in English, Chinese, Malay and Manglish, in about
10 ms. It learns from what each restaurant's guests order, and every dish, price and allergen it
states comes from the restaurant's own data.

## How a question is answered

```
question ─► normalise ─► find dishes ─► read constraints ─► intent model ─► decide ─► pick dishes ─► write answer
            (Manglish,    (fuzzy, on     (allergens, diet,    (neural, reads    (safety    (signatures,     (templates,
             Malay SMS,    this menu)     spice + negation,    §dish, not the    rules,     orders, what's   both
             typos)                       budget, party,       dish names)       memory)    ordered          languages)
                                          course, appetite)                                 together)
```

Code: `src/shared/brain` (text handling, the intent model) and `src/server/ai/brain` (understanding,
conversation, answers).

- **Normalising** (`text.ts`) maps the ways guests type to one spelling ("x pedas" to "tak pedas",
  "wat" to "what") and drops particles ("lah", "leh"). Misspelt keywords are corrected against a
  small lexicon, SymSpell-style ("vegeterian", "reccomend", "desert"); real words never are.
- **Finding dishes** (`understand.ts`) uses a gazetteer over the restaurant's own menu, weighted by how
  distinctive each word is: "laksa" names Penang Assam Laksa, but "chicken" alone names no dish.
  It forgives one-letter typos ("char kuey teow") and reads names the menu gives in Chinese. Diet,
  allergen and generic food words never name a dish on their own, so "vegetarian?" is a diet and
  "kacang" in "satay ada kacang tak?" is nuts.
- **Constraints** come from patterns, with negation scope: a negation within a few words of a
  spice word flips it ("not spicy", "tak pedas", "不辣", "can't take spice"), and "not too" or
  "sikit" makes it a little. Allergens are avoided when the guest says so ("allergic", "no",
  "tanpa", "不能吃"), or whenever no dish is named, which is the safe reading. Budgets, party
  sizes ("table of 5", "kami berlima", "我们六个人"), courses and appetite ("not very hungry")
  are read the same way.
- **The intent model** (`intentModel.ts`) is a fastText-style network: hashed word, word-pair and
  character n-grams, a 24-wide embedding, one hidden layer of 32, and 12 intents. It reads
  the question with dish names replaced by `§dish` and numbers by `§num`, so one model serves
  every restaurant and nothing needs re-indexing when a menu changes. That's also why we don't
  embed menus. The weights are int8, 265 KB, shipped inside the Worker. A question with no words
  from its training vocabulary is rejected as off-topic (open-set rejection).
- **Deciding** combines the intent with the facts. A dish plus an allergen is always a question
  about that dish's allergens, whatever the model says. Allergies and diets the guest mentioned
  earlier stay in force for the rest of the chat. "Those", "it" and "which one" refer to the dishes
  the last answer showed.
- **Picking dishes** ranks by signature and smoothed popularity. Pairings use lift from the branch's
  last 60 days of orders (how much more often guests order B with A than at all). Without that
  data, they fall back to a content prior: something cold and refreshing for a rich or spicy dish. Group plans spread
  dishes across courses and keep within a stated total. "Something light" ranks by how filling
  each dish looks.
- **Answers** are templates in each language (`assistantReply.*` in `src/i18n/locales`).

A language model is optional, and off unless `ASSISTANT_PROVIDER` is set. When it's on, it gets
only the questions the brain marks as not confident (off-topic, or too unsure). Its answers pass
through the allergen guard and the same budgets as before (`src/server/ai/usage.ts`).

## How good it is

| Set | What it is | Score |
|---|---|---|
| Core guest promises (`EVAL_CASES`) | the 22 cases every engine is scored on | 22/22, 0 unsafe |
| More cases (`MORE_CASES`) | multi-turn memory, follow-ups, typos, Malay, Chinese, service | 40/40, 0 unsafe |
| Final test (`test/unit/brainFinal.ts`) | a café menu it never trained on or was tuned against | 35/38 (92%) on its first run, 0 unsafe; 38/38 after fixing what it found |
| Intents, held out (`test/unit/brainIntents.ts`) | 101 questions written apart from the training data | 93% |

For comparison, the earlier rules engine scored 18/22 on the core set. Llama 3.1 8B on Workers AI
scored 22/22 as deployed, and Qwen3 0.6B on an iPhone scored 20/22.

The intent model has never seen the eval menu or the café: it trains only on the restaurants in
`scripts/brain/menus.ts`. A test checks that no held-out question appears in the training
templates.

## Changing it

- **Teaching it new phrasings:** add templates to `scripts/brain/data.ts` (any language, with
  `{d}`, `{a}`, `{c}`, `{diet}`, `{n}`, `{p}` placeholders), then retrain:

  ```
  npx tsx scripts/brain/train.ts
  ```

  Training takes about 6 seconds and is deterministic. A unit test fails if the weights are older
  than the data. Don't copy questions from the held-out or final sets into the templates; that
  would only make the scores lie.
- **New constraint words** (a diet, a course, a spice word) go in `understand.ts`. New answer
  wording goes in the locale files.
- **Run the checks:** `npx vitest run test/unit/brain.test.ts`.

## What's next

1. **Cross-restaurant pairings.** Map dishes to shared concepts (curry, iced lime, nasi lemak,
   teh tarik), so a new restaurant gets pairings learnt from every other one on day one.
2. **The learning loop.** Questions the brain rejected or answered badly (no order followed)
   become new training examples. A large model labels them offline, and each retrained model
   ships only if it passes the eval sets above.
3. **Learning to rank** from which suggested dishes guests actually add to their cart.

Research behind the design: few-shot intent classification with small models
([SetFit](https://www.alphaxiv.org/abs/2209.11055),
[minimal few-shot intent detectors](https://www.alphaxiv.org/abs/2407.09943)); on-device intent
models with open-set rejection ([2610.00170](https://www.alphaxiv.org/abs/2610.00170),
[2610.20652](https://www.alphaxiv.org/abs/2610.20652)); strong simple baselines for basket
recommendation ([next-basket reality check](https://www.alphaxiv.org/abs/2109.14233)); and
distilling large models into small ones through synthetic data
([SLMRec](https://www.alphaxiv.org/abs/2405.17890),
[conversational recommendation with synthetic data](https://www.alphaxiv.org/abs/2609.30297)).
