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
- **Picking dishes** ranks by signature, smoothed popularity and, once a dish has been shown in
  the chat at least 10 times, how often guests add it from there (a small, smoothed boost).
  Group plans spread dishes across courses and keep within a stated total. "Something light"
  ranks by how filling each dish looks.
- **Pairings** use the most specific evidence there is, with each level shrunk towards the next
  (see "Learning across restaurants" below):
  1. this branch's own orders over the last 60 days;
  2. what guests order together across every restaurant, by dish concept;
  3. a hand-written prior of classic pairings.

  The answer says which one decided: "guests here often order them together", "guests at many
  restaurants order these together", or "a classic pairing".
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

**Edge models, answering alone (2026-10-28).** Each was served by llama.cpp (`llama-server`, 4 CPU
cores, thinking off) and scored with `EVAL_BASE_URL=… EVAL_SET=all npx vitest run --config
vitest.eval.config.ts`, the menu either in the prompt ("inline") or behind the menu tools:

| Model (GGUF) | Download | Core 22, best mode | All 62, inline | All 62, tools | Unsafe (inline / tools, of 62) | Seconds per answer |
|---|---|---|---|---|---|---|
| LFM3-1.7B Q4_K_M | 1.10 GB | 18/22 (tools) | 30 | 39 | 14 / 8 | 17 / 21 |
| Qwen3-1.7B Q8_0 | 1.83 GB | 12/22 (inline) | 35 | 11 | 13 / 15 | 5 / 4 |
| LFM2.5-1.2B Q4_K_M | 0.73 GB | 5/22 (inline) | 17 | 7 | 16 / 15 | 3 / 4 |

Gemma 4 26B on Workers AI, the default server model, scored 17/22 alone with tools (1 unsafe).
LFM3-1.7B is the first edge model that matches it with tools, but it is unsafe on its own (it
misses allergens), answers Malay as Indonesian or reads Malay phrases as dish names, and writes
long answers (about 300 tokens at 20 tokens/s here). As deployed (the brain first, the allergen
guard on every model answer) every model scored 62/62 with 0 unsafe: on these cases the brain
never needs the fallback. LFM3 isn't on Workers AI or OpenRouter yet, and Transformers.js needs
4.3.2 to load its ONNX build.

On the benchmark (`bench/models.ts`, menu tools, the six dev sets):

| | Menu brain | LFM3-1.7B |
|---|---|---|
| Alone, 30 cases per set (180) | 171/180 (95.0%), 0 unsafe | 71/180 (39.4%), 15 unsafe; 42 with no answer; ~27 s each |
| As the brain's fallback (all 2,922) | 2,750 (94.1%), 0 unsafe | 2,735 (93.6%), 0 unsafe |

The brain hands only 74 of 2,922 questions to a fallback (off-topic and adversarial ones it
already answers right), and the model makes 15 of those worse. Its 172 failures are answers it was
confident of, which a fallback never sees.

The intent model has never seen the eval menu or the café: it trains only on the restaurants in
`scripts/brain/menus.ts`. A test checks that no held-out question appears in the training
templates.

## Changing it

- **Teaching it new phrasings:** add templates to `scripts/brain/data.ts` (any language, with
  `{d}`, `{a}`, `{c}`, `{diet}`, `{n}`, `{p}` placeholders), then retrain:

  ```
  npx tsx scripts/brain/train.ts
  ```

  Training takes about 6 seconds and is deterministic. It writes the weights only if they pass
  the gate (see the learning loop below). A unit test fails if the weights are older than the data. Don't copy questions from the held-out or final sets into the templates; that
  would only make the scores lie.
- **New constraint words** (a diet, a course, a spice word) go in `understand.ts`. New answer
  wording goes in the locale files. New dish concepts and classic pairings go in `concepts.ts`.
- **Run the checks:** `npx vitest run test/unit/brain.test.ts`.

## Learning across restaurants

Each dish maps to shared concepts (`src/server/ai/brain/concepts.ts`): curry noodles, coconut rice,
milk tea, iced citrus, dim sum, cake and so on, read from its name, description and course, in English,
Malay and Chinese. A daily cron (`crons/daily.ts`) rebuilds a platform table of which concepts guests order
together, from every restaurant's last 90 days (`src/server/ai/brain/platform.ts`).

Only aggregates leave a restaurant. A concept or pair is stored only once at least **3 restaurants
and 20 orders** back it, and the total order count is withheld until the platform has 3
restaurants, so no restaurant's sales can be read back from the table.

Lift is smoothed at every level. The platform's concept lift counts the prior as 30 pseudo-orders,
so real orders overrule it within a few dozen. A branch's lift counts the platform's as 8
pseudo-orders, so a busy branch's own habits win. That way a restaurant's first day gets pairings
that guests elsewhere have shown work, and its own data takes over as it comes in.

## The learning loop

1. **Log.** Every assistant answer is logged in `assistant_turns`: the question only as the
   model read it (dish names as `§dish`, emails and phone numbers removed), the intent, its
   confidence, the dishes shown, and which of them the guest added from the chat card (the
   chat posts to `/api/public/branches/:ref/assistant/added`). Kept 90 days; the daily cron
   purges older entries.
2. **Harvest.** `scripts/brain/harvest.ts` picks out the questions worth teaching: ones the
   brain was unsure of, called off-topic, or answered with dishes nobody added. The most-asked
   come first, and eval questions are never picked. Its header shows how to dump the log
   with `wrangler d1 execute` (production) or `void db execute` (local).
3. **Label.** `scripts/brain/label.ts` has a large model label them offline, 40 to a request.
   Only labels it is sure of are added to `scripts/brain/harvested.json`. The large model
   is the teacher here and never answers guests. Without `ANTHROPIC_API_KEY` it does a dry run.
4. **Train and gate.** `scripts/brain/train.ts` trains on the templates plus the harvested
   questions (each counted 3 times), then scores the new weights and the shipped ones on every
   eval set (core, more, the café, held-out intents). It writes the new weights only if they
   are no worse on each and give no unsafe answer. It refuses to train at all if a harvested
   question is an eval question.

The **Menu brain learning run** workflow (manual only) runs steps 2–4 on production's log and
uploads the proposed `harvested.json` and weights as an artifact. It commits nothing; a person
reviews the artifact and commits it.

Research behind the design: few-shot intent classification with small models
([SetFit](https://www.alphaxiv.org/abs/2209.11055),
[minimal few-shot intent detectors](https://www.alphaxiv.org/abs/2407.09943)); on-device intent
models with open-set rejection ([2610.00170](https://www.alphaxiv.org/abs/2610.00170),
[2610.20652](https://www.alphaxiv.org/abs/2610.20652)); strong simple baselines for basket
recommendation ([next-basket reality check](https://www.alphaxiv.org/abs/2109.14233)); and
distilling large models into small ones through synthetic data
([SLMRec](https://www.alphaxiv.org/abs/2405.17890),
[conversational recommendation with synthetic data](https://www.alphaxiv.org/abs/2609.30297)).
