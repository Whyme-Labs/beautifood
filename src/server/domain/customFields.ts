// Custom fields (src/shared/customFields.ts): the restaurant's field definitions per record type,
// and each record's values. Writing values checks the same permission as changing the record
// itself: dishes need menu.manage, orders order.create in their branch, members member.manage,
// staff staff.manage over that person.
import { ENTITIES, FIELD_TYPES, MAX_FIELDS, MAX_OPTIONS, keyOf, mergeValues, publicValues, validKey, type Entity, type FieldDef, type Values } from "../../shared/customFields";
import { fail, notFound } from "../errors";
import { requirePerm, type Staff } from "../http";
import { newId } from "../ids";
import { Tx } from "../tx";
import { streams } from "./context";
import { checkGrant } from "./tenants";

interface Row {
  id: string;
  entity: Entity;
  key: string;
  label: string;
  type: FieldDef["type"];
  options: string;
  required: number;
  public: number;
  sort: number;
}

const toDef = (r: Row): FieldDef => ({
  id: r.id,
  entity: r.entity,
  key: r.key,
  label: JSON.parse(r.label),
  type: r.type,
  options: JSON.parse(r.options || "[]"),
  required: !!r.required,
  public: r.entity === "dish" && !!r.public,
  sort: r.sort,
});

export async function listFields(db: D1Database, tenantId: string, entity?: Entity): Promise<FieldDef[]> {
  const rows = entity
    ? await db.prepare("SELECT * FROM custom_fields WHERE tenant_id = ? AND entity = ? ORDER BY sort, created_at").bind(tenantId, entity).all<Row>()
    : await db.prepare("SELECT * FROM custom_fields WHERE tenant_id = ? ORDER BY entity, sort, created_at").bind(tenantId).all<Row>();
  return rows.results.map(toDef);
}

export interface FieldInput {
  entity: Entity;
  label: { en: string; zh?: string };
  type: FieldDef["type"];
  options?: string[];
  required?: boolean;
  public?: boolean;
  sort?: number;
}

function cleanInput(i: FieldInput) {
  if (!ENTITIES.includes(i.entity)) fail(400, "invalid_field", "Unknown record type");
  if (!FIELD_TYPES.includes(i.type)) fail(400, "invalid_field", "Unknown field type");
  const label = { en: i.label.en.trim().slice(0, 60), ...(i.label.zh?.trim() ? { zh: i.label.zh.trim().slice(0, 60) } : {}) };
  if (!label.en) fail(400, "invalid_field", "Give the field a name");
  const options = i.type === "select" ? [...new Set((i.options ?? []).map((o) => o.trim().slice(0, 60)).filter(Boolean))] : [];
  if (i.type === "select" && options.length < 2) fail(400, "invalid_field", "A choice field needs at least two options");
  if (options.length > MAX_OPTIONS) fail(400, "invalid_field", `At most ${MAX_OPTIONS} options`);
  return { label, options, required: !!i.required, public: i.entity === "dish" && !!i.public };
}

export async function createField(db: D1Database, tenantId: string, actor: string, input: FieldInput): Promise<FieldDef> {
  const c = cleanInput(input);
  const existing = await listFields(db, tenantId, input.entity);
  if (existing.length >= MAX_FIELDS) fail(409, "too_many_fields", `Up to ${MAX_FIELDS} fields per record type`);
  if (existing.some((f) => f.label.en.toLowerCase() === c.label.en.toLowerCase())) fail(409, "field_exists", "There's already a field with that name");
  let key = keyOf(c.label.en);
  for (let n = 2; existing.some((f) => f.key === key); n++) key = `${keyOf(c.label.en).slice(0, 36)}_${n}`;
  if (!validKey(key)) fail(400, "invalid_field", "Give the field a name in letters");
  const id = newId("cf_");
  const sort = input.sort ?? (existing.at(-1)?.sort ?? -1) + 1;
  await new Tx(db, { tenantId, actor })
    .assert("NOT EXISTS (SELECT 1 FROM custom_fields WHERE tenant_id = ? AND entity = ? AND key = ?)", [tenantId, input.entity, key], 409, "field_exists", "There's already a field with that name")
    .assert("(SELECT COUNT(*) FROM custom_fields WHERE tenant_id = ? AND entity = ?) < ?", [tenantId, input.entity, MAX_FIELDS], 409, "too_many_fields", `Up to ${MAX_FIELDS} fields per record type`)
    .run(
      "INSERT INTO custom_fields (id, tenant_id, entity, key, label, type, options, required, public, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      tenantId,
      input.entity,
      key,
      JSON.stringify(c.label),
      input.type,
      JSON.stringify(c.options),
      c.required ? 1 : 0,
      c.public ? 1 : 0,
      sort,
      Date.now(),
    )
    .event({ stream: streams.tenant(tenantId), type: "fields.saved", data: { id, entity: input.entity, key, type: input.type } })
    .commit();
  return { id, entity: input.entity, key, type: input.type, sort, ...c };
}

