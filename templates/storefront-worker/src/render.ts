// Draws the storefront as one HTML page from Beautifood's storefront JSON: the same design tokens,
// sections and words the Beautifood page uses, with no framework and no client JavaScript. Edit
// freely; keep text escaped (esc) and keep the queue/booking links pointing at Beautifood.

export interface Words {
  [locale: string]: string;
}
export interface StorefrontPayload {
  design: {
    theme: { bg: string; surface: string; ink: string; accent: string; accentInk: string; font: "kopitiam" | "modern" | "editorial" | "rounded"; radius: "sharp" | "soft" | "round" };
    hero: { tagline: Words; intro: Words; layout: "centered" | "split" | "banner"; image: string | null };
    sections: { type: "queue" | "menu" | "story" | "branches" | "booking" | "gallery"; visible: boolean; title: Words }[];
    gallery: { url: string; alt: Words }[];
  };
  published: boolean;
  restaurant: { name: string; slug: string; cuisine: string; description: string; story: string; translations: Record<string, { story?: string; description?: string }> };
  branches: { id: string; ref: string; name: string; address: string; phone: string; modules: { bookings: boolean }; hours: { open: number; close: number } | null }[];
  currency: string;
  menuLanguage: string;
  menu: {
    now?: { menus: { id: string; name: string; until: string | null }[]; deals: { id: string; name: string; until: string | null }[] };
    signatures: Dish[];
    deals: Dish[];
  };
}
interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  listPrice?: number;
  translations?: Record<string, { name?: string; description?: string }>;
}

