// Show-don't-tell scenes for the reel. Each starts on a downbeat; motion lands on the beat.
import type React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { staticFile } from "remotion";
import { C, NUM, SANS } from "../theme";
import { useCopy } from "./copy";
import { BEAT, clamp, ease, useAt, useBeat, usePulse } from "./beat";

const STOCK = { A: C.sun, B: "#ff8fa8", C: "#7fddbf", D: "#bba8ff" } as const;

// ── small parts ────────────────────────────────────────────────────────────

const Person: React.FC<{ color?: string; size?: number; style?: React.CSSProperties }> = ({ color = C.ink, size = 46, style }) => (
  <div style={{ width: size, height: size * 1.55, position: "relative", ...style }}>
    <div style={{ position: "absolute", left: size * 0.28, top: 0, width: size * 0.44, height: size * 0.44, borderRadius: "50%", background: color }} />
    <div style={{ position: "absolute", left: 0, bottom: 0, width: size, height: size * 0.95, borderRadius: `${size * 0.5}px ${size * 0.5}px ${size * 0.14}px ${size * 0.14}px`, background: color }} />
  </div>
);

/** A ticket stub with notches; `tear` is the perforation height in %. */
export const Ticket: React.FC<{ serial: string; label?: string; foot?: string; stock?: string; width?: number; style?: React.CSSProperties }> = ({ serial, label, foot, stock = C.sun, width = 420, style }) => (
  <div
    style={{
      width,
      background: stock,
      color: C.ink,
      borderRadius: width * 0.06,
      padding: `${width * 0.07}px ${width * 0.08}px`,
      fontFamily: SANS,
      boxShadow: "0 30px 60px rgba(26,24,20,.28)",
      WebkitMaskImage: `radial-gradient(circle ${width * 0.045}px at 0 72%, transparent ${width * 0.044}px, #000 ${width * 0.046}px), radial-gradient(circle ${width * 0.045}px at 100% 72%, transparent ${width * 0.044}px, #000 ${width * 0.046}px)`,
      WebkitMaskComposite: "source-in",
      ...style,
    }}
  >
    {label && <div style={{ fontSize: width * 0.06, fontWeight: 750, opacity: 0.7 }}>{label}</div>}
    <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: width * 0.36, lineHeight: 1, margin: `${width * 0.02}px 0 ${width * 0.05}px` }}>{serial}</div>
    <div style={{ borderTop: `${Math.max(3, width * 0.008)}px dashed rgba(26,24,20,.35)`, margin: `0 -${width * 0.08}px`, paddingTop: width * 0.05 }} />
    {foot && <div style={{ fontSize: width * 0.065, fontWeight: 750 }}>{foot}</div>}
  </div>
);

