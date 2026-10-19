// Receipt printer + cash drawer, straight from the browser: an ESC/POS encoder
// (pure, no DOM, unit-tested) and three transports (WebUSB, Web Serial, Web Bluetooth).
//
// Non-ASCII text (中文 dish names, a Chinese restaurant name, a zh cashier's labels):
// most cheap printers ship without GBK/GB18030 fonts, and their code pages disagree
// above 0x7f, so the encoder never sends a byte above 0x7f as text. Each line is, in order:
//   1. printed as text when it is ASCII after safe transliteration (NFKC folds fullwidth
//      forms, NFKD strips accents: "Café" → "Cafe", typographic quotes and dashes map to ASCII);
//   2. otherwise drawn as a 1-bit image (GS v 0) by a rasterizer, when one is given:
//      the browser renders the line on a canvas, so CJK prints on every printer;
//   3. otherwise printed from its ASCII alternative (the English label, or the dish's English
//      or original name: orders carry original names), with any leftover character as "?".
import { formatters, translate } from "../i18n/core";

// ---------------------------------------------------------------------------
// ESC/POS commands

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Paper = 58 | 80;
export type Align = "left" | "center" | "right";

/** Characters per line in the default 12×24 font, and printable dots across. */
export const COLS: Record<Paper, number> = { 58: 32, 80: 48 };
export const DOTS: Record<Paper, number> = { 58: 384, 80: 576 };

export const init = () => [ESC, 0x40];
export const align = (a: Align) => [ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0];
export const bold = (on: boolean) => [ESC, 0x45, on ? 1 : 0];
/** Double width and height (GS ! 0x11), or back to normal. */
export const size = (big: boolean) => [GS, 0x21, big ? 0x11 : 0];
export const feed = (lines: number) => [ESC, 0x64, Math.max(0, Math.min(255, lines))];
/** Feed past the tear bar, then a partial cut (GS V 1). */
export const cut = (lines = 4) => [...feed(lines), GS, 0x56, 0x01];
/** Pulse drawer pin 2 for 50 ms on, 500 ms off (ESC p 0 25 250). */
export const drawerKick = () => [ESC, 0x70, 0x00, 25, 250];

const MAP: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"', "„": '"', "–": "-", "—": "-", "−": "-", "…": "...",
  "·": ".", "•": "*", "×": "x", "÷": "/", "€": "EUR", "£": "GBP", "¥": "Y", "฿": "THB", "°": "o", " ": " ", "ß": "ss", "æ": "ae", "ø": "o", "đ": "d",
};

/** Text the printer can show as is: transliterated to printable ASCII, and whether nothing was lost. */
export function toAscii(s: string): { text: string; printable: boolean } {
  let text = "";
  let printable = true;
  for (const ch of s.normalize("NFKC")) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c < 0x7f) text += ch;
    else if (MAP[ch] !== undefined) text += MAP[ch];
    else if (ch === "\t" || ch === "\n" || ch === "\r") text += " ";
    else {
      const d = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      if (/^[\x20-\x7e]+$/.test(d)) text += d;
      else {
        printable = false;
        if (!text.endsWith("?")) text += "?";
      }
    }
  }
  return { text, printable };
}

const ascii = (s: string) => Array.from(toAscii(s).text, (ch) => ch.charCodeAt(0));

/** Word-wrap to `width` characters, splitting words that are longer than a line. */
export function wrap(s: string, width: number): string[] {
  const out: string[] = [];
  let row = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > width) {
      if (row) (out.push(row), (row = ""));
      out.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!w) continue;
    if (!row) row = w;
    else if (row.length + 1 + w.length <= width) row += ` ${w}`;
    else (out.push(row), (row = w));
  }
  if (row || !out.length) out.push(row);
  return out;
}

/** "label ........ amount" filling exactly `width`; a long label wraps above its amount. */
export function columns(left: string, right: string, width: number): string[] {
  if (!right) return wrap(left, width);
  const room = width - right.length - 1;
  if (room < 4) return [...wrap(left, width), right.padStart(width)];
  const rows = wrap(left, room);
  const last = rows.pop()!;
  const fill = width - last.length - right.length;
  return [...rows, last + (fill >= 4 ? ` ${".".repeat(fill - 2)} ` : " ".repeat(fill)) + right];
}