const FONTS = {
  kopitiam: { heading: '"Big Shoulders Display", Impact, "PingFang SC", sans-serif', body: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif', weight: 800, upper: true },
  modern: { heading: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif', body: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif', weight: 850, upper: false },
  editorial: { heading: '"Iowan Old Style", "Palatino Linotype", Georgia, "Songti SC", serif', body: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif', weight: 700, upper: false },
  rounded: { heading: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", system-ui, sans-serif', body: "ui-rounded, system-ui, sans-serif", weight: 800, upper: false },
} as const;
const RADIUS = { sharp: "4px", soft: "14px", round: "26px" } as const;

const T = {
  en: { join: "Join the queue", menu: "See the menu", book: "Book a table", bookAt: "Book at {b}", queue: "Queue now", menuNow: "On the menu now", story: "Our story", branches: "Find us", booking: "Book a table", gallery: "Photos", joinAt: "Join at {b}", map: "Directions", call: "Call", fullMenu: "Full menu", until: "until {t}", live: "Live queue on Beautifood", other: "中文" },
  zh: { join: "排队取号", menu: "查看菜单", book: "订位", bookAt: "在 {b} 订位", queue: "现在排队", menuNow: "现正供应", story: "我们的故事", branches: "门店", booking: "订位", gallery: "相册", joinAt: "在 {b} 排队", map: "导航", call: "致电", fullMenu: "完整菜单", until: "至 {t}", live: "实时排队由 Beautifood 提供", other: "English" },
};

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const say = (w: Words | undefined, l: string) => (w && (w[l] || w.en || Object.values(w).find(Boolean))) || "";
const money = (v: number, c: string, l: string) => new Intl.NumberFormat(l === "zh" ? "zh-MY" : "en-MY", { style: "currency", currency: c }).format(v / 100);
const color = (s: string) => (/^#[0-9a-f]{6}$/i.test(s) ? s : "#000000");

export function render(p: StorefrontPayload, o: { locale: string; base: string }): string {
  const l = o.locale === "zh" ? "zh" : "en";
  const t = T[l];
  const d = p.design;
  const r = p.restaurant;
  const f = FONTS[d.theme.font] ?? FONTS.modern;
  const story = (l !== p.menuLanguage && r.translations?.[l]?.story) || r.story;
  const tagline = say(d.hero.tagline, l) || (l !== p.menuLanguage && r.translations?.[l]?.description) || r.description;
  const title = (type: string, fallback: string) => say(d.sections.find((s) => s.type === type)?.title, l) || fallback;
  const one = p.branches.length === 1 ? p.branches[0] : null;
  const dishName = (x: Dish) => (l !== p.menuLanguage && x.translations?.[l]?.name) || x.name;
  const dish = (x: Dish) =>
    `<div class="dish"><div><b>${esc(dishName(x))}</b>${dishName(x) !== x.name ? `<small>${esc(x.name)}</small>` : ""}<small>${esc((l !== p.menuLanguage && x.translations?.[l]?.description) || x.description)}</small></div><span class="price">${esc(money(x.price, p.currency, l))}${x.listPrice != null ? `<s>${esc(money(x.listPrice, p.currency, l))}</s>` : ""}</span></div>`;
  const sections: Record<string, () => string> = {
    queue: () =>
      `<section id="queue"><h2>${esc(title("queue", t.queue))}</h2><div class="grid">${p.branches
        .map((b) => `<div class="card"><h3>${esc(b.name)}</h3><p class="muted">${esc(t.live)}</p><a class="btn" href="${esc(o.base)}/r/${esc(b.ref)}">${esc(p.branches.length > 1 ? t.joinAt.replace("{b}", b.name) : t.join)} →</a></div>`)
        .join("")}</div></section>`,
    menu: () => {
      const chips = [...(p.menu.now?.menus ?? []), ...(p.menu.now?.deals ?? [])].map((m) => `<span class="chip">${esc(m.name)}${m.until ? ` · ${esc(t.until.replace("{t}", m.until))}` : ""}</span>`).join("");
      const deals = p.menu.deals.map(dish).join("");
      const sigs = p.menu.signatures.filter((s) => !p.menu.deals.some((x) => x.id === s.id)).map(dish).join("");
      return `<section id="menu"><h2>${esc(title("menu", t.menuNow))}</h2>${chips ? `<div class="chips">${chips}</div>` : ""}<div class="dishes">${deals}${sigs}</div>${p.branches[0] ? `<a class="link" href="${esc(o.base)}/r/${esc(p.branches[0].ref)}/menu">${esc(t.fullMenu)} →</a>` : ""}</section>`;
    },
    story: () => (story ? `<section id="story" class="story"><h2>${esc(title("story", t.story))}</h2>${story.split(/\n{2,}/).map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""),
    branches: () =>
      `<section id="branches"><h2>${esc(title("branches", t.branches))}</h2><div class="grid">${p.branches
        .map(
          (b) =>
            `<div class="card"><h3>${esc(b.name)}</h3>${b.address ? `<a class="link" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${r.name} ${b.address}`)}">${esc(b.address)}</a>` : ""}${b.phone ? `<a class="link" href="tel:${esc(b.phone.replace(/[^\d+]/g, ""))}">${esc(t.call)} ${esc(b.phone)}</a>` : ""}</div>`,
        )
        .join("")}</div></section>`,
    booking: () => {
      const bs = p.branches.filter((b) => b.modules.bookings);
      return bs.length ? `<section id="booking"><h2>${esc(title("booking", t.booking))}</h2><div class="row">${bs.map((b) => `<a class="btn" href="${esc(o.base)}/r/${esc(b.ref)}/book">${esc(bs.length > 1 ? t.bookAt.replace("{b}", b.name) : t.book)}</a>`).join("")}</div></section>` : "";
    },
    gallery: () => (d.gallery.length ? `<section id="gallery"><h2>${esc(title("gallery", t.gallery))}</h2><div class="gallery">${d.gallery.map((g) => `<img src="${esc(g.url)}" alt="${esc(say(g.alt, l))}" loading="lazy">`).join("")}</div></section>` : ""),
  };
  const body = d.sections.filter((s) => s.visible).map((s) => sections[s.type]?.() ?? "").join("");
  return `<!doctype html><html lang="${l === "zh" ? "zh-Hans" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(r.name)}</title><meta name="description" content="${esc(tagline)}"><meta name="theme-color" content="${color(d.theme.bg)}"><style>
:root{--bg:${color(d.theme.bg)};--surface:${color(d.theme.surface)};--ink:${color(d.theme.ink)};--accent:${color(d.theme.accent)};--accent-ink:${color(d.theme.accentInk)};--radius:${RADIUS[d.theme.radius] ?? "14px"}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:${f.body};line-height:1.5}
h1,h2,h3,.name{font-family:${f.heading};font-weight:${f.weight};${f.upper ? "text-transform:uppercase;" : ""}letter-spacing:-.01em;margin:0 0 .4em}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}header{display:flex;justify-content:space-between;align-items:center;padding:14px 0}.name{font-size:22px;color:var(--ink);text-decoration:none;margin:0}
.hero{padding:clamp(28px,7vw,72px) 0 clamp(24px,5vw,48px);display:grid;gap:28px;align-items:center}${d.hero.layout === "centered" ? ".hero{text-align:center;justify-items:center}.ctas{justify-content:center}" : ""}${d.hero.layout === "split" ? "@media(min-width:820px){.hero{grid-template-columns:1.1fr .9fr}}" : ""}
${d.hero.layout === "banner" ? ".banner{background:var(--accent);color:var(--accent-ink)}.banner h1,.banner p{color:var(--accent-ink)}.banner .btn{background:var(--accent-ink);color:var(--accent)}" : ""}
h1{font-size:clamp(2.4rem,8vw,4.6rem);line-height:.98}.tag{font-size:clamp(1.1rem,3vw,1.4rem);font-weight:650;margin:0 0 8px}.intro{opacity:.85;max-width:56ch}
.ctas,.row,.chips{display:flex;flex-wrap:wrap;gap:10px}.btn{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:0 20px;border-radius:var(--radius);background:var(--accent);color:var(--accent-ink);font-weight:750;text-decoration:none}.btn.ghost{background:transparent;color:inherit;border:2px solid currentColor}
.art{aspect-ratio:4/3;border-radius:var(--radius);overflow:hidden;background:var(--accent)}.art img{width:100%;height:100%;object-fit:cover}
main{display:flex;flex-direction:column;gap:clamp(28px,6vw,56px);padding-bottom:40px}h2{font-size:clamp(1.6rem,5vw,2.3rem)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))}.card{background:var(--surface);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.muted,small{opacity:.72;font-size:14px;display:block}.link{color:inherit;font-weight:650}.chip{padding:8px 12px;border-radius:var(--radius);background:var(--accent);color:var(--accent-ink);font-weight:650;font-size:14px}
.dishes{display:grid;gap:2px 28px;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));margin:14px 0}.dish{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
.price{font-weight:800;white-space:nowrap;text-align:right}.price s{display:block;font-weight:600;font-size:13px;opacity:.6}.story p{font-size:17px;max-width:62ch}
.gallery{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))}.gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius)}
footer{text-align:center;padding:26px 16px;font-size:13px;opacity:.8}a{text-decoration-color:color-mix(in srgb,var(--accent) 70%,transparent)}
</style></head><body>
<div class="wrap"><header><a class="name" href="/">${esc(r.name)}</a><a class="link" href="/?lang=${l === "zh" ? "en" : "zh"}">${esc(t.other)}</a></header></div>
<div class="${d.hero.layout === "banner" ? "banner" : ""}"><div class="wrap hero"><div>${r.cuisine ? `<small>${esc(r.cuisine)}</small>` : ""}<h1>${esc(r.name)}</h1>${tagline ? `<p class="tag">${esc(tagline)}</p>` : ""}${say(d.hero.intro, l) ? `<p class="intro">${esc(say(d.hero.intro, l))}</p>` : ""}
<div class="ctas"><a class="btn" href="${one ? `${esc(o.base)}/r/${esc(one.ref)}` : "#queue"}">${esc(t.join)}</a>${p.branches[0] ? `<a class="btn ghost" href="${esc(o.base)}/r/${esc(p.branches[0].ref)}/menu">${esc(t.menu)}</a>` : ""}</div></div>
${d.hero.layout === "split" ? `<div class="art">${d.hero.image ? `<img src="${esc(d.hero.image)}" alt="">` : ""}</div>` : ""}</div></div>
<main class="wrap">${body}</main>
<footer><a class="link" href="${esc(o.base)}/at/${esc(r.slug)}">${esc(t.live)}</a></footer>
</body></html>`;
}
