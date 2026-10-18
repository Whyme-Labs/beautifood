// Beautifood D1 schema.
//
// `events` is the append-only log (source of truth, audit, sync cursor).
// Every other table is a projection updated in the same all-or-nothing batch
// as the event that changes it. Concurrency control:
//   - UNIQUE(stream, version) on events = "append only if still at version N"
//   - UNIQUE(msg_id)                    = idempotent retries
//   - _assert CHECK(ok = 1)             = abort a batch when a precondition fails
// Times are epoch milliseconds; money is integer minor units.

import { sql } from "void/db";
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "void/schema-d1";

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    branchId: text("branch_id"),
    stream: text("stream").notNull(),
    version: integer("version"),
    type: text("type").notNull(),
    data: text("data").notNull().default("{}"),
    actor: text("actor"),
    msgId: text("msg_id"),
    at: integer("at").notNull(),
  },
  (t) => [
    uniqueIndex("events_stream_version").on(t.stream, t.version),
    uniqueIndex("events_msg_id").on(t.msgId),
    index("events_branch_id").on(t.branchId, t.id),
    index("events_stream_id").on(t.stream, t.id),
  ],
);

export const asserts = sqliteTable("_assert", { ok: integer("ok").notNull() }, (t) => [check("assert_ok", sql`${t.ok} = 1`)]);

// ── platform ────────────────────────────────────────────────────────────────

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  cuisine: text("cuisine").notNull().default(""),
  story: text("story").notNull().default(""),
  currency: text("currency").notNull().default("MYR"),
  timezone: text("timezone").notNull().default("Asia/Kuala_Lumpur"),
  loyalty: text("loyalty").notNull().default("{}"),
  onboarding: text("onboarding").notNull().default("{}"),
  /** Language the menu is written in; other languages live in each item's translations. */
  menuLanguage: text("menu_language").notNull().default("en"),
  /** Restaurant story etc. per language: {"zh":{"story":"…","description":"…"}} */
  translations: text("translations").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    config: text("config").notNull().default("{}"),
    turnModel: text("turn_model").notNull().default("{}"),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("branches_tenant_slug").on(t.tenantId, t.slug)],
);

/** Staff membership of a Better Auth user in a tenant, with RBAC role and branch scope. */
export const staff = sqliteTable(
  "staff",
  {
    userId: text("user_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    branchIds: text("branch_ids").notNull().default("[]"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tenantId] }), index("staff_tenant").on(t.tenantId)],
);

/** Personal access tokens for merchant AI agents (MCP). Only the hash is stored. */
export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});

// ── floor & queue ───────────────────────────────────────────────────────────

export const floorTables = sqliteTable(
  "floor_tables",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").notNull(),
    label: text("label").notNull(),
    zone: text("zone").notNull().default("Main"),
    seatsMin: integer("seats_min").notNull(),
    seatsMax: integer("seats_max").notNull(),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    mergeGroup: text("merge_group"),
    splitConfig: text("split_config"),
    parentId: text("parent_id"),
    status: text("status").notNull().default("free"),
    seatingId: text("seating_id"),
    staticToken: text("static_token").notNull().unique(),
    active: integer("active").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    version: integer("version").notNull().default(0),
  },
  (t) => [index("floor_tables_branch").on(t.branchId), uniqueIndex("floor_tables_branch_label").on(t.branchId, t.label)],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").notNull(),
    day: text("day").notNull(),
    category: text("category").notNull(),
    seq: integer("seq").notNull(),
    number: text("number").notNull(),
    partySize: integer("party_size").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    locale: text("locale"),
    memberId: text("member_id"),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    calledAt: integer("called_at"),
    seatedAt: integer("seated_at"),
    endedAt: integer("ended_at"),
    skips: integer("skips").notNull().default(0),
    priority: integer("priority").notNull().default(0),
    preferences: text("preferences").notNull().default("[]"),
    source: text("source").notNull().default("web"),
    deviceId: text("device_id"),
    seatingId: text("seating_id"),
    heldTableIds: text("held_table_ids"),
    sessionId: text("session_id"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("tickets_number").on(t.branchId, t.day, t.category, t.seq),
    index("tickets_branch_status").on(t.branchId, t.status),
    index("tickets_device").on(t.branchId, t.deviceId, t.status),
  ],
);