async function own(db: D1Database, tenantId: string, id: string): Promise<FieldDef> {
  const r = await db.prepare("SELECT * FROM custom_fields WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<Row>();
  if (!r) notFound("Field");
  return toDef(r);
}

/** Rename, re-option or move a field. Its key and type stay, so values recorded under it keep their meaning. */
export async function updateField(db: D1Database, tenantId: string, actor: string, id: string, input: Partial<Omit<FieldInput, "entity" | "type">>): Promise<FieldDef> {
  const f = await own(db, tenantId, id);
  const c = cleanInput({ entity: f.entity, type: f.type, label: input.label ?? f.label, options: input.options ?? f.options, required: input.required ?? f.required, public: input.public ?? f.public });
  const sort = input.sort ?? f.sort;
  await new Tx(db, { tenantId, actor })
    .run("UPDATE custom_fields SET label = ?, options = ?, required = ?, public = ?, sort = ? WHERE id = ?", JSON.stringify(c.label), JSON.stringify(c.options), c.required ? 1 : 0, c.public ? 1 : 0, sort, id)
    .event({ stream: streams.tenant(tenantId), type: "fields.saved", data: { id, entity: f.entity, key: f.key, type: f.type } })
    .commit();
  return { ...f, ...c, sort };
}

/** Remove a field and, with it, every value recorded under it. */
export async function deleteField(db: D1Database, tenantId: string, actor: string, id: string) {
  const f = await own(db, tenantId, id);
  await new Tx(db, { tenantId, actor })
    .run("DELETE FROM custom_fields WHERE id = ?", id)
    .run("UPDATE custom_values SET data = json_remove(data, '$.' || ?) WHERE tenant_id = ? AND entity = ?", f.key, tenantId, f.entity)
    .event({ stream: streams.tenant(tenantId), type: "fields.deleted", data: { id, entity: f.entity, key: f.key } })
    .commit();
}

// ---- values ----

export async function getValues(db: D1Database, tenantId: string, entity: Entity, ids: string[]): Promise<Record<string, Values>> {
  const out: Record<string, Values> = {};
  const unique = [...new Set(ids)].slice(0, 500);
  // D1 caps bound parameters per statement; read in slices
  for (let i = 0; i < unique.length; i += 90) {
    const part = unique.slice(i, i + 90);
    const rows = await db
      .prepare(`SELECT record_id, data FROM custom_values WHERE tenant_id = ? AND entity = ? AND record_id IN (${part.map(() => "?").join(",")})`)
      .bind(tenantId, entity, ...part)
      .all<{ record_id: string; data: string }>();
    for (const r of rows.results) out[r.record_id] = JSON.parse(r.data || "{}");
  }
  return out;
}

/** Who may see or change a record's values, and that the record is this restaurant's. */
async function authorize(db: D1Database, s: Staff, entity: Entity, id: string, write: boolean) {
  switch (entity) {
    case "dish": {
      if (write) requirePerm(s, "menu.manage");
      if (!(await db.prepare("SELECT 1 FROM menu_items WHERE id = ? AND tenant_id = ?").bind(id, s.tenantId).first())) notFound("Dish");
      return;
    }
    case "order": {
      const o = await db.prepare("SELECT branch_id FROM orders WHERE id = ? AND tenant_id = ?").bind(id, s.tenantId).first<{ branch_id: string }>();
      if (!o) notFound("Order");
      requirePerm(s, "order.create", o.branch_id);
      return;
    }
    case "member": {
      requirePerm(s, "member.manage");
      if (!(await db.prepare("SELECT 1 FROM members WHERE id = ? AND tenant_id = ?").bind(id, s.tenantId).first())) notFound("Member");
      return;
    }
    case "staff": {
      requirePerm(s, "staff.manage");
      const p = await db.prepare("SELECT role, branch_ids FROM staff WHERE user_id = ? AND tenant_id = ?").bind(id, s.tenantId).first<{ role: string; branch_ids: string }>();
      if (!p) notFound("Staff member");
      // details of people above you are theirs and the owner's, not yours
      if (id !== s.userId) await checkGrant(db, s, p.role, JSON.parse(p.branch_ids));
      return;
    }
  }
}

/** Read permission for a list of records: what the caller could change, or (orders, dishes) see. */
export async function readValues(db: D1Database, s: Staff, entity: Entity, ids: string[]) {
  if (entity === "member") requirePerm(s, "member.manage");
  if (entity === "staff") requirePerm(s, "staff.manage");
  const values = await getValues(db, s.tenantId, entity, ids);
  if (entity === "order" && !s.tenantWide && !s.branches.includes("*")) {
    // only orders of the caller's branches
    const keys = Object.keys(values);
    if (keys.length) {
      const rows = await db.prepare(`SELECT id, branch_id FROM orders WHERE tenant_id = ? AND id IN (${keys.map(() => "?").join(",")})`).bind(s.tenantId, ...keys).all<{ id: string; branch_id: string }>();
      for (const r of rows.results) if (!s.branches.includes(r.branch_id)) delete values[r.id];
    }
  }
  return values;
}

export async function setValues(db: D1Database, s: Staff, actor: string, entity: Entity, id: string, patch: Record<string, unknown>): Promise<Values> {
  if (!ENTITIES.includes(entity)) fail(400, "invalid_field", "Unknown record type");
  await authorize(db, s, entity, id, true);
  const [defs, current] = await Promise.all([listFields(db, s.tenantId, entity), getValues(db, s.tenantId, entity, [id])]);
  const { values, errors } = mergeValues(defs, current[id] ?? {}, patch);
  const bad = Object.entries(errors);
  if (bad.length) {
    const label = (k: string) => defs.find((d) => d.key === k)?.label.en ?? k;
    fail(400, "invalid_fields", bad.map(([k, e]) => `${label(k)} ${e}`).join("; "), errors);
  }
  const now = Date.now();
  await new Tx(db, { tenantId: s.tenantId, actor })
    .run(
      "INSERT INTO custom_values (tenant_id, entity, record_id, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, entity, record_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      s.tenantId,
      entity,
      id,
      JSON.stringify(values),
      now,
      actor,
    )
    .event({ stream: streams.tenant(s.tenantId), type: "fields.values_set", data: { entity, id, keys: Object.keys(patch) } })
    .commit();
  return values;
}

/** What guests see of dishes' custom fields: the public fields and each dish's public values. */
export async function publicDishFields(db: D1Database, tenantId: string, dishIds: string[]) {
  const fields = (await listFields(db, tenantId, "dish")).filter((f) => f.public);
  if (!fields.length) return { fields: [], values: {} as Record<string, Values> };
  const all = await getValues(db, tenantId, "dish", dishIds);
  const values: Record<string, Values> = {};
  for (const [id, v] of Object.entries(all)) {
    const p = publicValues(fields, v);
    if (Object.keys(p).length) values[id] = p;
  }
  return { fields: fields.map(({ key, label, type }) => ({ key, label, type })), values };
}
