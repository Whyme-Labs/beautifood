// Scenes added after the second review: the four screens of the rush in sync, the two diners as
// figures, the walk-away count running down to zero, the 300-person queue, and the till on any
// device with a receipt printer.
import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "../theme";
import { BEAT, clamp, ease, useAt, useBeat } from "./beat";
import { useCopy, useLang } from "./copy";
import { Person, Tag } from "./scenes";
import { cueIn, Device } from "./takes";

/** A heading for the scene: what this feature is, in a few words. */
export const Title: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 74, style }) => {
  const p = useAt(0, 0.6);
  return (
    <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: "-.025em", color: C.ink, opacity: p, translate: `0 ${(1 - p) * 18}px`, ...style }}>
      {children}
    </div>
  );
};

const Pane: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <div style={{ position: "relative", ...style }}>
    {children}
    <span style={{ position: "absolute", left: 16, top: 16, background: C.ink, color: C.sun, fontFamily: SANS, fontWeight: 900, fontSize: 24, letterSpacing: ".06em", padding: "7px 13px", borderRadius: 10 }}>{label}</span>
  </div>
);

/** Mid-rush, four screens filmed at the same moment: one thing happens, every screen reacts. */
export const RushStage: React.FC = () => {
  const copy = useCopy();
  const lang = useLang();
  const { beat, phase } = useBeat();
  const now = (beat + phase) * BEAT;
  // captions follow the recording's own cues
  const steps = ([["rushHost", "guests join"], ["rushHost", "order arrives"], ["rushHost", "call"], ["rushKitchen", "bump"]] as const).map(([id, label], i) => ({ at: cueIn(id, lang, label), text: copy.rush[i] }));
  const current = [...steps].reverse().find((s) => now >= s.at - 0.15);
  return (
    <AbsoluteFill style={{ background: C.ink, padding: "28px 40px 34px", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, height: 80 }}>
        <Title size={60} style={{ color: C.sun }}>{copy.titles.rush}</Title>
        {current && (
          <span key={current.text} style={{ marginLeft: "auto" }}>
            <Tag at={current.at / BEAT} size={40}>{current.text}</Tag>
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 18, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Pane label={copy.who.host}><Device id="rushHost" w={1130} h={520} bare /></Pane>
          <Pane label={copy.who.kitchen}><Device id="rushKitchen" w={1130} h={400} bare /></Pane>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
          <Pane label={copy.who.tv}><Device id="rushTv" w={652} h={367} bare /></Pane>
          <Pane label={copy.who.guest} style={{ paddingLeft: 60 }}><Device id="rushPhone" w={420} h={553} /></Pane>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Two diners as figures, both pointing at one shared cart. */
export const Diners: React.FC<{ names: [string, string] }> = ({ names }) => {
  const a = useAt(0, 0.6);
  const b = useAt(1, 0.6);
  const cart = useAt(2, 0.6);
  const Who = ({ name, p, color }: { name: string; p: number; color: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: p, translate: `0 ${(1 - p) * 20}px` }}>
      <Person size={86} color={color} />
      <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 40, color: C.ink }}>{name}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ display: "flex", gap: 46 }}>
        <Who name={names[0]} p={a} color={C.ink} />
        <Who name={names[1]} p={b} color="#e2557a" />
      </div>
      <svg width="220" height="60" viewBox="0 0 220 60" style={{ opacity: cart }}>
        <path d="M40 4 C60 40 90 50 110 52 M180 4 C160 40 130 50 110 52" fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div style={{ opacity: cart, scale: String(0.9 + 0.1 * cart), background: C.ink, borderRadius: 22, padding: "16px 26px", display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={C.sun} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6" />
        </svg>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 44, color: C.sun }}>×1</span>
      </div>
    </div>
  );
};

