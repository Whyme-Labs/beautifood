// Lay phone screenshots (1170×2532) side by side in a real phone frame, for docs/gallery.
//   node scripts/phone-gallery.mjs out.png screen1.png screen2.png [screen3.png] [--bg=#fff1b8] [--tilt]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const out = args.shift();
const opts = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const screens = args.filter((a) => !a.startsWith("--")).map((f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`);
const W = 2400, H = 1600;
const SW = 560; // screen width in px
const SB = Math.round((SW * 54) / 390); // status bar (54 pt on a 390 pt phone), above the page
const SH = SB + Math.round((SW * 2532) / 1170);
const time = opts.time ?? "7:43";
const bar = opts.bar ?? "#ffd12e"; // the app header colour, so the status bar runs into it
const tilt = (i) => (opts.tilt === undefined ? 0 : (i - (screens.length - 1) / 2) * 2.5);

// signal, Wi-Fi, battery
const ICONS = `<svg width="26" height="17" viewBox="0 0 26 17"><rect x="0" y="11" width="4.5" height="6" rx="1.2"/><rect x="7" y="7.5" width="4.5" height="9.5" rx="1.2"/><rect x="14" y="4" width="4.5" height="13" rx="1.2"/><rect x="21" y="0" width="4.5" height="17" rx="1.2"/></svg>
<svg width="24" height="17" viewBox="0 0 24 17"><path d="M12 3.2c3.6 0 6.9 1.4 9.3 3.7l1.9-2C20.2 2 16.3.4 12 .4S3.8 2 .8 4.9l1.9 2C5.1 4.6 8.4 3.2 12 3.2zm0 5.1c2.2 0 4.2.8 5.7 2.2l1.9-2C17.6 6.6 14.9 5.5 12 5.5S6.4 6.6 4.4 8.5l1.9 2C7.8 9.1 9.8 8.3 12 8.3zm0 5c.9 0 1.7.3 2.3.9L12 16.6l-2.3-2.4c.6-.6 1.4-.9 2.3-.9z"/></svg>
<svg width="38" height="18" viewBox="0 0 38 18"><rect x="1" y="1" width="31" height="16" rx="5" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="2"/><rect x="4" y="4" width="22" height="10" rx="2.5"/><path d="M34.5 6.5v5c1.2-.4 2-1.4 2-2.5s-.8-2.1-2-2.5z" fill-opacity=".45"/></svg>`;

const phone = (src, i) => `
  <div class="phone" style="rotate:${tilt(i)}deg">
    <i class="btn l1"></i><i class="btn l2"></i><i class="btn l3"></i><i class="btn r1"></i>
    <div class="bezel"><div class="screen">
      <div class="status"><b>${time}</b><span class="icons">${ICONS}</span></div>
      <img src="${src}"><div class="island"></div>
    </div></div>
  </div>`;

const html = `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${W}px; height: ${H}px; background: ${opts.bg ?? "#fff1b8"}; display: flex; align-items: center; justify-content: center; gap: 110px; }
  .phone { position: relative; padding: 7px; border-radius: 96px; background: linear-gradient(145deg, #6b6760, #2b2925 40%, #4a4741 70%, #1d1b18);
    box-shadow: 0 50px 90px rgba(26,24,20,.28), 0 12px 24px rgba(26,24,20,.18); }
  .bezel { padding: 16px; border-radius: 90px; background: #0c0b0a; }
  .screen { position: relative; width: ${SW}px; height: ${SH}px; border-radius: 74px; overflow: hidden; background: #fff; }
  .screen img { width: 100%; display: block; }
  .status { height: ${SB}px; background: ${bar}; color: #1a1814; display: flex; align-items: center; justify-content: space-between; padding: 6px 44px 0 58px; font: 700 24px/1 -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif; }
  .status .icons { display: flex; gap: 7px; align-items: center; fill: #1a1814; color: #1a1814; }
  .island { position: absolute; top: 16px; left: 50%; width: 168px; height: 50px; margin-left: -84px; border-radius: 25px; background: #000; }
  .btn { position: absolute; width: 7px; border-radius: 4px; background: #3a3833; }
  .l1 { left: -5px; top: 190px; height: 58px; } .l2 { left: -5px; top: 290px; height: 110px; } .l3 { left: -5px; top: 420px; height: 110px; }
  .r1 { right: -5px; top: 330px; height: 170px; }
</style></head><body>${screens.map(phone).join("")}</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html, { waitUntil: "load" });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
console.log("→", out);
