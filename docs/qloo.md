# Taste insights, with Qloo

## The problem

Big chains pay for consumer research to decide what to put on the menu, what to play, which
nights to theme and where to open next. A hawker stall or a neighbourhood restaurant never could.
It knows what it sells, but not what the people around it love. Beautifood already runs these
restaurants' queue, orders, POS and kitchen, so it knows what sells. Qloo's taste graph knows what
an area and a fan base love, across dining, music, TV and more. Put together, they tell the owner
what to try next, and why.

## What it does

- **Taste brief** (console: *Taste*; API: `GET /api/m/branches/:branch/taste`): for the branch's
  area, the places people love, the same-cuisine places closest to their tastes, the artists they
  listen to and the shows they watch. When Qloo knows the restaurant itself, it adds what its fans
  are like and uses the restaurant as the signal. All of this is set against the menu and the last
  30 days' best sellers, and becomes things to try:
  - a weekend special for a cuisine or dish the area loves and the menu doesn't serve;
  - opening hours, when the favourites are known for being open late;
  - a dining-room playlist;
  - a themed night;
  - which nearby places to keep an eye on.

  Each suggestion comes with its reason and its Qloo source.
- **The owner's own AI agent** (MCP, with a personal access token):
  - `merchant_taste_brief` gives the agent the same brief.
  - `merchant_taste_query` lets it run any read-only Qloo workflow for its own research, such as
    "fans of this restaurant also like…" or "where in KL is this loved?".

  The agent can then act with Beautifood's other merchant tools. This is "your app in my AI": the
  owner's Claude or ChatGPT gets Qloo through Beautifood, within Beautifood's quota and permissions.

## How a brief is made

```
Worker (Cloudflare)                        taste service (container)            Qloo
───────────────────                        ─────────────────────────            ────
branch address ─► "Bangsar, Kuala Lumpur"
menu, best sellers (D1)
          │  POST /v1/run (bearer secret)
          ├──────────────────────────────► qloo mcp (harness, one connection) ─► api.qloo.com
          │   1. qloo_find_tags  "Malaysian restaurant"   → a Qloo cuisine tag
          │      qloo_describe   "Ah Seng Bangsar, KL"    → the restaurant, if Qloo knows it
          │   2. qloo_recommend  place,   signal+filter location            → loved nearby
          │      qloo_recommend  place,   + include_tags [cuisine tag]      → same cuisine
          │      qloo_recommend  artist,  signal: the restaurant, or the area
          │      qloo_recommend  tv_show, signal: the restaurant, or the area
          │      qloo_entity_tags the restaurant (when known)               → its fans
          ◄──────────────────────────────  envelopes (cached a day per question)
compare with the menu and best sellers ─► actions, each with its reason and Qloo source
(cached 12 hours per branch, area and day)
```

Code: `src/server/taste/` (client, brief, branch glue), `services/taste/` (the container),
`routes/api/m/branches/[branch]/taste.ts`, the two tools in `src/server/mcp.ts`, `pages/m/taste.tsx`.

### Request to result, redacted

`qloo_recommend { target_type: "place", signal_location: "Bangsar, Kuala Lumpur", filter_location:
"Bangsar, Kuala Lumpur", limit: 8 }` returns places with their tags. Suppose three of them share
the tag "Indian Muslim" (`urn:tag:genre:…`), and no word of it appears on the menu. The brief then
suggests *Trial a weekend special around "Indian Muslim"*, with the reason *3 of the places people
around Bangsar, Kuala Lumpur love are known for it, and nothing on your menu is*. A tag about hours
(`late night`) becomes an hours suggestion instead, and a vibe tag ("family friendly") becomes
neither.

## Data handling

- Nothing about a guest is sent to Qloo. A brief sends the restaurant's public name, its area and
  its cuisine.
- The Qloo key lives only in the container, as a secret. The Worker holds only the taste service's
  address and its bearer secret. Nothing reaches a browser.
- Calls are cached (a day per question in the service, 12 hours per brief in the Worker) and capped
  per day, as the kit asks.

## What a brief doesn't establish

- Qloo describes where an area's or a fan base's tastes lean, in aggregate. It is not a count of
  visits, and not a prediction about any guest.
- A suggestion is a starting point for a trial, to be judged by what then sells. Beautifood's
  reports show that.
- Matching tags against the menu is word-based, so a menu that serves a cuisine under another name
  may still be told to trial it.

## Setup

1. Deploy `services/taste` as a container, with `QLOO_API_KEY` and `TASTE_SECRET`
   ([its README](../services/taste/README.md)).
2. Give the Worker `TASTE_URL` and the same `TASTE_SECRET`.
3. Open *Taste* in the console, or ask your agent for `merchant_taste_brief`.

Tests: `test/unit/taste.test.ts`; `services/taste` (`npm test`); and `e2e/api/taste.spec.ts` plus the
Taste page in `e2e/ui/extras.spec.ts`. The e2e tests run the real taste service, with a stand-in for
Qloo's harness that speaks the same MCP.