/** The opening rush again: the walk-away count runs down, -10 … 0, as the faces come back. */
export const Countdown: React.FC = () => {
  const copy = useCopy();
  const { beat, phase } = useBeat();
  const n = Math.max(0, 10 - Math.floor((beat + phase) * 1.5)); // one step every ⅔ beat
  const done = useAt(7, 0.6);
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: SANS, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: 120, right: 120, top: 70, height: 120, display: "flex", borderRadius: "0 0 30px 30px", overflow: "hidden" }}>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? C.paper : C.sun }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 215, left: 0, right: 0, textAlign: "center", color: C.sun, fontFamily: NUM, fontWeight: 800, fontSize: 64, letterSpacing: ".04em" }}>{copy.crowd.sign}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 30, marginTop: 100, scale: String(1 + done * 0.08) }}>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 300, color: n === 0 ? C.sun : C.paper, lineHeight: 1, minWidth: 360, textAlign: "right" }}>{n === 0 ? "0" : `−${n}`}</span>
        <span style={{ fontSize: 80, fontWeight: 900, color: C.paper }}>{copy.reprise}</span>
      </div>
      <div style={{ display: "flex", gap: 34, marginTop: 60 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <Person key={i} size={54} color={i < 10 - n ? C.sun : "#3a352d"} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 300 people in one long queue, each holding their own number: start close, pull back to all. */
export const QueueZoom: React.FC = () => {
  const copy = useCopy();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const COLS = 30, ROWS = 10, CW = 58, CH = 104;
  const W = COLS * CW, H = ROWS * CH;
  // close on the first three, then out to the whole queue
  const z = interpolate(frame, [0.6 * fps, 4.6 * fps], [5.2, 1], { ...clamp, easing: ease });
  const focusX = interpolate(z, [1, 5.2], [W / 2, CW * 1.5]);
  const focusY = interpolate(z, [1, 5.2], [H / 2, CH * 0.5]);
  const end = useAt(9, 0.6);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 960 - focusX * z, top: 520 - focusY * z, width: W, height: H, transformOrigin: "0 0", scale: String(z) }}>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const r = Math.floor(i / COLS);
          const c = r % 2 ? COLS - 1 - (i % COLS) : i % COLS; // the line snakes back and forth
          return (
            <div key={i} style={{ position: "absolute", left: c * CW + 8, top: r * CH + 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <Person size={30} color={i % 4 === 0 ? C.sun : i % 4 === 1 ? "#ff8fa8" : i % 4 === 2 ? "#7fddbf" : "#bba8ff"} />
              <span style={{ background: C.paper, color: C.ink, fontFamily: NUM, fontWeight: 800, fontSize: 15, padding: "1px 4px", borderRadius: 3 }}>{`A${String(i + 1).padStart(3, "0")}`}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", gap: 18, opacity: end, translate: `0 ${(1 - end) * 20}px` }}>
        <Tag at={9} size={48}>{copy.wallZoom[0]}</Tag>
        <Tag at={10} size={48} dark>{copy.wallZoom[1]}</Tag>
      </div>
    </AbsoluteFill>
  );
};

/** The real till on a POS terminal, a tablet and a laptop, and a receipt coming out of the printer. */
export const PosDevices: React.FC = () => {
  const copy = useCopy();
  const lang = useLang();
  const shot = staticFile(`reel-stills/pos-${lang}.png`);
  const a = useAt(0, 0.6), b = useAt(1, 0.6), c = useAt(2, 0.6);
  const receipt = useAt(4, 2.2);
  const label = (s: string) => <div style={{ marginTop: 14, textAlign: "center", fontFamily: SANS, fontWeight: 850, fontSize: 30, color: C.ink }}>{s}</div>;
  const screen = (w: number, h: number) => <Img src={shot} style={{ width: w, height: h, objectFit: "cover", objectPosition: "left top", display: "block" }} />;
  return (
    <AbsoluteFill style={{ background: C.sunSoft, alignItems: "center", justifyContent: "center", gap: 40, paddingTop: 30 }}>
      <Title>{copy.titles.pos}</Title>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 70 }}>
        {/* POS terminal with a receipt printer on top */}
        <div style={{ opacity: a, translate: `0 ${(1 - a) * 30}px` }}>
          <div style={{ position: "relative", width: 360, background: "#2b2925", borderRadius: 30, padding: "70px 16px 26px" }}>
            <div style={{ position: "absolute", left: 60, right: 60, top: 26, height: 12, borderRadius: 6, background: "#0c0b0a" }} />
            <div style={{ position: "absolute", left: 76, top: 32, width: 208, height: 260 * receipt, transform: "translateY(-100%)", background: "#fff", borderRadius: "6px 6px 0 0", boxShadow: "0 8px 20px rgba(0,0,0,.2)", overflow: "hidden", padding: receipt > 0.1 ? "14px 16px" : 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
              <div style={{ textAlign: "center", fontWeight: 800 }}>AUNTIE LIM'S KITCHEN</div>
              <div style={{ textAlign: "center" }}>KLCC · T4</div>
              <div>--------------------------</div>
              <div>Char Kway Teow    16.90</div>
              <div>Cendol             8.50</div>
              <div>Satay (6)         13.00</div>
              <div>--------------------------</div>
              <div style={{ fontWeight: 800 }}>TOTAL         RM76.40</div>
            </div>
            <div style={{ borderRadius: 14, overflow: "hidden" }}>{screen(328, 440)}</div>
          </div>
          {label(copy.pos.devices[0])}
        </div>
        {/* tablet */}
        <div style={{ opacity: b, translate: `0 ${(1 - b) * 30}px` }}>
          <div style={{ background: "#1a1814", borderRadius: 34, padding: 22 }}>
            <div style={{ borderRadius: 14, overflow: "hidden" }}>{screen(560, 400)}</div>
          </div>
          {label(copy.pos.devices[1])}
        </div>
        {/* laptop */}
        <div style={{ opacity: c, translate: `0 ${(1 - c) * 30}px` }}>
          <div style={{ background: "#1a1814", borderRadius: "20px 20px 0 0", padding: "18px 18px 22px" }}>
            <div style={{ borderRadius: 6, overflow: "hidden" }}>{screen(500, 312)}</div>
          </div>
          <div style={{ height: 22, margin: "0 -36px", background: "#b9b3a6", borderRadius: "0 0 18px 18px" }} />
          {label(copy.pos.devices[2])}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {copy.tags.pos.map((x, i) => (
          <Tag key={x} at={3 + i * 2} size={44} dark={i % 2 === 1}>{x}</Tag>
        ))}
        <Tag at={7} size={44}>{copy.pos.printer}</Tag>
      </div>
    </AbsoluteFill>
  );
};
