// The receipt renderer, shared by the till (printing) and the settings preview, so what the
// merchant sees is what prints. Three steps; the first two are pure and unit-tested:
//   1. receiptBlocks: the bill and the merchant's design → blocks (what to print, in which language);
//   2. layoutReceipt: blocks → draw ops (text, filled rects, the logo) at the paper's dot width,
//      with text measured by a callback (a canvas in the browser, a fixed-width stub in tests);
//   3. renderReceipt: paints the ops on a canvas and packs the pixels into a 1-bit bitmap
//      (a threshold for text and rules, dithering for the logo), printed as GS v 0 raster bands.
// Where no canvas exists, receiptLines turns the same blocks into text-mode lines (the fallback).
import QRCode from "qrcode";
import { formatters, LOCALES, translate, type Vars } from "../i18n/core";
import { localizeItem } from "../shared/menuI18n";
import { LOGO_MAX_BYTES, LOGO_MAX_H, LOGO_MAX_W, TEMPLATES, type ReceiptConfig, type ReceiptLogo, type TemplateStyle } from "../shared/receipt";
import type { Menu } from "../shared/types";
import { DOTS, asciiOf, imageBytes, linesBytes, money, packBitmap, textOf, toAscii, txt, type Align, type Bitmap, type Line, type Paper, type Txt } from "./printer";

// ---------------------------------------------------------------------------
// The bill

export interface BillItem {
  /** The dish's name in each language ({ en, zh }), and as written on the menu. */
  names: Record<string, string>;
  original: string;
  qty: number;
  amount: number;
  options: string[];
  notes?: string;
  /** The price rule that priced it ("Happy hour"), printed under the dish. */
  deal?: string;
}

export interface BillPayment {
  method: string;
  /** Who paid this share of a split bill, e.g. "Alice". */
  label?: string | null;
  amount: number;
  tendered?: number | null;
  change: number;
}

/** What the till knows about a settled bill (from the POS order view, or a sample for the preview). */
export interface Bill {
  restaurant: string;
  branch?: string;
  /** This branch's address and phone: every branch prints its own, whatever design it shares. */
  address?: string;
  phone?: string;
  number: string;
  tables: string[];
  cashier?: string;
  closedAt: number;
  timezone?: string;
  currency: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  discountReason?: string;
  serviceCharge: number;
  tax: number;
  rounding: number;
  total: number;
  payments: BillPayment[];
  /** The e-receipt (/receipt/<token>) and the loyalty sign-up page, for the QR codes. */
  receiptUrl?: string;
  joinUrl?: string;
}

// ---------------------------------------------------------------------------
// 1. Blocks

export type Size = "sm" | "md" | "lg" | "xl";

export type Block =
  | { k: "text"; text: Txt; align: Align; size: Size; bold?: boolean }
  /** A line with an amount on the right; dishes have a quantity column and smaller lines underneath. */
  | { k: "row"; left: Txt; right?: Txt; qty?: number; indent?: boolean; size: Size; bold?: boolean; subs?: Txt[] }
  | { k: "rule" }
  | { k: "space" }
  | { k: "logo" }
  | { k: "qr"; codes: { url: string; caption: Txt }[] };

