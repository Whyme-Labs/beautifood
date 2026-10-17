# Beautifood — Architecture

Beautifood is a multi-tenant, multi-branch restaurant platform. It covers queueing, table management, ordering, POS, loyalty, bookings and AI.
This document records the stack decision and the design behind the hard parts: ACID, surge traffic, concurrent orders, shared table carts, and table merge and split.

## 1. Stack decision: serverless, on Cloudflare

| Concern | Rust server + Postgres (PlanetScale) | Cloudflare Workers + Durable Objects (chosen) |
|---|---|---|
| HA | You run ≥2 instances per region, a load balancer, health checks, rolling deploys, and DB failover | Workers run in 300+ PoPs. A Durable Object (DO) is re-created automatically on failure, and its storage is replicated before a write is acknowledged |
| Surge (lunch rush, viral promo) | Autoscaling lag, plus the Postgres connection ceiling (needs PgBouncer or Hyperdrive) | The stateless edge absorbs the spike. Each branch's writes go to its own actor, so there's no shared hot DB |
| Hot-row contention (one table's cart, one branch's queue counter) | Row locks or `SERIALIZABLE` retries under contention | Single-threaded actor per branch and per session, so no locks and no retries |
| Realtime (cart sync, "now calling" boards) | Sticky WebSockets plus Redis pub/sub fan-out across nodes | The DO *is* the room. WebSocket Hibernation API, about 32k sockets per object at near-zero idle cost |
| Ops burden | Containers, migrations, pool tuning, Redis, observability | `wrangler deploy` |
| Cost at idle (most restaurants are idle 16h/day) | Always-on instances | Pay per request |

**The domain is naturally sharded.** Almost every strongly consistent decision is scoped to one branch: who gets table 7, what the next queue number is, whether two people can both pay the last RM10. The same goes for one dining session: whose cart edit wins. Durable Objects give exactly that: a single-writer, transactional SQLite database co-located with the compute that owns that shard. Cross-branch work like reporting, the boss dashboard and loyalty is either read-mostly or commutative, so it doesn't need a global lock.

Postgres/PlanetScale is a sensible later **analytics sink** (via Hyperdrive) if the D1 reporting store outgrows itself. It isn't on the transactional path.

### Components

```
                ┌────────────── Cloudflare edge (stateless Worker, Hono) ──────────────┐
 customers ───► │ /api/public  /api/m (staff, JWT+RBAC)  /mcp (agents)  static SPA      │
 staff POS ───► │ validation · authz · rate-limit · edge cache for public reads         │
 AI agents ───► └──────┬───────────────┬───────────────────┬──────────────┬────────────┘
                       │ RPC           │ RPC               │ RPC          │ SQL
               ┌───────▼──────┐ ┌──────▼───────┐  ┌────────▼──────┐  ┌────▼─────┐
               │  TenantDO    │ │  BranchDO    │  │  SessionDO    │  │   D1     │
               │ (1 / brand)  │ │ (1 / branch) │◄─┤ (1 / dining   │  │ platform │
               │ menu catalog │ │ queue,tables │  │  session/cart)│  │ users,   │
               │ members+pts  │ │ seatings,    │  │ shared cart,  │  │ RBAC,    │
               │ campaigns    │ │ orders, KDS, │  │ WebSockets    │  │ facts,   │
               │ promo codes  │ │ payments,    │  └───────────────┘  │ receipts,│
               └──────┬───────┘ │ shifts,      │                     │ outbox   │
                      │         │ bookings,    │  transactional      └────▲─────┘
                      │         │ ML turn model│  outbox ──► Queue ───────┤
                      │         └──────────────┘          (EVENTS)  consumer: facts,
                      └──────────────────────────────────────────── loyalty accrual,
                                                                    e-receipts, broadcasts
               KV: public snapshots (queue status, menus)   R2: images (optional)
```