/** Concatenate command arrays and byte arrays into one buffer. */
export function concat(parts: (number[] | Uint8Array)[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let i = 0;
  for (const p of parts) (out.set(p, i), (i += p.length));
  return out;
}

/** Split a buffer into writes of at most `max` bytes. */
export function chunks(data: Uint8Array, max: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += max) out.push(data.subarray(i, i + max));
  return out;
}

/** A 1-bit image: `width` dots (a multiple of 8), rows top to bottom, MSB is the leftmost dot, 1 is black. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Threshold RGBA pixels (as from a canvas) into a bitmap. */
export function packBitmap(rgba: ArrayLike<number>, width: number, height: number): Bitmap {
  const bytes = Math.ceil(width / 8);
  const data = new Uint8Array(bytes * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const lum = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
      if (rgba[p + 3] > 127 && lum < 128) data[y * bytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  return { width: bytes * 8, height, data };
}

/** GS v 0 raster image, in bands so small printer buffers keep up. */
export function raster(b: Bitmap, band = 128): number[] {
  const bytes = b.width / 8;
  const out: number[] = [];
  for (let y = 0; y < b.height; y += band) {
    const h = Math.min(band, b.height - y);
    out.push(GS, 0x76, 0x30, 0, bytes & 0xff, bytes >> 8, h & 0xff, h >> 8);
    for (const v of b.data.subarray(y * bytes, (y + h) * bytes)) out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lines and receipts

/** Text shown to the guest, with an ASCII alternative for printers that cannot draw it. */
export type Txt = string | { text: string; ascii: string };
const textOf = (t: Txt) => (typeof t === "string" ? t : t.text);
const asciiOf = (t: Txt) => (typeof t === "string" ? t : t.ascii);
export const txt = (text: string, ascii: string): Txt => (text === ascii ? text : { text, ascii });

export type Line = { left: Txt; right?: Txt; align?: Align; bold?: boolean; big?: boolean } | "rule";

/** Draws one line that is not plain ASCII; returns null when it cannot. */
export type Rasterizer = (line: { left: string; right?: string; align: Align; bold: boolean; big: boolean }, dots: number) => Bitmap | null;

export interface EncodeOptions {
  paper: Paper;
  raster?: Rasterizer;
}

/** Encode lines as ESC/POS (no init or cut). */
export function encodeLines(lines: Line[], { paper, raster: draw }: EncodeOptions): Uint8Array {
  const parts: number[][] = [];
  for (const l of lines) {
    if (l === "rule") {
      parts.push([...ascii("-".repeat(COLS[paper])), LF]);
      continue;
    }
    const a = l.align ?? "left";
    const left = textOf(l.left);
    const right = l.right === undefined ? "" : textOf(l.right);
    const plain = toAscii(left).printable && toAscii(right).printable;
    const img = !plain && draw ? draw({ left, right: right || undefined, align: a, bold: !!l.bold, big: !!l.big }, DOTS[paper]) : null;
    if (img) {
      parts.push(align("left"), raster(img));
      continue;
    }
    const L = plain ? left : asciiOf(l.left);
    const R = plain ? right : l.right === undefined ? "" : asciiOf(l.right);
    const cols = l.big ? COLS[paper] / 2 : COLS[paper];
    const rows = R ? columns(toAscii(L).text, toAscii(R).text, cols) : wrap(toAscii(L).text, cols);
    parts.push(R ? align("left") : align(a), bold(!!l.bold), size(!!l.big));
    for (const r of rows) parts.push([...ascii(r), LF]);
    parts.push(size(false), bold(false), align("left"));
  }
  return concat(parts);
}

const SYMBOL: Record<string, string> = { MYR: "RM", USD: "$", SGD: "S$", AUD: "A$", IDR: "Rp" };

/** Money in minor units, ASCII only: "12.90", or "RM 12.90" with a currency. */
export function money(minor: number, currency?: string): string {
  const [whole, frac] = (Math.abs(minor) / 100).toFixed(2).split(".");
  const n = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  const sym = currency ? `${SYMBOL[currency] ?? currency} ` : "";
  return `${minor < 0 ? "-" : ""}${sym}${n}`;
}

export interface ReceiptLabels {
  bill: Txt;
  subtotal: Txt;
  discount: Txt;
  serviceCharge: Txt;
  tax: Txt;
  rounding: Txt;
  total: Txt;
  tendered: Txt;
  change: Txt;
  thanks: Txt;
}

/** What the till knows about a settled bill (derived from the POS order view). */
export interface ReceiptData {
  restaurant: Txt;
  branch?: Txt;
  address?: Txt;
  number: string;
  table?: Txt;
  when: Txt;
  currency: string;
  items: { name: Txt; qty: number; amount: number; options?: Txt }[];
  subtotal: number;
  discount: number;
  discountLabel?: Txt;
  serviceCharge: number;
  tax: number;
  rounding: number;
  total: number;
  payments: { label: Txt; amount: number; tendered?: number | null; change: number }[];
  labels: ReceiptLabels;
}

export interface ReceiptOptions extends EncodeOptions {
  /** Kick the cash drawer before printing (one write for both). */
  openDrawer?: boolean;
}

const join = (a: Txt, b: string): Txt => txt(`${textOf(a)} ${b}`, `${asciiOf(a)} ${b}`);

/** The receipt as lines: header, items, totals, payments, thank-you. */
export function receiptLines(r: ReceiptData): Line[] {
  const L = r.labels;
  const lines: Line[] = [{ left: r.restaurant, align: "center", bold: true, big: true }];
  if (r.branch) lines.push({ left: r.branch, align: "center" });
  if (r.address) lines.push({ left: r.address, align: "center" });
  lines.push("rule", { left: join(L.bill, `#${r.number}`), right: r.table, bold: true }, { left: r.when }, "rule");
  for (const i of r.items) {
    lines.push({ left: txt(`${i.qty} x ${textOf(i.name)}`, `${i.qty} x ${asciiOf(i.name)}`), right: money(i.amount) });
    if (i.options) lines.push({ left: txt(`    ${textOf(i.options)}`, `    ${asciiOf(i.options)}`) });
  }
  lines.push("rule", { left: L.subtotal, right: money(r.subtotal) });
  if (r.discount) lines.push({ left: r.discountLabel ?? L.discount, right: money(-r.discount) });
  if (r.serviceCharge) lines.push({ left: L.serviceCharge, right: money(r.serviceCharge) });
  if (r.tax) lines.push({ left: L.tax, right: money(r.tax) });
  if (r.rounding) lines.push({ left: L.rounding, right: money(r.rounding) });
  lines.push({ left: L.total, right: money(r.total, r.currency), bold: true });
  if (r.payments.length) lines.push("rule");
  for (const p of r.payments) {
    lines.push({ left: p.label, right: money(p.amount) });
    if (p.tendered) lines.push({ left: txt(`  ${textOf(L.tendered)}`, `  ${asciiOf(L.tendered)}`), right: money(p.tendered) });
    if (p.change) lines.push({ left: txt(`  ${textOf(L.change)}`, `  ${asciiOf(L.change)}`), right: money(p.change) });
  }
  lines.push("rule", { left: L.thanks, align: "center" });
  return lines;
}

/** Init, (drawer kick,) the receipt, feed and partial cut. */
export function receiptBytes(r: ReceiptData, opts: ReceiptOptions): Uint8Array {
  return concat([init(), opts.openDrawer ? drawerKick() : [], encodeLines(receiptLines(r), opts), cut()]);
}

/** A short test page: the paper width, a column row and the alphabet. */
export function testBytes(title: Txt, line: Txt, opts: ReceiptOptions): Uint8Array {
  const lines: Line[] = [
    { left: title, align: "center", bold: true, big: true },
    "rule",
    { left: `${opts.paper} mm / ${COLS[opts.paper]} cols`, right: money(123456) },
    { left: "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789" },
    { left: line, align: "center" },
  ];
  return concat([init(), opts.openDrawer ? drawerKick() : [], encodeLines(lines, opts), cut()]);
}

// ---------------------------------------------------------------------------
// Browser: canvas rasterizer for non-ASCII lines

/** Wrap text to a pixel width, at spaces where possible, else between characters (CJK). */
function wrapPx(s: string, max: number, measure: (s: string) => number): string[] {
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
  return out;
}

/** Draws lines on a canvas (24 dots per row, 48 when big); undefined outside a browser. */
export function canvasRasterizer(): Rasterizer | undefined {
  if (typeof document === "undefined") return undefined;
  return (line, dots) => {
    const c = document.createElement("canvas");
    let g = c.getContext("2d");
    if (!g) return null;
    const px = line.big ? 48 : 24;
    const font = `${line.bold || line.big ? "700" : "500"} ${px - 2}px "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif`;
    g.font = font;
    const rightW = line.right ? g.measureText(line.right).width + px / 2 : 0;
    const rows = wrapPx(line.left, dots - rightW, (s) => g!.measureText(s).width);
    c.width = dots;
    c.height = rows.length * px + 4;
    g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#000";
    g.font = font;
    g.textBaseline = "middle";
    rows.forEach((r, i) => {
      g!.textAlign = line.right ? "left" : line.align;
      g!.fillText(r, line.right || line.align === "left" ? 0 : line.align === "center" ? dots / 2 : dots, i * px + px / 2 + 2);
    });
    if (line.right) {
      g.textAlign = "right";
      g.fillText(line.right, dots, (rows.length - 1) * px + px / 2 + 2);
    }
    return packBitmap(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
  };
}

// ---------------------------------------------------------------------------
// Transports. Typed locally: these APIs are not in TypeScript's DOM lib.

interface UsbEndpoint { endpointNumber: number; direction: "in" | "out"; type: string }
interface UsbAlternate { alternateSetting: number; interfaceClass: number; endpoints: UsbEndpoint[] }
interface UsbInterface { interfaceNumber: number; alternates: UsbAlternate[] }
interface UsbDevice {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  productName?: string;
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  selectAlternateInterface(n: number, alt: number): Promise<void>;
  transferOut(ep: number, data: Uint8Array): Promise<{ status: string }>;
}
interface Usb extends EventTarget {
  requestDevice(o: { filters: object[] }): Promise<UsbDevice>;
  getDevices(): Promise<UsbDevice[]>;
}
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}
interface SerialLike extends EventTarget {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}
interface BleCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(d: Uint8Array): Promise<void>;
  writeValueWithoutResponse(d: Uint8Array): Promise<void>;
}
interface BleService { uuid: string; getCharacteristics(): Promise<BleCharacteristic[]> }
interface BleServer { connected: boolean; connect(): Promise<BleServer>; disconnect(): void; getPrimaryServices(): Promise<BleService[]> }
interface BleDevice extends EventTarget { id: string; name?: string; gatt?: BleServer }
interface BluetoothLike {
  requestDevice(o: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BleDevice>;
  getDevices?(): Promise<BleDevice[]>;
}

const nav = () => (typeof navigator === "undefined" ? {} : navigator) as unknown as { usb?: Usb; serial?: SerialLike; bluetooth?: BluetoothLike };

export type Kind = "usb" | "serial" | "bluetooth";
export const KINDS: Kind[] = ["usb", "serial", "bluetooth"];

/** Which transports this browser has (Chrome/Edge on desktop and Android; none on Safari, iOS or Firefox). */
export function support(): Record<Kind, boolean> {
  const n = nav();
  return { usb: !!n.usb, serial: !!n.serial, bluetooth: !!n.bluetooth };
}

/** The device to reconnect to without a prompt on the next visit. */
export type Remembered = { kind: "usb"; vendorId: number; productId: number; serialNumber?: string } | { kind: "serial"; vendorId?: number; productId?: number } | { kind: "bluetooth"; id: string };

export interface PrinterLink {
  kind: Kind;
  /** The device's own name; empty when it reports none. */
  name: string;
  device: Remembered;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

/** The first bulk OUT endpoint, preferring the USB printer class (7). */
export function findBulkOut(interfaces: UsbInterface[]): { iface: number; alt: number; ep: number } | null {
  const found: { iface: number; alt: number; ep: number; cls: number }[] = [];
  for (const i of interfaces)
    for (const a of i.alternates) {
      const ep = a.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
      if (ep) found.push({ iface: i.interfaceNumber, alt: a.alternateSetting, ep: ep.endpointNumber, cls: a.interfaceClass });
    }
  const best = found.find((f) => f.cls === 7) ?? found[0];
  return best ? { iface: best.iface, alt: best.alt, ep: best.ep } : null;
}

async function openUsb(dev: UsbDevice, onLost: () => void): Promise<PrinterLink> {
  if (!dev.opened) await dev.open();
  if (!dev.configuration) await dev.selectConfiguration(1);
  const out = findBulkOut(dev.configuration!.interfaces);
  if (!out) throw new Error("No bulk OUT endpoint");
  await dev.claimInterface(out.iface);
  if (out.alt) await dev.selectAlternateInterface(out.iface, out.alt);
  const usb = nav().usb!;
  const lost = (e: Event) => (e as unknown as { device: UsbDevice }).device === dev && (usb.removeEventListener("disconnect", lost), onLost());
  usb.addEventListener("disconnect", lost);
  return {
    kind: "usb",
    name: dev.productName ?? "",
    device: { kind: "usb", vendorId: dev.vendorId, productId: dev.productId, serialNumber: dev.serialNumber },
    async write(data) {
      for (const c of chunks(data, 1024)) {
        const r = await dev.transferOut(out.ep, c);
        if (r.status !== "ok") throw new Error(`USB transfer ${r.status}`);
      }
    },
    async close() {
      usb.removeEventListener("disconnect", lost);
      try {
        await dev.releaseInterface(out.iface);
      } finally {
        await dev.close();
      }
    },
  };
}

async function openSerial(port: SerialPortLike, baud: number, onLost: () => void): Promise<PrinterLink> {
  await port.open({ baudRate: baud });
  const info = port.getInfo();
  const serial = nav().serial!;
  const lost = (e: Event) => (e.target as unknown) === port && (serial.removeEventListener("disconnect", lost), onLost());
  serial.addEventListener("disconnect", lost);
  const hex = (n?: number) => (n ?? 0).toString(16).padStart(4, "0");
  return {
    kind: "serial",
    name: info.usbVendorId ? `${hex(info.usbVendorId)}:${hex(info.usbProductId)}` : "",
    device: { kind: "serial", vendorId: info.usbVendorId, productId: info.usbProductId },
    async write(data) {
      const w = port.writable!.getWriter();
      try {
        for (const c of chunks(data, 512)) await w.write(c);
      } finally {
        w.releaseLock();
      }
    },
    async close() {
      serial.removeEventListener("disconnect", lost);
      await port.close();
    },
  };
}

/** Common vendor services on BLE thermal printers; others are reachable only when listed. */
export const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openBluetooth(dev: BleDevice, onLost: () => void): Promise<PrinterLink> {
  const server = await dev.gatt!.connect();
  const services = (await server.getPrimaryServices()).sort((a, b) => rank(a.uuid) - rank(b.uuid));
  let ch: BleCharacteristic | undefined;
  for (const s of services) {
    ch = (await s.getCharacteristics()).find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (ch) break;
  }
  if (!ch) {
    server.disconnect();
    throw new Error("No writable characteristic");
  }
  const c = ch;
  const lost = () => (dev.removeEventListener("gattserverdisconnected", lost), onLost());
  dev.addEventListener("gattserverdisconnected", lost);
  // Start at a size most stacks negotiate (MTU 185); if the link refuses it, fall back to the
  // 20 bytes every BLE link carries. A short pause lets cheap printers drain their buffer.
  let size = 180;
  return {
    kind: "bluetooth",
    name: dev.name ?? "",
    device: { kind: "bluetooth", id: dev.id },
    async write(data) {
      for (let i = 0; i < data.length; ) {
        const part = data.subarray(i, i + size);
        try {
          if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(part);
          else await c.writeValueWithResponse(part);
        } catch (e) {
          if (size === 20) throw e;
          size = 20;
          continue;
        }
        i += part.length;
        await sleep(c.properties.writeWithoutResponse ? 20 : 4);
      }
    },
    async close() {
      dev.removeEventListener("gattserverdisconnected", lost);
      server.disconnect();
    },
  };
}
const rank = (uuid: string) => (BLE_SERVICES.indexOf(uuid) + BLE_SERVICES.length + 1) % (BLE_SERVICES.length + 1);

/** Ask the cashier to pick a printer (needs a click). Throws NotFoundError when they cancel. */
export async function connect(kind: Kind, baud: number, onLost: () => void): Promise<PrinterLink> {
  const n = nav();
  if (kind === "usb") return openUsb(await n.usb!.requestDevice({ filters: [] }), onLost);
  if (kind === "serial") return openSerial(await n.serial!.requestPort(), baud, onLost);
  return openBluetooth(await n.bluetooth!.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES }), onLost);
}

/** Reopen the remembered printer without a prompt; null when it is not plugged in or in range. */
export async function reconnect(dev: Remembered | null, baud: number, onLost: () => void): Promise<PrinterLink | null> {
  const n = nav();
  try {
    if (dev?.kind === "usb" && n.usb) {
      const list = await n.usb.getDevices();
      const d = list.find((x) => x.vendorId === dev.vendorId && x.productId === dev.productId && (!dev.serialNumber || x.serialNumber === dev.serialNumber));
      return d ? await openUsb(d, onLost) : null;
    }
    if (dev?.kind === "serial" && n.serial) {
      const ports = await n.serial.getPorts();
      const p = ports.find((x) => x.getInfo().usbVendorId === dev.vendorId && x.getInfo().usbProductId === dev.productId) ?? (ports.length === 1 ? ports[0] : undefined);
      return p ? await openSerial(p, baud, onLost) : null;
    }
    if (dev?.kind === "bluetooth" && n.bluetooth?.getDevices) {
      const d = (await n.bluetooth.getDevices()).find((x) => x.id === dev.id);
      return d ? await openBluetooth(d, onLost) : null;
    }
  } catch {
    /* unplugged, out of range or claimed elsewhere: the cashier reconnects by hand */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-device settings (this terminal's browser)

export interface PrinterSettings {
  paper: Paper;
  baud: number;
  drawerOnCash: boolean;
  autoPrint: boolean;
  device: Remembered | null;
}

const KEY = "bf.printer";
export const BAUDS = [9600, 19200, 38400, 115200];

export function loadSettings(): PrinterSettings {
  const s = support();
  // Without a transport, auto-print means a print dialog after every bill: opt-in only.
  const def: PrinterSettings = { paper: 80, baud: 9600, drawerOnCash: true, autoPrint: s.usb || s.serial || s.bluetooth, device: null };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<PrinterSettings> | null;
    if (!raw) return def;
    return {
      paper: raw.paper === 58 ? 58 : 80,
      baud: BAUDS.includes(raw.baud ?? 0) ? raw.baud! : 9600,
      drawerOnCash: raw.drawerOnCash ?? def.drawerOnCash,
      autoPrint: raw.autoPrint ?? def.autoPrint,
      device: raw.device ?? null,
    };
  } catch {
    return def;
  }
}

export function saveSettings(s: PrinterSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or storage blocked: settings last for this visit */
  }
}

/** Fallback for browsers without a transport: the e-receipt page in the print dialog. */
export function printReceiptPage(token: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  f.setAttribute("aria-hidden", "true");
  f.src = `/receipt/${encodeURIComponent(token)}?print=1`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 120_000);
}

/** An English rendering of a translated string, for the ASCII fallback. */
export const englishTxt = (locale: string, key: string, vars?: Record<string, string | number>): Txt => txt(translate(locale, key, vars), translate("en", key, vars));
export const englishDateTime = (locale: string, ms: number, timeZone?: string): Txt => txt(formatters(locale).dateTime(ms, timeZone), formatters("en").dateTime(ms, timeZone));
