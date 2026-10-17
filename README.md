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

The design is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): ACID on D1, surge handling, the shared cart and the assignment engine.

## Run it locally

You need Node ≥ 24 and pnpm. Rust is optional, because the compiled WASM is committed.

```sh
pnpm install
npx void db reset --yes     # local D1 with the schema
pnpm dev                    # http://localhost:5173
```

1. Open `/m/login` and create an account.
2. Then either follow **✨ AI setup**, or load the demo restaurant (two branches, a menu, tables, members and a promo code) from the browser console:
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
| `TOKEN_SECRET`, `BETTER_AUTH_SECRET` | **Set strong values in production** |

## Email

Mail goes out through **Cloudflare Email Sending** (Void's `sendEmail` over the `SEND_EMAIL` binding). The sender is set in `src/shared/mail.ts`; change it to an address on a domain you control in Cloudflare. Each restaurant's name is used as the display name.

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

Set `PW_CHROMIUM` to use a preinstalled Chromium. Reports are written to `playwright-report/` and `test-results/e2e.json`.

## Rebuild the Rust core

```sh
pnpm core   # cargo build --target wasm32-unknown-unknown + wasm-bindgen → src/core/wasm/
```

## Deploy

```sh
npx void deploy
```

Void builds the Worker and provisions what the project declares: D1, the `broadcasts` queue, the 1-minute cron, and **Cloudflare Email Sending**. Set `APP_ENV=production`, plus a `TOKEN_SECRET` of 32+ random characters (the app refuses to run in production without one), and the optional keys above.
