// Domain types shared by the Worker, Durable Objects and the web app.
// Money is always integer minor units (sen / cents).

export type Role = "owner" | "admin" | "branch_manager" | "cashier" | "waiter" | "kitchen" | "marketing";

export interface StaffClaims {
  kind: "staff";
  sub: string; // user id
  tid: string; // tenant id
  role: Role;
  branches: string[]; // ["*"] = all
  name: string;
  exp: number;
}

export interface CustomerClaims {
  kind: "customer";
  sub: string; // customer id
  email: string;
  exp: number;
}

export interface PartyCategory {
  code: string; // "S"
  label: string; // "Small"
  prefix: string; // "A"
  min: number;
  max: number;
}

export type Strategy = "fifo" | "category_fifo" | "best_fit" | "smart";
export type QrMode = "static" | "dynamic" | "both";

export interface BranchConfig {
  categories: PartyCategory[];
  strategy: Strategy;
  weights: { wait: number; waste: number; merge: number; booking: number; priority: number };
  maxSkips: number;
  qrMode: QrMode;
  staticQrSelfSeat: boolean;
  serviceChargePct: number; // e.g. 10
  taxPct: number; // e.g. 6
  taxInclusive: boolean;
  cashRounding: number; // minor units, e.g. 5 => round to 0.05
  maxWaiting: number; // admission control
  holdCalledMinutes: number; // how long a called ticket is held before no-show
  autoCloseOnPay: boolean;
  requireStaffConfirmFirstRound: boolean;
  preorderFire: "on_seat" | "on_call";
  booking: { enabled: boolean; slotMinutes: number; durationMinutes: number; openHour: number; closeHour: number; leadMinutes: number };
  modules: Modules;
  currency: string;
  timezone: string;
}

export interface Modules {
  menuDisplay: boolean;
  queuePreorder: boolean;
  tableQr: boolean;
  bookings: boolean;
  loyalty: boolean;
  eReceipt: boolean;
  campaigns: boolean;
  aiAssistant: boolean;
  kiosk: boolean;
}

export const DEFAULT_MODULES: Modules = {
  menuDisplay: true,
  queuePreorder: true,
  tableQr: true,
  bookings: true,
  loyalty: true,
  eReceipt: true,
  campaigns: true,
  aiAssistant: true,
  kiosk: true,
};

export const DEFAULT_CATEGORIES: PartyCategory[] = [
  { code: "S", label: "Small", prefix: "A", min: 1, max: 2 },
  { code: "M", label: "Medium", prefix: "B", min: 3, max: 4 },
  { code: "L", label: "Large", prefix: "C", min: 5, max: 8 },
  { code: "XL", label: "Group", prefix: "D", min: 9, max: 30 },
];

export const DEFAULT_BRANCH_CONFIG: BranchConfig = {
  categories: DEFAULT_CATEGORIES,
  strategy: "smart",
  weights: { wait: 1, waste: 0.6, merge: 1.5, booking: 3, priority: 5 },
  maxSkips: 3,
  qrMode: "both",
  staticQrSelfSeat: false,
  serviceChargePct: 10,
  taxPct: 6,
  taxInclusive: false,
  cashRounding: 5,
  maxWaiting: 500,
  holdCalledMinutes: 10,
  autoCloseOnPay: false,
  requireStaffConfirmFirstRound: false,
  preorderFire: "on_seat",
  booking: { enabled: true, slotMinutes: 30, durationMinutes: 90, openHour: 10, closeHour: 22, leadMinutes: 30 },
  modules: DEFAULT_MODULES,
  currency: "MYR",
  timezone: "Asia/Kuala_Lumpur",
};

export type TableStatus = "free" | "seated" | "dirty" | "reserved" | "blocked" | "split";

export interface Table {
  id: string;
  label: string;
  zone: string;
  seatsMin: number;
  seatsMax: number;
  x: number;
  y: number;
  mergeGroup: string | null;
  splitConfig: { suffix: string; seats: number }[] | null;
  parentId: string | null;
  status: TableStatus;
  staticToken: string;
  active: boolean;
  seatingId?: string | null;
}

export type TicketStatus = "waiting" | "called" | "seated" | "cancelled" | "no_show";

