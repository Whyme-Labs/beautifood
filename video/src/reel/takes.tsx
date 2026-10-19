// The real recordings (public/reel-clips/<lang>, made by e2e/evidence/reel-clips.mjs) and the camera
// moves that frame them. Each take names the key moments by cue label, so its timing and framing
// come from that language's own recording (cues/<lang>.json). The reel, the promos and the feature
// demos all cut from these.
import type React from "react";
import { C } from "../theme";
import { Camera, Phone, type Box, type Shot } from "./camera";
import { useLang, type Lang } from "./copy";
import en from "./cues/en.json";
import zh from "./cues/zh.json";

type Recording = { width: number; height: number; duration: number; cues: { label: string; t: number; box: Box | null }[] };
const CUES: Record<Lang, Record<string, Recording>> = { en: en.clips, zh: zh.clips };

/** A camera keyframe at a cue: frame the cue's element ("cue"), a fixed region, or the whole screen. */
type ShotSpec = { at: string; dt?: number; box?: "cue" | Box | null; pad?: number };
type TakeSpec = { clip: string; kind: "phone" | "desk"; rate: number; shots: ShotSpec[]; maxZoom?: number; lead?: number };

const phone = (clip: string, rate: number, shots: ShotSpec[]): TakeSpec => ({ clip, kind: "phone", rate, shots });
const desk = (clip: string, rate: number, shots: ShotSpec[], maxZoom = 2): TakeSpec => ({ clip, kind: "desk", rate, shots, maxZoom });

const SPECS = {
  join: phone("p-join", 1.25, [{ at: "tap +" }, { at: "type name" }, { at: "ticket number appears" }, { at: "ahead + wait" }]),
  called: phone("p-ticket-called", 1.15, [{ at: "waiting ticket" }, { at: "ticket stub (called)" }]),
  preorder: phone("p-preorder", 1.6, [{ at: "tap preorder" }, { at: "add Char Kway Teow" }, { at: "add Cendol" }, { at: "cart lines" }, { at: "preorder saved" }]),
  cartA: phone("p-cart-a", 1.5, [{ at: "A types name" }, { at: "A adds Char Kway Teow" }, { at: "A adds Nasi Lemak" }, { at: "cart view (grouped by person)" }]),
  cartB: phone("p-cart-b", 1.5, [{ at: "B types name" }, { at: "B adds Cendol" }, { at: "B adds Satay" }, { at: "cart view (grouped by person)" }]),
  assistant: phone("p-assistant", 1.6, [{ at: "tap Ask what to eat" }, { at: "type question" }, { at: "answer appears" }, { at: "safety note" }]),
  signatures: phone("p-signatures", 1.5, [{ at: "type question" }, { at: "answer appears" }, { at: "recommended dishes" }]),
  menu: phone("p-menu", 1.2, [{ at: "allergen filter chips" }, { at: "first dish" }, { at: "dish" }, { at: "dish card" }]),
  host: desk("d-host", 1, [{ at: "suggestions", box: { x: 230, y: 380, w: 1500, h: 900 } }, { at: "Call", pad: 5 }, { at: "called: table held on the floor", box: { x: 1900, y: 650, w: 900, h: 600 } }, { at: "Seat", pad: 5 }, { at: "floor: seated", box: { x: 1900, y: 650, w: 900, h: 700 } }]),
  kitchen: desk("d-kitchen", 1.5, [{ at: "tickets", box: { x: 232, y: 400, w: 1600, h: 1000 } }, { at: "bump → cooking", pad: 2.4 }, { at: "all ready", pad: 3.5 }, { at: "ticket cleared", box: { x: 232, y: 400, w: 2416, h: 1038 } }], 1.8),
  till: desk("d-pos", 1.7, [{ at: "select bill", box: { x: 588, y: 300, w: 2000, h: 1300 } }, { at: "promo applied (discount line)", pad: 3 }, { at: "change preview", pad: 2 }, { at: "change toast", pad: 3 }], 2.2),
  setup: desk("d-setup", 1.2, [{ at: "paste menu", pad: 1.3 }, { at: "describe floor", pad: 1.5 }, { at: "draft items appear", pad: 2.5 }, { at: "applied", pad: 2 }], 1.6),
  translate: desk("d-translate", 1.3, [{ at: "Translate menu", pad: 3 }, { at: "translation result", pad: 1.4 }, { at: "dishes", box: null }]),
  boss: desk("d-boss", 1.8, [{ at: "today across both branches (totals)", pad: 1.2 }, { at: "AI insights", pad: 1.3 }, { at: "report KPIs", pad: 1.2 }, { at: "best sellers & menu engineering", pad: 1.2 }], 1.8),
  board: { clip: "d-display", kind: "desk", rate: 1.6, shots: [{ at: "board: nobody called yet", box: null }], maxZoom: 1, lead: 0.4 } as TakeSpec,
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

/** Seconds a take plays before its recording runs out, at a given speed. */
export const takeLen = (id: TakeId, lang: Lang, rate?: number) => {
  const t = take(id, lang);
  return (t.dur - t.from) / (rate ?? t.rate);
};

/** A take on screen: phones as a screen card, desktops full-frame or in a rounded panel. */
export const Device: React.FC<{ id: TakeId; w: number; h: number; rate?: number; tilt?: number; bare?: boolean }> = ({ id, w, h, rate, tilt, bare }) => {
  const t = take(id, useLang());
  const cam = { src: t.src, from: t.from, rate: rate ?? t.rate, shots: t.shots, maxZoom: t.maxZoom };
  if (t.kind === "phone") return <Phone {...cam} width={w} height={h} tilt={tilt} />;
  if (bare) return <Camera {...cam} vw={t.vw} vh={t.vh} w={w} h={h} />;
  return (
    <div style={{ padding: 10, background: C.ink, borderRadius: 26, boxShadow: "0 40px 90px rgba(26,24,20,.3)", rotate: tilt ? `${tilt}deg` : undefined }}>
      <Camera {...cam} vw={t.vw} vh={t.vh} w={w - 20} h={h - 20} style={{ borderRadius: 18 }} />
    </div>
  );
};
