// A virtual camera over a real screen recording: it frames the cued UI element (box in video
// pixels) and glides between cues, so text is read at real size instead of shrunk to fit.
import type React from "react";
import { Video } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { clamp, ease } from "./beat";

export type Box = { x: number; y: number; w: number; h: number };
/** A camera keyframe at clip time `t` (seconds into the recording) framing `box` (null = whole screen). */
export type Shot = { t: number; box: Box | null; pad?: number };

type Props = {
  src: string;
  /** Recording size in pixels. */
  vw: number;
  vh: number;
  /** Viewport size on screen. */
  w: number;
  h: number;
  /** Clip second where this shot starts, and playback speed. */
  from?: number;
  rate?: number;
  shots: Shot[];
  /** Never zoom past this multiple of "fit". */
  maxZoom?: number;
  style?: React.CSSProperties;
};

export const Camera: React.FC<Props> = ({ src, vw, vh, w, h, from = 0, rate = 1, shots, maxZoom = 2.6, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clipT = from + (frame / fps) * rate;
  const fit = Math.max(w / vw, h / vh); // cover the viewport
  const frameFor = (s: Shot) => {
    if (!s.box) return { scale: fit, cx: vw / 2, cy: vh / 2 };
    const pad = s.pad ?? 1.25;
    const scale = Math.min(fit * maxZoom, Math.max(fit, Math.min(w / (s.box.w * pad), h / (s.box.h * pad))));
    return { scale, cx: s.box.x + s.box.w / 2, cy: s.box.y + s.box.h / 2 };
  };
  const ks = shots.map(frameFor);
  const ts = shots.map((s) => s.t);
  // glide over ~0.45 s ending at each cue
  const glide = 0.45;
  const pick = (key: "scale" | "cx" | "cy") => {
    if (ks.length === 1) return ks[0][key];
    const input: number[] = [];
    const output: number[] = [];
    ks.forEach((k, i) => {
      const t0 = i === 0 ? ts[0] : Math.max(ts[i] - glide, input[input.length - 1] + 0.01);
      if (i > 0) {
        input.push(t0);
        output.push(ks[i - 1][key]);
      }
      input.push(Math.max(ts[i], (input[input.length - 1] ?? -1) + 0.01));
      output.push(k[key]);
    });
    return interpolate(clipT, input, output, { ...clamp, easing: ease });
  };
  const scale = pick("scale");
  // keep the frame inside the recording
  const cx = Math.min(vw - w / (2 * scale), Math.max(w / (2 * scale), pick("cx")));
  const cy = Math.min(vh - h / (2 * scale), Math.max(h / (2 * scale), pick("cy")));
  return (
    <div style={{ width: w, height: h, overflow: "hidden", position: "relative", background: "#fff", ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: vw, height: vh, transformOrigin: "0 0", transform: `translate(${w / 2 - cx * scale}px, ${h / 2 - cy * scale}px) scale(${scale})` }}>
        <Video src={staticFile(src)} trimBefore={Math.round(from * fps)} playbackRate={rate} muted style={{ width: vw, height: vh }} />
      </div>
    </div>
  );
};

/**
 * A phone screen card around a Camera. It is wider than a real phone on purpose: the camera
 * crops to the part of the page that matters, so the UI reads at a legible size in a 1080p frame.
 */
export const Phone: React.FC<Omit<Props, "w" | "h" | "vw" | "vh"> & { height?: number; width?: number; tilt?: number }> = ({ height = 1000, width = 860, tilt = 0, style, ...rest }) => (
  <div style={{ padding: 14, background: C.ink, borderRadius: 56, boxShadow: "0 40px 90px rgba(26,24,20,.35)", rotate: `${tilt}deg`, ...style }}>
    <Camera vw={1170} vh={2532} w={width - 28} h={height - 28} style={{ borderRadius: 42 }} {...rest} />
  </div>
);