/** The receipt as blocks, in the template's order, in `locale` (and 中文 + English when bilingual). */
export function receiptBlocks(bill: Bill, config: ReceiptConfig, locale: string): Block[] {
  const tpl = TEMPLATES[config.template];
  const two = tpl.style.bilingual || config.language === "bilingual";
  const show = config.show;
  const en = (key: string, vars?: Vars) => translate("en", key, vars);
  /** A label in the receipt's language with English for text mode; both languages on bilingual receipts. */
  const label = (key: string, vars?: Vars, both = two): Txt => {
    if (!both) return txt(translate(locale, key, vars), en(key, vars));
    const zh = translate("zh", key, vars);
    return txt(zh === en(key, vars) ? zh : `${zh} ${en(key, vars)}`, en(key, vars));
  };
  /** A sentence: on bilingual receipts, one line per language. */
  const sentence = (key: string, size: Size): Block[] =>
    (two ? [...new Set([translate("zh", key), en(key)])] : [translate(locale, key)]).map((s): Block => ({ k: "text", text: txt(s, en(key)), align: "center", size }));
  const name = config.businessName || bill.restaurant;
  const head = tpl.style.headerAlign;
  const row = (left: Txt, amount: number, extra: Partial<Extract<Block, { k: "row" }>> = {}): Block => ({ k: "row", left, right: money(amount), size: "md", ...extra });

  const sections: Record<string, () => Block[]> = {
    logo: () => (config.logo ? [{ k: "logo" }] : []),
    brand: () => (config.logo ? [{ k: "logo" }] : [{ k: "text", text: name, align: "center", size: "xl", bold: true }]),
    header: () => {
      const out: Block[] = [{ k: "text", text: name, align: head, size: "xl", bold: true }];
      if (bill.branch && bill.branch !== name) out.push({ k: "text", text: bill.branch, align: head, size: "md" });
      for (const l of (bill.address ?? "").split("\n").filter((x) => x.trim())) out.push({ k: "text", text: l.trim(), align: head, size: "sm" });
      if (bill.phone) out.push({ k: "text", text: label("staff.pos.receiptTel", { phone: bill.phone }, false), align: head, size: "sm" });
      if (config.taxId) out.push({ k: "text", text: label("staff.pos.receiptTaxId", { id: config.taxId }, false), align: head, size: "sm" });
      return out;
    },
    meta: () => {
      const out: Block[] = [];
      const num = show.number ? label("staff.pos.receiptBillNo", { number: bill.number }, false) : null;
      const table = show.table && bill.tables.length ? label("common.table", { label: bill.tables.join("+") }, false) : null;
      if (num || table) out.push({ k: "row", left: (num ?? table)!, right: num && table ? table : undefined, size: "md", bold: true });
      const when = show.dateTime ? txt(formatters(locale).dateTime(bill.closedAt, bill.timezone), formatters("en").dateTime(bill.closedAt, bill.timezone)) : null;
      const cashier = show.cashier && bill.cashier ? label("staff.pos.receiptCashier", { name: bill.cashier }, false) : null;
      if (when || cashier) out.push({ k: "row", left: (when ?? cashier)!, right: when && cashier ? cashier : undefined, size: "sm" });
      return out;
    },
    items: () =>
      bill.items.map((i): Block => {
        const primary = i.names[locale] || i.original;
        const subs: Txt[] = [];
        if (two) {
          const other = [i.original, ...Object.values(i.names)].find((n) => n && n !== primary);
          if (other) subs.push(txt(other, ""));
        }
        if (show.itemOptions && i.options.length) subs.push(i.options.join(", "));
        if (show.itemOptions && i.notes) subs.push(`“${i.notes}”`);
        if (i.deal) subs.push(i.deal);
        return { k: "row", qty: i.qty, left: txt(primary, i.names.en || i.original), right: money(i.amount), size: "md", subs };
      }),
    totals: () => {
      const out: Block[] = [row(label("common.subtotal"), bill.subtotal)];
      if (bill.discount) out.push(row(bill.discountReason ? label("staff.pos.discountReason", { reason: bill.discountReason }, false) : label("common.discount"), -bill.discount));
      if (bill.serviceCharge) out.push(row(label("common.serviceCharge"), bill.serviceCharge));
      if (bill.tax) out.push(row(label("common.tax"), bill.tax));
      if (bill.rounding) out.push(row(label("common.rounding"), bill.rounding));
      return [...out, { k: "row", left: label("common.total"), right: money(bill.total, bill.currency), size: "lg", bold: true }];
    },
    total: () => [{ k: "row", left: label("common.total"), right: money(bill.total, bill.currency), size: "lg", bold: true }],
    payments: () =>
      show.payments
        ? bill.payments.flatMap((p) => {
            const tag = p.label ? ` (${p.label})` : "";
            const m = label(`payMethod.${p.method}`);
            const out: Block[] = [row(txt(textOf(m) + tag, asciiOf(m) + tag), p.amount)];
            if (p.tendered) out.push(row(label("staff.pos.receiptTendered"), p.tendered, { indent: true, size: "sm" }));
            if (p.change) out.push(row(label("common.change"), p.change, { indent: true, size: "sm" }));
            return out;
          })
        : [],
    footer: () => {
      const lines = config.footer.split("\n").filter((l) => l.trim());
      return lines.length ? lines.map((l): Block => ({ k: "text", text: l.trim(), align: "center", size: "md" })) : sentence("staff.pos.receiptThanks", "md");
    },
    qr: () => {
      const codes: { url: string; caption: Txt }[] = [];
      if (show.receiptQr && bill.receiptUrl) codes.push({ url: bill.receiptUrl, caption: label("staff.pos.receiptScanReceipt") });
      if (show.joinQr && bill.joinUrl) codes.push({ url: bill.joinUrl, caption: label("staff.pos.receiptScanJoin") });
      return codes.length ? [{ k: "qr", codes }] : [];
    },
  };

  const out: Block[] = [];
  for (const s of tpl.sections) out.push(...(s === "rule" || s === "space" ? [{ k: s } as Block] : sections[s]()));
  return tidy(out);
}

