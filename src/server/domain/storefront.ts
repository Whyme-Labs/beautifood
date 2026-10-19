// The storefront: the restaurant's own page at /at/<slug>. The design is data (shared/storefront.ts)
// kept as a draft and a published copy; the page fills it with what is live: each branch's queue,
// what is being served now and any happy hour, the story, where to find each branch.
import { StorefrontSchema, defaultStorefront, readable, type Storefront } from "../../shared/storefront";
import type { Menu } from "../../shared/types";
import { fail } from "../errors";
import { branchConfig, getBranch, getTenant, streams } from "./context";
import { menuAt } from "./menu";
import { Tx } from "../tx";

/** Validate (and make readable) a design from anywhere: the editor, the designer, an agent. */
export function cleanStorefront(input: unknown): Storefront {
  const r = StorefrontSchema.safeParse(input);
  if (!r.success) fail(400, "invalid_storefront", r.error.issues[0]?.message ?? "That design isn't valid");
  return { ...r.data, theme: readable(r.data.theme) };
}

export async function getStorefront(db: D1Database, tenantId: string) {
  const [row, t] = await Promise.all([
    db.prepare("SELECT draft, published, updated_at, published_at FROM storefronts WHERE tenant_id = ?").bind(tenantId).first<{ draft: string; published: string | null; updated_at: number; published_at: number | null }>(),
    getTenant(db, tenantId),
  ]);
  const fallback = defaultStorefront(t);
  const parse = (s: string | null | undefined) => {
    if (!s) return null;
    const r = StorefrontSchema.safeParse(JSON.parse(s));
    return r.success ? r.data : null;
  };
  return {
    draft: parse(row?.draft) ?? fallback,
    published: parse(row?.published),
    updatedAt: row?.updated_at ?? null,
    publishedAt: row?.published_at ?? null,
  };
}

export async function saveDraft(db: D1Database, tenantId: string, actor: string, design: Storefront) {
  await new Tx(db, { tenantId, actor })
    .run(
      "INSERT INTO storefronts (tenant_id, draft, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET draft = excluded.draft, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      tenantId,
      JSON.stringify(design),
      Date.now(),
      actor,
    )
    .commit();
}

export async function publish(db: D1Database, tenantId: string, actor: string) {
  const { draft } = await getStorefront(db, tenantId);
  await new Tx(db, { tenantId, actor })
    .run(
      "INSERT INTO storefronts (tenant_id, draft, published, updated_at, updated_by, published_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET published = excluded.published, published_at = excluded.published_at",
      tenantId,
      JSON.stringify(draft),
      JSON.stringify(draft),
      Date.now(),
      actor,
      Date.now(),
    )
    .event({ stream: streams.tenant(tenantId), type: "storefront.published", data: { theme: draft.theme, sections: draft.sections.filter((s) => s.visible).map((s) => s.type) } })
    .commit();
}

export interface StorefrontBranch {
  id: string;
  ref: string;
  name: string;
  address: string;
  phone: string;
  modules: { bookings: boolean; queue: boolean; takeaway: boolean };
  hours: { open: number; close: number } | null;
}

export interface StorefrontData {
  restaurant: { name: string; slug: string; cuisine: string; description: string; story: string; translations: Record<string, { story?: string; description?: string }> };
  branches: StorefrontBranch[];
  currency: string;
  menuLanguage: string;
  /** From the first branch: what's served now, the dishes worth showing, the deals on now. */
  menu: { now: Menu["now"]; menus: Menu["menus"]; rules: Menu["rules"]; signatures: Menu["items"]; deals: Menu["items"] };
}

/** Everything the page shows besides the design, as of now. */
export async function storefrontData(db: D1Database, slug: string): Promise<StorefrontData & { tenantId: string }> {
  const t = await getTenant(db, slug);
  if (t.slug !== slug && t.id !== slug) fail(404, "not_found", "Restaurant not found");
  const rows = (await db.prepare("SELECT * FROM branches WHERE tenant_id = ? AND active = 1 ORDER BY created_at").bind(t.id).all<Parameters<typeof branchConfig>[0] & { id: string; slug: string; name: string; address: string }>()).results;
  const branches = rows.map((b) => {
    const c = branchConfig(b, t);
    return {
      id: b.id,
      ref: `${t.slug}~${b.slug}`,
      name: b.name,
      address: b.address,
      phone: c.phone ?? "",
      modules: { bookings: c.modules.bookings && c.booking.enabled, queue: true, takeaway: true },
      hours: c.booking ? { open: c.booking.openHour, close: c.booking.closeHour } : null,
    };
  });
  const first = rows[0] ? await getBranch(db, rows[0].id) : null;
  const menu = first ? await menuAt(db, first) : null;
  const live = (menu?.items ?? []).filter((i) => i.servedNow !== false && !i.soldOut);
  return {
    tenantId: t.id,
    restaurant: { name: t.name, slug: t.slug, cuisine: t.cuisine, description: t.description, story: t.story, translations: JSON.parse(t.translations || "{}") },
    branches,
    currency: first?.config.currency ?? t.currency,
    menuLanguage: menu?.language ?? "en",
    menu: {
      now: menu?.now,
      menus: menu?.menus,
      rules: menu?.rules,
      signatures: (live.filter((i) => i.isSignature).length ? live.filter((i) => i.isSignature) : live).slice(0, 6),
      deals: live.filter((i) => i.deal).slice(0, 6),
    },
  };
}
