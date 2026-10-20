// Custom fields in the staff console: the Settings card that defines them, and the editor for a
// record's values (inline on a dish, behind a "Details" button on orders, members and staff).
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2 } from "lucide-react";
import { api } from "./api";
import { Modal, useAction } from "./components";
import { useI18n } from "../i18n/react";
import type { MessageKey } from "../i18n/core";
import { ENTITIES, FIELD_TYPES, TEMPLATES, type Entity, type FieldDef, type FieldType, type Values } from "../shared/customFields";

const k = (s: string) => `staff.fields.${s}` as MessageKey;

/** The restaurant's fields for one record type (all staff can read them). */
export function useFieldDefs(entity: Entity) {
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  const load = useCallback(() => api<FieldDef[]>(`/api/m/fields?entity=${entity}`).then(setDefs, () => setDefs([])), [entity]);
  useEffect(() => void load(), [load]);
  return { defs, reload: load };
}

function labelOf(d: Pick<FieldDef, "label">, locale: string) {
  return (locale.startsWith("zh") && d.label.zh) || d.label.en;
}

/** Inputs for each field, in the restaurant's order. */
export function FieldInputs({ defs, values, onChange, disabled }: { defs: FieldDef[]; values: Record<string, unknown>; onChange: (key: string, v: unknown) => void; disabled?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <div className="cf-form two">
      {defs.map((d) => {
        const v = values[d.key];
        const name = `${labelOf(d, locale)}${d.required ? " *" : ""}`;
        if (d.type === "boolean")
          return (
            <label key={d.key} className="inline">
              <input type="checkbox" checked={v === true} disabled={disabled} onChange={(e) => onChange(d.key, e.target.checked)} data-field={d.key} /> {name}
            </label>
          );
        return (
          <label key={d.key}>
            {name}
            {d.type === "select" ? (
              <select value={typeof v === "string" ? v : ""} disabled={disabled} onChange={(e) => onChange(d.key, e.target.value)} data-field={d.key}>
                <option value="">{t(k("unset"))}</option>
                {d.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type={d.type === "number" ? "number" : d.type === "date" ? "date" : d.type === "url" ? "url" : "text"}
                step={d.type === "number" ? "any" : undefined}
                value={v === undefined || v === null ? "" : String(v)}
                disabled={disabled}
                maxLength={d.type === "text" ? 500 : undefined}
                placeholder={d.type === "url" ? "https://" : undefined}
                onChange={(e) => onChange(d.key, e.target.value)}
                data-field={d.key}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

/** A record's values with a Save button. Shows nothing when the restaurant has no fields for it. */
export function CustomFieldsForm({ entity, id, canEdit = true, heading, onSaved }: { entity: Entity; id: string; canEdit?: boolean; heading?: string; onSaved?: () => void }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const { defs } = useFieldDefs(entity);
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [dirty, setDirty] = useState<Record<string, unknown>>({});
  useEffect(() => {
    setValues(null);
    setDirty({});
    api<Values>(`/api/m/fields/values/${entity}/${encodeURIComponent(id)}`).then(setValues, () => setValues({}));
  }, [entity, id]);
  if (!defs?.length || !values) return null;
  const shown = { ...values, ...dirty };
  const save = () =>
    run(async () => {
      const r = await api<Values>(`/api/m/fields/values/${entity}/${encodeURIComponent(id)}`, { method: "PUT", body: { values: dirty } });
      setValues(r);
      setDirty({});
      onSaved?.();
    }, t(k("saved")));
  return (
    <form className="col" onSubmit={(e) => (e.preventDefault(), save())} data-testid={`cf-form-${entity}`}>
      {heading && <h3 style={{ margin: 0 }}>{heading}</h3>}
      <FieldInputs defs={defs} values={shown} disabled={!canEdit || pending} onChange={(key, v) => setDirty({ ...dirty, [key]: v })} />
      {canEdit && (
        <div className="row">
          <button className="btn" disabled={pending || !Object.keys(dirty).length} data-testid="cf-save">
            {t(k("save"))}
          </button>
        </div>
      )}
    </form>
  );
}

/** A "Details" icon for a list row that opens the record's fields; nothing when there are none. */
export function CustomFieldsButton({ entity, id, name, defs }: { entity: Entity; id: string; name: string; defs: FieldDef[] | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!defs?.length) return null;
  return (
    <>
      <button type="button" className="btn small ghost icon" title={t(k("details"))} aria-label={t(k("detailsFor"), { name })} onClick={() => setOpen(true)} data-testid={`cf-open-${entity}`}>
        <ListPlus size={16} />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={t(k("detailsFor"), { name })}>
          <CustomFieldsForm entity={entity} id={id} onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

// ---- Settings: define the fields ----

type Draft = { en: string; zh: string; type: FieldType; options: string; required: boolean; public: boolean };
const EMPTY: Draft = { en: "", zh: "", type: "text", options: "", required: false, public: false };

export function CustomFieldsCard() {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const [entity, setEntity] = useState<Entity>("dish");
  const { defs, reload } = useFieldDefs(entity);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const create = (d: Draft) =>
    run(async () => {
      await api("/api/m/fields", {
        body: { entity, label: { en: d.en, ...(d.zh.trim() ? { zh: d.zh } : {}) }, type: d.type, options: d.type === "select" ? d.options.split("\n").map((o) => o.trim()).filter(Boolean) : undefined, required: d.required, public: entity === "dish" && d.public },
      });
      setDraft(EMPTY);
      await reload();
    }, t(k("added")));
  const patch = (f: FieldDef, body: Record<string, unknown>) =>
    run(async () => {
      await api(`/api/m/fields/${f.id}`, { method: "PATCH", body });
      await reload();
    });
  const move = (i: number, by: number) =>
    run(async () => {
      const list = [...(defs ?? [])];
      const [x] = list.splice(i, 1);
      list.splice(i + by, 0, x);
      await Promise.all(list.map((f, n) => (f.sort === n ? null : api(`/api/m/fields/${f.id}`, { method: "PATCH", body: { sort: n } }))));
      await reload();
    });
  const remove = (f: FieldDef) =>
    run(async () => {
      if (!confirm(t(k("removeConfirm"), { name: labelOf(f, locale) }))) return;
      await api(`/api/m/fields/${f.id}`, { method: "DELETE" });
      await reload();
    });
  const taken = new Set((defs ?? []).map((d) => d.label.en.toLowerCase()));
  const templates = TEMPLATES[entity].filter((x) => !taken.has(x.label.en.toLowerCase()));

  return (
    <section className="card col" data-testid="custom-fields">
      <h2>
        <ListPlus size={18} className="settings-icon" aria-hidden="true" /> {t(k("title"))}
      </h2>
      <p className="muted" style={{ margin: 0 }}>{t(k("lead"))}</p>
      <div className="segmented" role="group" aria-label={t(k("title"))}>
        {ENTITIES.map((e) => (
          <button key={e} type="button" aria-pressed={entity === e} className={entity === e ? "active" : ""} onClick={() => setEntity(e)} data-testid={`cf-entity-${e}`}>
            {t(k(`entities.${e}`))}
          </button>
        ))}
      </div>

      {defs && !defs.length && <p className="muted" style={{ margin: 0 }}>{t(k("none"))}</p>}
      {!!defs?.length && (
        <div className="cf-list">
          {defs.map((f, i) => (
            <div key={f.id} className="cf-row" data-testid="cf-row">
              <div style={{ minWidth: 0 }}>
                <b>{labelOf(f, locale)}</b>
                <div className="muted cf-meta row" style={{ gap: 6 }}>
                  <span>{t(k(`types.${f.type}`))}</span>
                  {f.type === "select" && <span>· {f.options.join(", ")}</span>}
                  {f.required && <span className="badge">{t(k("requiredBadge"))}</span>}
                </div>
              </div>
              <span className="row nowrap">
                {entity === "dish" && (
                  <label className="inline cf-meta" title={t(k("public"))}>
                    <input type="checkbox" checked={f.public} disabled={pending} onChange={(e) => patch(f, { public: e.target.checked })} aria-label={`${t(k("public"))}: ${labelOf(f, locale)}`} /> {t(k("publicBadge"))}
                  </label>
                )}
                <button type="button" className="btn small ghost icon" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label={t(k("up"))}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="btn small ghost icon" disabled={pending || i === defs.length - 1} onClick={() => move(i, 1)} aria-label={t(k("down"))}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" className="btn small ghost icon danger" disabled={pending} onClick={() => remove(f)} aria-label={`${t(k("remove"))}: ${labelOf(f, locale)}`}>
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!!templates.length && (
        <div className="col tight">
          <span className="muted cf-meta">{t(k("quick"))}</span>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {templates.map((x) => (
              <button key={x.label.en} type="button" className="chip" disabled={pending} onClick={() => create({ en: x.label.en, zh: x.label.zh, type: x.type, options: x.options.join("\n"), required: false, public: x.public })}>
                <Plus size={13} /> {locale.startsWith("zh") ? x.label.zh : x.label.en}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="col" onSubmit={(e) => (e.preventDefault(), draft.en.trim() && create(draft))}>
        <div className="cf-form two">
          <label>
            {t(k("name"))}
            <input value={draft.en} maxLength={60} onChange={(e) => setDraft({ ...draft, en: e.target.value })} data-testid="cf-name" />
          </label>
          <label>
            {t(k("nameZh"))}
            <input value={draft.zh} maxLength={60} onChange={(e) => setDraft({ ...draft, zh: e.target.value })} />
          </label>
          <label>
            {t(k("type"))}
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as FieldType })} data-testid="cf-type">
              {FIELD_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(k(`types.${ty}`))}
                </option>
              ))}
            </select>
          </label>
          {draft.type === "select" && (
            <label>
              {t(k("options"))}
              <textarea rows={3} value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} data-testid="cf-options" />
            </label>
          )}
        </div>
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} /> {t(k("required"))}
          </label>
          {entity === "dish" && (
            <label className="inline">
              <input type="checkbox" checked={draft.public} onChange={(e) => setDraft({ ...draft, public: e.target.checked })} /> {t(k("public"))}
            </label>
          )}
          <button className="btn primary" style={{ marginLeft: "auto" }} disabled={pending || !draft.en.trim()} data-testid="cf-add">
            <Plus size={16} /> {t(k("add"))}
          </button>
        </div>
      </form>
    </section>
  );
}
