// Printed receipts: the merchant's design (template, logo, header and footer, what to show,
// language, text size) and the built-in templates. Shared by the API (validation) and the
// web app (renderer, settings). A template is data: its sections in print order and a style.
import { z } from "zod";

export const TEMPLATE_IDS = ["classic", "compact", "bilingual", "minimal"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/**
 * What a template prints, top to bottom. "rule" is a divider and "space" a blank line; a divider
 * next to an empty section (say, payments turned off) is dropped, so templates never print two in a row.
 *   brand: the logo, or the business name when there is none (Minimal)
 *   meta: bill number, table, date and time, cashier
 *   total: the grand total only (Minimal); totals: subtotal, charges, total
 */
export type Section = "logo" | "header" | "brand" | "meta" | "items" | "totals" | "total" | "payments" | "footer" | "qr" | "rule" | "space";

export interface TemplateStyle {
  /** Body type size against the merchant's S/M/L choice. */
  scale: number;
  /** Line height as a multiple of the type size. */
  leading: number;
  /** Business name size against the body size. */
  nameScale: number;
  /** Grand total size against the body size. */
  totalScale: number;
  headerAlign: "left" | "center";
  rule: "dashed" | "solid";
  /** Dots of air above and below a divider. */
  ruleGap: number;
  /** Tallest logo, and widest QR code, in dots. */
  logoMax: number;
  qrMax: number;
  /** Labels in 中文 + English, and each dish with its other name underneath. */
  bilingual: boolean;
}

export interface ReceiptTemplate {
  id: TemplateId;
  sections: Section[];
  style: TemplateStyle;
}

const BASE: TemplateStyle = { scale: 1, leading: 1.3, nameScale: 1.6, totalScale: 1.25, headerAlign: "center", rule: "dashed", ruleGap: 10, logoMax: 160, qrMax: 216, bilingual: false };

export const TEMPLATES: Record<TemplateId, ReceiptTemplate> = {
  classic: {
    id: "classic",
    sections: ["logo", "header", "rule", "meta", "rule", "items", "rule", "totals", "rule", "payments", "rule", "footer", "qr"],
    style: BASE,
  },
  compact: {
    id: "compact",
    sections: ["logo", "header", "rule", "meta", "rule", "items", "rule", "totals", "payments", "rule", "footer", "qr"],
    style: { ...BASE, scale: 0.84, leading: 1.14, nameScale: 1.35, totalScale: 1.15, ruleGap: 4, logoMax: 80, qrMax: 150 },
  },
  bilingual: {
    id: "bilingual",
    sections: ["logo", "header", "rule", "meta", "rule", "items", "rule", "totals", "rule", "payments", "rule", "footer", "qr"],
    style: { ...BASE, bilingual: true },
  },
  minimal: {
    id: "minimal",
    sections: ["brand", "space", "items", "rule", "total", "space", "footer", "qr"],
    style: { ...BASE, leading: 1.4, nameScale: 1.4, totalScale: 1.5, rule: "solid", ruleGap: 12, logoMax: 200 },
  },
};

/** The receipt's language: the cashier's, the guest's when the bill knows it, English, or both. */
export const RECEIPT_LANGUAGES = ["cashier", "guest", "en", "bilingual"] as const;
export const TEXT_SIZES = ["s", "m", "l"] as const;
export const SHOW_KEYS = ["number", "table", "dateTime", "cashier", "itemOptions", "payments", "receiptQr", "joinQr"] as const;
export type ShowKey = (typeof SHOW_KEYS)[number];

/** Longest logo data URL the API stores (the browser downscales and compresses to fit). */
export const LOGO_MAX_BYTES = 64 * 1024;
/** Widest and tallest stored logo, in dots: the 80 mm paper width, and a sane height. */
export const LOGO_MAX_W = 576;
export const LOGO_MAX_H = 320;

const Logo = z
  .object({
    src: z
      .string()
      .max(LOGO_MAX_BYTES, "The logo is too large")
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, "The logo must be a PNG, JPEG or WebP image"),
    width: z.number().int().min(1).max(LOGO_MAX_W),
    height: z.number().int().min(1).max(LOGO_MAX_H),
  })
  .strict();

const line = (max: number) => z.string().trim().max(max);

export const ReceiptConfigSchema = z
  .object({
    template: z.enum(TEMPLATE_IDS),
    logo: Logo.nullable(),
    /** Empty: the restaurant's name. (The address and phone are each branch's own, from the branch.) */
    businessName: line(80),
    /** Tax / SST registration number. */
    taxId: line(60),
    /** Printed at the bottom; empty: the standard thank-you. */
    footer: z.string().trim().max(300).refine((s) => s.split("\n").length <= 6, "Keep the footer to 6 lines"),
    show: z.object(Object.fromEntries(SHOW_KEYS.map((k) => [k, z.boolean()])) as Record<ShowKey, z.ZodBoolean>).strict(),
    language: z.enum(RECEIPT_LANGUAGES),
    textSize: z.enum(TEXT_SIZES),
  })
  .strict();

export type ReceiptConfig = z.infer<typeof ReceiptConfigSchema>;
export type ReceiptLogo = NonNullable<ReceiptConfig["logo"]>;

/** What a restaurant prints before anyone opens the settings. */
export const DEFAULT_RECEIPT: ReceiptConfig = {
  template: "classic",
  logo: null,
  businessName: "",
  taxId: "",
  footer: "",
  show: { number: true, table: true, dateTime: true, cashier: true, itemOptions: true, payments: true, receiptQr: true, joinQr: false },
  language: "cashier",
  textSize: "m",
};

/**
 * The receipt design in force: defaults, then the restaurant's saved design, then the branch's
 * override. Stored JSON is trusted only field by field, so a design saved by an older version
 * (or a hand-edited row) still prints.
 */
export function resolveReceipt(...layers: (Partial<ReceiptConfig> | null | undefined)[]): ReceiptConfig {
  let out: ReceiptConfig = DEFAULT_RECEIPT;
  for (const l of layers) {
    if (!l) continue;
    const show = Object.fromEntries(SHOW_KEYS.map((k) => [k, typeof l.show?.[k] === "boolean" ? l.show[k] : out.show[k]])) as ReceiptConfig["show"];
    out = { ...out, ...l, show };
  }
  const ok = ReceiptConfigSchema.safeParse(out);
  if (ok.success) return ok.data;
  // keep every field that is valid on its own, default the rest
  const fields = ReceiptConfigSchema.shape;
  const fixed = { ...DEFAULT_RECEIPT } as Record<string, unknown>;
  for (const [k, schema] of Object.entries(fields)) {
    const v = schema.safeParse((out as Record<string, unknown>)[k]);
    if (v.success) fixed[k] = v.data;
  }
  return fixed as ReceiptConfig;
}

/** The locale to print in. "bilingual" prints the cashier's language with the other underneath. */
export function receiptLocale(language: ReceiptConfig["language"], cashier: string, guest?: string | null): string {
  if (language === "en") return "en";
  if (language === "guest" && guest) return guest;
  return cashier;
}
