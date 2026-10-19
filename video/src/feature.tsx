// Feature demo: a title stub, then real recordings of the app with the points they show, then the sign-off.
import type React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Headline, Screen, Stub, useIn } from "./parts";
import { Device, take, type TakeId, takeLen } from "./reel/takes";
import { LangProvider, useCopy, useLang, type Lang } from "./reel/copy";

/** A take from the real recordings (one phone, two phones side by side, or a desktop), or an older clip. */
export type Segment = { take: TakeId; take2?: TakeId; rate?: number; note: string } | { clip: string; kind: "phone" | "desktop"; start: number; len: number; note: string };
export type FeatureDemoProps = { lang: Lang; n: string; stock: string; title: string; sub: string; points: string[]; segments: Segment[] };

const INTRO = 2.6;
const OUTRO = 2.4;

/** Frames a feature demo lasts, for its Composition registration. */
export const featureFrames = (segments: Segment[], lang: Lang, fps = 30) => Math.round((INTRO + segments.reduce((s, x) => s + segLen(x, lang), 0) + OUTRO) * fps);

/** A take plays until its recording (the shorter one, for a pair) runs out. */
const segLen = (seg: Segment, lang: Lang) => ("take" in seg ? Math.min(takeLen(seg.take, lang, seg.rate), seg.take2 ? takeLen(seg.take2, lang, seg.rate) : Infinity) : seg.len);

export const FeatureDemo: React.FC<FeatureDemoProps> = ({ lang, n, stock, title, sub, points, segments }) => {
  const { fps } = useVideoConfig();
  let at = INTRO;
  const body = segments.map((seg, i) => {
    const from = Math.round(at * fps);
    at += segLen(seg, lang);
    return (
      <Sequence key={i} name={`Clip ${i + 1}`} from={from} durationInFrames={Math.round(segLen(seg, lang) * fps)}>
        <SegmentView seg={seg} n={n} stock={stock} title={title} points={points} />
      </Sequence>
    );
  });
  return (
    <LangProvider value={lang}>
      <AbsoluteFill style={{ background: C.paper, fontFamily: SANS, color: C.ink }}>
        <Sequence name="Title" durationInFrames={Math.round(INTRO * fps)}>
          <TitleCard n={n} stock={stock} title={title} sub={sub} />
        </Sequence>
        {body}
        <Sequence name="Sign-off" from={Math.round(at * fps)}>
          <SignOff />
        </Sequence>
      </AbsoluteFill>
    </LangProvider>
  );
};

const TitleCard: React.FC<{ n: string; stock: string; title: string; sub: string }> = ({ n, stock, title, sub }) => {
  const frame = useCurrentFrame();
  const label = useCopy().feature.label;
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.sun, alignItems: "center", justifyContent: "center", gap: 40, flexDirection: "row", padding: 140 }}>
      <div style={{ ...useIn(0), rotate: `${interpolate(frame, [0, 0.8 * fps], [-8, -3], { extrapolateRight: "clamp", easing: Easing.bezier(0.23, 1, 0.32, 1) })}deg` }}>
        <Stub serial={n} label={label} stock={stock} width={360}>
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
  const lang = useLang();
  const phone = "take" in seg ? take(seg.take, lang).kind === "phone" : seg.kind === "phone";
  const media =
    "take" in seg ? (
      seg.take2 ? (
        <>
          <Device id={seg.take} w={540} h={940} rate={seg.rate} tilt={-2} />
          <Device id={seg.take2} w={540} h={940} rate={seg.rate} tilt={2} />
        </>
      ) : (
        <Device id={seg.take} w={780} h={960} rate={seg.rate} />
      )
    ) : (
      <Screen src={seg.clip} kind={seg.kind} height={phone ? 900 : 760} start={seg.start} />
    );
  const pair = "take" in seg && Boolean(seg.take2);
  if ("take" in seg && !phone)
    // Desktop screens need the width to stay legible: caption on top, the screen nearly full-bleed.
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, padding: "40px 80px" }}>
        <div style={{ width: 1760, display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 40, background: stock, borderRadius: 10, padding: "0 12px" }}>{n}</span>
          <span style={{ fontSize: 30, fontWeight: 800, color: C.ink2 }}>{title}</span>
          <span style={{ fontSize: 46, fontWeight: 850, letterSpacing: "-.01em", marginLeft: 12, ...useIn(0) }}>{seg.note}</span>
        </div>
        <Device id={seg.take} w={1760} h={860} rate={seg.rate} />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", gap: 60, padding: "60px 80px" }}>
      <div style={{ width: phone && !pair ? 640 : 500, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 40, background: stock, borderRadius: 10, padding: "0 12px" }}>{n}</span>
          <span style={{ fontSize: 30, fontWeight: 800, color: C.ink2 }}>{title}</span>
        </div>
        <div style={{ fontSize: phone && !pair ? 54 : 46, fontWeight: 850, lineHeight: 1.1, letterSpacing: "-.01em", wordBreak: "keep-all", ...useIn(0) }}>{seg.note}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
          {points.map((p, i) => (
            <div key={p} style={{ display: "flex", gap: 14, alignItems: "baseline", fontSize: 30, fontWeight: 650, color: C.ink2, ...useIn(0.4 + i * 0.25) }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: C.ink, flex: "none", translate: "0 -4px" }} />
              {p}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>{media}</div>
    </AbsoluteFill>
  );
};

const SignOff: React.FC = () => {
  const copy = useCopy();
  return (
    <AbsoluteFill style={{ background: C.ink, color: C.paper, alignItems: "center", justifyContent: "center", gap: 18 }}>
      <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 120, color: C.sun, ...useIn(0) }}>beautifood</div>
      <div style={{ fontSize: 38, fontWeight: 650, ...useIn(0.3) }}>{copy.feature.signOff}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: C.sun, ...useIn(0.6) }}>{copy.url}</div>
    </AbsoluteFill>
  );
};
