// The demo's scenes. Each is a full-frame connected composition so it can be opened on its own in Studio.
import type React from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Headline, Kicker, Points, Screen, Stub, useIn } from "./parts";

const fill: React.CSSProperties = { fontFamily: SANS, color: C.ink };

const HookInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = Math.round(interpolate(frame, [0.4 * fps, 3 * fps], [0, 38], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ ...fill, background: C.sun, padding: "120px 140px", flexDirection: "row", alignItems: "center", gap: 120 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 40, fontWeight: 800, ...useIn(0) }}>Friday, 7:42pm · Penang hawker stall</div>
        <Headline size={120} style={{ marginTop: 26, ...useIn(0.3) }}>
          <span style={{ fontFamily: NUM, fontSize: 200 }}>{count}</span> people
          <br />
          waiting outside.
        </Headline>
      </div>
      <div style={{ ...useIn(0.8, 0.7), rotate: `${interpolate(frame, [0.8 * fps, 2 * fps], [-14, -5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.23, 1, 0.32, 1) })}deg` }}>
        <Stub serial="A012" label="Your number" stock={C.paper} width={500}>
          ~12 min · 4 ahead
        </Stub>
      </div>
    </AbsoluteFill>
  );
};
export const Hook = Interactive.create({ Component: HookInner, layout: "absolute-fill" });

const ProblemInner: React.FC = () => (
  <AbsoluteFill style={{ ...fill, background: C.ink, color: C.paper, padding: "140px 160px", justifyContent: "center" }}>
    <Headline size={96} style={{ color: C.sun, ...useIn(0) }}>
      Paper numbers. Shouted names.
      <br />
      Guests who give up and leave.
    </Headline>
    <div style={{ fontSize: 44, fontWeight: 600, marginTop: 50, maxWidth: 1400, lineHeight: 1.35, color: "#efe7d6", ...useIn(1.2) }}>
      Busy restaurants run the front of house on memory and a notebook, and every guest is asked to download one more app.
    </div>
  </AbsoluteFill>
);
export const Problem = Interactive.create({ Component: ProblemInner, layout: "absolute-fill" });

const TitleInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ ...fill, background: C.paper, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 34, scale: interpolate(frame, [0, 0.6 * fps], [0.9, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.23, 1, 0.32, 1) }), opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" }) }}>
        <svg viewBox="0 0 32 32" width={170} height={170}>
          <path d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z" fill={C.ink} />
          <path d="M11 9.5v13M11 9.5h5.5a3.25 3.25 0 0 1 0 6.5H11m0 0h6a3.25 3.25 0 0 1 0 6.5h-6" fill="none" stroke={C.sun} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 210, letterSpacing: ".01em" }}>beautifood</span>
      </div>
      <div style={{ fontSize: 52, fontWeight: 700, marginTop: 30, ...useIn(0.7) }}>Queue, order and book. No app to download.</div>
      <div style={{ fontSize: 40, fontWeight: 600, marginTop: 14, color: C.ink2, ...useIn(1.1) }}>排队、点餐、订位，扫码即用</div>
    </AbsoluteFill>
  );
};
export const Title = Interactive.create({ Component: TitleInner, layout: "absolute-fill" });

type FeatureProps = {
  n: string;
  kicker: string;
  title: string;
  points: string[];
  src: string;
  kind: "phone" | "desktop";
  start?: number;
  bg?: string;
  src2?: string;
  start2?: number;
};

