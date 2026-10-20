// What AI costs us, and the limits that keep it free for restaurants without surprises: each branch
// gets a daily allowance of model answers for guests, and the whole platform has a monthly budget.
// Past either, the free rules engine answers instead, so guests never see an error.

/** US dollars per million tokens (input, output), for the models we may run. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "@cf/google/gemma-4-26b-a4b-it": [0.1, 0.3],
  "@cf/qwen/qwen3.8-27b": [0.45, 3.2],
  "@cf/deepseek-ai/deepseek-v4-flash-0731": [0.44, 1.32],
  "@cf/meta/llama-3.1-8b-instruct-fp8-fast": [0.045, 0.384],
};

export interface Usage {
  model: string;
  input: number;
  output: number;
}

/** A call's cost in micro-dollars. Unknown models use `fallback` (ASSISTANT_PRICE "in,out"), else a deliberately high guess. */
export function costMicros(u: Usage, fallback?: string): number {
  const configured = fallback?.split(",").map(Number);
  const [pin, pout] = PRICES[u.model] ?? (configured?.length === 2 && configured.every(Number.isFinite) ? (configured as [number, number]) : [4, 20]);
  return Math.round(u.input * pin + u.output * pout);
}

export interface Limits {
  /** Model answers per branch per day for guests. */
  perBranchDaily: number;
  /** The platform's monthly AI budget in US dollars. */
  monthlyUsd: number;
}

export function limitsFrom(env: { ASSISTANT_DAILY_PER_BRANCH?: string; AI_MONTHLY_BUDGET_USD?: string }): Limits {
  const n = (v: string | undefined, d: number) => (v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
  return { perBranchDaily: n(env.ASSISTANT_DAILY_PER_BRANCH, 100), monthlyUsd: n(env.AI_MONTHLY_BUDGET_USD, 20) };
}

const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);

/** Whether a guest question at this branch may go to a model now. */
export async function mayUseModel(db: D1Database, branch: { tenantId: string; branchId: string }, limits: Limits, at = Date.now()): Promise<{ ok: boolean; reason?: "branch_daily" | "platform_budget" }> {
  if (limits.perBranchDaily <= 0 || limits.monthlyUsd <= 0) return { ok: false, reason: limits.perBranchDaily <= 0 ? "branch_daily" : "platform_budget" };
  const day = utcDay(at);
  const [today, month] = await db.batch([
    db.prepare("SELECT calls FROM ai_usage WHERE day = ? AND tenant_id = ? AND branch_id = ? AND kind = 'assistant'").bind(day, branch.tenantId, branch.branchId),
    db.prepare("SELECT COALESCE(SUM(cost_micros), 0) AS c FROM ai_usage WHERE day >= ?").bind(`${day.slice(0, 7)}-01`),
  ]);
  if (((today.results[0] as { calls?: number } | undefined)?.calls ?? 0) >= limits.perBranchDaily) return { ok: false, reason: "branch_daily" };
  if (((month.results[0] as { c: number }).c ?? 0) >= limits.monthlyUsd * 1_000_000) return { ok: false, reason: "platform_budget" };
  return { ok: true };
}

/** Add calls to the day's tally (one row per day, restaurant, branch and feature). */
export async function recordUsage(db: D1Database, scope: { tenantId: string; branchId?: string | null; kind: string }, uses: Usage[], priceFallback?: string, at = Date.now()) {
  if (!uses.length) return;
  const input = uses.reduce((n, u) => n + u.input, 0);
  const output = uses.reduce((n, u) => n + u.output, 0);
  const cost = uses.reduce((n, u) => n + costMicros(u, priceFallback), 0);
  await db
    .prepare(
      `INSERT INTO ai_usage (day, tenant_id, branch_id, kind, calls, input_tokens, output_tokens, cost_micros) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(day, tenant_id, branch_id, kind) DO UPDATE SET calls = calls + 1, input_tokens = input_tokens + excluded.input_tokens,
         output_tokens = output_tokens + excluded.output_tokens, cost_micros = cost_micros + excluded.cost_micros`,
    )
    .bind(utcDay(at), scope.tenantId, scope.branchId ?? "", scope.kind, input, output, cost)
    .run();
}
