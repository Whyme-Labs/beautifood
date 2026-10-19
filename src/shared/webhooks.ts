// The public event catalogue: what a restaurant can subscribe a webhook (or its own AI agent's
// connector) to. Names match the event log; each delivery carries the event and the record it is
// about, so a receiver rarely needs to call back.

export const WEBHOOK_EVENTS = [
  { type: "queue.joined", group: "queue", about: "ticket" },
  { type: "queue.called", group: "queue", about: "ticket" },
  { type: "queue.seated", group: "queue", about: "ticket" },
  { type: "queue.cancelled", group: "queue", about: "ticket" },
  { type: "queue.no_show", group: "queue", about: "ticket" },
  { type: "booking.created", group: "bookings", about: "booking" },
  { type: "booking.checked_in", group: "bookings", about: "booking" },
  { type: "booking.cancelled", group: "bookings", about: "booking" },
  { type: "booking.no_show", group: "bookings", about: "booking" },
  { type: "order.round_added", group: "orders", about: "order" },
  { type: "kitchen.ready", group: "orders", about: "order" },
  { type: "order.paid", group: "orders", about: "order" },
  { type: "payment.captured", group: "payments", about: "order" },
  { type: "payment.refunded", group: "payments", about: "order" },
  { type: "shift.closed", group: "payments", about: "shift" },
  { type: "menu.sold_out", group: "menu", about: "item" },
  { type: "menu.back_in_stock", group: "menu", about: "item" },
  { type: "menu.item_saved", group: "menu", about: "item" },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number]["type"];
export const WEBHOOK_EVENT_TYPES = WEBHOOK_EVENTS.map((e) => e.type) as WebhookEventType[];
export const WEBHOOK_GROUPS = ["queue", "bookings", "orders", "payments", "menu"] as const;

/** The test event a merchant can send to check an endpoint. */
export const WEBHOOK_PING = "webhook.ping";

/** Header names on every delivery. */
export const WEBHOOK_HEADERS = {
  event: "x-beautifood-event",
  delivery: "x-beautifood-delivery",
  signature: "x-beautifood-signature",
} as const;

/** Is this event type one an endpoint subscribed to? `["*"]` subscribes to all of them. */
export const subscribes = (events: string[], type: string) => type === WEBHOOK_PING || events.includes("*") || events.includes(type);

/** Retry schedule after a failed attempt: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, then give up. */
export const RETRY_MINUTES = [1, 5, 30, 120, 360, 720];
