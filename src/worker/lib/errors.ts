// Errors cross Durable Object RPC boundaries as plain Error messages, so the
// status/code are encoded into the message and decoded by the HTTP layer.

const MARK = /^\[\[(\d{3})\|([a-z_]+)\]\] ([\s\S]*)$/;

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(`[[${status}|${code}]] ${message}${data !== undefined ? `\u0000${JSON.stringify(data)}` : ""}`);
  }
}

export function fail(status: number, code: string, message: string, data?: unknown): never {
  throw new AppError(status, code, message, data);
}

export function decodeError(e: unknown): { status: number; code: string; message: string; data?: unknown } {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(MARK);
  if (!m) return { status: 500, code: "internal", message: msg };
  const [body, json] = m[3].split("\u0000");
  let data: unknown;
  if (json) {
    try {
      data = JSON.parse(json);
    } catch {
      data = undefined;
    }
  }
  return { status: Number(m[1]), code: m[2], message: body, data };
}