const FeatureInner: React.FC<FeatureProps> = ({ n, kicker, title, points, src, kind, start = 0, bg = C.paper, src2, start2 = 0 }) => {
  const phone = kind === "phone";
  return (
    <AbsoluteFill style={{ ...fill, background: bg, padding: phone ? "90px 140px" : "80px 100px", flexDirection: "row", alignItems: "center", gap: phone ? 110 : 70 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Kicker n={n} style={useIn(0)}>
          {kicker}
        </Kicker>
        <Headline size={phone ? 78 : 64} style={{ marginTop: 26, ...useIn(0.2) }}>
          {title}
        </Headline>
        <Points items={points} at={0.7} size={phone ? 38 : 32} />
      </div>
      <div style={{ display: "flex", gap: 36, ...useIn(0.3, 0.7) }}>
        <Screen src={src} kind={kind} height={phone ? 860 : 700} start={start} />
        {src2 && <Screen src={src2} kind={kind} height={phone ? 860 : 700} start={start2} />}
      </div>
    </AbsoluteFill>
  );
};
export const Feature = Interactive.create({ Component: FeatureInner, layout: "absolute-fill" });

const LanguagesInner: React.FC = () => (
  <AbsoluteFill style={{ ...fill, background: C.sun, padding: "80px 120px", flexDirection: "row", alignItems: "center", gap: 90 }}>
    <div style={{ flex: 1 }}>
      <Kicker n="EN | 中" style={useIn(0)}>
        Every screen, every email
      </Kicker>
      <Headline size={76} style={{ marginTop: 26, ...useIn(0.2) }}>
        The menu speaks the guest's language.
      </Headline>
      <Points items={["One tap translates the whole menu (Claude, Workers AI or a hawker glossary)", "The owner fixes any dish; their edit always wins", "Guests see 炒粿条 with “Char Kway Teow” underneath"]} at={0.8} size={36} />
    </div>
    <div style={{ display: "flex", gap: 30, ...useIn(0.4, 0.7) }}>
      <Screen src="shots/en-menu.png" kind="phone" height={820} />
      <Screen src="shots/zh-menu.png" kind="phone" height={820} />
    </div>
  </AbsoluteFill>
);
export const Languages = Interactive.create({ Component: LanguagesInner, layout: "absolute-fill" });

const ProofInner: React.FC = () => {
  const stats: [string, string][] = [
    ["56", "end-to-end tests, every push"],
    ["300", "people joining at once: no duplicate or skipped numbers"],
    ["11", "persona videos recorded by the tests"],
    ["2", "languages, one file each to add more"],
  ];
  return (
    <AbsoluteFill style={{ ...fill, background: C.ink, color: C.paper, padding: "110px 140px" }}>
      <Headline size={80} style={{ color: C.sun, ...useIn(0) }}>
        Built to survive the dinner rush.
      </Headline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "50px 80px", marginTop: 60 }}>
        {stats.map(([big, small], i) => (
          <Stat key={big} big={big} small={small} at={0.5 + i * 0.35} />
        ))}
      </div>
      <div style={{ marginTop: 70, fontSize: 34, fontWeight: 650, color: "#efe7d6", ...useIn(2.2) }}>
        Cloudflare Workers + D1 · Rust/WASM core · Claude
      </div>
    </AbsoluteFill>
  );
};
const Stat: React.FC<{ big: string; small: string; at: number }> = ({ big, small, at }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10, ...useIn(at) }}>
    <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 130, color: C.sun, lineHeight: 1 }}>{big}</span>
    <span style={{ fontSize: 38, fontWeight: 650, lineHeight: 1.25, maxWidth: 700 }}>{small}</span>
  </div>
);
export const Proof = Interactive.create({ Component: ProofInner, layout: "absolute-fill" });

const CloseInner: React.FC = () => (
  <AbsoluteFill style={{ ...fill, background: C.sun, alignItems: "center", justifyContent: "center", gap: 40 }}>
    <div style={useIn(0)}>
      <Stub serial="A013" label="Next please" stock={C.paper} width={560}>
        Your table is ready
      </Stub>
    </div>
    <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 96, ...useIn(0.5) }}>beautifood</div>
    <div style={{ fontSize: 40, fontWeight: 700, ...useIn(0.8) }}>beautifood-app.swmengappdev.workers.dev</div>
  </AbsoluteFill>
);
export const Close = Interactive.create({ Component: CloseInner, layout: "absolute-fill" });
