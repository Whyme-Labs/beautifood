// Text handling for the menu brain: normalising how guests really type (Manglish, Malay SMS
// spelling, Chinese), tokens, and the hashed n-gram features the intent model reads.

/** Malay SMS spellings and Manglish shorthands, to one spelling each. */
const LEXICON: Record<string, string> = {
  u: "you", ur: "your", r: "are", pls: "please", plz: "please", pliz: "please", thx: "thanks", tq: "thanks", tqvm: "thanks", ty: "thanks",
  wat: "what", wht: "what", wats: "whats", hw: "how", abt: "about", bcos: "because", coz: "because", cuz: "because", gd: "good", hv: "have", nt: "not",
  dun: "dont", dunno: "dont know", dont: "dont", cant: "cant", wont: "wont", w: "with", wif: "with", wid: "with", n: "and", b4: "before", "2day": "today",
  x: "tak", tk: "tak", tak: "tak", tidak: "tak", tdk: "tak", tak2: "tak", xde: "takde", xda: "takde", tade: "takde", takde: "takde", tiada: "takde",
  nk: "nak", nak: "nak", mau: "nak", mahu: "nak", ingin: "nak", sdp: "sedap", sedap: "sedap", mkn: "makan", makan: "makan", mnm: "minum", minum: "minum",
  ckt: "sikit", sikit: "sikit", sedikit: "sikit", brp: "berapa", berapa: "berapa", ape: "apa", apa: "apa", mcm: "macam", camne: "macam mana", cmne: "macam mana",
  sy: "saya", sye: "saya", aku: "saya", kite: "kita", korang: "kamu", awak: "kamu", yg: "yang", dgn: "dengan", dan: "dan", utk: "untuk", tu: "itu", ni: "ini",
  bole: "boleh", blh: "boleh", leh: "leh", org: "orang", ppl: "people", pax: "people", ppls: "people",
};

/** Discourse particles that carry tone, not meaning. */
const PARTICLES = new Set(["lah", "la", "lor", "meh", "ah", "ar", "hor", "wor", "leh", "liao", "one", "bro", "sis", "boss", "uncle", "auntie", "aunty", "ya", "yah", "eh", "oi", "please"]);

const HAN = /\p{Script=Han}/u;

/** Lower case, one spelling per word, particles kept (the caller drops them when it wants). */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/(\p{Script=Han})/gu, " $1 ")
    .replace(/[^\p{L}\p{N}'. ]+/gu, " ")
    .replace(/\.(?!\d)|(?<!\d)\./g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const plain = w.replace(/'/g, "");
      return LEXICON[plain] ?? plain;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words (and single Chinese characters) of normalised text. */
export function tokens(normalized: string, keepParticles = false): string[] {
  const out = normalized.split(" ").filter(Boolean);
  return keepParticles ? out : out.filter((w) => !PARTICLES.has(w));
}

export const isHan = (s: string) => HAN.test(s);

/** 32-bit FNV-1a. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The features the intent model reads: words, word pairs and character 3- and 4-grams (which
 * carry typos and unseen spellings), each hashed into `buckets`.
 */
export function features(toks: string[], buckets: number): number[] {
  const f: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    f.push(`w:${w}`);
    if (i > 0) f.push(`b:${toks[i - 1]}_${w}`);
    if (!isHan(w) && w.length >= 3 && !w.startsWith("§")) {
      const s = `<${w}>`;
      for (let n = 3; n <= 4; n++) for (let j = 0; j + n <= s.length; j++) f.push(`c:${s.slice(j, j + n)}`);
    }
  }
  if (!toks.length) f.push("w:<empty>");
  return f.map((x) => hash(x) % buckets);
}

/** Levenshtein distance, stopping early past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
