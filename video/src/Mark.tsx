// The Beautifood mark (the spoon-b) and the wordmark beside it, shared with the app.
import type React from "react";
import { MARK_PATH, MARK_VIEWBOX } from "../../src/ui/brand";
import { NUM } from "./theme";

export const Mark: React.FC<{ height: number; color?: string; style?: React.CSSProperties }> = ({ height, color = "currentColor", style }) => (
  <svg viewBox={MARK_VIEWBOX} height={height} width={(height * 302) / 464} style={style} aria-hidden="true">
    <path d={MARK_PATH} fill={color} fillRule="evenodd" />
  </svg>
);

/** The mark and "beautifood", the mark a little taller than the letters as on the site. */
export const Wordmark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.22, color, ...style }}>
    <Mark height={size * 1.18} style={{ marginTop: -size * 0.12 }} />
    <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: ".01em" }}>beautifood</span>
  </div>
);
