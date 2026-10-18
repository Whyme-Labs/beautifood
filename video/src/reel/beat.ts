// The soundtrack's grid: 112.8 BPM, first downbeat at 0.892 s (measured from the track's onsets).
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const BPM = 112.8;
export const BEAT = 60 / BPM;
export const DOWNBEAT = 0.892;
export const BAR = 4 * BEAT;

/** Seconds at the start of bar `n` (bar 0 is the first downbeat). */
export const bar = (n: number) => DOWNBEAT + n * BAR;
/** Frames at the start of bar `n`. */
export const barF = (n: number, fps = 30) => Math.round(bar(n) * fps);
/** Frames spanning bars a..b. */
export const barsF = (a: number, b: number, fps = 30) => barF(b, fps) - barF(a, fps);

export const ease = Easing.bezier(0.23, 1, 0.32, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Local beat position inside a scene that starts on a downbeat. */
export function useBeat() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = frame / (BEAT * fps);
  return { beat: Math.floor(b), phase: b - Math.floor(b), frame, fps, t: frame / fps };
}

/** 1 right on each beat, decaying to 0 over `len` beats: a punch for scale or flashes. */
export function usePulse(len = 0.5, every = 1) {
  const { beat, phase } = useBeat();
  const p = ((beat % every) + phase) / every;
  return beat < 0 ? 0 : Math.max(0, 1 - p / (len / every));
}

/** 0→1 eased between two local times in beats. */
export function useAt(fromBeat: number, durBeats = 0.75) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [fromBeat * BEAT * fps, (fromBeat + durBeats) * BEAT * fps], [0, 1], { ...clamp, easing: ease });
}
