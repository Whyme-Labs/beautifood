# Your storefront, on your own Cloudflare account

Beautifood gives every restaurant a page at `/at/<your-slug>`. This template is the same storefront as code you own: it runs on **your** Cloudflare account and domain, reads your published design and what's on now from Beautifood, and sends guests to Beautifood to queue, order and book.

Use it when you want your own domain, your own code, or your own coding agent changing things beyond what the storefront editor offers.

## Deploy in one click

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Whyme-Labs/beautifood/tree/main/templates/storefront-worker)

Then set two values (Cloudflare dashboard → your worker → Settings → Variables, or `wrangler.jsonc`):

| Variable | What |
| --- | --- |
| `RESTAURANT` | your slug, the part after `/at/` in your Beautifood storefront address |
| `BEAUTIFOOD_URL` | where your Beautifood lives, e.g. `https://beautifood-app.swmengappdev.workers.dev` |

Add your domain under the worker's **Domains & Routes**. Done.

## Or from the command line

```sh
npx wrangler deploy
```

## How it works

- `src/index.ts` fetches `GET {BEAUTIFOOD_URL}/api/public/storefronts/{RESTAURANT}` (your **published** design plus live data: branches, signatures, deals, what's served now), renders it, and caches it for 30 seconds at the edge.
- `src/render.ts` turns that into one HTML page, with no framework and no client JavaScript. The design tokens (colours, font, corners, layout, section order, words in English and Chinese) are the same ones the storefront editor sets.
- Queue, menu, booking, ticket and receipt pages stay on Beautifood: `/r/...`, `/ticket/...` and the like redirect there, so guests always get the live product.

Change the design in Beautifood's storefront editor and it shows up here within 30 seconds. Change the code here and it's yours: the next design publish doesn't overwrite it.

## Changing it with a coding agent

Open this folder in Claude Code, Codex or any agent and ask, for example, "add a section with our opening hours from a new HOURS variable" or "make the hero a full-bleed photo carousel". See `AGENTS.md` for the rules it should follow.
