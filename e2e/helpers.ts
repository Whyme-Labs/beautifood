import { expect, request as pwRequest, type APIRequestContext, type APIResponse } from "@playwright/test";

export const BASE = `http://127.0.0.1:${process.env.E2E_PORT ?? 5190}`;
const TRUSTED = { "x-auth-trusted-key": process.env.AUTH_TRUSTED_KEY ?? "e2e-trusted" };
let seq = 0;
export const uid = (p = "x") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A signed-in staff API client (Better Auth session cookie). */
export async function staffClient(email = `${uid("staff")}@test.co`, name = "Test Staff", password = "password-123456"): Promise<{ api: APIRequestContext; email: string; userId: string }> {
  const api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { ...TRUSTED, origin: BASE } });
  const r = await api.post("/api/auth/sign-up/email", { data: { email, password, name } });
  expect(r.status(), await r.text()).toBe(200);
  const me = await (await api.get("/api/m/me")).json();
  return { api, email, userId: me.user.id };
}

export async function guestClient(device = uid("dev-")): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { ...TRUSTED, "x-device": device } });
}

export interface Seeded {
  owner: APIRequestContext;
  ownerEmail: string;
  tenantId: string;
  slug: string;
  klcc: { id: string; ref: string };
  bangsar: { id: string; ref: string };
}

/** Fresh demo restaurant (two branches, menu, tables, promo, members) owned by a new user. */
export async function seed(): Promise<Seeded> {
  const { api, email } = await staffClient(`${uid("owner")}@test.co`, "Olivia Owner");
  const r = await api.post(`/api/dev/seed?name=${encodeURIComponent(`Beautifood ${uid("")}`)}`);
  expect(r.status(), await r.text()).toBe(201);
  const s = await r.json();
  return { owner: api, ownerEmail: email, tenantId: s.tenantId, slug: s.slug, klcc: s.branches[0], bangsar: s.branches[1] };
}

export async function json<T = any>(r: APIResponse | Promise<APIResponse>, status?: number): Promise<T> {
  const res = await r;
  const body = await res.text();
  if (status !== undefined) expect(res.status(), body).toBe(status);
  else expect(res.ok(), `${res.status()} ${body}`).toBeTruthy();
  return body ? JSON.parse(body) : (null as T);
}

export async function errorOf(r: APIResponse | Promise<APIResponse>, status: number): Promise<{ code: string; message: string; data?: any }> {
  const res = await r;
  const body = await res.text();
  expect(res.status(), body).toBe(status);
  return JSON.parse(body).error;
}

export async function menuItems(api: APIRequestContext) {
  const m = await json<{ items: { id: string; name: string; price: number; modifiers: any[]; allergens: string[] }[]; categories: any[] }>(api.get("/api/m/menu"));
  const byName = (n: string) => m.items.find((i) => i.name === n)!;
  return { ...m, byName };
}

export async function board(api: APIRequestContext, branchId: string) {
  return json<any>(api.get(`/api/m/branches/${branchId}/board`));
}

export async function tableIds(api: APIRequestContext, branchId: string) {
  const ts = await json<{ id: string; label: string; status: string; seatsMax: number; mergeGroup: string | null; splitConfig: any; seatingId: string | null; staticToken: string }[]>(api.get(`/api/m/branches/${branchId}/tables`));
  return Object.fromEntries(ts.map((t) => [t.label, t]));
}

/** Join the queue as a guest; returns ticket + token. */
export async function join(branchRef: string, partySize: number, name = "Guest", extra: Record<string, unknown> = {}, device = uid("dev-")) {
  const g = await guestClient(device);
  return json<{ token: string; url: string; ticket: any; existing: boolean }>(g.post(`/api/public/branches/${branchRef}/queue`, { data: { partySize, name, ...extra } }));
}

/** Seat a walk-in directly and return the cart session id + signed token. */
export async function seatWalkIn(owner: APIRequestContext, branchId: string, tableIds: string[], partySize = 2) {
  const r = await json<{ seatingId: string; sessionId: string; sessionUrl: string }>(owner.post(`/api/m/branches/${branchId}/seat`, { data: { partySize, tableIds } }), 201);
  const k = new URL(BASE + r.sessionUrl).searchParams.get("k")!;
  return { ...r, token: k };
}

export async function runPipeline(api: APIRequestContext) {
  return json(api.post("/api/dev/pipeline"));
}

export async function inbox(api: APIRequestContext, to?: string, kind?: string) {
  const qs = new URLSearchParams({ ...(to ? { to } : {}), ...(kind ? { kind } : {}), html: "1" });
  return json<{ to_email: string; subject: string; kind: string; ref: string; html: string; text: string; status: string; error: string | null; message_id: string | null; attempts: number; headers: string | null }[]>(api.get(`/api/dev/inbox?${qs}`));
}

export const participant = (name: string) => ({ id: `p-${name}-${uid()}`, name });

/** Wait until `fn` returns truthy (polling), for asynchronous side effects. */
export async function eventually<T>(fn: () => Promise<T>, timeout = 10_000): Promise<NonNullable<T>> {
  const start = Date.now();
  let last: unknown;
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v as NonNullable<T>;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw last ?? new Error("timed out waiting for condition");
}

/** Invite a new staff member with a role and sign them in. */
export async function hire(owner: APIRequestContext, role: string, branchIds: string[], name = `${role} person`) {
  const email = `${uid(role)}@test.co`;
  const inv = await json<{ code: string }>(owner.post("/api/m/staff", { data: { email, name, role, branchIds } }), 201);
  const s = await staffClient(email, name);
  await json(s.api.post("/api/m/invites", { data: { code: inv.code } }));
  return { ...s, code: inv.code };
}

/** Navigate and wait until React has hydrated, so clicks and typing reach the app. */
export async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url);
  await page.locator("html[data-hydrated]").waitFor();
}
