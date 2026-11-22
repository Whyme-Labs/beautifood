// The #BuildHybridAI cut: "Can I eat this?", a guest's allergy read by Gemini Nano on the device and by the
// cloud model when it can't, both through Firebase AI Logic. Real footage and screenshots from the live app
// (public/hybrid/): the owner's own on-device reading, the kiosk going offline, the blind tests.
import type React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Wordmark } from "./Mark";
import { C, NUM, SANS } from "./theme";
import { Headline, Screen, Stub, useIn } from "./parts";

const ease = Easing.bezier(0.23, 1, 0.32, 1);
const S = (s: number) => Math.round(s * 30);

/** Scenes in order, with their lengths in seconds. */
const SCENES: { name: string; len: number; el: React.ReactNode }[] = [];

export const hybridFrames = () => S(SCENES.reduce((n, s) => n + s.len, 0));

/** The same soundtrack as the other Beautifood videos (public/audio, git-ignored), faded in and out. */
const Music: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const v = interpolate(frame, [0, S(1), durationInFrames - S(3), durationInFrames - 1], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Audio src={staticFile("audio/bgm-demo.m4a")} volume={v} />;
};

export const Hybrid: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: SANS, color: C.ink }}>
      <Music />
      {SCENES.map((s) => {
        const from = S(at);
        at += s.len;
        return (
          <Sequence key={s.name} name={s.name} from={from} durationInFrames={S(s.len)}>
            {s.el}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** The caption column beside the footage: a kicker, the line, and its points. */
const Caption: React.FC<{ kicker: string; line: string; points: string[]; width?: number }> = ({ kicker, line, points, width = 560 }) => (
  <div style={{ width, display: "flex", flexDirection: "column", gap: 26 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, ...useIn(0) }}>
      <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 36, background: C.sun, borderRadius: 10, padding: "0 12px" }}>Can I eat this?</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: C.ink2 }}>{kicker}</span>
    </div>
    <div style={{ fontSize: 54, fontWeight: 850, lineHeight: 1.08, letterSpacing: "-.01em", ...useIn(0.15) }}>{line}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
      {points.map((p, i) => (
        <div key={p} style={{ display: "flex", gap: 14, alignItems: "baseline", fontSize: 31, fontWeight: 650, color: C.ink2, ...useIn(0.6 + i * 0.35) }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: C.ink, flex: "none", translate: "0 -4px" }} />
          {p}
        </div>
      ))}
    </div>
  </div>
);

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.sun, alignItems: "center", justifyContent: "center", gap: 70, flexDirection: "row", padding: 140 }}>
      <div style={{ ...useIn(0), rotate: `${interpolate(frame, [0, 0.8 * fps], [-8, -3], { extrapolateRight: "clamp", easing: ease })}deg` }}>
        <Stub serial="AI" label="#BuildHybridAI" stock={C.paper} width={360}>
          beautifood
        </Stub>
      </div>
      <div style={{ flex: 1 }}>
        <Headline size={110} style={useIn(0.2)}>
          Can I eat this?
        </Headline>
        <div style={{ fontSize: 46, fontWeight: 650, marginTop: 26, lineHeight: 1.25, ...useIn(0.5) }}>
          A guest's allergy, in their own words, read by Gemini Nano on the device, and by the cloud when it can't.
        </div>
        <div style={{ fontSize: 32, fontWeight: 750, marginTop: 26, color: C.ink2, ...useIn(0.9) }}>Firebase AI Logic · hybrid inference</div>
      </div>
    </AbsoluteFill>
  );
};

const WORDS = ["doctor says no ocean stuff for me", "saya tak boleh sentuh benda bersusu", "我老婆碰到带壳的海产就不行", "We're Hindu, no cow please"];
const Problem: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper, padding: "110px 150px", justifyContent: "center" }}>
    <div style={{ fontSize: 36, fontWeight: 750, color: C.sun, ...useIn(0) }}>At a Malaysian restaurant, guests say it like this:</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 40 }}>
      {WORDS.map((w, i) => (
        <div key={w} style={{ fontSize: 58, fontWeight: 800, letterSpacing: "-.01em", ...useIn(0.5 + i * 0.6) }}>
          “{w}”
        </div>
      ))}
    </div>
    <div style={{ fontSize: 44, fontWeight: 650, marginTop: 56, color: "#efe7d6", lineHeight: 1.3, ...useIn(3.4) }}>
      Menu rules miss about <b style={{ color: C.sun }}>1 in 4</b> of these, and then recommend the laksa.
    </div>
  </AbsoluteFill>
);

