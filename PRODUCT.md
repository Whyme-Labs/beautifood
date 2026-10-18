# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Guests on their phones**, standing outside a busy restaurant or seated at a table: joining the walk-in queue by party size, watching their number, preordering, ordering together from one shared table cart, paying, collecting points, booking ahead. Often in a hurry, one-handed, in sunlight or a dim dining room, sometimes in Chinese.
- **Restaurant staff on tablets and counter screens**: host stand (queue and seating), cashier (POS, payments, splits, refunds, shifts), kitchen (KDS), managers and owners (multi-branch boss dashboard, reports, menu, staff, loyalty and promotions). Fast, repetitive, interrupted work during a lunch rush.

## Product Purpose

Beautifood runs the front of house for multi-branch F&B businesses: queue, seat, order, cook, pay and bring guests back. It survives lunch-rush surges without losing a ticket or double-charging a bill. Success is shorter perceived waits for guests and fewer mistakes and taps for staff.

## Positioning

- One system covers the walk-in queue (with merge and split table assignment and fair ETAs), the shared table cart, POS, KDS, bookings and loyalty, across branches.
- AI is part of the product: guests ask the menu assistant what to eat or what contains peanuts; merchants paste a menu to get a working setup; guests' own AI agents can queue and book through MCP.

## Operating Context

- Malaysian hawker and casual-dining restaurants (prices in RM, Penang hawker classics in the demo).
- Peak service with phones in one hand.
- Table QR codes, both static and dynamic.
- Kitchen tickets read from a distance.
- Host tablets at the door.
- Customers and staff may read English or Chinese.

## Capabilities and Constraints

- Every feature is built and covered by end-to-end tests (see README and docs/ARCHITECTURE.md).
- **UI must be localisable:** English and Simplified Chinese to begin with, easy to add more. Menu content is multilingual, with AI translation.
- **Stack:** React pages on Cloudflare Workers (Void); no CSS framework; styles live in `src/ui/styles.css`.
- **Must keep:** every `data-testid` and accessible name used by the E2E suite.

## Brand Commitments

- **Name:** Beautifood.
- **Colour:** yellow is the brand colour (user requirement).
- **Personality:** warm hawker energy. Friendly, local, a little playful, like a busy kopitiam with good signage. Never corporate or sterile.

## Evidence on Hand

- A demo restaurant with a real Penang-hawker menu, two branches (KLCC, Bangsar), tables and members (`/api/dev/seed`).
- There are no testimonials, customer logos or usage numbers. Do not invent any.

## Product Principles

1. **One-handed and glanceable for guests.** The queue number and "what happens next" always win the screen.
2. **Fewer taps for staff in a rush.** Dense but calm, with clear state colours and big targets on tablets.
3. **Honest about food safety.** Allergen information always carries the "confirm with staff" note.
4. **Shared, not siloed.** Everyone at a table sees the same cart and bill live.
5. **Local by default.** Language, currency and tone fit the restaurant and its guests.

## Accessibility & Inclusion

- WCAG AA contrast. Yellow must never carry text on white; use dark ink on yellow.
- Large touch targets for guests and kitchen.
- Respect reduced motion.
- Chinese typography must render well (CJK font fallback, no tight tracking on CJK).
