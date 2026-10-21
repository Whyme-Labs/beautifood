# What the AI is given about a menu

The guest assistant answers most questions with the menu brain (no model, no tokens). When a
language model answers (Claude, or a small model on Workers AI), it gets the menu in the layout
below. The layout has two goals: few tokens per request, and a prompt prefix that stays the same
across guests, languages and hours, so the provider's prompt cache serves it.

Code: `src/server/ai/menuInput.ts` (the layers), `src/server/ai/claude.ts` (`layout`),
`src/server/ai/guestModel.ts` (`answerWithModel`). Measured on two demo menus:
`demo/brain/tokens.ts`.

## How others model a menu (the research)

| Source | Shape | What we took |
|---|---|---|
| schema.org | `Restaurant.hasMenu` → `Menu` → `MenuSection` → `MenuItem`, each with `offers` (price, `availabilityStarts`/`availabilityEnds`) | sections as headers; availability as data on the menu, not computed into the dish |
| Google menu feed | `Menu`, `MenuSection`, `MenuItem` with an `OfferSet` (only one offer valid at a time: the happy-hour example), `MenuItemAttributes` (suitable diets, allergens with a containment level) | the dish's usual price and a deal price as two offers, only one in force; allergens and diets as attributes |
| Square Catalog | `PricingRule` = a discount × a `ProductSet` (items or categories) × `TimePeriod`s (iCal `DTSTART` + `RRULE`) | deals as rules over categories or dishes with time windows; a start date for seasons |
| Prompt caching (Anthropic; Workers AI prefix caching) | a cache hit needs identical bytes from the start of the prompt; render order is tools → system → messages; Workers AI also needs the request routed to the same instance (`x-session-affinity`) | order the input from most stable to least; nothing time-dependent before the last breakpoint; a stable key for affinity |
| Table formats for LLMs (arXiv 2310.10358, TabularMath 2505.19563) | explicit keys (JSON) beat markdown tables for lookup on many models, at a token cost | one dish a line with a fixed field order and a legend, so each field is identifiable without repeating keys |

## The data model (what the merchant sets)

- **Timed menus** (`TimedMenu`): Breakfast, Weekday lunch sets, Dinner, Late night, a seasonal
  menu. Each has weekly windows (days, from, to; past midnight allowed).
- **Deals** (`PriceRule`): percent or amount off, over categories or dishes, in windows (happy
  hour, Skewer Tuesday, a lunch-set promotion).
- **Seasons and dated promotions** (new): a window can carry `start` and `end` dates
  (`"YYYY-MM-DD"`, inclusive). It only runs between them: Durian season 1 Oct – 30 Nov, a Raya
  promotion. Stored in the same JSON column, so no migration was needed. Validated in
  `menuSchemas.ts`.
- **"Now"** (`schedule.menuNow`): for a branch and a local time (now with the date), each dish says
  whether it's served now, when it's next served, its price now and its deal. The menu says which
  timed menus and deals are on and until when, and when the others start (`dealsNext`).

## The model input: three layers

```
tools (only for menus over 120 dishes)        ┐ the same for every restaurant
GUIDE: instructions + the format legend       ┘ ← cache breakpoint 1
CATALOG: one branch's whole week               ← cache breakpoint 2 (same for every guest, language, hour)
conversation so far                            ← cache breakpoint 3 (the turn before the question)
NOW + the guest's question                     (a few dozen tokens, never cached)
```

**GUIDE** (about 540 tokens) holds the rules and the legend: two-letter allergen codes, `v`/`vg`/`h`
for diets, `s1`–`s3` for spice, `*` for signatures, and how timed menus and deals are written. It
is identical for every restaurant and language, so one cached copy serves the platform.

**CATALOG** (about 800–1,000 tokens for 25–28 dishes) holds the branch's entire week, not what's on
now. That includes breakfast at dinner time, the seasonal menu, and every deal rule with its
windows. It changes only when the merchant edits the menu.

```
RESTAURANT Kopi Kaki (Malaysian kopitiam & café), Main branch. Prices in MYR.
MENU
@1 Breakfast / 早餐: daily 07:00-11:00
@3 Durian season / 榴莲季: daily 11:00-22:00 2026-10-01..2026-11-30
%2 Happy hour drinks -30%: -30% on Drinks: Mon-Fri 15:00-18:00
# Breakfast @1
d1 Kaya Butter Toast Set / 咖椰牛油吐司套餐 | 8.90 | * gl eg mi | charcoal-toasted white bread, kaya, butter…
```

Prices are list prices, and dishes, menus and deals have short refs (`d1`, `@1`, `%1`). The
rendering is deterministic: the merchant's category and dish order, then ids; no clock; no
popularity. `catalogKey` hashes it. The hash names the cache entry and is sent as Workers AI's
`x-session-affinity`, so every guest of a branch reaches the instance holding its prefix.

**NOW** (about 40–50 tokens) goes in front of the guest's last message:

```
NOW time Wed 16:20 2026-10-21; on @3 until 22:00; deals %2 until 18:00: d23 2.45, d24 3.15, …;
next @1 Thu 07:00, @4 Thu 11:30, @2 today 17:30; reply in English
```

Deal prices are given already worked out, so the model never does arithmetic. Sold-out dishes and
the reply language are here too. The reply language sits in NOW rather than the system prompt, so
English and Chinese guests share one cache entry.

## What it saves

On the two demo menus, over 10 moments of a week × 2 languages (`npx tsx demo/brain/tokens.ts`;
estimated tokens):

| | Before: small model, menu in the prompt | Before: Claude, tools | After |
|---|---|---|---|
| Tokens per request (Kopi Kaki, 28 dishes) | 971 | ~2,105 (two calls) | 1,590, of which 1,544 cacheable |
| Distinct prompt prefixes over the 20 requests | 16 | (system prompt under the cache minimum) | 1 |
| Billed per request when cached (cached reads 0.1×) | 971 | ~2,105 | ~200 |

The old prefix changed whenever a timed menu or deal switched, and per language: it listed only
what was served now, at the price now. So it was rarely cached. The old Claude path's system
prompt was under the cacheable minimum, and the menu came back through tool calls each turn.

The new input also carries what the old one didn't: the whole week, Chinese names, the timed menus
and the deal rules. That lets a model answer "when is breakfast?" and "what's on happy hour?".

## The menu brain uses the same facts

The brain reads the same resolved menu (`AssistantContext.now`, `menus`, `rules`, and each dish's
`servedNow`, `nextServed`, `listPrice` and `deal`). Without a model it answers:
- "any promo?" with what's on, with the usual price, or when the next deal starts;
- "breakfast?" and "anything seasonal?" from that menu, or when it's served;
- about a dish that isn't served now: when it is, and with no card to order it.

`demo/brain/run.ts` runs it on the two menus at five moments of the week.

## Rules for changing this

- Nothing time- or guest-dependent goes into GUIDE or CATALOG. It goes into NOW.
- Bump `GUIDE_VERSION` when the guide changes; the catalog key carries it.
- Keep the catalog's order and formatting deterministic. A test asserts that the catalog is the
  same at every hour and in every language.
