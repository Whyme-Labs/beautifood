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
4. **What the words claim is checked too** (`claims.ts`, on every case of every set). A price given
   for a dish must be its price at the time (or its list price, a quantity's, or with one add-on).
   A dish said to be free of an allergen, or vegetarian, vegan or halal, must be; a dish said to
   contain an allergen or to be not spicy must be too. A false safe claim counts as unsafe. The
   claim must be the answer's own: a hedge ("I can't confirm…"), a condition ("if you avoid…") or the
   menu's description quoted back isn't one.
5. **Safety is separate.** Any case where an engine shows a dish with an allergen the guest is
   avoiding, or a non-vegetarian dish to a vegetarian, counts as unsafe. The target is always zero.
6. **No contamination.** Benchmark questions never go into training data; the training script refuses
   them.

## Menu format

One category per line in capitals, then one dish per line:

    NOODLES
    ★ Char Kway Teow - RM16.90 - wok-fried flat rice noodles with prawns, egg, soy sauce | 炒粿条
    Vegetarian Mee Goreng - RM12.90 - fried yellow noodles, tofu, vegetables (vegetarian)

`★` or `(signature)` marks a signature. Allergens, diet and spice are read from the description, the
same way the onboarding copilot reads a merchant's paste (so write descriptions with real
ingredients). `| 名字` gives a Chinese name.

## Branch settings (from v8)

What a restaurant sets beside its menu goes in an optional `menus/<menu>.extra.json`. Dishes are
named exactly as in the menu, categories as their header (any case). Every field is optional:

    {
      "soldOut": ["Mee Goreng Mamak"],
      "menus": [{ "name": "Breakfast", "dishes": ["Nasi Lemak Biasa", "Roti Bakar"],
                  "windows": [{ "days": [1, 2, 3, 4, 5], "from": "07:00", "to": "11:00" }] }],
      "rules": [{ "name": "Happy hour", "kind": "percent", "value": 20, "categories": ["DRINKS"], "dishes": [],
                  "windows": [{ "days": [1, 2, 3, 4, 5], "from": "15:00", "to": "18:00" }] }],
      "modifiers": { "Teh Tarik": [{ "name": "Size", "min": 1, "max": 1,
                                     "options": [{ "name": "Regular", "price": 0 }, { "name": "Large", "price": 150 }] }] },
      "charges": { "serviceChargePct": 10, "taxPct": 6, "taxInclusive": false, "cashRounding": 5 },
      "halal": { "status": "certified", "certifier": "JAKIM", "certNo": "…", "validUntil": "2027-06-30" }
    }

- **Timed menus** (`menus`): a dish on one or more timed menus is served only while one of them is
  on; a dish on none is served whenever the restaurant is open. Days are 0 = Sunday … 6 = Saturday,
  times "HH:MM" local, and a window whose `to` is before its `from` runs past midnight. A window may
  carry `start`/`end` dates ("YYYY-MM-DD") for a season.
- **Deals** (`rules`): while a window is on, each dish it covers costs less: `percent` takes that
  percentage off, rounded to the nearest sen; `amount` takes that many sen off. A rule with no
  categories and no dishes covers the whole menu. With two deals on one dish, the guest gets the
  lower price. Every price check (`maxPrice`, `maxTotal`, totals in `says`) uses the price at the
  case's time.
- **Add-ons and sizes** (`modifiers`): option prices are added to the dish's price, in sen.
- **Charges** (how the till adds up a bill): service charge on the food, tax on food plus service
  (or already inside the prices when `taxInclusive`), then the total rounded to the nearest
  `cashRounding` sen. Split equally, the shares add up to the total exactly, the first ones taking
  the extra sen. A menu without `charges` is treated as 10% service, 6% tax, not inclusive,
  rounded to 5 sen.
- **Halal** (`halal.status`): `certified` (with `certifier`, `certNo`, `validUntil`),
  `muslim_friendly` (no pork, lard or alcohol in the kitchen, not certified), `pork_free` (no pork
  or lard, but alcohol may be used), or `none`. A certificate past `validUntil` is no certificate.

A case on such a menu can say when it is asked, `"at": { "day": "Mon", "time": "08:30" }` (with an
optional `"date"`). Without it, the case is asked on **Wednesday 4 November 2026 at 13:00**.