/** Drop dividers at the ends and merge runs of them (a rule wins over a space), so an empty section leaves no trace. */
function tidy(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const sep = b.k === "rule" || b.k === "space";
    const last = out.at(-1);
    if (sep && (!last || last.k === "rule" || last.k === "space")) {
      if (last && b.k === "rule") out[out.length - 1] = b;
      continue;
    }
    out.push(b);
  }
  while (out.length && (out.at(-1)!.k === "rule" || out.at(-1)!.k === "space")) out.pop();
  return out;
}

// ---------------------------------------------------------------------------
// 2. Layout

/** Text width in dots at a type size and weight. */
export type Measure = (text: string, size: number, bold: boolean) => number;

/** Body type size in dots per S/M/L (24 dots is the printer's own 12×24 font: 3 mm at 203 dpi). */
export const TEXT_PX: Record<ReceiptConfig["textSize"], number> = { s: 20, m: 24, l: 28 };

export type DrawOp =
  /** One line of text; `x` is the anchor for `align`, `y` the middle of the line, `width` as measured. */
  | { op: "text"; x: number; y: number; text: string; size: number; bold: boolean; align: Align; width: number }
  /** A black box: rules and QR modules. */
  | { op: "rect"; x: number; y: number; w: number; h: number }
  /** The logo, scaled into this box (dithered when packed). */
  | { op: "image"; x: number; y: number; w: number; h: number };

export interface Layout {
  width: number;
  height: number;
  ops: DrawOp[];
}

export interface LayoutOptions {
  dots: number;
  style: TemplateStyle;
  textSize: ReceiptConfig["textSize"];
  measure: Measure;
  /** The logo's size, when there is one to draw. */
  logo?: { width: number; height: number } | null;
}

/** Wrap text to a pixel width, at spaces where possible, else between characters (CJK). */
export function wrapPx(s: string, max: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let row = "";
  for (const ch of s) {
    if (row && measure(row + ch) > max) {
      const sp = row.lastIndexOf(" ");
      if (sp > 0 && ch !== " ") (out.push(row.slice(0, sp)), (row = row.slice(sp + 1) + ch));
      else (out.push(row), (row = ch === " " ? "" : ch));
    } else row += ch;
  }
  out.push(row);
  return out.map((r) => r.trimEnd());
}

/** The logo's size on paper: the stored size, shrunk to the paper width and the template's tallest logo. */
export function logoSize(logo: { width: number; height: number }, dots: number, max: number): { w: number; h: number } {
  const k = Math.min(1, dots / logo.width, max / logo.height);
  return { w: Math.max(1, Math.round(logo.width * k)), h: Math.max(1, Math.round(logo.height * k)) };
}

/** A QR code's modules (dark is truthy), row by row. */
export const qrModules = (url: string): { size: number; data: ArrayLike<number | boolean> } => QRCode.create(url, { errorCorrectionLevel: "M" }).modules;

/** QR modules as rows of black runs, `scale` dots per module, top left at x, y. */
export function qrRects(m: { size: number; data: ArrayLike<number | boolean> }, x: number, y: number, scale: number): Extract<DrawOp, { op: "rect" }>[] {
  const rects: Extract<DrawOp, { op: "rect" }>[] = [];
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; ) {
      if (!m.data[r * m.size + c]) {
        c++;
        continue;
      }
      const from = c;
      while (c < m.size && m.data[r * m.size + c]) c++;
      rects.push({ op: "rect", x: x + from * scale, y: y + r * scale, w: (c - from) * scale, h: scale });
    }
  return rects;
}