export interface QueueTicket {
  id: string;
  number: string;
  category: string;
  partySize: number;
  name: string;
  phone: string | null;
  email: string | null;
  customerId: string | null;
  status: TicketStatus;
  createdAt: number;
  calledAt: number | null;
  seatedAt: number | null;
  skips: number;
  priority: number;
  preferences: string[];
  source: string;
  seatingId: string | null;
  preorderOrderId: string | null;
  etaMinutes?: number | null;
  position?: number;
}

export interface Seating {
  id: string;
  tableIds: string[];
  partySize: number;
  ticketId: string | null;
  bookingId: string | null;
  token: string;
  startedAt: number;
  endedAt: number | null;
  status: "open" | "closed";
  orderId: string | null;
}

export interface ModifierOption {
  name: string;
  price: number;
}
export interface ModifierGroup {
  name: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

/** One language's version of a dish. Missing fields fall back to the original. */
export interface ItemTranslation {
  name?: string;
  description?: string;
  story?: string;
  /** Labels only: carts and orders always carry the original group/option names. */
  modifiers?: Record<string, { name?: string; options?: Record<string, string> }>;
  /** "ai" when machine-translated and not yet reviewed by the restaurant. */
  source?: "ai" | "manual" | "glossary";
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  allergens: string[];
  dietary: string[]; // vegetarian, vegan, halal, spicy, gluten_free...
  spiceLevel: number; // 0-3
  story: string;
  isSignature: boolean;
  tags: string[];
  station: string; // kitchen station: kitchen, bar, dessert
  modifiers: ModifierGroup[];
  active: boolean;
  sort: number;
  soldOut?: boolean;
  translations?: Record<string, ItemTranslation>;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  translations?: Record<string, { name?: string }>;
}

export interface Menu {
  /** Language the original names are written in. */
  language?: string;
  version: number;
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface CartModifier {
  group: string;
  option: string;
  price: number;
}

export interface CartLine {
  id: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  modifiers: CartModifier[];
  notes: string;
  addedBy: { pid: string; name: string };
  updatedAt: number;
}

export type OrderType = "dine_in" | "takeaway" | "queue_preorder" | "booking_preorder";
export type OrderStatus = "open" | "paid" | "void" | "refunded" | "partially_refunded";
export type ItemStatus = "held" | "pending" | "fired" | "preparing" | "ready" | "served" | "void";

export interface OrderItem {
  id: string;
  orderId: string;
  round: number;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  modifiers: CartModifier[];
  notes: string;
  addedBy: string;
  status: ItemStatus;
  station: string;
  createdAt: number;
  voidReason: string | null;
  splitLabel: string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  method: "cash" | "card" | "ewallet" | "points" | "voucher";
  amount: number;
  tendered: number | null;
  change: number;
  ref: string | null;
  splitLabel: string | null;
  status: "captured" | "refunded" | "partially_refunded";
  refunded: number;
  createdAt: number;
  shiftId: string | null;
}

export interface Totals {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  rounding: number;
  total: number;
}

export interface Order extends Totals {
  id: string;
  number: string;
  type: OrderType;
  status: OrderStatus;
  seatingId: string | null;
  ticketId: string | null;
  bookingId: string | null;
  sessionId: string | null;
  customerId: string | null;
  memberId: string | null;
  email: string | null;
  discountSpec: { kind: "percent" | "amount"; value: number; reason: string; code?: string } | null;
  paidTotal: number;
  refundedTotal: number;
  createdAt: number;
  closedAt: number | null;
  tableLabels: string[];
  items: OrderItem[];
  payments: Payment[];
  receiptToken: string | null;
}

export interface Booking {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  slotStart: number;
  durationMinutes: number;
  status: "confirmed" | "checked_in" | "cancelled" | "no_show" | "completed";
  tableIds: string[];
  notes: string;
  customerId: string | null;
  preorderOrderId: string | null;
  token: string;
  createdAt: number;
}

export interface Suggestion {
  ticketId: string;
  ticketNumber: string;
  partySize: number;
  tableIds: string[];
  tableLabels: string[];
  action: "seat" | "merge_seat" | "split_seat";
  split?: { parentId: string; childSuffixes: string[] };
  score: number;
  reasons: string[];
}

export interface AppEvent {
  id: string;
  type: string;
  tenantId: string;
  branchId?: string;
  at: number;
  data: Record<string, unknown>;
}