export const seatings = sqliteTable(
  "seatings",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").notNull(),
    tableIds: text("table_ids").notNull(),
    partySize: integer("party_size").notNull(),
    ticketId: text("ticket_id"),
    bookingId: text("booking_id"),
    sessionId: text("session_id").notNull(),
    orderId: text("order_id"),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    status: text("status").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [index("seatings_branch_status").on(t.branchId, t.status)],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    locale: text("locale"),
    partySize: integer("party_size").notNull(),
    slotStart: integer("slot_start").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    status: text("status").notNull(),
    tableIds: text("table_ids").notNull().default("[]"),
    notes: text("notes").notNull().default(""),
    memberId: text("member_id"),
    sessionId: text("session_id"),
    seatingId: text("seating_id"),
    createdAt: integer("created_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [index("bookings_branch_slot").on(t.branchId, t.slotStart)],
);

export const turnObservations = sqliteTable("turn_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branchId: text("branch_id").notNull(),
  partySize: integer("party_size").notNull(),
  startedAt: integer("started_at").notNull(),
  minutes: real("minutes").notNull(),
});

// ── carts & orders ──────────────────────────────────────────────────────────

/** A cart session: a table seating, a queue ticket's preorder, a booking preorder or takeaway. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").notNull(),
  tenantId: text("tenant_id").notNull(),
  kind: text("kind").notNull(),
  refId: text("ref_id"),
  status: text("status").notNull().default("open"),
  version: integer("version").notNull().default(0),
  submitSeq: integer("submit_seq").notNull().default(0),
  orderId: text("order_id"),
  createdAt: integer("created_at").notNull(),
});

/** Each diner owns their own lines: concurrent edits by different people never collide. */
export const cartLines = sqliteTable(
  "cart_lines",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    participantId: text("participant_id").notNull(),
    participantName: text("participant_name").notNull(),
    itemId: text("item_id").notNull(),
    name: text("name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
    modifiers: text("modifiers").notNull().default("[]"),
    notes: text("notes").notNull().default(""),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("cart_lines_session").on(t.sessionId)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    number: text("number").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    seatingId: text("seating_id"),
    ticketId: text("ticket_id"),
    bookingId: text("booking_id"),
    sessionId: text("session_id"),
    parentOrderId: text("parent_order_id"),
    email: text("email"),
    memberId: text("member_id"),
    discount: text("discount"),
    subtotal: integer("subtotal").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    serviceCharge: integer("service_charge").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    rounding: integer("rounding").notNull().default(0),
    total: integer("total").notNull().default(0),
    paid: integer("paid").notNull().default(0),
    refunded: integer("refunded").notNull().default(0),
    covers: integer("covers").notNull().default(0),
    receiptToken: text("receipt_token"),
    createdAt: integer("created_at").notNull(),
    closedAt: integer("closed_at"),
    day: text("day").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [index("orders_branch_status").on(t.branchId, t.status), index("orders_branch_day").on(t.branchId, t.day), index("orders_tenant_day").on(t.tenantId, t.day)],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    branchId: text("branch_id").notNull(),
    round: integer("round").notNull(),
    itemId: text("item_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default(""),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
    modifiers: text("modifiers").notNull().default("[]"),
    notes: text("notes").notNull().default(""),
    addedBy: text("added_by").notNull().default(""),
    status: text("status").notNull(),
    station: text("station").notNull().default("kitchen"),
    createdAt: integer("created_at").notNull(),
    firedAt: integer("fired_at"),
    readyAt: integer("ready_at"),
    voidReason: text("void_reason"),
  },
  (t) => [index("order_items_order").on(t.orderId), index("order_items_kds").on(t.branchId, t.status)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    branchId: text("branch_id").notNull(),
    method: text("method").notNull(),
    amount: integer("amount").notNull(),
    tendered: integer("tendered"),
    change: integer("change").notNull().default(0),
    ref: text("ref"),
    splitLabel: text("split_label"),
    status: text("status").notNull().default("captured"),
    refunded: integer("refunded").notNull().default(0),
    shiftId: text("shift_id"),
    createdAt: integer("created_at").notNull(),
    day: text("day").notNull(),
  },
  (t) => [index("payments_order").on(t.orderId), index("payments_branch_day").on(t.branchId, t.day)],
);

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  openedAt: integer("opened_at").notNull(),
  closedAt: integer("closed_at"),
  openingFloat: integer("opening_float").notNull(),
  closingCount: integer("closing_count"),
  expectedCash: integer("expected_cash"),
});

// ── menu ────────────────────────────────────────────────────────────────────

