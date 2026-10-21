// The Worker's side of the taste service (services/taste): Qloo's harness runs in a container,
// and this calls it over HTTPS with a shared secret. Off unless TASTE_URL and TASTE_SECRET are set.
// Qloo results describe aggregate taste ("fans of X also like…"), never a person; nothing about a
// guest beyond the public names they typed is ever sent.

export interface TasteEnv {
  TASTE_URL?: string;
  TASTE_SECRET?: string;
}

/** The read-only Qloo workflows the service allows. */
export type TasteTool =
  | "qloo_find_tags"
  | "qloo_describe"
  | "qloo_recommend"
  | "qloo_rank"
  | "qloo_where_popular"
  | "qloo_compare_audiences"
  | "qloo_entity_tags"
  | "qloo_audience_demographics"
  | "qloo_trends";

export const TASTE_TOOLS: TasteTool[] = [
  "qloo_find_tags",
  "qloo_describe",
  "qloo_recommend",
  "qloo_rank",
  "qloo_where_popular",
  "qloo_compare_audiences",
  "qloo_entity_tags",
  "qloo_audience_demographics",
  "qloo_trends",
];

/** The harness's result envelope (status ok | empty | needs_input | partial | degraded | error). */
export interface Envelope {
  status: "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";
  summary?: string;
  results?: unknown;
  result_count?: number;
  warnings?: string[];
  error?: { code: string; retryable: boolean; recovery: string };
  provenance?: { source?: string; endpoint?: string; documentation?: string };
  cached?: boolean;
}

/** One result, whatever its type: the fields we show, read tolerantly. */
export interface TasteItem {
  id: string;
  name: string;
  type?: string;
  score?: number;
  popularity?: number;
  tags: string[];
  /** Qloo's tag ids, alongside the names, when given (urn:tag:genre:…, urn:tag:amenity:…). */
  tagIds: (string | undefined)[];
  place?: string;
  description?: string;
}

export type Runner = (tool: TasteTool, args: Record<string, unknown>) => Promise<Envelope>;

export const tasteEnabled = (env: TasteEnv) => !!(env.TASTE_URL && env.TASTE_SECRET);

/** Answers worth keeping: anything but an error or a question back. */
const KEEP = new Set(["ok", "empty", "partial", "degraded"]);

/** JSON with sorted keys, so the same question is the same cache entry. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

const edge = () => (typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null);

/**
 * Calls to the taste service, with each answer kept for a day in the Worker's own cache. The
 * service runs on demand and sleeps when idle, losing its memory, so this cache is what lets a
 * sleeping container stay asleep for any question someone asked in the last day.
 */
export function tasteRunner(env: TasteEnv, fetcher: typeof fetch = fetch, timeoutMs = 30_000): Runner {
  return async (tool, args) => {
    if (!tasteEnabled(env)) return { status: "error", summary: "Taste insights are not set up", error: { code: "TASTE_OFF", retryable: false, recovery: "Set TASTE_URL and TASTE_SECRET" } };
    const cache = edge();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${tool}\n${stable(args)}`)));
    const key = new Request(`https://taste-call.internal/${[...digest].map((b) => b.toString(16).padStart(2, "0")).join("")}`);
    const hit = cache ? await cache.match(key).catch(() => undefined) : undefined;
    if (hit) return { ...((await hit.json()) as Envelope), cached: true };
    try {
      const r = await fetcher(`${env.TASTE_URL!.replace(/\/$/, "")}/v1/run`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.TASTE_SECRET}`, "content-type": "application/json" },
        body: JSON.stringify({ tool, args }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await r.json().catch(() => null)) as (Envelope & { error?: unknown }) | null;
      if (body && typeof body.status === "string") {
        if (cache && KEEP.has(body.status)) await cache.put(key, new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "max-age=86400" } })).catch(() => {});
        return body;
      }
      return { status: "error", summary: `Taste service ${r.status}`, error: { code: r.status === 429 ? "DAILY_LIMIT" : "TASTE_HTTP", retryable: r.status >= 500, recovery: "" } };
    } catch (e) {
      return { status: "error", summary: (e as Error).message, error: { code: "TASTE_UNREACHABLE", retryable: true, recovery: "" } };
    }
  };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Results as a list of items: entities, tags or places, from whichever shape the workflow returned. */
export function items(e: Envelope): TasteItem[] {
  const raw = Array.isArray(e.results) ? e.results : Array.isArray((e.results as { entities?: unknown[] })?.entities) ? (e.results as { entities: unknown[] }).entities : [];
  return raw
    .map((x): TasteItem | null => {
      const r = x as Record<string, unknown>;
      const name = str(r.name) ?? str(r.title) ?? str((r.entity as Record<string, unknown> | undefined)?.name);
      if (!name) return null;
      const tagList = (Array.isArray(r.tags) ? r.tags : [])
        .map((t) => (typeof t === "string" ? { name: t, id: undefined } : { name: str((t as Record<string, unknown>)?.name), id: str((t as Record<string, unknown>)?.id) ?? str((t as Record<string, unknown>)?.tag_id) }))
        .filter((t): t is { name: string; id: string | undefined } => !!t.name)
        .slice(0, 6);
      const props = (r.properties as Record<string, unknown> | undefined) ?? {};
      const addr = str(r.address) ?? str(props.address) ?? str((r.address as Record<string, unknown> | undefined)?.formatted);
      return {
        id: str(r.entity_id) ?? str(r.id) ?? name,
        name,
        type: str(r.type) ?? str(r.subtype),
        score: num(r.affinity) ?? num(r.score) ?? num((r.query as Record<string, unknown> | undefined)?.affinity),
        popularity: num(r.popularity),
        tags: tagList.map((t) => t.name),
        tagIds: tagList.map((t) => t.id),
        place: addr,
        description: str(r.description) ?? str(props.short_description),
      };
    })
    .filter((x): x is TasteItem => !!x);
}

/** Usable results: ok, or partial/degraded with something in them. */
export const usable = (e: Envelope) => (e.status === "ok" || e.status === "partial" || e.status === "degraded") && items(e).length > 0;
