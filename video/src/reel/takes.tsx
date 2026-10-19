// The real recordings (public/reel-clips/<lang>, made by e2e/evidence/reel-clips.mjs) and the camera
// moves that frame them. Each take names the key moments by cue label, so its timing and framing
// come from that language's own recording (cues/<lang>.json). The reel, the promos and the feature
// demos all cut from these.
import type React from "react";
import { C } from "../theme";
import { Camera, Phone, type Box, type Shot } from "./camera";
import { useLang, type Lang } from "./copy";
import { usePlay } from "./focus";
import en from "./cues/en.json";
import zh from "./cues/zh.json";

type Recording = { width: number; height: number; duration: number; cues: { label: string; t: number; box: Box | null }[] };
const CUES: Record<Lang, Record<string, Recording>> = { en: en.clips, zh: zh.clips };

/** The hero's ticket number and table in that language's recording, so graphics can quote them. */
export const story = (lang: Lang): { hero: string; table: string } => ({ en: en.story, zh: zh.story })[lang] as unknown as { hero: string; table: string };

/** A camera keyframe at a cue: frame the cue's element ("cue"), a fixed region, or the whole screen. */
type ShotSpec = { at: string; dt?: number; box?: "cue" | Box | null; pad?: number };
type TakeSpec = { clip: string; kind: "phone" | "desk"; rate: number; shots: ShotSpec[]; maxZoom?: number; lead?: number };

const phone = (clip: string, rate: number, shots: ShotSpec[]): TakeSpec => ({ clip, kind: "phone", rate, shots });
const desk = (clip: string, rate: number, shots: ShotSpec[], maxZoom = 2): TakeSpec => ({ clip, kind: "desk", rate, shots, maxZoom });

const SPECS = {
  join: phone("p-join", 1.6, [{ at: "tap +" }, { at: "type name" }, { at: "ticket number appears" }]),
  // the live ticket while the hero still waits (the end of the join clip, before anyone is seated)
  ticket: { ...phone("p-join", 0.8, [{ at: "ahead + wait" }]), lead: 0.5 } as TakeSpec,
  menu: phone("p-menu", 1.2, [{ at: "allergen filter chips" }, { at: "first dish" }, { at: "dish" }]),
  assistant: phone("p-assistant", 1.6, [{ at: "tap Ask what to eat" }, { at: "type question" }, { at: "answer appears" }, { at: "safety note" }]),
  preorder: phone("p-preorder", 1.9, [{ at: "tap preorder" }, { at: "add Char Kway Teow" }, { at: "add Cendol" }, { at: "cart lines" }, { at: "preorder saved" }]),
  // the host's queue before the call: every party, how long they've waited, the AI suggestion
  hostQueue: { ...desk("d-host", 0.6, [{ at: "suggestions", box: { x: 110, y: 300, w: 1220, h: 900 } }], 1.6), lead: 0.3 } as TakeSpec,
  // the call, filmed on three screens at once: keep their rates and leads equal so they stay in sync
  hostCall: desk("d-host", 1.25, [{ at: "suggestions", pad: 1.6 }, { at: "Call", pad: 5 }, { at: "called: table held on the floor", pad: 3 }, { at: "Seat here", pad: 2 }, { at: "floor: seated", pad: 3 }], 2.2),
  phoneCall: phone("p-ticket-called", 1.25, [{ at: "waiting ticket" }, { at: "table ready" }, { at: "seated" }]),
  board: { clip: "d-display", kind: "desk", rate: 1, shots: [{ at: "first called", box: null }], maxZoom: 1, lead: 0.8 } as TakeSpec,
  // mid-rush, four screens filmed together: same rate and lead keeps them in sync
  rushHost: desk("x-host", 1.5, [{ at: "start", box: { x: 110, y: 300, w: 1220, h: 900 } }, { at: "call", pad: 6 }, { at: "called", box: { x: 110, y: 300, w: 1220, h: 900 } }], 1.6),
  rushKitchen: desk("x-kitchen", 1.5, [{ at: "start", box: null }, { at: "new ticket", pad: 1.5 }, { at: "bump", pad: 1.5 }], 2),
  rushTv: { clip: "x-tv", kind: "desk", rate: 1.5, shots: [{ at: "start", box: null }], maxZoom: 1 } as TakeSpec,
  rushPhone: phone("x-phone", 1.5, [{ at: "start" }, { at: "phone flips" }]),
  cartA: phone("p-cart-a", 1.3, [{ at: "A types name" }, { at: "A adds Char Kway Teow" }, { at: "cart view (grouped by person)" }, { at: "sent to kitchen" }]),
  cartB: phone("p-cart-b", 1.3, [{ at: "B types name" }, { at: "B adds Cendol" }, { at: "B adds Satay" }, { at: "cart view (grouped by person)" }]),
  kitchen: desk("d-kitchen", 1.4, [{ at: "tickets", pad: 1.1 }, { at: "bump → cooking", pad: 2.4 }, { at: "all ready", pad: 3.5 }, { at: "ticket cleared", box: null }], 1.8),
  till: desk("d-pos", 1.6, [{ at: "select bill", pad: 4 }, { at: "bill open", pad: 1.2 }, { at: "promo applied (discount line)", pad: 3 }, { at: "change preview", pad: 2 }, { at: "change toast", pad: 3 }], 2.2),
  setup: desk("d-setup", 1.3, [{ at: "paste menu", pad: 1.3 }, { at: "describe floor", pad: 1.5 }, { at: "draft items appear", pad: 2.5 }, { at: "applied", pad: 2 }], 1.6),
  translate: desk("d-translate", 1.3, [{ at: "Translate menu", pad: 3 }, { at: "translation result", pad: 1.4 }, { at: "dishes", box: null }]),
  // the dashboard, then (as its own take, skipping the page load between them) tonight's report
  boss: desk("d-boss", 1.2, [{ at: "today across both branches (totals)", pad: 1.2 }, { at: "branch cards", pad: 1.2 }, { at: "AI insights", pad: 1.3 }], 1.8),
  report: { ...desk("d-boss", 1.2, [{ at: "report KPIs", pad: 1.2 }, { at: "best sellers & menu engineering", pad: 1.2 }], 1.8), lead: 0.1 } as TakeSpec,
} satisfies Record<string, TakeSpec>;

