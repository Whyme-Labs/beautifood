// Feature demo: a title stub, then the test recording(s) with the points they show, then the sign-off.
import type React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Headline, Screen, Stub, useIn } from "./parts";

export type Segment = { clip: string; kind: "phone" | "desktop"; start: number; len: number; clip2?: string; start2?: number; note: string };
export type FeatureDemoProps = { n: string; stock: string; title: string; sub: string; points: string[]; segments: Segment[] };

const INTRO = 2.6;
const OUTRO = 2.4;

/** Frames a feature demo lasts, for its Composition registration. */
export const featureFrames = (segments: Segment[], fps = 30) => Math.round((INTRO + segments.reduce((s, x) => s + x.len, 0) + OUTRO) * fps);

export const FeatureDemo: React.FC<FeatureDemoProps> = ({ n, stock, title, sub, points, segments }) => {
  const { fps } = useVideoConfig();
  let at = INTRO;
  const body = segments.map((seg, i) => {
    const from = Math.round(at * fps);
    at += seg.len;
    return (
      <Sequence key={i} name={`Clip ${i + 1}`} from={from} durationInFrames={Math.round(seg.len * fps)}>
        <SegmentView seg={seg} n={n} stock={stock} title={title} points={points} />
      </Sequence>
    );
  });
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: SANS, color: C.ink }}>
      <Sequence name="Title" durationInFrames={Math.round(INTRO * fps)}>
        <TitleCard n={n} stock={stock} title={title} sub={sub} />
      </Sequence>
      {body}
      <Sequence name="Sign-off" from={Math.round(at * fps)}>
        <SignOff />
      </Sequence>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ n: string; stock: string; title: string; sub: string }> = ({ n, stock, title, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.sun, alignItems: "center", justifyContent: "center", gap: 40, flexDirection: "row", padding: 140 }}>
      <div style={{ ...useIn(0), rotate: `${interpolate(frame, [0, 0.8 * fps], [-8, -3], { extrapolateRight: "clamp", easing: Easing.bezier(0.23, 1, 0.32, 1) })}deg` }}>
        <Stub serial={n} label="Feature" stock={stock} width={360}>
          beautifood
        </Stub>
      </div>
      <div style={{ flex: 1 }}>
        <Headline size={96} style={useIn(0.2)}>
          {title}
        </Headline>
        <div style={{ fontSize: 44, fontWeight: 650, marginTop: 22, ...useIn(0.5) }}>{sub}</div>
      </div>
    </AbsoluteFill>
  );
};

const SegmentView: React.FC<{ seg: Segment; n: string; stock: string; title: string; points: string[] }> = ({ seg, n, stock, title, points }) => {
  const phone = seg.kind === "phone";
  const h = phone ? (seg.clip2 ? 860 : 900) : 760;
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", gap: 60, padding: "60px 80px" }}>
      <div style={{ width: phone ? 640 : 500, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 40, background: stock, borderRadius: 10, padding: "0 12px" }}>{n}</span>
          <span style={{ fontSize: 30, fontWeight: 800, color: C.ink2 }}>{title}</span>
        </div>
        <div style={{ fontSize: phone ? 54 : 46, fontWeight: 850, lineHeight: 1.1, letterSpacing: "-.01em", wordBreak: "keep-all", ...useIn(0) }}>{seg.note}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
          {points.map((p, i) => (
            <div key={p} style={{ display: "flex", gap: 14, alignItems: "baseline", fontSize: 30, fontWeight: 650, color: C.ink2, ...useIn(0.4 + i * 0.25) }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: C.ink, flex: "none", translate: "0 -4px" }} />
              {p}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 30 }}>
        <Screen src={seg.clip} kind={seg.kind} height={h} start={seg.start} />
        {seg.clip2 && <Screen src={seg.clip2} kind={seg.kind} height={h} start={seg.start2 ?? seg.start} />}
      </div>
    </AbsoluteFill>
  );
};

const SignOff: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper, alignItems: "center", justifyContent: "center", gap: 18 }}>
    <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 120, color: C.sun, ...useIn(0) }}>beautifood</div>
    <div style={{ fontSize: 38, fontWeight: 650, ...useIn(0.3) }}>Recorded by an end-to-end test. Every step asserted.</div>
    <div style={{ fontSize: 32, fontWeight: 700, color: C.sun, ...useIn(0.6) }}>beautifood-app.swmengappdev.workers.dev</div>
  </AbsoluteFill>
);