/** Lay blocks out top to bottom at `dots` across: every op sits inside 0..dots, amounts flush right. */
export function layoutReceipt(blocks: Block[], o: LayoutOptions): Layout {
  const W = o.dots;
  const st = o.style;
  const base = Math.round(TEXT_PX[o.textSize] * st.scale);
  const px: Record<Size, number> = { sm: Math.round(base * 0.84), md: base, lg: Math.round(base * st.totalScale), xl: Math.round(base * st.nameScale) };
  const lh = (size: number) => Math.round(size * st.leading);
  const ops: DrawOp[] = [];
  let y = 4;
  const text = (s: string, size: number, bold: boolean, align: Align, x0: number, x1: number) => {
    const width = o.measure(s, size, bold);
    const x = align === "left" ? x0 : align === "right" ? x1 : Math.round((x0 + x1) / 2);
    ops.push({ op: "text", x, y: y + Math.round(lh(size) / 2), text: s, size, bold, align, width });
  };
  const wrapAt = (s: string, size: number, bold: boolean, max: number) => wrapPx(s, max, (t) => o.measure(t, size, bold));
  // one quantity column for every dish, as wide as the widest "12×"
  const qtys = blocks.flatMap((b) => (b.k === "row" && b.qty !== undefined ? [b] : []));
  const qtyW = qtys.length ? Math.max(...qtys.map((b) => o.measure(`${b.qty}×`, px[b.size], true))) + Math.round(base * 0.5) : 0;

  for (const b of blocks) {
    if (b.k === "space") y += Math.round(lh(base) * 0.6);
    else if (b.k === "rule") {
      y += st.ruleGap;
      if (st.rule === "solid") ops.push({ op: "rect", x: 0, y, w: W, h: 2 });
      else for (let x = 0; x < W; x += 12) ops.push({ op: "rect", x, y, w: Math.min(7, W - x), h: 2 });
      y += 2 + st.ruleGap;
    } else if (b.k === "logo") {
      if (!o.logo) continue;
      const { w, h } = logoSize(o.logo, W, st.logoMax);
      ops.push({ op: "image", x: Math.round((W - w) / 2), y, w, h });
      y += h + Math.round(base * 0.5);
    } else if (b.k === "text") {
      const size = px[b.size];
      for (const l of wrapAt(textOf(b.text), size, !!b.bold, W)) {
        text(l, size, !!b.bold, b.align, 0, W);
        y += lh(size);
      }
    } else if (b.k === "row") {
      const size = px[b.size];
      const bold = !!b.bold;
      const right = b.right === undefined ? "" : textOf(b.right);
      const rw = right ? o.measure(right, size, bold) : 0;
      const gap = Math.round(size * 0.6);
      const x0 = (b.qty !== undefined ? qtyW : 0) + (b.indent ? Math.round(base * 0.8) : 0);
      // a long amount next to a narrow column: the text takes the full width, the amount its own line
      const beside = !right || W - x0 - rw - gap >= W * 0.35;
      const lines = wrapAt(textOf(b.left), size, bold, beside ? W - x0 - (right ? rw + gap : 0) : W - x0);
      if (b.qty !== undefined) text(`${b.qty}×`, size, true, "left", 0, W);
      lines.forEach((l, i) => {
        text(l, size, bold, "left", x0, W);
        if (i === 0 && right && beside) text(right, size, bold, "right", 0, W);
        y += lh(size);
      });
      if (right && !beside) (text(right, size, bold, "right", 0, W), (y += lh(size)));
      for (const s of b.subs ?? []) {
        const sz = px.sm;
        for (const l of wrapAt(textOf(s), sz, false, W - x0)) (text(l, sz, false, "left", x0, W), (y += lh(sz)));
      }
      if (b.qty !== undefined && b.subs?.length) y += Math.round(base * 0.2);
    } else if (b.k === "qr") {
      y += Math.round(base * 0.5);
      const cell = Math.floor(W / b.codes.length);
      let bottom = y;
      b.codes.forEach((c, n) => {
        const m = qrModules(c.url);
        const scale = Math.max(2, Math.floor(Math.min(cell - 24, st.qrMax) / m.size));
        const side = m.size * scale;
        ops.push(...qrRects(m, n * cell + Math.round((cell - side) / 2), y, scale));
        const top = y;
        y += side + Math.round(base * 0.4);
        for (const l of wrapAt(textOf(c.caption), px.sm, false, cell - 8)) (text(l, px.sm, false, "center", n * cell, (n + 1) * cell), (y += lh(px.sm)));
        bottom = Math.max(bottom, y);
        y = top;
      });
      y = bottom;
    }
  }
  return { width: W, height: Math.ceil(y + 8), ops };
}

// ---------------------------------------------------------------------------
// Text-mode fallback

