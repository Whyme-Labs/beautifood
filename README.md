# Beautifood

A restaurant platform covering walk-in queues, ordering and the front of house. It runs as one stateless Cloudflare Worker over D1, with a Rust/WASM core shared by the server and the browser.

## Features

**For guests**
- Queue from a phone by party size, with live position and ETA, and see every branch's queue.
- Get a Web Push or email when the table is ready, and preorder while waiting.
- Order with friends from a shared cart: scan the table QR (static or dynamic) and each diner adds from their own phone.
- Book a table with a preorder, collect and redeem loyalty points, and receive e-receipts.
- Ask an AI menu assistant about signatures, allergens, a dish's story, budget or diet.

**For merchants**
- Host stand that suggests seatings with reasons, including merge and split, with a fairness bound.
- Floor plan with merge, split and transfer.
- Full POS: voids, discounts, promo codes, item or N-way splits, multi-tender payments, refunds and cash-drawer shifts.
- Kitchen display, bookings and reports with menu engineering.
- Multi-branch RBAC with a boss dashboard across all branches.
- Loyalty tiers, promo broadcasts, and an AI onboarding copilot (paste your menu, describe your floor).

**For AI agents**
- A stateless MCP server at `/mcp` with public tools; merchant tools unlock with a personal access token.
- Discovery docs: `/llms.txt` and `/openapi.json`.

**In your language**
- English and 简体中文 throughout: guest pages, the staff console, emails and the AI assistant. Each person's choice is remembered.
- Menus are translated too: one tap machine-translates the menu (Claude, Workers AI, or a built-in hawker glossary), and the owner can correct any dish. Guests see their language with the original name underneath, and staff tickets keep the original.
- Adding a language means adding one catalog file and one line in `src/i18n/core.ts`. TypeScript fails the build if a string is missing.

Live demo: https://beautifood-app.swmengappdev.workers.dev

The design is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): ACID on D1, surge handling, the shared cart and the assignment engine.

## Run it locally

You need Node ≥ 24 and pnpm. Rust is optional, because the compiled WASM is committed.

```sh
pnpm install
npx void db reset --yes     # local D1 with the schema
pnpm dev                    # http://localhost:5173
```

1. Open `/m/login` and create an account.
2. Then either follow **AI setup**, or load the demo restaurant (two branches, a menu, tables, members and a promo code) from the browser console:
   ```js
   await fetch("/api/dev/seed", { method: "POST" }).then((r) => r.json());
   ```
3. Guests start at `/` (directory) or `/r/<restaurant>~<branch>`.

### Optional settings

Put these in `.env`; never commit it.

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Claude answers the assistant, onboarding and insights. Without it, a deterministic local engine does |
| `ANTHROPIC_MODEL` | Model to use (default `claude-opus-5-5`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push. Generate them with `node scripts/vapid-keys.mjs` |
| `BETTER_AUTH_SECRET` | Signs sessions. `void deploy` generates one for you |
| `TOKEN_SECRET` | Signs guest links (tickets, carts, receipts). Optional: derived from `BETTER_AUTH_SECRET` when unset; 32+ characters if you set it |
| `MAIL_FROM` | Build-time sender, e.g. `Beautifood <noreply@your-domain>` |

## Email

Mail goes out through **Cloudflare Email Sending** (Void's `sendEmail` over the `SEND_EMAIL` binding). The sender comes from `MAIL_FROM` at build time (see `void.config.ts`); use an address on a domain you control in Cloudflare. Each restaurant's name is used as the display name, and each guest gets their email in the language they used to queue or book.

- `npx void deploy --platform cloudflare` sets up Email Routing and Email Sending on that domain and binds `SEND_EMAIL`. Run `npx void email status --platform cloudflare` to check readiness.
- Sending to arbitrary guests needs Workers Paid; on Workers Free, only verified recipients (`npx void email allow <address>`).
- Locally there is no binding, so emails stay in the dev inbox at `/m/inbox` (status `logged`).
- Every email is recorded once per (kind, reference, recipient). Failed sends are retried by the cron with backoff (up to 5 attempts within a day). Bad recipients are not retried, and a send whose outcome is unknown is never resent, to avoid duplicates.
- Campaign emails carry one-click `List-Unsubscribe` headers.

## Tests

```sh
pnpm test:rust      # Rust core
pnpm test:unit      # vitest
pnpm typecheck
pnpm test:e2e       # Playwright: builds for production, fresh D1, api + ui + load projects
```

**Evidence videos.** `pnpm test:evidence` runs 11 persona walkthroughs (guest, diner group, menu assistant, host, kitchen, cashier, owner, marketing, booking, kiosk and TV board, AI agent) with video recording on. The recordings and what each one proves are in [docs/evidence](docs/evidence/README.md).

**Demo video.** The Remotion project in [`video/`](video/README.md) assembles the demo from those recordings (`npm run render`).

Set `PW_CHROMIUM` to use a preinstalled Chromium. Reports are written to `playwright-report/` and `test-results/e2e.json`.

## Rebuild the Rust core

```sh
pnpm core   # cargo build --target wasm32-unknown-unknown + wasm-bindgen → src/core/wasm/
```

## Deploy

Pushes to the default branch deploy through GitHub Actions on Blacksmith runners (`.github/workflows/ci.yml`): tests first, then `void deploy --platform cloudflare`, a smoke test, and a commit of `void.lock.json`. The job needs two repository secrets, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and optionally a `MAIL_FROM` variable.

Resources use explicit names (Worker `beautifood-app`, D1 `beautifood-app-db`, queue `beautifood-app-broadcasts`), and the workflow refuses to deploy over a database or Worker that isn't this app's. `PUBLIC_URL` is set from the deployed URL.

To deploy by hand:

```sh
npx void deploy --platform cloudflare
```

Void builds the Worker and provisions what the project declares: D1, the broadcasts queue, the 1-minute cron, Workers AI (with `BEAUTIFOOD_WORKERS_AI=1`) and Cloudflare Email Sending. `APP_ENV` defaults to `production`.
