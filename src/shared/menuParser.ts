// Deterministic menu-text parser used by the onboarding copilot when no LLM is
// configured (and as a validator of LLM output). Handles typical pasted menus:
//
//   NOODLES
//   Char Kway Teow - RM12.90 - wok-fried flat rice noodles with prawns
//   ★ Laksa ......... 14.50
//   Teh Tarik  4.5

import { inferAllergens, inferDietary } from "./allergens";

export interface ParsedItem {
  name: string;
  price: number; // minor units
  description: string;
  category: string;
  allergens: string[];
  dietary: string[];
  spiceLevel: number;
  isSignature: boolean;
  station: string;
}

export interface ParsedMenu {
  categories: string[];
  items: ParsedItem[];
  warnings: string[];
}

const PRICE_RE = /^(.*?)\s*(?:\.{2,}|[-–—:|])?\s*(?:RM|MYR|S\$|SGD|USD|\$|€|£)?\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:(?:[-–—|]|\s{2,})\s*(.+))?$/i;
// a price with its currency is the price, though the name has a number ("Ampang 6-Piece Set - RM11.90")
const MARKED_PRICE_RE = /^(.*?)\s*(?:\.{2,}|[-–—:|])?\s*(?:RM|MYR|S\$|SGD|USD|\$|€|£)\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:(?:[-–—|]|\s{2,})\s*(.+))?$/i;
const SIGNATURE_RE = /(★|⭐|\*|\(signature\)|signature|chef'?s (special|pick|recommend\w*)|best ?seller|must[- ]try|house special)/i;

export function stationFor(category: string, name: string): string {
  const t = `${category} ${name}`.toLowerCase();
  if (/(drink|beverage|coffee|kopi|tea\b|teh|juice|jus|soda|smoothie|bar|wine|beer|latte|milo|water)/.test(t)) return "bar";
  if (/(dessert|cake|ice cream|cendol|ais kacang|pudding|sweet)/.test(t)) return "dessert";
  return "kitchen";
}

function cleanName(s: string) {
  return s
    .replace(SIGNATURE_RE, "")
    .replace(/^[\s\-•·*\d.)]+/, "")
    .replace(/[\s.\-–—:|]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isHeading(line: string) {
  const l = line.trim();
  if (!l) return false;
  if (/^#{1,6}\s+/.test(l)) return true;
  if (/:$/.test(l) && !/\d/.test(l)) return true;
  return l.length <= 40 && !/\d/.test(l) && (l === l.toUpperCase() || /^\[.*\]$/.test(l));
}

export function parseMenuText(text: string): ParsedMenu {
  const items: ParsedItem[] = [];
  const categories: string[] = [];
  const warnings: string[] = [];
  let category = "Menu";
  let lastItem: ParsedItem | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      lastItem = null;
      continue;
    }
    if (isHeading(line)) {
      category = line.replace(/^#+\s*/, "").replace(/[:\[\]]/g, "").trim();
      category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      if (!categories.includes(category)) categories.push(category);
      lastItem = null;
      continue;
    }
    // (not when a plain price comes first: "Ais Kacang - 6.50 - add durian RM1")
    const marked = line.match(MARKED_PRICE_RE);
    const m = marked && !/(^|\s)\d{1,4}(?:[.,]\d{1,2})?(\s|$)/.test(marked[1]) ? marked : line.match(PRICE_RE);
    if (m && m[1] && cleanName(m[1]).length > 0) {
      const name = cleanName(m[1]);
      const price = Math.round(parseFloat(m[2].replace(",", ".")) * 100);
      const description = (m[3] ?? "").trim();
      const all = `${name} ${description}`;
      const { dietary, spiceLevel } = inferDietary(all);
      if (!categories.includes(category)) categories.push(category);
      lastItem = {
        name,
        price,
        description,
        category,
        allergens: inferAllergens(all),
        dietary,
        spiceLevel,
        isSignature: SIGNATURE_RE.test(line),
        station: stationFor(category, name),
      };
      items.push(lastItem);
    } else if (lastItem && !lastItem.description) {
      // a description on the line after the item
      lastItem.description = line;
      const all = `${lastItem.name} ${line}`;
      lastItem.allergens = inferAllergens(all);
      Object.assign(lastItem, inferDietary(all));
      if (SIGNATURE_RE.test(line)) lastItem.isSignature = true;
    } else {
      warnings.push(`Could not find a price in: "${line}"`);
    }
  }
  return { categories, items, warnings };
}

export interface ParsedTable {
  label: string;
  seatsMin: number;
  seatsMax: number;
  zone: string;
  mergeGroup: string | null;
  splitConfig: { suffix: string; seats: number }[] | null;
}

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1 };
const ZH_DIGITS: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 一 … 九十九 ("十二" = 12, "二十" = 20). */
const zhNum = (s: string) => {
  const [tens, ones] = s.includes("十") ? s.split("十") : ["", s];
  const n = (s.includes("十") ? (tens ? ZH_DIGITS[tens] : 1) * 10 : 0) + (ones ? ZH_DIGITS[ones] : 0);
  return n > 0 ? n : NaN;
};
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s.toLowerCase()] ?? zhNum(s));