/** A real recording in a device frame, with keyframed punch-in zooms (x, y = focus 0..1). */
export const Clip: React.FC<{
  src: string;
  kind: "phone" | "desktop";
  height: number;
  start?: number;
  rate?: number;
  zoom?: { t: number; s: number; x: number; y: number }[];
  style?: React.CSSProperties;
}> = ({ src, kind, height, start = 0, rate = 1, zoom = [], style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ratio = kind === "phone" ? 390 / 844 : 1366 / 860;
  const width = height * ratio;
  const keys = zoom.length ? zoom : [{ t: 0, s: 1, x: 0.5, y: 0.5 }];
  const ts = keys.map((k) => k.t * fps);
  const one = keys.length === 1;
  const s = one ? keys[0].s : interpolate(frame, ts, keys.map((k) => k.s), { ...clamp, easing: ease });
  const x = one ? keys[0].x : interpolate(frame, ts, keys.map((k) => k.x), { ...clamp, easing: ease });
  const y = one ? keys[0].y : interpolate(frame, ts, keys.map((k) => k.y), { ...clamp, easing: ease });
  const inner = (
    <div style={{ width, height, overflow: "hidden", background: "#fff", borderRadius: kind === "phone" ? 40 : 0 }}>
      <div style={{ width, height, scale: String(s), transformOrigin: `${x * 100}% ${y * 100}%` }}>
        <Video src={staticFile(src)} trimBefore={Math.round(start * fps)} playbackRate={rate} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
  if (kind === "phone") return <div style={{ padding: 13, background: C.ink, borderRadius: 54, boxShadow: "0 40px 80px rgba(26,24,20,.35)", ...style }}>{inner}</div>;
  return (
    <div style={{ background: C.ink, borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 80px rgba(26,24,20,.3)", ...style }}>
      <div style={{ height: 30, display: "flex", alignItems: "center", gap: 8, padding: "0 14px" }}>
        {["#ff6b5e", "#ffc53d", "#41c94f"].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
        ))}
      </div>
      {inner}
    </div>
  );
};

/** A short label that snaps in on a beat. */
export const Tag: React.FC<{ at: number; children: React.ReactNode; dark?: boolean; size?: number; style?: React.CSSProperties }> = ({ at, children, dark, size = 54, style }) => {
  const p = useAt(at, 0.5);
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "-.02em",
        lineHeight: 1,
        padding: `${size * 0.22}px ${size * 0.36}px`,
        borderRadius: size * 0.24,
        background: dark ? C.ink : C.sun,
        color: dark ? C.sun : C.ink,
        opacity: p,
        translate: `0 ${(1 - p) * 30}px`,
        scale: String(0.9 + 0.1 * p),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── 1. The crowd outside ──────────────────────────────────────────────────

export const CrowdScene: React.FC = () => {
  const { beat, phase, fps, frame } = useBeat();
  const shown = Math.min(38, Math.floor((beat + phase) * 4.6));
  const people = Array.from({ length: 38 }, (_, i) => i);
  const copy = useCopy();
  const shouts = copy.crowd.shouts;
  const pulse = usePulse(0.4);
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: SANS }}>
      {/* the stall */}
      <div style={{ position: "absolute", left: 120, right: 120, top: 70, height: 120, display: "flex", borderRadius: "0 0 30px 30px", overflow: "hidden" }}>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? C.paper : C.sun }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 215, left: 0, right: 0, textAlign: "center", color: C.sun, fontFamily: NUM, fontWeight: 800, fontSize: 64, letterSpacing: ".04em" }}>
        {copy.crowd.sign}
      </div>
      {/* the queue grows */}
      <div style={{ position: "absolute", left: 150, right: 150, bottom: 110, display: "flex", flexWrap: "wrap-reverse", gap: "22px 30px", justifyContent: "center" }}>
        {people.map((i) => {
          const on = i < shown;
          const r = random(`p${i}`);
          return <Person key={i} size={50} color={r > 0.82 ? STOCK.B : r > 0.66 ? STOCK.C : "#e9e2d0"} style={{ opacity: on ? 1 : 0, scale: on ? "1" : "0.6", translate: `0 ${on ? 0 : 20}px` }} />;
        })}
      </div>
      {/* shouting */}
      {shouts.map((s, i) => {
        const at = 1 + i * 1.5;
        const p = interpolate(frame, [at * BEAT * fps, (at + 0.4) * BEAT * fps, (at + 1.6) * BEAT * fps, (at + 2) * BEAT * fps], [0, 1, 1, 0], clamp);
        return (
          <div key={s} style={{ position: "absolute", left: `${12 + ((i * 37) % 70)}%`, top: `${36 + ((i * 23) % 26)}%`, background: C.paper, color: C.ink, fontWeight: 900, fontSize: 52, padding: "14px 26px", borderRadius: 26, opacity: p, scale: String(0.85 + 0.15 * p), rotate: `${(i % 2 ? 4 : -5)}deg` }}>
            {s}
          </div>
        );
      })}
      <div style={{ position: "absolute", right: 150, top: 300, textAlign: "right", color: C.sun }}>
        <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 220, lineHeight: 0.9, scale: String(1 + pulse * 0.06) }}>{shown}</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: C.paper }}>{copy.crowd.waiting}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── 2. Paper numbers, walk-aways ───────────────────────────────────────────

