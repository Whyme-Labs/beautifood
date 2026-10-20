import { describe, expect, it } from "vitest";
import { cleanValue, guestFacts, keyOf, mergeValues, publicValues, type FieldDef } from "../../src/shared/customFields";

const def = (key: string, type: FieldDef["type"], extra: Partial<FieldDef> = {}): FieldDef => ({ id: `cf_${key}`, entity: "dish", key, label: { en: key }, type, options: [], required: false, public: false, sort: 0, ...extra });

describe("custom field keys", () => {
  it("come from the label, and always start with a letter", () => {
    expect(keyOf("Halal cert no.")).toBe("halal_cert_no");
    expect(keyOf("  Café origin ")).toBe("cafe_origin");
    expect(keyOf("2nd phone")).toBe("field_2nd_phone");
    expect(keyOf("清真")).toBe("field");
  });
});

describe("custom field values", () => {
  it("are typed by their field", () => {
    expect(cleanValue(def("n", "number"), "1,200.5")).toEqual({ ok: true, value: 1200.5 });
    expect(cleanValue(def("n", "number"), "lots")).toMatchObject({ ok: false });
    expect(cleanValue(def("b", "boolean"), "true")).toEqual({ ok: true, value: true });
    expect(cleanValue(def("b", "boolean"), 0)).toEqual({ ok: true, value: false });
    expect(cleanValue(def("b", "boolean"), "maybe")).toMatchObject({ ok: false });
    expect(cleanValue(def("s", "select", { options: ["GrabFood", "foodpanda"] }), "FOODPANDA")).toEqual({ ok: true, value: "foodpanda" });
    expect(cleanValue(def("s", "select", { options: ["GrabFood"] }), "Uber")).toMatchObject({ ok: false });
    expect(cleanValue(def("d", "date"), "2024-02-29")).toEqual({ ok: true, value: "2024-02-29" });
    expect(cleanValue(def("d", "date"), "2023-02-29")).toMatchObject({ ok: false });
    expect(cleanValue(def("d", "date"), "17/05/1990")).toMatchObject({ ok: false });
    expect(cleanValue(def("u", "url"), "https://halal.gov.my/x")).toEqual({ ok: true, value: "https://halal.gov.my/x" });
    expect(cleanValue(def("u", "url"), "javascript:alert(1)")).toMatchObject({ ok: false });
    expect(cleanValue(def("t", "text"), "x".repeat(501))).toMatchObject({ ok: false });
    // empty is "not set", for every type
    for (const ty of ["text", "number", "boolean", "select", "date", "url"] as const) expect(cleanValue(def("x", ty), "")).toEqual({ ok: true, value: null });
  });

  it("merge into what's there: unknown keys dropped, empty clears, required must end up set", () => {
    const defs = [def("supplier", "text", { required: true }), def("calories", "number")];
    expect(mergeValues(defs, { supplier: "Pak Ali", gone: 1 }, { calories: "320", other: "x" })).toEqual({ values: { supplier: "Pak Ali", calories: 320 }, errors: {} });
    expect(mergeValues(defs, { supplier: "Pak Ali", calories: 320 }, { calories: null })).toEqual({ values: { supplier: "Pak Ali" }, errors: {} });
    expect(mergeValues(defs, { supplier: "Pak Ali" }, { supplier: "" }).errors).toEqual({ supplier: "is required" });
    expect(mergeValues(defs, {}, { calories: "x" }).errors).toEqual({ calories: "must be a number", supplier: "is required" });
  });

  it("only public dish fields reach guests, as short facts in their language", () => {
    const defs = [def("halal", "boolean", { public: true, label: { en: "Halal certified", zh: "清真认证" } }), def("supplier", "text"), def("heat", "select", { public: true, options: ["Hot"], label: { en: "Heat" } })];
    const v = publicValues(defs, { halal: true, supplier: "Pak Ali", heat: "Hot" });
    expect(v).toEqual({ halal: true, heat: "Hot" });
    expect(guestFacts(defs.filter((d) => d.public), v, "en")).toEqual(["Halal certified", "Heat: Hot"]);
    expect(guestFacts(defs.filter((d) => d.public), v, "zh")).toEqual(["清真认证", "Heat: Hot"]);
    expect(guestFacts(defs.filter((d) => d.public), { halal: false }, "en")).toEqual([]);
  });
});
