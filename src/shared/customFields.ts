// Custom fields: a restaurant adds its own fields to dishes, orders, members and staff ("Halal
// certificate", "Delivery platform", "Birthday", "Emergency contact"). Definitions are per
// restaurant; values live beside the record they describe. Dish fields marked public show to
// guests on the menu; everything else stays in the staff console.

export const ENTITIES = ["dish", "order", "member", "staff"] as const;
export type Entity = (typeof ENTITIES)[number];

export const FIELD_TYPES = ["text", "number", "boolean", "select", "date", "url"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const MAX_FIELDS = 20;
export const MAX_OPTIONS = 30;
const MAX_TEXT = 500;

export interface FieldDef {
  id: string;
  entity: Entity;
  key: string;
  label: { en: string; zh?: string };
  type: FieldType;
  options: string[];
  required: boolean;
  /** Dish fields only: shown to guests on the menu. */
  public: boolean;
  sort: number;
}

export type Value = string | number | boolean;
export type Values = Record<string, Value>;

/** A stable key from a label: "Halal cert no." → "halal_cert_no". Non-Latin labels fall back to "field". */
export function keyOf(label: string): string {
  const k = label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(k) ? k : `field${k ? `_${k}` : ""}`.slice(0, 40);
}

export const validKey = (k: string) => /^[a-z][a-z0-9_]{0,39}$/.test(k);

/** One value as its field's type, or an error message. Empty means "not set" (null). */
export function cleanValue(def: Pick<FieldDef, "type" | "options">, raw: unknown): { ok: true; value: Value | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  switch (def.type) {
    case "text": {
      const s = String(raw).trim();
      return s.length > MAX_TEXT ? { ok: false, error: `at most ${MAX_TEXT} characters` } : { ok: true, value: s || null };
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/,/g, ""));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: "must be a number" };
    }
    case "boolean":
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === 1 || raw === "1") return { ok: true, value: true };
      if (raw === "false" || raw === 0 || raw === "0") return { ok: true, value: false };
      return { ok: false, error: "must be yes or no" };
    case "select": {
      const s = String(raw).trim();
      const hit = def.options.find((o) => o.toLowerCase() === s.toLowerCase());
      return hit ? { ok: true, value: hit } : { ok: false, error: `must be one of: ${def.options.join(", ")}` };
    }
    case "date": {
      const s = String(raw).trim();
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
      return d && d.getUTCDate() === +m![3] && d.getUTCMonth() === +m![2] - 1 ? { ok: true, value: s } : { ok: false, error: "must be a date (YYYY-MM-DD)" };
    }
    case "url": {
      const s = String(raw).trim();
      try {
        const u = new URL(s);
        return /^https?:$/.test(u.protocol) && s.length <= MAX_TEXT ? { ok: true, value: s } : { ok: false, error: "must be a web address (https://…)" };
      } catch {
        return { ok: false, error: "must be a web address (https://…)" };
      }
    }
  }
}

/**
 * Merge `patch` into `current` for these definitions: values are typed, empty ones removed, keys
 * without a definition ignored. Required fields must end up set. Errors are per key.
 */
export function mergeValues(defs: FieldDef[], current: Values, patch: Record<string, unknown>): { values: Values; errors: Record<string, string> } {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const values: Values = {};
  for (const [k, v] of Object.entries(current)) if (byKey.has(k)) values[k] = v;
  const errors: Record<string, string> = {};
  for (const [k, raw] of Object.entries(patch)) {
    const def = byKey.get(k);
    if (!def) continue;
    const r = cleanValue(def, raw);
    if (!r.ok) errors[k] = r.error;
    else if (r.value === null) delete values[k];
    else values[k] = r.value;
  }
  for (const d of defs) if (d.required && values[d.key] === undefined && !errors[d.key]) errors[d.key] = "is required";
  return { values, errors };
}

/** What guests may see of a dish's values: public fields only, in the restaurant's order. */
export function publicValues(defs: FieldDef[], values: Values): Values {
  const out: Values = {};
  for (const d of defs) if (d.entity === "dish" && d.public && values[d.key] !== undefined) out[d.key] = values[d.key];
  return out;
}

/** A value as text for a person reading it. */
export function showValue(def: Pick<FieldDef, "type">, v: Value, yesNo: [string, string] = ["Yes", "No"]): string {
  if (def.type === "boolean") return v ? yesNo[0] : yesNo[1];
  return String(v);
}

export type Template = Pick<FieldDef, "type" | "options" | "public"> & { label: { en: string; zh: string } };

/** One-tap starting points per record type (staff can rename or change any of them). */
export const TEMPLATES: Record<Entity, Template[]> = {
  dish: [
    { label: { en: "Halal certified", zh: "清真认证" }, type: "boolean", options: [], public: true },
    { label: { en: "Calories", zh: "卡路里" }, type: "number", options: [], public: true },
    { label: { en: "Origin", zh: "产地" }, type: "text", options: [], public: true },
    { label: { en: "Supplier", zh: "供应商" }, type: "text", options: [], public: false },
    { label: { en: "Cost price", zh: "成本价" }, type: "number", options: [], public: false },
  ],
  order: [
    { label: { en: "Delivery platform", zh: "外卖平台" }, type: "select", options: ["GrabFood", "foodpanda", "ShopeeFood", "Own delivery"], public: false },
    { label: { en: "Platform order no.", zh: "平台订单号" }, type: "text", options: [], public: false },
    { label: { en: "Event / occasion", zh: "场合" }, type: "text", options: [], public: false },
  ],
  member: [
    { label: { en: "Birthday", zh: "生日" }, type: "date", options: [], public: false },
    { label: { en: "Company", zh: "公司" }, type: "text", options: [], public: false },
    { label: { en: "Seating preference", zh: "座位偏好" }, type: "select", options: ["Indoor", "Outdoor", "Quiet corner"], public: false },
  ],
  staff: [
    { label: { en: "Phone", zh: "电话" }, type: "text", options: [], public: false },
    { label: { en: "Emergency contact", zh: "紧急联系人" }, type: "text", options: [], public: false },
    { label: { en: "Start date", zh: "入职日期" }, type: "date", options: [], public: false },
    { label: { en: "Food handler certified", zh: "食品处理证书" }, type: "boolean", options: [], public: false },
  ],
};

/** A dish's public fields as short facts for guests: "Halal certified", "Heat: Hot". A "no" isn't worth saying. */
export function guestFacts(fields: { key: string; label: { en: string; zh?: string }; type: FieldType }[], values: Values | undefined, locale: string): string[] {
  if (!values) return [];
  const out: string[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined || v === false) continue;
    const label = (locale.startsWith("zh") && f.label.zh) || f.label.en;
    out.push(f.type === "boolean" ? label : `${label}: ${v}`);
  }
  return out;
}