- **D1 (platform DB)**: tenants, branch directory, staff users and role assignments (RBAC), customers and OTPs, reporting fact tables, receipts, and the email outbox.
- **TenantDO**: menu catalog with versioned publish, loyalty members and the points ledger (with holds), campaigns, and promo codes with atomic usage counting.
- **BranchDO**: everything operational for one branch, in one SQLite DB.
- **SessionDO**: the live shared cart for one dining session (a table seating, a queue ticket's preorder, a booking preorder, or takeaway).
- **Queue `EVENTS`**: fed by each DO's transactional outbox. It handles reporting facts, loyalty accrual, e-receipts, campaign fan-out and notifications.
- **KV**: last-known public snapshots, so read surges never touch the actors.

## 2. ACID design

1. **Atomicity and isolation inside a shard.** Every DO mutation runs inside `ctx.storage.transactionSync(...)`. Business invariants are checked and written in one synchronous block, and a DO executes one such block at a time. Examples: "table is free → seat party", "paid_total ≤ total", "queue number = last+1". That gives serializable isolation with no locks. Any exception rolls the whole block back.
2. **Durability.** A DO's storage write is acknowledged only after it's replicated. The output gate guarantees no response or WebSocket message leaves the object before its writes are durable.
3. **Idempotency.** Every externally retryable mutation carries an `idempotency_key`: submit-round, payments, refunds, points earn and redeem, emails. The key and its result are stored in the same transaction, so a retry returns the original result.
4. **Cross-shard work uses sagas and outboxes, not distributed transactions.**
   - *Transactional outbox:* the event row (`order.paid`, `ticket.called`, …) is inserted in the same transaction as the state change. A post-commit flush and an alarm-driven retry deliver it to the Queue. Consumers are idempotent, so it's at-least-once delivery with effectively-once effects.
   - *Paying with loyalty points* spans TenantDO and BranchDO, as a reserve, apply, then commit-or-release saga:
     `TenantDO.holdPoints` (balance check plus hold, atomic) → `BranchDO.addPayment(method=points, ref=hold)` → `TenantDO.commitHold`. If the payment fails, the hold is released. An alarm expires orphaned holds, so points are never lost or double-spent.
   - *Submitting a cart* spans SessionDO and BranchDO. The submit carries `idemKey = sessionId:submitSeq`. The BranchDO is the authority and de-duplicates. The SessionDO only removes the exact line ids it submitted, so lines added mid-flight survive.

## 3. Surviving surge traffic

- **Read surge** (everyone refreshing "how long is the queue?"):
  - The BranchDO publishes a public snapshot to KV, throttled to one write every 2 s.
  - Public reads hit the Cache API and then KV.
  - Live screens subscribe to a hibernating WebSocket and get pushes instead of polling.
- **Write surge** (500 people scan the queue QR at a viral opening):
  - Requests fan out across the stateless edge. Writes then serialize per branch in the actor, so no lock storms.
  - A queue-join is about 1 small SQLite insert, so one actor sustains hundreds to thousands of joins per second.
  - Per-branch admission control applies: `max_waiting` and a per-device token bucket. Excess load gets a clean `429`/`queue_full` rather than a meltdown.
  - The test suite fires 300 concurrent joins at one branch and asserts gap-free, duplicate-free numbering. See `test/surge.test.ts`.
- **Slow work is never on the request path.** Emails, broadcasts, reporting facts and loyalty accrual all go through the Queue, which has batching, retries and a DLQ.
- **Isolation of failures.** One noisy branch can't slow another, because each has its own actor.

## 4. Simultaneous orders and the shared table cart

The **SessionDO** is the single source of truth for one table's cart. Every diner's phone opens a WebSocket to it.

- Ops: `add`, `set_qty`, `remove`, `note`, `submit`. Each carries a client `opId`, and duplicate opIds are ignored (safe to resend after reconnect). Each applied op bumps a monotonically increasing `version` and broadcasts the new state to every participant.
- Lines are per-diner (`addedBy`). Two people adding the same dish create two lines, so nobody silently overwrites anyone else. `set_qty` on a line is last-writer-wins, decided by server order. Removing an already-removed line is a no-op.
- **Submit uses optimistic concurrency.** `submit {expectedVersion}`:
  - If someone changed the cart since the submitter last looked, the submit is rejected with `409 version_conflict` and the fresh cart. The UI shows "Alice just added Laksa — review and send". So nobody sends an order they haven't seen.
  - Two people pressing *Send* at the same instant: the actor processes one first. The second sees a new version and an empty cart, and gets a friendly "already sent by Bob".
- Each submit becomes a **round** on the seating's single bill. Many rounds can go to the kitchen over the course of the meal.
- HTTP fallbacks exist for every op, for clients without WebSockets and for AI agents.

## 5. Tables: merge, split, transfer

- **Tables are merchant-defined**: label, zone, seats (min and max), position, `merge_group` (which tables may be pushed together), and an optional `split_config`. For example, a 10-top that can become 6 + 4.
- **Seating** (= dining session) owns `table_ids[]`. So a *merged* party is just a seating with several tables. Seat, merge, unmerge and transfer are single-transaction updates of seating and table status.
- **Split** activates child tables (`T10a`, `T10b`) and blocks the parent. **Unsplit** is only allowed when all children are free.
- **Bills:**
  - Merging seatings merges their bills, moving items.
  - Split-bill supports *equal N-way*, *by item* (each item moved to a sub-check), and *custom amounts*. Each is recorded as payments with a `split_label`, so the bill closes only when the sum is covered.

## 6. Queue and table-assignment intelligence

- **Party-size categories are configurable** per branch, e.g. `S 1–2 (A)`, `M 3–4 (B)`, `L 5–8 (C)`, `XL 9+ (D)`. Each has its own prefix and numbering.
- **Strategies** (per branch, switchable live):
  - `fifo`: strict arrival order.
  - `category_fifo`: FIFO within each size class.
  - `best_fit`: minimise empty seats, with bounded skipping.
  - `smart` (default): a score-based matcher. Score = aged wait time (super-linear, for fairness) − wasted seats − merge/split penalty − upcoming-booking conflict + priority. Candidates include merged-table combos within a merge group and split children. A `max_skips` fairness bound means no ticket can be overtaken forever.
- **ML turn-time model:**
  - An online model learns dining duration per (party size, daypart, weekday/weekend) from every closed seating, as an EWMA with Bayesian priors.
  - Wait-time ETAs come from a discrete simulation: current seatings' predicted end times are replayed against the waiting line using the active strategy.
  - Suggestions come with human-readable reasons. The merchant always confirms; the AI suggests and staff decide.

## 7. AI for customers, merchants and their agents

| Audience | Without their own AI | With their own AI agent |
|---|---|---|
| Customer | In-app assistant: "what should I eat?", signatures, allergens, dish stories, budget and dietary filters. Answers are grounded in structured menu data, and allergen answers come from data, never from generation | `/mcp` (Model Context Protocol, streamable HTTP), `/llms.txt`, `/api/openapi.json`, schema.org JSON-LD on menu pages. Agents can browse menus, check queues, join a queue, preorder and book |
| Merchant | Onboarding copilot: paste a menu as text, which becomes structured items with prices, inferred allergens, drafted stories and suggested signatures. It also turns a description of the floor into a tables layout, and recommends categories and strategy. It explains assignment suggestions and gives daily insights | The same MCP endpoint with a staff token exposes merchant tools (queue state, suggestions, sales summary) |

The provider is pluggable. It uses Anthropic Claude when `ANTHROPIC_API_KEY` is set (tool-use loop over menu tools). Otherwise a deterministic local engine handles intent detection and retrieval. Tests run fully offline.

## 8. RBAC

| Role | Scope | Highlights |
|---|---|---|
| owner (boss) | all branches | everything, cross-branch dashboard |
| admin | all branches | everything but tenant deletion |
| branch_manager | assigned branches | tables, staff, reports, refunds |
| cashier | assigned branches | queue, orders, payments, shifts |
| waiter | assigned branches | queue, seating, orders |
| kitchen | assigned branches | KDS only |
| marketing | all branches | members, campaigns, reports (read) |

Permissions are checked in the Worker (`src/shared/rbac.ts`) against JWT claims `{tid, role, branches}`. Every branch-scoped route also checks the branch is in scope.

## 9. QR ordering: static vs. dynamic

- **Static QR** (printed once per table): `/t/{tableToken}`.
  - If the table has an open seating, scanning joins it.
  - Otherwise, depending on branch policy, it either self-seats (walk-in) or shows "please see the host".
  - It's cheap to deploy. The risk is that people who've left can still scan, which is mitigated because the seating closes on payment.
- **Dynamic QR**: generated per seating, `/s/{sessionId}?k={token}`.
  - Shown on the host tablet, printed on the seating slip, or pushed automatically to the queue ticket holder's phone when they're seated.
  - It expires when the bill closes, so there's no remote ordering.
- **Mode** per branch is `static`, `dynamic` or `both`.

## 10. Module toggles

Every module can be switched off per tenant or branch: menu display, queue preorder, table QR ordering, bookings, loyalty, e-receipts, campaigns, AI assistant, kiosk.

## 11. Testing strategy

- **Unit**: money math, RBAC matrix, assignment engine, turn-time model, menu parser and allergen inference.
- **Integration** (Vitest inside workerd/Miniflare with real DOs, D1, KV and Queues): ACID and idempotency, concurrent cart submits, surge numbering, points saga rollback, merge/split, split bill, RBAC denials.
- **E2E** (Playwright against `wrangler dev`): the full customer, merchant and boss journeys, including two browsers editing one table cart in real time.
