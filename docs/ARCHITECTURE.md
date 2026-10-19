# Beautifood: Architecture

Beautifood is a multi-tenant, multi-branch restaurant platform. It covers:

- walk-in queueing and table management (merge, split, transfer)
- shared-table QR ordering, a full F&B POS and kitchen display
- bookings with preorder, loyalty points, e-receipts and promo broadcasts
- AI for guests, merchants, and their own AI agents

This document records the stack decision and how the hard parts work. The hard parts are ACID, surge traffic, concurrent orders, the shared cart, and fair table assignment.

## 1. Stack: stateless Workers + D1 + a Rust/WASM core

| Layer | Choice | Why |
|---|---|---|
| Framework | [Void](https://void.cloud) (Vite + Cloudflare Workers): file routes (Hono), React pages, Drizzle schema for D1, queues and crons as files | One deployable Worker, no servers to run |
| Database | **Cloudflare D1** (SQLite): an append-only **event log** plus projection tables | Every command is one atomic `db.batch` |
| Domain core | **Rust → WASM** (`crates/core`): pricing, bill splitting, the table-assignment engine, ETA simulation, the turn-time model | One implementation, loaded in the Worker *and* the browser, so the phone's bill preview and the till agree to the sen |
| Email | **Cloudflare Email Sending** via Void's `sendEmail` (`SEND_EMAIL` binding), sender domain set up by `void deploy` | No third-party mail provider; recorded-then-delivered, retried with backoff, never double-sent |
| Async work | Transactional outbox over the event log, drained right after each command (`waitUntil`) and by a 1-minute cron. A Cloudflare **Queue** handles campaign fan-out | At-least-once delivery with idempotent handlers gives exactly-once effects |
| Auth | Better Auth (staff email/password) with per-tenant RBAC. Guests and members get **HMAC-signed capability tokens** | No guest accounts, no session state |
| Realtime | Cheap polling with version cursors (`204 Not Modified`), edge-cached public reads, payload-less **Web Push** (VAPID) | Works with phones locked, and costs nothing at idle |
| AI | Claude via the Anthropic SDK, with server-side model fallbacks enabled (`fallbacks: "default"`). A deterministic local engine answers when no key is set or a call fails | AI improves answers but is never on the critical path |

**What we deliberately did not use.** We dropped Durable Objects, VPS-hosted NATS, and Postgres.

The domain shards naturally per branch, and D1's batch semantics already give us a single atomic, serialized write per command. A per-branch actor would add a second consistency system to reason about and a second bill. A VPS or managed NATS ($49/mo and up) breaks the "$0 at idle, $5/mo Workers Paid" economics.

**The NATS idea survives in-process.** The event log *is* the stream: each consumer keeps a durable cursor (`consumer_cursors`), exactly like a JetStream durable consumer. Commands are the publishers.

### Cost at idle and at peak

- **Idle:** no compute and no connections. D1 storage is the only standing cost.
- **Peak:** a lunch-rush surge is Worker requests (stateless, horizontally scaled by Cloudflare) plus D1 writes. Read surges ("how long is the queue?") are absorbed by the edge cache, so a thousand phones refreshing cost about one D1 read per PoP every 2 s.

### Request path

```
 guest phone / kiosk / AI agent ──► Worker (Hono routes, zod validation, RBAC)
 staff console (React)          ──►   │  Rust core (WASM, in-isolate)
                                      │  one db.batch per command:
                                      │    asserts + projection updates + events
                                      ▼
                                     D1 ── events ──► pipeline (waitUntil + cron)
                                                        ├─ loyalty accrual
                                                        ├─ receipt snapshot + e-receipt email
                                                        ├─ "table ready" email + Web Push
                                                        └─ booking/queue confirmations
                                     campaigns ──► Queue `broadcasts` (50/msg) ──► email
```

## 2. ACID on D1: asserts inside the batch

D1 runs a `batch` as one SQLite transaction, but it has no interactive transactions. You can't `SELECT … FOR UPDATE`, decide in JS, and then write. So `src/server/tx.ts` builds every command as a **single batch whose preconditions are SQL**:

```sql
-- precondition: the table must still be free
INSERT INTO _assert(ok) SELECT 0 WHERE NOT (EXISTS (SELECT 1 FROM floor_tables WHERE id = ? AND status = 'free'));
-- _assert has CHECK(ok = 1), so a failed precondition aborts the whole batch
UPDATE floor_tables SET status = 'seated', seating_id = ? WHERE id = ?;
INSERT INTO events (stream, version, type, data, msg_id, …) VALUES (…);
```

Each guard maps to a clear error, for example `409 table_taken` or `409 insufficient_points`. On top of that:

- **Optimistic concurrency per aggregate:** `UNIQUE(stream, version)` on the event log.
- **Idempotency:** `UNIQUE(msg_id)`. A retried "pay" or "send to kitchen" with the same `msgId` returns the original result (`duplicate: true`) instead of charging twice.
- **Invariants as constraints:** `CHECK(points >= 0)` on members, `UNIQUE(branch, day, category, seq)` on tickets, and unique `(kind, ref, to)` on emails.

**Evidence.** These E2E tests exercise the guarantees:

| Scenario | Result |
|---|---|
| 20 concurrent seat attempts | exactly 1 wins |
| 2 hosts seating different parties on one table | one 200 and one `table_taken` |
| 4 bills racing for a promo code capped at 2 uses | exactly 2 apply |
| 6 guests booking the only 16-seat combo | exactly 1 booking |
| Redeeming more points than the balance | refused atomically |

## 3. Surviving surge traffic

- **Queue numbers** come from `MAX(seq)+1` inside the batch, guarded by the unique index. A collision retries, so numbers are gap-free and duplicate-free. Proven at 300 simultaneous joins on a laptop; see the `load` project.
- **Admission control:** `maxWaiting` per branch answers `429 queue_full` instead of degrading.
- **Cheap writes:** the join response computes the "parties ahead" count and runs the ETA simulation only when fewer than 25 parties are ahead.
- **Cheap reads:**
  - Public status, menu and directory are edge-cached (`Cache API`, 2–15 s).
  - Branch config is cached per isolate for 3 s.
  - The host board shares a 2 s snapshot.
  - Cart polling sends `since=version` and gets an empty `204` when nothing changed.
- **Coalesced side effects:** during a surge every command kicks the pipeline. Only one run executes per isolate, and kicks that arrive meanwhile schedule a single re-run.

## 4. Simultaneous orders and the shared table cart

A seated table gets a **session**. Everyone who scans the table QR or follows the ticket's table link joins it under a self-chosen name.

- **Lines are owned.** Each cart line records its participant. You can change your own lines, but not your friend's (`403`).
- **Server-side pricing.** The client sends item ids and modifier choices. The server prices from the menu at send time, applying any price rule (happy hour) on at that moment in branch-local time, and rejects sold-out dishes, dishes whose timed menu is not on (guests only; the till may ring them up) and missing required modifiers. Order lines keep the usual price and the rule name beside the price charged, for the receipt and reports.
- **Send is versioned.** "Send to kitchen" carries `expectedVersion` and a `msgId`:
  - A stale send gets `409` plus the fresh cart.
  - Two phones pressing send at once: one fires the round, the other gets `already_sent`.
  - A retried send is idempotent.
- **Rounds:** each send becomes a numbered round on the table's single bill and fires to the KDS. A preorder from the queue or a booking is **held** and fires when the party is seated or checked in.

## 5. Tables: merge, split, transfer

- **Merge:**
  - Tables share a `merge_group` (for example the patio 4-tops). The engine proposes merges of up to 4 tables in one group, and seating applies them atomically.
  - Tables from different groups refuse with `not_mergeable`.
  - Two seated parties can also be merged into one seating, which combines the parties and their bills.
- **Split:**
  - A table with a `split_config` (for example a 10-top as 6 + 4) becomes child tables. A small party can be seated on one half while the other half stays bookable.
  - Rejoining is refused while a child is occupied.
  - The engine itself may suggest `split_seat` when that's the best fit.
- **Transfer** moves a seating to other tables. The old ones become `dirty`, ready for cleaning.
- **Bills** can be split by items (a separate bill on the same table) or N ways. Equal splits come from the Rust core and always sum exactly. A table closes only when every bill is settled.

## 6. Queue and table-assignment intelligence

Party-size classes are configurable per branch. The defaults are A 1–2, B 3–4, C 5–8 and D 9–30, each with its own number sequence.

The engine in `crates/core/src/assignment.rs` generates candidates (single table, merge, split) and ranks them with a pluggable strategy:

| Strategy | Behaviour |
|---|---|
| `fifo` | Strict first come, first served |
| `category_fifo` | Round-robin over the heads of each size class, so no class starves |
| `best_fit` | Least wasted seats |
| `smart` | Weighted score: wait, waste, merge penalty, upcoming bookings, priority |

Every suggestion carries human-readable **reasons**.

A **fairness bound** (`maxSkips`) counts how often a party was passed over. Once it hits the bound, that party is seated next ("fairness: skipped 1× already").

**Machine learning, sized for the problem.** Turn times are learned per (branch, party size) from every closed seating. The model is a Bayesian-shrunk mean that becomes an EWMA once warm. **ETAs** come from simulating table releases against that model, not from a fixed "10 minutes per party".

## 7. AI for guests, merchants and their agents

- **Guest menu assistant** (`/api/public/branches/:ref/assistant`):
  - Covers signatures, budget, diet, the allergens in a dish, and the story behind a dish.
  - Uses Claude with tool use over the live menu; the local engine is the fallback.
  - Answers about allergens always carry a "confirm with staff" safety note.
  - The UI shows suggested dishes as add-to-cart cards.
- **Merchant onboarding copilot** (`/api/m/ai/onboarding`):
  - Takes a pasted menu in any format and a sentence about the floor. It returns a reviewable draft: categories, prices in minor units, signatures, allergens, and tables with merge groups and split configs.
  - Nothing is saved until the merchant applies it. A checklist tracks setup progress.
- **Insights:** facts are computed from the day's report (peak hour, menu-engineering classes); Claude narrates them.
- **Bring-your-own-agent:**
  - A stateless **MCP server** at `/mcp`. Public tools: find restaurants, menu with allergen filters, ask the assistant, queue status, join/check/cancel ticket, booking availability and booking.
  - Merchant tools (overview, queue, sales report, sold-out) unlock with a personal access token (`bf_pat_…`) and obey the token owner's RBAC.
  - Discovery docs: `public/llms.txt` and `public/openapi.json`.

## 8. RBAC

Roles: owner, admin, branch_manager, cashier, waiter, kitchen, marketing. The permission matrix lives in `src/shared/rbac.ts`.

- **Tenant-wide roles** (owner, admin, marketing) see every branch. That's the boss dashboard at `/m` and `/api/m/overview`. Other roles are scoped to their assigned branches.
- **No privilege escalation:** you can only grant roles in your `GRANTABLE` list, only for your own branches, and never to yourself.
- **Invitations** are single-use and bound to the invited email. Removing a staff member revokes access immediately.
- The console hides tools a role can't use, and the API enforces the same rules regardless.

## 9. QR ordering: static vs. dynamic

| Mode | How it works |
|---|---|
| **Static** | A printed QR per table (`/t/:token`). Scanning a seated table joins its cart. A free table either self-seats (if the branch allows it) or asks for staff |
| **Dynamic** | The host prints or shows a QR per seating. It's a signed session token that dies when the seating closes, so no one orders to a table from home |

The branch chooses `static`, `dynamic` or `both`.

## 10. Modules

These can be switched on or off per branch:

- menu display
- queue preorder
- table QR ordering
- bookings
- loyalty
- e-receipts
- AI assistant

## 11. Testing and evidence

| Suite | What | Count |
|---|---|---|
| `cargo test` | Money and rounding, equal split, candidates (single, merge, split), strategies, fairness, ETA simulation, turn model | 15 |
| `vitest` | Menu and floor parsers, the TS facade over the WASM core | 12 |
| Playwright `api` | Queue, seating/merge/split/transfer, shared cart, POS, RBAC, loyalty/e-receipts/campaigns/push, bookings, AI/onboarding/MCP | 47 |
| Playwright `ui` | Guest journey with two phones sharing a cart live, directory, assistant chat, merchant sign-up + AI onboarding, boss dashboard → host → KDS → POS, static QR, receipt page, cashier's role-limited console | 8 |
| Playwright `load` | 300 simultaneous queue joins (gap-free, duplicate-free); runs alone after the functional projects | 1 |

E2E runs against a **production build** (`vite build` + `vite preview` on workerd) with a fresh D1, real Better Auth sessions, real VAPID-signed pushes to a dev sink, and the real queue consumer.

**Known local-only flakiness.** The emulator is one workerd process over one SQLite file. Under bursts it occasionally drops a connection (`read ECONNRESET` between the preview proxy and workerd) or reports `SQLITE_BUSY`; neither is app code. The suite retries a test once, and Playwright reports any retried test as *flaky* rather than hiding it.

Two real defects surfaced this way and are fixed:
- **Unread request bodies.** A POST refused before its body was read (for example a `403`) left a poisoned pooled connection for the next request. The `api()` wrapper now always drains the request body.
- **Directory search.** The query applied its `LIMIT` before the search filter, so a match could be cut off. Filtering now happens in SQL.

The surge test retries like a real phone would; because joins are idempotent per device, a retry never creates a second ticket.
