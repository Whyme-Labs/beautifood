// Browser API client: JSON in/out, typed errors, device id, staff tenant header.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public data?: unknown) {
    super(message);
  }
}

const isBrowser = typeof window !== "undefined";

export function deviceId(): string {
  if (!isBrowser) return "ssr";
  try {
    let id = localStorage.getItem("bf.device");
    if (!id) {
      id = `dv-${crypto.randomUUID()}`;
      localStorage.setItem("bf.device", id);
    }
    return id;
  } catch {
    return "dv-ephemeral";
  }
}

let tenantHeader: string | null = null;
export function setTenant(id: string | null) {
  tenantHeader = id;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; allow204?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-device": deviceId(), ...(init.headers ?? {}) };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (tenantHeader && path.startsWith("/api/m")) headers["x-tenant"] = tenantHeader;
  const res = await fetch(path, { method: init.method ?? (init.body !== undefined ? "POST" : "GET"), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined, credentials: "same-origin" });
  if (res.status === 204) return null as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: { code: "bad_response", message: text.slice(0, 200) } };
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "error", e.message ?? data?.message ?? `Request failed (${res.status})`, e.data);
  }
  return data as T;
}

export const msgId = () => (isBrowser && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
