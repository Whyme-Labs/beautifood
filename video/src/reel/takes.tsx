// The real recordings (public/reel-clips, made by e2e/evidence/reel-clips.mjs) and the camera
// moves that frame them. The reel, the promos and the feature demos all cut from these.
import type React from "react";
import { C } from "../theme";
import { Camera, Phone, type Shot } from "./camera";

export type Take = {
  src: string;
  kind: "phone" | "desk";
  /** Recording size, clip length (s), where to start and how fast to play. */
  vw: number;
  vh: number;
  dur: number;
  from: number;
  rate: number;
  shots: Shot[];
  maxZoom?: number;
};

const R = "reel-clips/";
const phone = (name: string, dur: number, from: number, rate: number, shots: Shot[], maxZoom?: number): Take => ({ src: `${R}${name}.mp4`, kind: "phone", vw: 1170, vh: 2532, dur, from, rate, shots, maxZoom });
const desk = (name: string, dur: number, from: number, rate: number, shots: Shot[], maxZoom?: number, size = { vw: 2880, vh: 1800 }): Take => ({ src: `${R}${name}.mp4`, kind: "desk", ...size, dur, from, rate, shots, maxZoom });

export const TAKES = {
  join: phone("p-join", 5.56, 0.2, 1.25, [{ t: 0.2, box: null }, { t: 0.6, box: { x: 105, y: 880, w: 960, h: 900 } }, { t: 3.71, box: { x: 108, y: 379, w: 954, h: 294 }, pad: 1.1 }, { t: 4.6, box: { x: 108, y: 379, w: 954, h: 800 } }], 1.9),
  called: phone("p-ticket-called", 5.27, 0.3, 1.15, [{ t: 0.3, box: { x: 48, y: 225, w: 1074, h: 1103 } }, { t: 2.62, box: { x: 48, y: 225, w: 1074, h: 879 }, pad: 1.05 }], 1.6),
  preorder: phone("p-preorder", 10.53, 1.8, 1.6, [{ t: 1.8, box: null }, { t: 2.4, box: { x: 48, y: 855, w: 1074, h: 1000 } }, { t: 4.7, box: { x: 48, y: 604, w: 1074, h: 753 } }, { t: 8.52, box: { x: 48, y: 512, w: 1074, h: 1001 } }], 1.7),
  cartA: phone("p-cart-a", 8.91, 1.2, 1.6, [{ t: 1.2, box: { x: 48, y: 700, w: 1074, h: 1200 } }, { t: 3.56, box: { x: 48, y: 1500, w: 1074, h: 1000 } }, { t: 7.08, box: { x: 48, y: 593, w: 1074, h: 1270 } }], 1.6),
  cartB: phone("p-cart-b", 8.91, 1.2, 1.6, [{ t: 1.2, box: { x: 48, y: 700, w: 1074, h: 1200 } }, { t: 5.96, box: { x: 48, y: 1500, w: 1074, h: 1000 } }, { t: 7.1, box: { x: 48, y: 604, w: 1074, h: 1192 } }], 1.6),
  assistant: phone("p-assistant", 7.45, 0.8, 1.6, [{ t: 0.8, box: { x: 54, y: 1900, w: 1062, h: 600 } }, { t: 4.14, box: { x: 66, y: 922, w: 913, h: 1490 }, pad: 1.05 }, { t: 5.24, box: { x: 105, y: 1700, w: 835, h: 600 } }], 1.8),
  assistantZh: phone("p-assistant-zh", 6.95, 3.0, 1.2, [{ t: 3.0, box: { x: 66, y: 1074, w: 913, h: 1193 }, pad: 1.05 }], 1.5),
  menuZh: phone("p-menu-zh", 6.66, 1.0, 1.2, [{ t: 1.0, box: { x: 48, y: 1170, w: 1074, h: 469 }, pad: 1.1 }, { t: 3.16, box: { x: 48, y: 930, w: 1074, h: 469 }, pad: 1.1 }], 2.2),
  host: desk("d-host", 6.12, 0.2, 1, [{ t: 0.2, box: { x: 230, y: 380, w: 1500, h: 900 } }, { t: 1.35, box: { x: 270, y: 693, w: 1386, h: 139 }, pad: 1.6 }, { t: 2.15, box: { x: 1900, y: 650, w: 900, h: 600 } }, { t: 3.28, box: { x: 270, y: 693, w: 1386, h: 139 }, pad: 1.6 }, { t: 3.86, box: { x: 1900, y: 800, w: 900, h: 600 } }], 2),
  kitchen: desk("d-kitchen-zh", 6.68, 0.6, 1.5, [{ t: 0.6, box: { x: 232, y: 400, w: 1600, h: 1000 } }, { t: 1.25, box: { x: 232, y: 450, w: 1300, h: 800 } }, { t: 3.44, box: { x: 232, y: 500, w: 1300, h: 800 } }, { t: 4.88, box: { x: 232, y: 400, w: 2416, h: 1038 } }], 1.8),
  till: desk("d-pos", 8.83, 0.9, 1.9, [{ t: 0.9, box: { x: 588, y: 300, w: 2000, h: 1300 } }, { t: 3.68, box: { x: 1750, y: 330, w: 980, h: 700 } }, { t: 5.6, box: { x: 1700, y: 1350, w: 1000, h: 450 } }, { t: 7.21, box: { x: 1100, y: 1450, w: 1200, h: 350 } }], 2.2),
  setup: desk("d-setup", 7.58, 0.2, 1.2, [{ t: 0.2, box: { x: 270, y: 900, w: 2340, h: 700 } }, { t: 3.4, box: { x: 270, y: 1500, w: 2340, h: 300 } }, { t: 3.96, box: { x: 270, y: 900, w: 2340, h: 800 } }, { t: 5.74, box: { x: 232, y: 300, w: 2416, h: 700 } }], 1.6),
  translate: desk("d-translate", 6.22, 0.6, 1.5, [{ t: 0.6, box: { x: 1700, y: 280, w: 1000, h: 500 } }, { t: 1.71, box: { x: 270, y: 450, w: 2340, h: 500 } }, { t: 4.02, box: null }], 2),
  boss: desk("d-boss", 8.43, 0.4, 2, [{ t: 0.4, box: { x: 232, y: 697, w: 2416, h: 900 } }, { t: 2.39, box: { x: 232, y: 1254, w: 2416, h: 506 } }, { t: 4.81, box: { x: 232, y: 405, w: 2416, h: 1100 } }, { t: 7.02, box: { x: 1460, y: 721, w: 1188, h: 1039 } }], 1.8),
  board: desk("d-display", 7.3, 1.4, 1.8, [{ t: 1.4, box: null }], 1, { vw: 1920, vh: 1080 }),
} satisfies Record<string, Take>;

export type TakeId = keyof typeof TAKES;

/** Seconds a take plays before its recording runs out, at a given speed. */
export const takeLen = (id: TakeId, rate = TAKES[id].rate) => (TAKES[id].dur - TAKES[id].from) / rate;

/** A take on screen: phones as a screen card, desktops full-frame or in a rounded panel. */
export const Device: React.FC<{ id: TakeId; w: number; h: number; rate?: number; tilt?: number; bare?: boolean }> = ({ id, w, h, rate, tilt, bare }) => {
  const t = TAKES[id];
  const cam = { src: t.src, from: t.from, rate: rate ?? t.rate, shots: t.shots, maxZoom: t.maxZoom };
  if (t.kind === "phone") return <Phone {...cam} width={w} height={h} tilt={tilt} />;
  if (bare) return <Camera {...cam} vw={t.vw} vh={t.vh} w={w} h={h} />;
  return (
    <div style={{ padding: 10, background: C.ink, borderRadius: 26, boxShadow: "0 40px 90px rgba(26,24,20,.3)", rotate: tilt ? `${tilt}deg` : undefined }}>
      <Camera {...cam} vw={t.vw} vh={t.vh} w={w - 20} h={h - 20} style={{ borderRadius: 18 }} />
    </div>
  );
};