export const PaperScene: React.FC = () => {
  const { t, fps, frame, beat } = useBeat();
  const copy = useCopy();
  const slips = Array.from({ length: 22 }, (_, i) => i);
  const gone = Math.min(9, Math.max(0, beat - 2));
  return (
    <AbsoluteFill style={{ background: "#2a2620", fontFamily: SANS, overflow: "hidden" }}>
      {slips.map((i) => {
        const r = random(`s${i}`);
        const delay = r * 1.5;
        const y = interpolate(t, [delay, delay + 2.4], [-260, 1180], clamp);
        const x = 80 + ((i * 89) % 1760);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 150, padding: "12px 16px", background: "#f4ecd8", color: "#3b3328", fontFamily: "'Comic Sans MS', 'Marker Felt', cursive", fontSize: 54, fontWeight: 700, rotate: `${interpolate(t, [0, 3], [r * 60 - 30, r * 220 - 110])}deg`, boxShadow: "0 10px 20px rgba(0,0,0,.3)" }}>
            {30 + ((i * 7) % 40)}
          </div>
        );
      })}
      {/* guests giving up */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 140, display: "flex", justifyContent: "center", gap: 36 }}>
        {Array.from({ length: 9 }, (_, i) => {
          const leaving = i < gone;
          const at = (i + 2) * BEAT * fps;
          const p = interpolate(frame, [at, at + BEAT * fps * 1.5], [0, 1], { ...clamp, easing: ease });
          return <Person key={i} size={70} color={C.paper} style={{ opacity: leaving ? 1 - p : 1, translate: `${leaving ? p * 900 : 0}px 0` }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 140, top: 140, color: C.sun, fontFamily: NUM, fontWeight: 800, fontSize: 170, lineHeight: 1 }}>−{gone}</div>
      <div style={{ position: "absolute", left: 146, top: 320, color: C.paper, fontSize: 44, fontWeight: 800 }}>{copy.paper.walkedAway}</div>
    </AbsoluteFill>
  );
};

// ── 3. Scan → a ticket prints → your place counts down ─────────────────────

export const ScanScene: React.FC = () => {
  const { t, beat } = useBeat();
  const sweep = interpolate(t, [0.3, 1.6], [0, 1], { ...clamp, easing: ease });
  const print = useAt(4, 1.2);
  const ahead = Math.max(0, 4 - Math.max(0, beat - 7));
  const eta = Math.max(0, 12 - Math.max(0, beat - 7) * 3);
  const called = beat >= 12;
  const shake = called ? Math.sin(t * 60) * 6 * Math.max(0, 1 - (beat + 0) / 16) : 0;
  return (
    <AbsoluteFill style={{ background: C.sunSoft, fontFamily: SANS, alignItems: "center", justifyContent: "center" }}>
      {/* phone */}
      <div style={{ position: "relative", width: 430, height: 860, borderRadius: 60, background: C.ink, padding: 16, translate: `${shake}px 0` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 46, background: called ? C.sun : "#fff", overflow: "hidden", position: "relative" }}>
          {/* QR frame */}
          <div style={{ position: "absolute", left: 70, top: 120, width: 258, height: 258, opacity: 1 - print }}>
            {Array.from({ length: 49 }, (_, i) => (
              <div key={i} style={{ position: "absolute", left: (i % 7) * 37, top: Math.floor(i / 7) * 37, width: 33, height: 33, background: random(`q${i}`) > 0.45 || [0, 6, 42].includes(i) ? C.ink : "transparent" }} />
            ))}
            <div style={{ position: "absolute", left: -10, right: -10, top: sweep * 258, height: 6, background: C.sun, boxShadow: `0 0 24px ${C.sun}` }} />
          </div>
          {/* ticket */}
          <div style={{ position: "absolute", left: 34, top: interpolate(print, [0, 1], [860, 80]) }}>
            <Ticket serial="A012" label="Your number" foot={called ? "Your table is ready" : `${ahead} ahead · ~${eta} min`} width={330} />
          </div>
          {/* punches */}
          <div style={{ position: "absolute", left: 50, top: 560, display: "flex", gap: 16, opacity: print }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: 20, border: `5px solid ${C.ink}`, background: i < 4 - ahead || i === 4 ? C.ink : "transparent" }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 150, top: 430 }}>
        <Tag at={0}>Scan</Tag>
      </div>
      <div style={{ position: "absolute", right: 150, top: 300 }}>
        <Tag at={4}>Get a number</Tag>
      </div>
      <div style={{ position: "absolute", right: 150, top: 560 }}>
        <Tag at={8} dark>
          Walk away
        </Tag>
      </div>
      <div style={{ position: "absolute", left: 150, top: 640 }}>
        <Tag at={12}>Buzz. Table ready.</Tag>
      </div>
    </AbsoluteFill>
  );
};

// ── 4. The drop: logo ─────────────────────────────────────────────────────