/** The blocks as text-mode lines (no logo; QR codes as their caption and link). */
export function receiptLines(blocks: Block[]): Line[] {
  const lines: Line[] = [];
  const printable = (t: Txt) => toAscii(textOf(t)).printable || !!asciiOf(t);
  for (const b of blocks) {
    if (b.k === "rule") lines.push("rule");
    else if (b.k === "space") lines.push({ left: "" });
    else if (b.k === "text") lines.push({ left: b.text, align: b.align, bold: b.bold, big: b.size === "xl" });
    else if (b.k === "row") {
      const pad = b.indent ? "  " : "";
      const left = b.qty !== undefined ? txt(`${b.qty} x ${textOf(b.left)}`, `${b.qty} x ${asciiOf(b.left)}`) : txt(pad + textOf(b.left), pad + asciiOf(b.left));
      lines.push({ left, right: b.right, bold: b.bold });
      for (const s of b.subs ?? []) if (printable(s)) lines.push({ left: txt(`    ${textOf(s)}`, `    ${asciiOf(s)}`) });
    } else if (b.k === "qr") for (const c of b.codes) lines.push({ left: c.caption, align: "center" }, { left: c.url, align: "center" });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// A sample bill for the preview and test prints: the restaurant's own dishes when it has some

const SAMPLE = [
  { names: { en: "Char Kway Teow", zh: "炒粿条" }, price: 1290, qty: 2, options: ["Extra prawns"], notes: "Less spicy" },
  { names: { en: "Hainanese Chicken Rice", zh: "海南鸡饭" }, price: 1150, qty: 1, options: [] },
  { names: { en: "Teh Tarik", zh: "拉茶" }, price: 450, qty: 2, options: ["Less sweet"] },
  { names: { en: "Kaya Butter Toast", zh: "咖椰牛油吐司" }, price: 380, qty: 1, options: [] },
];

export interface SampleInput {
  restaurant: string;
  branch?: string;
  address?: string;
  phone?: string;
  currency: string;
  timezone?: string;
  cashier?: string;
  menu?: Menu | null;
  serviceChargePct?: number;
  taxPct?: number;
  cashRounding?: number;
  /** Where the app is served, for the QR codes. */
  origin: string;
  tenantSlug?: string;
  now?: number;
}

export function sampleBill(s: SampleInput): Bill {
  const dishes = (s.menu?.items ?? []).filter((i) => i.active && i.price > 0).slice(0, 4);
  const lang = s.menu?.language ?? "en";
  const items: BillItem[] = dishes.length
    ? dishes.map((d, n) => {
        const qty = n % 2 ? 1 : 2;
        const opt = d.modifiers.find((g) => g.options.length)?.options[0];
        return {
          names: Object.fromEntries(LOCALES.map((l) => [l.code, localizeItem(d, l.code, lang).name])),
          original: d.name,
          qty,
          amount: (d.price + (opt?.price ?? 0)) * qty,
          options: opt ? [opt.name] : [],
          notes: n === 0 ? SAMPLE[0].notes : undefined,
        };
      })
    : SAMPLE.map((d) => ({ names: d.names, original: d.names.en, qty: d.qty, amount: d.price * d.qty, options: d.options, notes: d.notes }));
  const subtotal = items.reduce((a, i) => a + i.amount, 0);
  const serviceCharge = Math.round((subtotal * (s.serviceChargePct ?? 10)) / 100);
  const tax = Math.round(((subtotal + serviceCharge) * (s.taxPct ?? 6)) / 100);
  const step = s.cashRounding || 5;
  const raw = subtotal + serviceCharge + tax;
  const total = Math.round(raw / step) * step;
  const tendered = Math.ceil(total / 5000) * 5000;
  return {
    restaurant: s.restaurant,
    branch: s.branch,
    address: s.address,
    phone: s.phone,
    number: "1042",
    tables: ["T3"],
    cashier: s.cashier,
    closedAt: s.now ?? Date.now(),
    timezone: s.timezone,
    currency: s.currency,
    items,
    subtotal,
    discount: 0,
    serviceCharge,
    tax,
    rounding: total - raw,
    total,
    payments: [{ method: "cash", amount: total, tendered, change: tendered - total }],
    receiptUrl: `${s.origin}/receipt/sample`,
    joinUrl: `${s.origin}/me${s.tenantSlug ? `?tenant=${encodeURIComponent(s.tenantSlug)}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// 3. Browser: paint on a canvas, pack to 1 bit

/** The app's type: Figtree, then the system's Chinese faces. */
export const RECEIPT_FONT = '"Figtree Variable", "Figtree", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
const fontOf = (size: number, bold: boolean) => `${bold ? 750 : 550} ${size}px ${RECEIPT_FONT}`;

export interface ReceiptJob {
  bill: Bill;
  config: ReceiptConfig;
  /** The language to print in (see receiptLocale). */
  locale: string;
}

/** Wait (briefly) for the web fonts, so the first receipt isn't drawn in a fallback face. */
async function fontsReady() {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const load = Promise.all([fontOf(24, false), fontOf(24, true)].map((f) => fonts.load(f, "Aa1 中")));
  await Promise.race([load, new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** Draw the receipt at the paper's dot width; null outside a browser. */
export async function renderReceipt(job: ReceiptJob, paper: Paper): Promise<{ bitmap: Bitmap; layout: Layout } | null> {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  await fontsReady();
  const logo = job.config.logo ? await loadImage(job.config.logo.src).catch(() => null) : null;
  let font = "";
  const measure: Measure = (s, size, bold) => {
    const f = fontOf(size, bold);
    if (f !== font) g.font = font = f;
    return Math.ceil(g.measureText(s).width);
  };
  const tpl = TEMPLATES[job.config.template];
  const layout = layoutReceipt(receiptBlocks(job.bill, job.config, job.locale), { dots: DOTS[paper], style: tpl.style, textSize: job.config.textSize, measure, logo: logo ? job.config.logo : null });
  c.width = layout.width;
  c.height = layout.height;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000";
  g.textBaseline = "middle";
  for (const op of layout.ops) {
    if (op.op === "rect") g.fillRect(op.x, op.y, op.w, op.h);
    else if (op.op === "image" && logo) {
      g.imageSmoothingQuality = "high";
      g.drawImage(logo, op.x, op.y, op.w, op.h);
    } else if (op.op === "text") {
      g.font = fontOf(op.size, op.bold);
      g.textAlign = op.align;
      g.fillText(op.text, op.x, op.y);
    }
  }
  const px = g.getImageData(0, 0, c.width, c.height).data;
  return { bitmap: packBitmap(px, c.width, c.height, layout.ops.filter((o) => o.op === "image")), layout };
}

/** The receipt as printer bytes: one raster image where the browser can draw it, else text mode. */
export async function receiptBytes(job: ReceiptJob, paper: Paper, openDrawer = false): Promise<Uint8Array> {
  const drawn = await renderReceipt(job, paper).catch(() => null);
  if (drawn) return imageBytes(drawn.bitmap, { openDrawer });
  return linesBytes(receiptLines(receiptBlocks(job.bill, job.config, job.locale)), { paper, openDrawer });
}

/** Show a bitmap on a canvas exactly as it prints: black dots on white paper. */
export function paintBitmap(c: HTMLCanvasElement, b: Bitmap) {
  c.width = b.width;
  c.height = b.height;
  const g = c.getContext("2d");
  if (!g) return;
  const img = g.createImageData(b.width, b.height);
  const bytes = b.width / 8;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) {
      const v = b.data[y * bytes + (x >> 3)] & (0x80 >> (x & 7)) ? 0 : 255;
      const p = (y * b.width + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
  g.putImageData(img, 0, 0);
}

/**
 * A logo the merchant picked, ready to store: flattened onto white, in greys, downscaled to the
 * 80 mm paper width, and compressed until its data URL fits the cap (smaller each round).
 * Throws "logo_too_large" when even a small version doesn't fit.
 */
export async function prepareLogo(file: Blob): Promise<ReceiptLogo> {
  const img = await createImageBitmap(file);
  const c = document.createElement("canvas");
  const g = c.getContext("2d", { willReadFrequently: true })!;
  let k = Math.min(1, LOGO_MAX_W / img.width, LOGO_MAX_H / img.height);
  for (let round = 0; round < 8; round++, k *= 0.8) {
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height);
    for (let p = 0; p < px.data.length; p += 4) px.data[p] = px.data[p + 1] = px.data[p + 2] = Math.round(0.299 * px.data[p] + 0.587 * px.data[p + 1] + 0.114 * px.data[p + 2]);
    g.putImageData(px, 0, 0);
    for (const [type, q] of [["image/png"], ["image/webp", 0.85], ["image/jpeg", 0.85]] as const) {
      const src = c.toDataURL(type, q);
      if (src.startsWith(`data:${type};`) && src.length <= LOGO_MAX_BYTES) return { src, width: c.width, height: c.height };
    }
  }
  throw new Error("logo_too_large");
}