export type TakeId = keyof typeof SPECS;

export type Take = { src: string; kind: "phone" | "desk"; vw: number; vh: number; dur: number; from: number; rate: number; shots: Shot[]; maxZoom?: number };

/** A take resolved against one language's recording. */
export function take(id: TakeId, lang: Lang): Take {
  const spec: TakeSpec = SPECS[id];
  const rec = CUES[lang][spec.clip];
  if (!rec) throw new Error(`no ${lang} recording for ${spec.clip}`);
  const cue = (label: string) => {
    const c = rec.cues.find((x) => x.label === label);
    if (!c) throw new Error(`${spec.clip} (${lang}) has no cue "${label}"`);
    return c;
  };
  const shots: Shot[] = spec.shots.map((s) => {
    const c = cue(s.at);
    const box = s.box === undefined || s.box === "cue" ? c.box : s.box;
    return { t: c.t + (s.dt ?? 0), box, pad: s.pad };
  });
  const from = Math.max(0, shots[0].t - (spec.lead ?? 0.25));
  return { src: `reel-clips/${lang}/${spec.clip}.mp4`, kind: spec.kind, vw: rec.width, vh: rec.height, dur: rec.duration, from, rate: spec.rate, shots, maxZoom: spec.maxZoom };
}

/** Where a cue falls in a take, in seconds of the take as played (from its start, at its speed). */
export const cueIn = (id: TakeId, lang: Lang, label: string, rate?: number) => {
  const t = take(id, lang);
  const c = CUES[lang][SPECS[id].clip].cues.find((x) => x.label === label);
  return c ? Math.max(0, (c.t - t.from) / (rate ?? t.rate)) : 0;
};

/** Seconds a take plays before its recording runs out, at a given speed. */
export const takeLen = (id: TakeId, lang: Lang, rate?: number) => {
  const t = take(id, lang);
  return (t.dur - t.from) / (rate ?? t.rate);
};

/** A take on screen: phones as a screen card, desktops full-frame or in a rounded panel. */
export const Device: React.FC<{ id: TakeId; w: number; h: number; rate?: number; tilt?: number; bare?: boolean }> = ({ id, w, h, rate, tilt, bare }) => {
  const t = take(id, useLang());
  // waiting for the title or a caption, the screen steps back so the words have the eye
  const opacity = 1 - 0.55 * usePlay().dim;
  const cam = { src: t.src, from: t.from, rate: rate ?? t.rate, shots: t.shots, maxZoom: t.maxZoom };
  if (t.kind === "phone") return <Phone {...cam} width={w} height={h} tilt={tilt} style={{ opacity }} />;
  if (bare) return <Camera {...cam} vw={t.vw} vh={t.vh} w={w} h={h} style={{ opacity }} />;
  return (
    <div style={{ padding: 10, background: C.ink, borderRadius: 26, boxShadow: "0 40px 90px rgba(26,24,20,.3)", rotate: tilt ? `${tilt}deg` : undefined, opacity }}>
      <Camera {...cam} vw={t.vw} vh={t.vh} w={w - 20} h={h - 20} style={{ borderRadius: 18 }} />
    </div>
  );
};
