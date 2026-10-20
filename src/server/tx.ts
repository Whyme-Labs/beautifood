// All-or-nothing command batches over D1.
//
// D1 runs one query at a time and `batch()` is a transaction, so a command is:
//   asserts (preconditions) + event append + projection updates  →  one batch.
// A failed assert inserts `ok = 0` into `_assert`, violating its CHECK and
// rolling the whole batch back. No locks, no interleaving, no partial writes.
import { AppError } from "./errors";

interface Check {
  cond: string;
  params: unknown[];
  status: number;
  code: string;
  message: string;
}

export interface EventInput {
  stream: string;
  type: string;
  data?: Record<string, unknown>;
  version?: number | null;
  msgId?: string | null;
}

export class DuplicateCommand extends Error {
  constructor(public msgId: string) {
    super(`duplicate command ${msgId}`);
  }
}

export class Tx {
  private stmts: D1PreparedStatement[] = [];
  private checks: Check[] = [];
  private msgIds: string[] = [];
  readonly at = Date.now();

  constructor(
    private db: D1Database,
    private scope: { tenantId: string; branchId?: string | null; actor?: string | null },
  ) {}

  /** Abort the whole batch unless `cond` (an SQL boolean expression) holds at this point. */
  assert(cond: string, params: unknown[], status: number, code: string, message: string): this {
    this.stmts.push(this.db.prepare(`INSERT INTO _assert(ok) SELECT 0 WHERE NOT (${cond})`).bind(...params));
    this.checks.push({ cond, params, status, code, message });
    return this;
  }

  run(sql: string, ...params: unknown[]): this {
    this.stmts.push(this.db.prepare(sql).bind(...params));
    return this;
  }

  /** Append to the event log. `version` enables per-stream optimistic concurrency; `msgId` de-duplicates retries. */
  event(e: EventInput): this {
    if (e.msgId) this.msgIds.push(e.msgId);
    this.stmts.push(
      this.db
        .prepare("INSERT INTO events (tenant_id, branch_id, stream, version, type, data, actor, msg_id, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(this.scope.tenantId, this.scope.branchId ?? null, e.stream, e.version ?? null, e.type, JSON.stringify(e.data ?? {}), this.scope.actor ?? null, e.msgId ?? null, this.at),
    );
    return this;
  }

  /**
   * Append an event only if `cond` holds at this point in the batch: for facts the batch itself
   * decides, like "this order took the rice below its low mark". No version or msgId.
   */
  eventIf(cond: string, params: unknown[], e: Omit<EventInput, "version" | "msgId"> & { branchId?: string }): this {
    this.stmts.push(
      this.db
        .prepare(`INSERT INTO events (tenant_id, branch_id, stream, type, data, actor, at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE (${cond})`)
        .bind(this.scope.tenantId, e.branchId ?? this.scope.branchId ?? null, e.stream, e.type, JSON.stringify(e.data ?? {}), this.scope.actor ?? null, this.at, ...params),
    );
    return this;
  }

  get actor() {
    return this.scope.actor ?? null;
  }

  get size() {
    return this.stmts.length;
  }

  async commit(): Promise<D1Result[]> {
    if (!this.stmts.length) return [];
    try {
      return await this.db.batch(this.stmts);
    } catch (e) {
      throw await this.explain(e);
    }
  }

  private async explain(e: unknown): Promise<unknown> {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("assert_ok")) {
      for (const c of this.checks) {
        const r = await this.db.prepare(`SELECT CASE WHEN (${c.cond}) THEN 1 ELSE 0 END AS ok`).bind(...c.params).first<{ ok: number }>();
        if (!r?.ok) return new AppError(c.status, c.code, c.message);
      }
      return new AppError(409, "conflict", "Someone else changed this at the same moment. Please retry.");
    }
    if (msg.includes("events.msg_id")) return new DuplicateCommand(this.msgIds[0] ?? "");
    if (msg.includes("events.stream, events.version")) return new AppError(409, "version_conflict", "This was changed by someone else. Refresh and try again.");
    if (msg.includes("members_points_non_negative")) return new AppError(409, "insufficient_points", "Not enough points");
    if (msg.includes("UNIQUE constraint failed")) return new AppError(409, "conflict", "Conflicting change, please retry.");
    return e;
  }
}

/** Run a command; on a duplicate msgId (a retried request), return `onDuplicate()` instead. */
export async function idempotent<T>(run: () => Promise<T>, onDuplicate: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof DuplicateCommand) return onDuplicate();
    throw e;
  }
}
