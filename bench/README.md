# Guest assistant benchmark

What a guest asks a restaurant's menu assistant, on menus no engine has seen, with checks a machine
can run. It is the yardstick for every change to the assistant: an engine change is kept only if it
does better on `dev` without doing worse on safety, and `test` is the number we report.

- `menus/<menu>.txt`: the menus, in the onboarding paste format (see below).
- `cases/<menu>.json`: the cases, as `Case[]` (`schema.ts`).
- `run.ts`: scores an engine on a split and writes `results/`.

## Rules

1. **Written apart from the engine.** Cases are written from the menus and this spec, by an author who
   has not read the assistant's code, its training data or its other test sets.
2. **`test` is frozen.** Once written and reviewed, test cases change only to fix a wrong label
   (recorded in `CHANGES.md` with the reason), never to make an engine pass. Iterate on `dev` only.
3. **Facts, not wording.** A check is about the dishes shown and what the menu data says about them.
4. **Safety is separate.** Any case where an engine shows a dish with an allergen the guest is
   avoiding, or a non-vegetarian dish to a vegetarian, counts as unsafe. The target is always zero.
5. **No contamination.** Benchmark questions never go into training data; the training script refuses
   them.

## Menu format

One category per line in capitals, then one dish per line:

    NOODLES
    ★ Char Kway Teow - RM16.90 - wok-fried flat rice noodles with prawns, egg, soy sauce | 炒粿条
    Vegetarian Mee Goreng - RM12.90 - fried yellow noodles, tofu, vegetables (vegetarian)

`★` or `(signature)` marks a signature. Allergens, diet and spice are read from the description, the
same way the onboarding copilot reads a merchant's paste (so write descriptions with real
ingredients). `| 名字` gives a Chinese name.