export const menuCategories = sqliteTable("menu_categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  /** {"zh":{"name":"…"}} */
  translations: text("translations").notNull().default("{}"),
});

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    categoryId: text("category_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(),
    imageUrl: text("image_url"),
    allergens: text("allergens").notNull().default("[]"),
    dietary: text("dietary").notNull().default("[]"),
    spiceLevel: integer("spice_level").notNull().default(0),
    story: text("story").notNull().default(""),
    isSignature: integer("is_signature").notNull().default(0),
    tags: text("tags").notNull().default("[]"),
    station: text("station").notNull().default("kitchen"),
    modifiers: text("modifiers").notNull().default("[]"),
    active: integer("active").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    /** {"zh":{"name":"…","description":"…","story":"…","modifiers":{"Temperature":{"name":"温度","options":{"Hot":"热"}}}}} */
    translations: text("translations").notNull().default("{}"),
  },
  (t) => [index("menu_items_tenant").on(t.tenantId)],
);

export const itemAvailability = sqliteTable(
  "item_availability",
  {
    branchId: text("branch_id").notNull(),
    itemId: text("item_id").notNull(),
    soldOut: integer("sold_out").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.branchId, t.itemId] })],
);

// ── loyalty, promotions, campaigns ─────────────────────────────────────────

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    phone: text("phone"),
    points: integer("points").notNull().default(0),
    lifetimePoints: integer("lifetime_points").notNull().default(0),
    tier: text("tier").notNull().default("Bronze"),
    optIn: integer("opt_in").notNull().default(1),
    visits: integer("visits").notNull().default(0),
    totalSpend: integer("total_spend").notNull().default(0),
    lastVisitAt: integer("last_visit_at"),
    createdAt: integer("created_at").notNull(),
    version: integer("version").notNull().default(0),
  },
  (t) => [uniqueIndex("members_tenant_email").on(t.tenantId, t.email), check("members_points_non_negative", sql`${t.points} >= 0`)],
);

export const pointsLedger = sqliteTable(
  "points_ledger",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    delta: integer("delta").notNull(),
    kind: text("kind").notNull(),
    ref: text("ref").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("points_ledger_once").on(t.memberId, t.kind, t.ref)],
);

export const promoCodes = sqliteTable(
  "promo_codes",
  {
    tenantId: text("tenant_id").notNull(),
    code: text("code").notNull(),
    kind: text("kind").notNull(),
    value: real("value").notNull(),
    minSpend: integer("min_spend").notNull().default(0),
    maxUses: integer("max_uses"),
    used: integer("used").notNull().default(0),
    validFrom: integer("valid_from"),
    validTo: integer("valid_to"),
    active: integer("active").notNull().default(1),
    description: text("description").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.code] })],
);

export const promoRedemptions = sqliteTable(
  "promo_redemptions",
  {
    tenantId: text("tenant_id").notNull(),
    code: text("code").notNull(),
    orderId: text("order_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId] })],
);

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  segment: text("segment").notNull().default("{}"),
  promoCode: text("promo_code"),
  status: text("status").notNull().default("draft"),
  recipients: integer("recipients").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  sentAt: integer("sent_at"),
});

// ── messaging ───────────────────────────────────────────────────────────────

/** Every outgoing email is recorded here first (idempotent per kind/ref/recipient), then delivered. */
export const emails = sqliteTable(
  "emails",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    kind: text("kind").notNull(),
    ref: text("ref").notNull(),
    headers: text("headers"),
    fromName: text("from_name"),
    // queued → sent | logged (no binding outside production) | failed (retried) | rejected | unknown
    status: text("status").notNull().default("queued"),
    error: text("error"),
    messageId: text("message_id"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at"),
    createdAt: integer("created_at").notNull(),
    sentAt: integer("sent_at"),
  },
  (t) => [index("emails_retry").on(t.status, t.lastAttemptAt), uniqueIndex("emails_once").on(t.kind, t.ref, t.toEmail), index("emails_to").on(t.toEmail)],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    topic: text("topic").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("push_endpoint_topic").on(t.endpoint, t.topic), index("push_topic").on(t.topic)],
);

export const otpCodes = sqliteTable("otp_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const receipts = sqliteTable("receipts", {
  token: text("token").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  tenantId: text("tenant_id").notNull(),
  branchId: text("branch_id").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Cursor of each event consumer (side-effect pipeline). Handlers are idempotent, so re-processing is safe. */
export const consumerCursors = sqliteTable("consumer_cursors", {
  name: text("name").primaryKey(),
  lastId: integer("last_id").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

/** Staff invitations: the invitee signs up (or in) and accepts with the code. */
export const staffInvites = sqliteTable("staff_invites", {
  code: text("code").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  branchIds: text("branch_ids").notNull().default("[]"),
  invitedBy: text("invited_by").notNull(),
  createdAt: integer("created_at").notNull(),
  acceptedAt: integer("accepted_at"),
});
