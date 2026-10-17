import type { Context } from "hono";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

export function fail(status: number, code: string, message: string, data?: unknown): never {
  throw new AppError(status, code, message, data);
}

export const notFound = (what: string): never => fail(404, "not_found", `${what} not found`);

export function errorResponse(c: Context, e: unknown): Response {
  if (e instanceof AppError) return c.json({ error: { code: e.code, message: e.message, data: e.data } }, e.status as 400);
  if (e instanceof ZodError) return c.json({ error: { code: "invalid_input", message: "Invalid input", data: e.issues } }, 400);
  if (e instanceof Response) return e;
  // Void's requireAuth throws an HTTPException-like object with a status
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403) return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, status);
  console.error("unhandled", e);
  return c.json({ error: { code: "internal", message: "Something went wrong" } }, 500);
}
