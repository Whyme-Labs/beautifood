# For coding agents changing this storefront

This is a restaurant's own storefront, deployed on its own Cloudflare account. It renders data from Beautifood; it never writes to Beautifood.

- Data: `GET {BEAUTIFOOD_URL}/api/public/storefronts/{RESTAURANT}`. The shape is `StorefrontPayload` in `src/render.ts`; the full schema is in Beautifood's `/openapi.json`. Money is integer minor units; words are `{ en, zh }` maps (use `say()`).
- Keep every piece of text escaped with `esc()`; the data includes names and words the restaurant typed.
- Keep queue, booking, menu and ticket links pointing at Beautifood (`${base}/r/<ref>…`), never reimplement them: the live queue, prices and availability only exist there.
- Keep text readable: at least 4.5:1 contrast for text on its background and on the accent colour.
- Keep it fast: one HTML response, edge-cached (`CACHE_SECONDS`), no client-side framework unless the owner asks.
- Test locally with `npx wrangler dev`; the page must render for a restaurant with one branch, several branches, no story, no deals and no photos.