/**
 * Parse a floor description such as
 * "10 two-seaters, 6 tables of 4 in the patio that can be pushed together, 2 round tables of 10 that can split into 6 and 4",
 * or in Chinese: "4张两人桌，2张四人桌可以拼桌".
 */
export function parseFloorText(text: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const counters = new Map<string, number>();
  const segments = text.split(/[,;\n，、；]|和(?=\s*[\d一二两三四五六七八九十]+\s*张)|\band\b(?=\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)\s)/i);
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    const word = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)";
    let count = NaN;
    let seats = NaN;
    let m = s.match(new RegExp(`^${word}\\s+(?:\\w+\\s+)?(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[- ]?(?:seaters?|pax|person|people|seats?)`, "i"));
    if (m) {
      count = num(m[1]);
      seats = num(m[2]);
    } else {
      m = s.match(new RegExp(`^${word}\\s+.*?tables?\\s+(?:of|for|with|seating)\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`, "i"));
      if (m) {
        count = num(m[1]);
        seats = num(m[2]);
      } else {
        // 4张两人桌 · 2张4人座 · 2张十人圆桌
        m = s.match(/^([\d一二两三四五六七八九十]+)\s*张\s*([\d一二两三四五六七八九十]+)\s*人/);
        if (m) {
          count = num(m[1]);
          seats = num(m[2]);
        }
      }
    }
    if (!Number.isFinite(count) || !Number.isFinite(seats) || count < 1 || seats < 1) continue;
    const zoneM = s.match(/\b(?:in|at|on)\s+(?:the\s+)?([a-z][a-z ]{1,20}?)(?:\s+(?:that|which|can|area)\b|$)/i);
    const zone = zoneM ? zoneM[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()) : "Main";
    const mergeable = /(push(ed)? together|join|combin|merge|拼|合并)/i.test(s);
    const splitM = s.match(/split\s+(?:in)?to\s+(\d+)\s*(?:and|&|\+)\s*(\d+)/i) ?? s.match(/分成\s*(\d+)\s*(?:和|与|\+)\s*(\d+)/);
    const prefix = zone === "Main" ? "T" : zone[0].toUpperCase();
    const group = mergeable ? `${zone}-${seats}` : null;
    for (let i = 0; i < Math.min(count, 200); i++) {
      tables.push({
        label: `${prefix}${(counters.set(prefix, (counters.get(prefix) ?? 0) + 1), counters.get(prefix))}`,
        seatsMin: Math.max(1, seats >= 6 ? Math.ceil(seats / 2) : seats <= 2 ? 1 : seats - 2),
        seatsMax: seats,
        zone,
        mergeGroup: group,
        splitConfig: splitM ? [
          { suffix: "a", seats: Number(splitM[1]) },
          { suffix: "b", seats: Number(splitM[2]) },
        ] : null,
      });
    }
  }
  return tables;
}
