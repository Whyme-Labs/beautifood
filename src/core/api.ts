// Typed facade over the Rust/WASM core. The same compiled module runs on the
// server (authoritative) and in the browser (instant UI), so totals and seating
// suggestions are identical on both sides.
import type * as raw from "./wasm/bf_core.js";
import type { CartModifier, Strategy, Suggestion, Totals } from "../shared/types";

type Raw = Pick<typeof raw, "compute_totals" | "split_equally" | "suggest" | "estimate_waits" | "candidates_for" | "predict_turn" | "observe_turn" | "version">;

export interface PricingInput {
  lines: { unitPrice: number; qty: number; modifiers?: CartModifier[] }[];
  discount?: { kind: "percent" | "amount"; value: number } | null;
  serviceChargePct: number;
  taxPct: number;
  taxInclusive?: boolean;
  cashRounding?: number;
}

export interface EngineTable {
  id: string;
  label: string;
  seatsMin: number;
  seatsMax: number;
  mergeGroup?: string | null;
  splitConfig?: { suffix: string; seats: number }[] | null;
  parentId?: string | null;
  status: string;
}

export interface EngineTicket {
  id: string;
  number: string;
  category: string;
  partySize: number;
  createdAt: number;
  skips?: number;
  priority?: number;
}

export interface EngineInput {
  tables: EngineTable[];
  tickets: EngineTicket[];
  bookings?: { tableIds: string[]; slotStart: number }[];
  strategy: Strategy;
  weights?: { wait: number; waste: number; merge: number; booking: number; priority: number };
  maxSkips?: number;
  now: number;
  /** predicted turn minutes keyed by party size */
  turn?: Record<number, number>;
}

export type TurnModel = Record<string, { mean: number; n: number }>;

export class CoreError extends Error {}

function call<T>(fn: (s: string) => string, input: unknown): T {
  const out = JSON.parse(fn(JSON.stringify(input)));
  if (out && typeof out === "object" && !Array.isArray(out) && "error" in out && Object.keys(out).length === 1) throw new CoreError(String(out.error));
  return out as T;
}

export function makeCore(m: Raw) {
  return {
    version: () => m.version(),
    computeTotals: (p: PricingInput) => call<Totals>(m.compute_totals, { ...p, discount: p.discount ?? null, cashRounding: p.cashRounding ?? 1 }),
    splitEqually: (amount: number, n: number) => call<number[]>(m.split_equally, { amount, n }),
    suggest: (i: EngineInput) => call<Suggestion[]>(m.suggest, i),
    estimateWaits: (i: EngineInput, busy: { tableIds: string[]; freeAt: number }[]) => call<Record<string, number>>(m.estimate_waits, { ...i, busy }),
    candidatesFor: (partySize: number, tables: EngineTable[]) =>
      call<{ tableIds: string[]; labels: string[]; capacity: number; action: Suggestion["action"]; split?: Suggestion["split"] }[]>(m.candidates_for, { partySize, tables }),
    predictTurn: (model: TurnModel, party: number, hour: number, weekend: boolean) => call<number>(m.predict_turn, { model, party, hour, weekend }),
    observeTurn: (model: TurnModel, party: number, hour: number, weekend: boolean, minutes: number) => call<TurnModel>(m.observe_turn, { model, party, hour, weekend, minutes }),
  };
}

export type Core = ReturnType<typeof makeCore>;
