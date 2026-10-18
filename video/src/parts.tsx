// Reusable pieces: the ticket stub, device frames and a step caption.
import type React from "react";
import { Video } from "@remotion/media";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";

const ease = Easing.bezier(0.23, 1, 0.32, 1);

/** Fade + rise in at `at` seconds. */
export const useIn = (at = 0, dur = 0.5) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, (at + dur) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return { opacity: p, translate: `0 ${(1 - p) * 40}px` } as React.CSSProperties;
};

export const Stub: React.FC<{ serial: string; label: string; stock?: string; width?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ serial, label, stock = C.sun, width = 520, style, children }) => (
  <div
    style={{
      width,
      background: stock,
      color: C.ink,
      borderRadius: 28,
      padding: "34px 40px 30px",
      fontFamily: SANS,
      boxShadow: "0 30px 60px rgba(26,24,20,.25)",
      position: "relative",
      WebkitMaskImage: "radial-gradient(circle 22px at 0 70%, transparent 21px, #000 22px), radial-gradient(circle 22px at 100% 70%, transparent 21px, #000 22px)",
      WebkitMaskComposite: "source-in",
      ...style,
    }}
  >
    <div style={{ fontSize: 28, fontWeight: 750, opacity: 0.7 }}>{label}</div>
    <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: width * 0.36, lineHeight: 1, margin: "8px 0 18px" }}>{serial}</div>
    <div style={{ borderTop: "4px dashed rgba(26,24,20,.35)", margin: "0 -40px", paddingTop: 22 }} />
    <div style={{ fontSize: 30, fontWeight: 700, padding: "0 0" }}>{children}</div>
  </div>
);

/** A clip (mp4 in public/clips) or a still (png in public/shots), inside a phone or browser frame. */
export const Screen: React.FC<{ src: string; kind: "phone" | "desktop"; height: number; start?: number; rate?: number; style?: React.CSSProperties }> = ({ src, kind, height, start = 0, rate = 1, style }) => {
  const { fps } = useVideoConfig();
  const ratio = kind === "phone" ? 390 / 844 : 1366 / 860;
  const width = height * ratio;
  const media = src.endsWith(".mp4") ? (
    <Video src={staticFile(src)} trimBefore={Math.round(start * fps)} playbackRate={rate} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
  ) : (
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
  );
  if (kind === "phone")
    return (
      <div style={{ width: width + 28, height: height + 28, background: C.ink, borderRadius: 58, padding: 14, boxShadow: "0 40px 80px rgba(26,24,20,.35)", ...style }}>
        <div style={{ width, height, borderRadius: 44, overflow: "hidden", background: "#fff" }}>{media}</div>
      </div>
    );
  return (
    <div style={{ width, background: C.ink, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 80px rgba(26,24,20,.3)", ...style }}>
      <div style={{ height: 34, display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
        {["#ff6b5e", "#ffc53d", "#41c94f"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
      </div>
      <div style={{ width, height, background: "#fff" }}>{media}</div>
    </div>
  );
};

export const Kicker: React.FC<{ n: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ n, children, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: SANS, ...style }}>
    <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 44, background: C.ink, color: C.sun, borderRadius: 12, padding: "2px 14px" }}>{n}</span>
    <span style={{ fontSize: 34, fontWeight: 800, color: C.ink2 }}>{children}</span>
  </div>
);

export const Headline: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 84, style }) => (
  <div style={{ fontFamily: SANS, fontWeight: 850, fontSize: size, lineHeight: 1.05, letterSpacing: "-.02em", color: C.ink, ...style }}>{children}</div>
);

export const Points: React.FC<{ items: string[]; at?: number; size?: number }> = ({ items, at = 0.6, size = 40 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 40 }}>
    {items.map((t, i) => (
      <Point key={t} at={at + i * 0.45} size={size}>
        {t}
      </Point>
    ))}
  </div>
);

const Point: React.FC<{ at: number; size: number; children: React.ReactNode }> = ({ at, size, children }) => (
  <div style={{ display: "flex", gap: 18, alignItems: "baseline", fontFamily: SANS, fontSize: size, fontWeight: 650, color: C.ink, ...useIn(at) }}>
    <span style={{ width: 16, height: 16, borderRadius: 8, background: C.ink, flex: "none", translate: "0 -6px" }} />
    <span>{children}</span>
  </div>
);
