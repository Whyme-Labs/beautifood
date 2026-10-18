// Promo cuts: fast, mostly type and real footage. Promo30 is 16:9, Teaser15 is 9:16 for social.
import type React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Screen, Stub, useIn } from "./parts";

const Slam: React.FC<{ children: React.ReactNode; size: number; color?: string; at?: number }> = ({ children, size, color = C.ink, at = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, (at + 0.35) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.23, 1, 0.32, 1) });
  return <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: "-.03em", color, opacity: p, scale: 0.92 + 0.08 * p, textAlign: "center" }}>{children}</div>;
};

type Shot = { clip: string; kind: "phone" | "desktop"; start: number; label: string; bg: string };

const ShotScene: React.FC<{ shot: Shot; vertical?: boolean }> = ({ shot, vertical }) => (
  <AbsoluteFill style={{ background: shot.bg, alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: vertical ? 50 : 80, padding: vertical ? "120px 60px" : 80 }}>
    <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: vertical ? 92 : 88, lineHeight: 1.02, letterSpacing: "-.02em", color: C.ink, maxWidth: vertical ? 960 : 640, textAlign: vertical ? "center" : "left", ...useIn(0, 0.35) }}>{shot.label}</div>
    <Screen src={shot.clip} kind={shot.kind} height={vertical ? (shot.kind === "phone" ? 1300 : 560) : shot.kind === "phone" ? 900 : 700} start={shot.start} rate={1.5} />
  </AbsoluteFill>
);

const EndCard: React.FC<{ vertical?: boolean }> = ({ vertical }) => (
  <AbsoluteFill style={{ background: C.sun, alignItems: "center", justifyContent: "center", gap: 34, fontFamily: SANS, color: C.ink }}>
    <div style={useIn(0)}>
      <Stub serial="A013" label="Next please" stock={C.paper} width={vertical ? 640 : 520}>
        Your table is ready
      </Stub>
    </div>
    <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: vertical ? 150 : 120, ...useIn(0.3) }}>beautifood</div>
    <div style={{ fontSize: vertical ? 44 : 40, fontWeight: 750, textAlign: "center", ...useIn(0.5) }}>Queue, order and book. No app.</div>
    <div style={{ fontSize: vertical ? 34 : 32, fontWeight: 700, ...useIn(0.7) }}>beautifood-app.swmengappdev.workers.dev</div>
  </AbsoluteFill>
);

const SHOTS: Shot[] = [
  { clip: "clips/01-guest-walk-in.mp4", kind: "phone", start: 10, label: "Scan. Get a number. Walk away.", bg: C.paper },
  { clip: "clips/02-diner-group-a.mp4", kind: "phone", start: 6, label: "One cart, every phone at the table.", bg: C.sunSoft },
  { clip: "clips/04-host.mp4", kind: "desktop", start: 2, label: "AI seats the right party at the right table.", bg: C.paper },
  { clip: "clips/05-kitchen.mp4", kind: "desktop", start: 2, label: "Orders fire straight to the kitchen.", bg: C.sunSoft },
  { clip: "clips/07-owner.mp4", kind: "desktop", start: 2, label: "Paste your menu. The shop sets itself up.", bg: C.paper },
];

export const Promo30: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sequence name="Hook" durationInFrames={3 * fps}>
        <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
          <Slam size={150} color={C.sun}>Still shouting</Slam>
          <Slam size={150} color={C.sun} at={0.4}>names at the door?</Slam>
        </AbsoluteFill>
      </Sequence>
      {SHOTS.map((s, i) => (
        <Sequence key={s.label} name={`Shot ${i + 1}`} from={Math.round((3 + i * 4) * fps)} durationInFrames={4 * fps}>
          <ShotScene shot={s} />
        </Sequence>
      ))}
      <Sequence name="Languages" from={23 * fps} durationInFrames={3 * fps}>
        <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 20 }}>
          <Slam size={170} color={C.sun}>English · 中文</Slam>
          <Slam size={56} color={C.paper} at={0.4}>Menus translated by AI. You have the final say.</Slam>
        </AbsoluteFill>
      </Sequence>
      <Sequence name="End" from={26 * fps}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Teaser15: React.FC = () => {
  const { fps } = useVideoConfig();
  const shots = [SHOTS[0], SHOTS[1], { ...SHOTS[2], label: "AI seats every party." }];
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sequence name="Hook" durationInFrames={2.5 * fps}>
        <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 24, padding: 60 }}>
          <Slam size={150} color={C.sun}>No more</Slam>
          <Slam size={150} color={C.sun} at={0.3}>shouting</Slam>
          <Slam size={150} color={C.sun} at={0.6}>names.</Slam>
        </AbsoluteFill>
      </Sequence>
      {shots.map((s, i) => (
        <Sequence key={s.label} name={`Shot ${i + 1}`} from={Math.round((2.5 + i * 3.3) * fps)} durationInFrames={Math.round(3.3 * fps)}>
          <ShotScene shot={s} vertical />
        </Sequence>
      ))}
      <Sequence name="End" from={Math.round(12.4 * fps)}>
        <EndCard vertical />
      </Sequence>
    </AbsoluteFill>
  );
};
