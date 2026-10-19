// One thing at a time. A scene opens on its title while the screen waits, dimmed and still; then
// the screen plays. Each caption lands while the screen pauses for it, so the eye is never asked
// to read on one side of the frame and watch motion on the other at the same moment.
import React, { createContext, useContext } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BAR, BEAT, clamp, ease } from "./beat";

/** Seconds the title holds before the screen plays, and how long each caption pauses it. */
export const HOLD = 0.75 * BAR;
export const PAUSE = 0.375 * BAR;

type Focus = { hold: number; marks: number[] };
const Ctx = createContext<Focus | null>(null);

/**
 * Captions at play-time beats `at` (the same beats the scene used before it had pauses): each
 * after the first frame of play gets a pause. Wrap a stage in this; its devices and tags follow.
 */
export const FocusScene: React.FC<{ at?: number[]; hold?: number; children: React.ReactNode }> = ({ at = [], hold = HOLD, children }) => (
  <Ctx.Provider value={{ hold, marks: at.map((b) => b * BEAT) }}>{children}</Ctx.Provider>
);

/** Extra bars a focused scene needs on top of what its recording plays: the hold and the pauses. */
export const focusBars = (captions: number, hold = HOLD) => (hold + captions * PAUSE) / BAR;

const pausesOf = (f: Focus) => f.marks.filter((m) => m > 0);

/** Scene time (s) at which caption `i` lands. */
export function landAt(f: Focus, i: number) {
  const m = f.marks[i] ?? 0;
  if (m <= 0) return 0;
  const before = pausesOf(f).filter((x) => x < m).length;
  return f.hold + m + before * PAUSE;
}

/** Map scene time to recording play time (frozen during the hold and each pause), and how dimmed the screen is. */
export function playTime(f: Focus | null, s: number) {
  if (!f) return { t: s, dim: 0 };
  if (s < f.hold) return { t: 0, dim: interpolate(s, [f.hold - 0.35, f.hold], [1, 0], { ...clamp, easing: ease }) };
  let t = s - f.hold;
  let dim = 0;
  for (const m of pausesOf(f)) {
    if (t <= m) break;
    if (t < m + PAUSE) {
      const into = t - m;
      dim = 0.5 * Math.min(interpolate(into, [0, 0.2], [0, 1], clamp), interpolate(into, [PAUSE - 0.25, PAUSE], [1, 0], clamp));
      t = m;
      break;
    }
    t -= PAUSE;
  }
  return { t, dim };
}

export const useFocus = () => useContext(Ctx);

/** The current play time (s) of the scene's recordings, and the dim level 0..1. */
export function usePlay() {
  const f = useFocus();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return playTime(f, frame / fps);
}

/** A caption's appearance beat in scene time: where it was asked for, shifted by the hold and the pauses before it. */
export function useLandBeat(i: number, at: number) {
  const f = useFocus();
  if (!f) return at;
  return landAt(f, i) / BEAT;
}
