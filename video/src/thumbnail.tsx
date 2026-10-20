// The YouTube thumbnail (1280×720): one promise in big type, the real live ticket on a phone, the mark.
// Read at a glance on a small screen: three or four words, one picture, high contrast.
import type React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Mark } from "./Mark";
import type { Lang } from "./reel/copy";

const WORDS: Record<Lang, { lines: string[]; tag: string; sub: string }> = {
  en: { lines: ["NO MORE", "SHOUTING", "NAMES"], tag: "No app · No sign-up", sub: "Scan, queue, eat." },
  zh: { lines: ["告别", "门口喊号"], tag: "免下载 · 免注册", sub: "扫码排队，到号通知" },
};

export const Thumbnail: React.FC<{ lang: Lang }> = ({ lang }) => {
  const w = WORDS[lang];
  const zh = lang === "zh";
  return (
    <AbsoluteFill style={{ background: C.sun, fontFamily: SANS, overflow: "hidden" }}>
      {/* ticket-stub perforation along the top, the product's motif */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 26, display: "flex" }}>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? C.paper : C.ink }} />
        ))}
      </div>

      <div style={{ position: "absolute", left: 70, top: zh ? 110 : 84, width: 700 }}>
        {w.lines.map((l, i) => (
          <div key={i} style={{ fontFamily: zh ? SANS : NUM, fontWeight: 900, fontSize: zh ? 150 : 148, lineHeight: zh ? 1.08 : 0.9, color: C.ink, letterSpacing: zh ? "0.02em" : "-0.005em" }}>
            {l}
          </div>
        ))}
        <div style={{ display: "inline-block", marginTop: zh ? 30 : 26, background: C.ink, color: C.sun, fontWeight: 900, fontSize: 40, padding: "10px 22px 12px", borderRadius: 14 }}>{w.tag}</div>
      </div>

      <div style={{ position: "absolute", left: 70, bottom: 46, display: "flex", alignItems: "center", gap: 14, color: C.ink }}>
        <Mark height={66} color={C.ink} style={{ marginTop: -8 }} />
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 56, lineHeight: 1 }}>beautifood</span>
      </div>

      {/* the real live ticket, on a phone */}
      <div style={{ position: "absolute", right: 70, top: 92, rotate: "5deg" }}>
        <div style={{ width: 400, padding: 14, background: C.ink, borderRadius: 56, boxShadow: "0 40px 80px rgba(26,24,20,.45)" }}>
          <div style={{ borderRadius: 44, overflow: "hidden", height: 560, background: "#fff" }}>
            <Img src={staticFile(`reel-stills/thumb-phone-${lang}.png`)} style={{ width: "100%", display: "block" }} />
          </div>
        </div>
        <div style={{ position: "absolute", left: -78, bottom: 64, rotate: "-9deg", background: C.paper, color: C.ink, fontWeight: 900, fontSize: 34, padding: "12px 20px 14px", borderRadius: 14, boxShadow: "0 18px 36px rgba(26,24,20,.3)" }}>{w.sub}</div>
      </div>
    </AbsoluteFill>
  );
};