export const DropScene: React.FC = () => {
  const { t } = useBeat();
  const [queue, order, book, noApp] = useCopy().drop;
  const flash = interpolate(t, [0, 0.25], [1, 0], clamp);
  const s = interpolate(t, [0, 0.35], [1.25, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: C.sun, alignItems: "center", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, scale: String(s) }}>
        <svg viewBox="0 0 32 32" width={190} height={190}>
          <path d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z" fill={C.ink} />
          <path d="M11 9.5v13M11 9.5h5.5a3.25 3.25 0 0 1 0 6.5H11m0 0h6a3.25 3.25 0 0 1 0 6.5h-6" fill="none" stroke={C.sun} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 240, color: C.ink }}>beautifood</span>
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 34 }}>
        <Tag at={1} dark>{queue}</Tag>
        <Tag at={1.5} dark>{order}</Tag>
        <Tag at={2} dark>{book}</Tag>
        <Tag at={3} style={{ background: C.paper }}>{noApp}</Tag>
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ── 5. Shared cart: dishes fly from every phone into one cart ──────────────

export const CartScene: React.FC = () => {
  const { t, fps, frame } = useBeat();
  const dishes = [
    { name: "Char Kway Teow", from: -1, at: 0.5 },
    { name: "炒粿条", from: 1, at: 1.5 },
    { name: "Teh Tarik ×2", from: -1, at: 2.5 },
    { name: "煎蕊", from: 1, at: 3.5 },
    { name: "Satay (6)", from: -1, at: 4.5 },
  ];
  const landed = dishes.filter((d) => t > (d.at + 1) * BEAT).length;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: SANS, alignItems: "center", justifyContent: "center" }}>
      {[-1, 1].map((side) => (
        <div key={side} style={{ position: "absolute", left: side < 0 ? 170 : undefined, right: side > 0 ? 170 : undefined, top: 200, rotate: `${side * 6}deg` }}>
          <div style={{ width: 300, height: 600, borderRadius: 46, background: C.ink, padding: 12 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 36, background: side < 0 ? "#fff" : C.sunSoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <Person size={70} color={side < 0 ? STOCK.B : STOCK.C} />
              <div style={{ fontWeight: 900, fontSize: 40 }}>{side < 0 ? "Ann" : "美美"}</div>
              <div style={{ fontWeight: 700, fontSize: 26, color: C.ink2 }}>{side < 0 ? "English" : "中文"}</div>
            </div>
          </div>
        </div>
      ))}
      {/* the cart */}
      <div style={{ width: 560, minHeight: 420, background: "#fff", borderRadius: 30, border: `4px solid ${C.ink}`, padding: 30, boxShadow: "0 30px 60px rgba(26,24,20,.2)" }}>
        <div style={{ fontWeight: 900, fontSize: 40, marginBottom: 18 }}>Table T4 · one cart</div>
        {dishes.slice(0, landed).map((d) => (
          <div key={d.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 750, padding: "10px 0", borderBottom: "2px dashed #e4e1d8" }}>
            <span>{d.name}</span>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: d.from < 0 ? STOCK.B : STOCK.C, alignSelf: "center" }} />
          </div>
        ))}
      </div>
      {dishes.map((d) => {
        const p = interpolate(frame, [d.at * BEAT * fps, (d.at + 1) * BEAT * fps], [0, 1], { ...clamp, easing: ease });
        if (p <= 0 || p >= 1) return null;
        const x0 = d.from < 0 ? -560 : 560;
        return (
          <div key={d.name} style={{ position: "absolute", left: "50%", top: "50%", translate: `${x0 * (1 - p) - 130}px ${-260 * Math.sin(p * Math.PI) + 40}px`, background: C.sun, fontWeight: 900, fontSize: 34, padding: "12px 22px", borderRadius: 18, boxShadow: "0 12px 24px rgba(26,24,20,.25)" }}>
            {d.name}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── 6. Assistant: the allergy question ─────────────────────────────────────

export const AskScene: React.FC = () => {
  const q = useAt(0, 0.6);
  const a = useAt(2, 0.6);
  const strike = useAt(4, 0.8);
  const shield = useAt(5, 0.6);
  const dishes = [
    { n: "Satay (6 sticks)", bad: true },
    { n: "Char Kway Teow", bad: false },
    { n: "Nasi Lemak", bad: true },
    { n: "Garden Salad", bad: false },
  ];
  return (
    <AbsoluteFill style={{ background: C.sun, fontFamily: SANS, padding: "120px 200px", gap: 28 }}>
      <div style={{ alignSelf: "flex-end", background: C.ink, color: C.paper, fontSize: 58, fontWeight: 800, padding: "26px 40px", borderRadius: "40px 40px 8px 40px", opacity: q, translate: `${(1 - q) * 60}px 0` }}>I'm allergic to peanuts.</div>
      <div style={{ alignSelf: "flex-start", background: "#fff", fontSize: 44, fontWeight: 750, padding: "28px 40px", borderRadius: "40px 40px 40px 8px", opacity: a, translate: `${(a - 1) * 60}px 0`, display: "flex", flexDirection: "column", gap: 14, minWidth: 820 }}>
        {dishes.map((d) => (
          <div key={d.n} style={{ display: "flex", alignItems: "center", gap: 18, opacity: d.bad ? 1 - strike * 0.65 : 1 }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: d.bad ? "#b8232b" : "#12753a" }} />
            <span style={{ textDecoration: d.bad && strike > 0.5 ? "line-through" : "none" }}>{d.n}</span>
          </div>
        ))}
      </div>
      <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 20, opacity: shield, scale: String(0.9 + 0.1 * shield), background: C.ink, color: C.sun, fontSize: 40, fontWeight: 800, padding: "18px 30px", borderRadius: 22 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={C.sun} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        Confirm with staff
      </div>
    </AbsoluteFill>
  );
};

// ── 7. Host stand: parties slide to tables, tables merge and split ─────────

export const FloorScene: React.FC = () => {
  const { t } = useBeat();
  const merge = useAt(4, 1);
  const split = useAt(8, 1);
  const seat = (b: number) => interpolate(t, [b * BEAT, (b + 1) * BEAT], [0, 1], { ...clamp, easing: ease });
  const tables = [
    { id: "T1", x: 300, y: 330, w: 170, h: 170 },
    { id: "T2", x: 560, y: 330, w: 170, h: 170 },
    { id: "P1", x: 900, y: 330 + merge * 0, w: 170, h: 170 },
    { id: "P2", x: 1080 - merge * 10, y: 330, w: 170, h: 170 },
  ];
  const parties = [
    { n: "A001", stock: STOCK.A, to: { x: 300, y: 330 }, at: 1 },
    { n: "B001", stock: STOCK.B, to: { x: 560, y: 330 }, at: 2 },
    { n: "D001", stock: STOCK.D, to: { x: 990, y: 330 }, at: 6 },
  ];
  return (
    <AbsoluteFill style={{ background: "#fff", fontFamily: SANS }}>
      {/* queue lane */}
      <div style={{ position: "absolute", left: 120, top: 760, right: 120, height: 4, background: "#e4e1d8" }} />
      {tables.map((tb) => (
        <div key={tb.id} style={{ position: "absolute", left: tb.x + (tb.id === "P1" ? merge * 10 : 0), top: tb.y, width: tb.w, height: tb.h, borderRadius: 22, border: `4px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: NUM, fontWeight: 800, fontSize: 56 }}>
          {tb.id}
        </div>
      ))}
      {/* merged outline */}
      <div style={{ position: "absolute", left: 890, top: 318, width: 372, height: 194, borderRadius: 28, border: `6px dashed ${C.ink}`, opacity: merge }} />
      {/* round table splitting */}
      <div style={{ position: "absolute", left: 1450, top: 300, width: 240, height: 240 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 240, height: 240, borderRadius: "120px 0 0 120px", clipPath: "inset(0 50% 0 0)", background: split > 0.5 ? STOCK.C : "#fff", border: `4px solid ${C.ink}`, translate: `${-split * 30}px 0` }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 240, height: 240, borderRadius: "0 120px 120px 0", clipPath: "inset(0 0 0 50%)", border: `4px solid ${C.ink}`, translate: `${split * 30}px 0` }} />
        <div style={{ position: "absolute", top: 260, width: 240, textAlign: "center", fontFamily: NUM, fontWeight: 800, fontSize: 48 }}>{split > 0.5 ? "T9a · T9b" : "T9"}</div>
      </div>
      {parties.map((p) => {
        const s = seat(p.at);
        const x0 = 180 + parties.indexOf(p) * 190;
        return (
          <div key={p.n} style={{ position: "absolute", left: x0 + (p.to.x - x0 + 10) * s, top: 720 + (p.to.y - 720 + 20) * s, translate: "0 -50%" }}>
            <Ticket serial={p.n} stock={p.stock} width={150} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", gap: 20 }}>
        <Tag at={1} dark>Seat</Tag>
        <Tag at={4} dark>Merge</Tag>
        <Tag at={8} dark>Split</Tag>
      </div>
    </AbsoluteFill>
  );
};

// ── 8. Kitchen: tickets drop into stations and get bumped ─────────────────

export const KitchenScene: React.FC = () => {
  const { t, beat } = useBeat();
  const cols = [
    { name: "Kitchen", items: ["Char Kway Teow", "Nasi Lemak", "Satay"] },
    { name: "Bar", items: ["Teh Tarik ×2", "Kopi O"] },
    { name: "Dessert", items: ["Cendol", "Ais Kacang"] },
  ];
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: SANS, flexDirection: "row", gap: 40, padding: "120px 140px" }}>
      {cols.map((c, ci) => (
        <div key={c.name} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: C.sun, fontFamily: NUM, fontWeight: 800, fontSize: 64 }}>{c.name}</div>
          {c.items.map((it, ii) => {
            const at = ci * 0.5 + ii * 1;
            const drop = interpolate(t, [at * BEAT, (at + 0.6) * BEAT], [0, 1], { ...clamp, easing: ease });
            const done = beat >= 5 + ci + ii;
            return (
              <div key={it} style={{ background: done ? "#12753a" : C.paper, color: done ? "#fff" : C.ink, borderRadius: 18, padding: "22px 26px", fontSize: 40, fontWeight: 800, display: "flex", justifyContent: "space-between", opacity: drop, translate: `0 ${(1 - drop) * -80}px` }}>
                <span>{it}</span>
                <span>{done ? "Ready" : "Cooking"}</span>
              </div>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ── 9. Till: the receipt prints, change counted ───────────────────────────

export const TillScene: React.FC = () => {
  const { t } = useBeat();
  const roll = interpolate(t, [0, 3 * BEAT], [0, 1], { ...clamp, easing: ease });
  const change = interpolate(t, [3 * BEAT, 5 * BEAT], [0, 12.3], clamp);
  const lines = [
    ["Char Kway Teow", "16.90"],
    ["Teh Tarik ×2", "11.00"],
    ["Cendol", "8.50"],
    ["Service 10%", "3.64"],
    ["WELCOME10", "−4.00"],
  ];
  return (
    <AbsoluteFill style={{ background: C.sunSoft, fontFamily: SANS, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120 }}>
      <div style={{ width: 560, height: 820, overflow: "hidden", display: "flex", alignItems: "flex-start" }}>
        <div style={{ width: 560, background: "#fff", padding: 40, translate: `0 ${(roll - 1) * 820}px`, boxShadow: "0 30px 60px rgba(26,24,20,.2)" }}>
          <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 64 }}>Receipt #0042</div>
          {lines.map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 650, padding: "12px 0", borderBottom: "2px dashed #e4e1d8" }}>
              <span>{a}</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 46, fontWeight: 900, paddingTop: 18 }}>
            <span>Total</span>
            <span>RM36.04</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {["Points", "Card", "Cash"].map((m) => (
              <span key={m} style={{ background: C.ink, color: C.sun, fontWeight: 800, fontSize: 28, padding: "8px 16px", borderRadius: 12 }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 52, fontWeight: 900 }}>Change</div>
        <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 230, lineHeight: 1 }}>{change.toFixed(2)}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── 10. Owner: a pasted menu becomes a structured menu ─────────────────────

export const SetupScene: React.FC = () => {
  const { t } = useBeat();
  const raw = "Char Kway Teow 16.90 *\nwok-fried flat noodles, prawn, egg\nNasi Lemak 18.90 *\ncoconut rice, sambal, peanuts\nCendol 8.50\nshaved ice, coconut milk";
  const typed = raw.slice(0, Math.floor(interpolate(t, [0, 3 * BEAT], [0, raw.length], clamp)));
  const cards = [
    { n: "Char Kway Teow", p: "RM16.90", tags: ["Signature", "Crustaceans", "Egg"], at: 4 },
    { n: "Nasi Lemak", p: "RM18.90", tags: ["Signature", "Peanuts", "Fish"], at: 5 },
    { n: "Cendol", p: "RM8.50", tags: ["Milk", "Vegetarian"], at: 6 },
  ];
  return (
    <AbsoluteFill style={{ background: "#fff", fontFamily: SANS, flexDirection: "row", gap: 70, padding: "130px 120px", alignItems: "flex-start" }}>
      <pre style={{ flex: 1, margin: 0, background: "#f6f4ee", border: "3px solid #e4e1d8", borderRadius: 24, padding: 36, fontSize: 34, lineHeight: 1.5, fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap", minHeight: 520 }}>
        {typed}
        <span style={{ opacity: Math.floor(t * 4) % 2 ? 1 : 0 }}>▍</span>
      </pre>
      <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 22 }}>
        {cards.map((c) => (
          <Card key={c.n} {...c} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ n: string; p: string; tags: string[]; at: number }> = ({ n, p, tags, at }) => {
  const s = useAt(at, 0.6);
  return (
    <div style={{ background: C.paper, border: `3px solid ${C.ink}`, borderRadius: 22, padding: "22px 28px", opacity: s, translate: `${(1 - s) * 80}px 0` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 42, fontWeight: 900 }}>
        <span>{n}</span>
        <span style={{ fontFamily: NUM }}>{p}</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {tags.map((tg) => (
          <span key={tg} style={{ background: tg === "Signature" ? C.sun : tg === "Vegetarian" ? "#dcf4e4" : "#fdefd0", fontSize: 26, fontWeight: 800, padding: "6px 14px", borderRadius: 10 }}>
            {tg}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── 11. Dashboard bars across branches ────────────────────────────────────

export const BossScene: React.FC = () => {
  const { t } = useBeat();
  const days = [42, 55, 48, 61, 70, 88, 96];
  const branches = [
    { n: "KLCC", c: C.sun, k: 1 },
    { n: "Bangsar", c: "#ff8fa8", k: 0.72 },
  ];
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: SANS, padding: "120px 160px", color: C.paper }}>
      <div style={{ display: "flex", gap: 30, marginBottom: 50 }}>
        {branches.map((b) => (
          <div key={b.n} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 800 }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: b.c }} />
            {b.n}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 40, height: 600 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", gap: 10, alignItems: "flex-end", height: "100%" }}>
            {branches.map((b) => {
              const g = interpolate(t, [(i * 0.5) * BEAT, (i * 0.5 + 1) * BEAT], [0, 1], { ...clamp, easing: ease });
              return <div key={b.n} style={{ flex: 1, height: `${d * b.k * g}%`, background: b.c, borderRadius: "10px 10px 0 0" }} />;
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 12. Languages: names flip between English and 中文 ─────────────────────

export const LangScene: React.FC = () => {
  const { beat, phase } = useBeat();
  const pairs = [
    ["Char Kway Teow", "炒粿条"],
    ["Your number", "你的号码"],
    ["Table ready", "桌位已准备好"],
    ["Teh Tarik", "拉茶"],
  ];
  const zh = beat % 2 === 1;
  const flip = Math.min(1, phase * 3);
  return (
    <AbsoluteFill style={{ background: C.sun, fontFamily: SANS, alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div style={{ display: "flex", gap: 0, borderRadius: 20, overflow: "hidden", border: `5px solid ${C.ink}`, fontWeight: 900, fontSize: 60 }}>
        <span style={{ padding: "10px 34px", background: zh ? "transparent" : C.ink, color: zh ? C.ink : C.sun }}>EN</span>
        <span style={{ padding: "10px 34px", background: zh ? C.ink : "transparent", color: zh ? C.sun : C.ink }}>中</span>
      </div>
      {pairs.map(([en, cn], i) => (
        <div key={en} style={{ fontSize: 110, fontWeight: 900, letterSpacing: "-.02em", lineHeight: 1.05, rotate: `${(1 - flip) * (i % 2 ? 1 : -1) * 4}deg`, opacity: 0.5 + 0.5 * flip, scale: String(0.94 + 0.06 * flip) }}>
          {zh ? cn : en}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ── 13. AI agents: MCP calls stream in ────────────────────────────────────

export const AgentScene: React.FC = () => {
  const { t } = useBeat();
  const lines = useCopy().agent;
  return (
    <AbsoluteFill style={{ background: "#14120e", fontFamily: "ui-monospace, Menlo, monospace", padding: "140px 180px", gap: 26 }}>
      {lines.map(([dir, a, b], i) => {
        const p = interpolate(t, [i * BEAT * 0.75, (i * 0.75 + 0.4) * BEAT], [0, 1], { ...clamp, easing: ease });
        const out = dir === "→";
        return (
          <div key={i} style={{ display: "flex", gap: 26, alignItems: "baseline", fontSize: 46, opacity: p, translate: `${(1 - p) * 40}px 0` }}>
            <span style={{ color: out ? C.sun : "#7fddbf", fontWeight: 800 }}>{dir}</span>
            <span style={{ color: out ? C.sun : "#fff", fontWeight: 800 }}>{a}</span>
            <span style={{ color: "#b3aa98" }}>{b}</span>
          </div>
        );
      })}
      <div style={{ marginTop: 30, fontFamily: SANS }}>
        <Tag at={5}>POST /mcp</Tag>
      </div>
    </AbsoluteFill>
  );
};

// ── 14. Proof: 300 joins, every number once ───────────────────────────────

export const WallScene: React.FC = () => {
  const { t } = useBeat();
  const copy = useCopy();
  const filled = Math.floor(interpolate(t, [0.2, 4 * BEAT], [0, 300], clamp));
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: SANS, padding: "70px 90px", color: C.paper }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 30, marginBottom: 26 }}>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 150, color: C.sun, lineHeight: 1 }}>{filled}</span>
        <span style={{ fontSize: 46, fontWeight: 800 }}>{copy.wall.join}</span>
        <span style={{ marginLeft: "auto", fontSize: 46, fontWeight: 900, color: filled === 300 ? C.sun : "#6f675b" }}>{copy.wall.clean}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(25, 1fr)", gap: 6 }}>
        {Array.from({ length: 300 }, (_, i) => (
          <div key={i} style={{ height: 52, borderRadius: 6, background: i < filled ? (i % 4 === 0 ? C.sun : i % 4 === 1 ? "#ff8fa8" : i % 4 === 2 ? "#7fddbf" : "#bba8ff") : "#2a2620", color: C.ink, fontFamily: NUM, fontWeight: 800, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {i < filled ? String(i + 1).padStart(3, "0") : ""}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** All the persona recordings playing at once: the tests filmed every feature. */
export const MontageScene: React.FC<{ clips: { src: string; kind: "phone" | "desktop" }[] }> = ({ clips }) => {
  const { frame, fps } = useBeat();
  return (
    <AbsoluteFill style={{ background: C.ink, padding: 40, fontFamily: SANS }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, height: "100%" }}>
        {clips.map((c, i) => {
          const p = interpolate(frame, [i * 2, i * 2 + 8], [0, 1], clamp);
          return (
            <div key={c.src + i} style={{ borderRadius: 14, overflow: "hidden", background: "#fff", opacity: p, scale: String(0.9 + 0.1 * p) }}>
              <Video src={staticFile(c.src)} muted objectFit="cover" trimBefore={Math.round(4 * fps)} style={{ width: "100%", height: "100%" }} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: C.sun, color: C.ink, padding: "26px 48px", borderRadius: 26, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
          <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 130, lineHeight: 1 }}>56 + 11</div>
          <div style={{ fontSize: 40, fontWeight: 850 }}>end-to-end tests · persona walkthroughs filmed by them</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 15. Close ─────────────────────────────────────────────────────────────

export const CloseScene: React.FC = () => {
  const { t } = useBeat();
  const copy = useCopy();
  const tear = useAt(0, 0.8);
  return (
    <AbsoluteFill style={{ background: C.sun, fontFamily: SANS, alignItems: "center", justifyContent: "center", gap: 36 }}>
      <div style={{ rotate: `${interpolate(t, [0, 1], [-10, -4], { ...clamp, easing: ease })}deg`, opacity: tear, scale: String(0.9 + 0.1 * tear) }}>
        <Ticket serial="A013" label={copy.ticket.next} foot={copy.ticket.ready} stock={C.paper} width={560} />
      </div>
      <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 150, lineHeight: 1 }}>beautifood</div>
      <Tag at={2} dark size={44}>
        {copy.url}
      </Tag>
    </AbsoluteFill>
  );
};