/** The owner's own screenshot: Gemini Nano's reading on their device, panned top to bottom. */
const Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = 960;
  const h = Math.round((w * 1204) / 1280);
  const view = 880;
  const y = interpolate(frame, [S(1.2), durationInFrames - S(1)], [0, -(h - view)], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", gap: 70, padding: "60px 90px" }}>
      <Caption kicker="On this device" line="Gemini Nano caught what the rules missed." points={["Read on the guest's own device: fish, crustaceans, molluscs", "3.8 seconds, through Firebase AI Logic", "The rules alone still offered the Curry Laksa"]} />
      <div style={{ width: w, height: view, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 80px rgba(26,24,20,.35)", background: "#141210", ...useIn(0.1) }}>
        <Img src={staticFile("hybrid/00-hero-on-device.png")} style={{ width: w, height: h, translate: `0 ${y}px` }} />
      </div>
    </AbsoluteFill>
  );
};

/** A full-frame still (the diagram, the evidence card), easing in with a slow push. */
const Still: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.04]);
  return (
    <AbsoluteFill style={{ background: "#fffdf6", ...useIn(0, 0.4) }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain", scale: String(scale) }} />
    </AbsoluteFill>
  );
};

const Footage: React.FC<{ src: string; start: number; rate?: number; kicker: string; line: string; points: string[] }> = ({ src, start, rate = 1, kicker, line, points }) => (
  <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", gap: 60, padding: "60px 80px" }}>
    <Caption kicker={kicker} line={line} points={points} width={540} />
    <div style={{ flex: 1, display: "flex", justifyContent: "center", ...useIn(0.1) }}>
      <Screen src={src} kind="desktop" height={720} start={start} rate={rate} />
    </div>
  </AbsoluteFill>
);

const Close: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper, alignItems: "center", justifyContent: "center", gap: 22 }}>
    <Wordmark size={120} color={C.sun} style={useIn(0)} />
    <div style={{ fontSize: 40, fontWeight: 700, ...useIn(0.3) }}>Can I eat this? · Firebase AI Logic · Gemini Nano · App Check</div>
    <div style={{ fontSize: 34, fontWeight: 700, color: C.sun, ...useIn(0.6) }}>app.beautifood.io/hybrid</div>
    <div style={{ fontSize: 28, fontWeight: 600, color: "#d2cbbb", ...useIn(0.9) }}>github.com/Whyme-Labs/beautifood · MIT</div>
  </AbsoluteFill>
);

SCENES.push(
  { name: "Title", len: 4, el: <Title /> },
  { name: "Problem", len: 7, el: <Problem /> },
  { name: "Hero", len: 10, el: <Hero /> },
  { name: "How it works", len: 8, el: <Still src="hybrid/01-how-it-works.png" /> },
  {
    name: "Kiosk offline",
    len: 17,
    el: <Footage src="hybrid/kiosk.mp4" start={1.5} rate={1.1} kicker="On the kiosk" line="Wi-Fi down? The kiosk still answers." points={["The menu and the reasoning live on the kiosk", "Gemini Nano needs no network", "The allergy never leaves the device"]} />,
  },
  {
    name: "Blind test",
    len: 9,
    el: <Footage src="hybrid/blind.mp4" start={2.5} kicker="Measured" line="386 guest messages, written blind." points={["Rules alone missed 26.3%", "With Gemini Nano on the device: 8.3%", "The model added no false alarm"]} />,
  },
  { name: "Evidence", len: 8, el: <Still src="hybrid/02-evidence.png" /> },
  { name: "Close", len: 5, el: <Close /> },
);
