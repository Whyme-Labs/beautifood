import type { CartModifier, Totals } from "./types";

/** Round half away from zero to an integer number of minor units. */
export function roundMinor(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

export function lineTotal(unitPrice: number, modifiers: CartModifier[], qty: number): number {
  const mods = modifiers.reduce((s, m) => s + m.price, 0);
  return (unitPrice + mods) * qty;
}

export interface PricingInput {
  lines: { unitPrice: number; modifiers: CartModifier[]; qty: number }[];
  discount: { kind: "percent" | "amount"; value: number } | null;
  serviceChargePct: number; // 0 for takeaway
  taxPct: number;
  taxInclusive: boolean;
  cashRounding: number; // minor units; 1 = none
}

/**
 * Bill computation. Order of operations (Malaysian-style F&B, common elsewhere):
 * subtotal → discount → service charge on discounted subtotal → tax on (discounted + service)
 * → round the grand total to the cash rounding unit.
 */
export function computeTotals(p: PricingInput): Totals {
  const subtotal = p.lines.reduce((s, l) => s + lineTotal(l.unitPrice, l.modifiers, l.qty), 0);
  let discount = 0;
  if (p.discount) {
    discount =
      p.discount.kind === "percent"
        ? roundMinor((subtotal * Math.min(Math.max(p.discount.value, 0), 100)) / 100)
        : Math.min(Math.max(roundMinor(p.discount.value), 0), subtotal);
  }
  const net = subtotal - discount;
  const serviceCharge = roundMinor((net * p.serviceChargePct) / 100);
  let tax: number;
  if (p.taxInclusive) {
    // tax already embedded in prices: report the embedded portion, it doesn't add to the total
    const gross = net + serviceCharge;
    tax = roundMinor(gross - gross / (1 + p.taxPct / 100));
  } else {
    tax = roundMinor(((net + serviceCharge) * p.taxPct) / 100);
  }
  const unrounded = net + serviceCharge + (p.taxInclusive ? 0 : tax);
  const unit = Math.max(1, Math.floor(p.cashRounding || 1));
  const total = Math.round(unrounded / unit) * unit;
  return { subtotal, discount, serviceCharge, tax, rounding: total - unrounded, total };
}

/** Split an amount into n parts that sum exactly to the amount (first parts absorb the remainder). */
export function splitEqually(amount: number, n: number): number[] {
  if (n < 1 || !Number.isInteger(n)) throw new Error("n must be a positive integer");
  const base = Math.floor(amount / n);
  const rem = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function formatMoney(minor: number, currency = "MYR"): string {
  const sym: Record<string, string> = { MYR: "RM", USD: "$", SGD: "S$", EUR: "€", GBP: "£" };
  const s = (Math.abs(minor) / 100).toFixed(2);
  return `${minor < 0 ? "-" : ""}${sym[currency] ?? currency + " "}${s}`;
}
