// Promo cuts: fast, mostly real footage cut on the beat. Promo30 is 16:9, Teaser15 is 9:16 for social.
import type React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Stub, useIn } from "./parts";
import { CartStage, Cut, DeskStage, PhoneStage } from "./reel/Reel";
import { Tag } from "./reel/scenes";

/** The soundtrack, faded in and out to fit the cut. */
const Music: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return <Audio src={staticFile("audio/bgm.m4a")} volume={interpolate(frame, [0, 6, durationInFrames - 1.5 * fps, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />;
};

const Slam: React.FC<{ children: React.ReactNode; size: number; color?: string; at?: number }> = ({ children, size, color = C.ink, at = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, (at + 0.35) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.23, 1, 0.32, 1) });
  return <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: "-.03em", color, opacity: p, scale: 0.92 + 0.08 * p, textAlign: "center" }}>{children}</div>;
};

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

/** Bars each cut lasts; the soundtrack plays from its start, so cuts land on its downbeats. */
export const PROMO_BARS = 14;
export const TEASER_BARS = 7;

export const Promo30: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <Music />
    <Cut name="Hook" from={0} to={1}>
      <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
        <Slam size={150} color={C.sun}>Still shouting</Slam>
        <Slam size={150} color={C.sun} at={0.4}>names at the door?</Slam>
      </AbsoluteFill>
    </Cut>
    <Cut name="Join" from={1} to={3}>
      <PhoneStage bg={C.sunSoft} id="join" tags={<><Tag at={0}>Scan the QR</Tag><Tag at={3}>Get a number</Tag><Tag at={6} dark>Walk away</Tag></>} />
    </Cut>
    <Cut name="Called" from={3} to={4}>
      <PhoneStage bg={C.sun} id="called" side="right" tilt={2} rate={1.6} tags={<><Tag at={0} dark>Table ready</Tag><Tag at={1.5} style={{ background: C.paper }}>桌位已准备好</Tag></>} />
    </Cut>
    <Cut name="Shared cart" from={4} to={6}><CartStage /></Cut>
    <Cut name="Assistant" from={6} to={7}>
      <PhoneStage bg={C.sun} id="assistant" rate={2} tags={<><Tag at={0} dark>Allergic to peanuts?</Tag><Tag at={2} style={{ background: C.paper }}>Ask the menu</Tag></>} />
    </Cut>
    <Cut name="Host" from={7} to={9}>
      <DeskStage id="host" tags={<><Tag at={0}>AI seats every party</Tag><Tag at={4} dark>With reasons</Tag></>} />
    </Cut>
    <Cut name="Kitchen" from={9} to={10}><DeskStage id="kitchen" rate={2} tags={<Tag at={0} dark>厨房 · Kitchen</Tag>} /></Cut>
    <Cut name="AI setup" from={10} to={11}>
      <DeskStage id="setup" rate={2.6} tags={<><Tag at={0}>Paste the menu</Tag><Tag at={2} dark>AI sets up the shop</Tag></>} />
    </Cut>
    <Cut name="Dashboard" from={11} to={12}><DeskStage id="boss" rate={3} tags={<Tag at={0} dark>Every branch, live</Tag>} /></Cut>
    <Cut name="End" from={12} to={PROMO_BARS}><EndCard /></Cut>
  </AbsoluteFill>
);

export const Teaser15: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <Music />
    <Cut name="Hook" from={0} to={1}>
      <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 24, padding: 60 }}>
        <Slam size={150} color={C.sun}>No more</Slam>
        <Slam size={150} color={C.sun} at={0.3}>shouting</Slam>
        <Slam size={150} color={C.sun} at={0.6}>names.</Slam>
      </AbsoluteFill>
    </Cut>
    <Cut name="Join" from={1} to={2}>
      <PhoneStage vertical bg={C.sunSoft} id="join" rate={1.8} tags={<Tag at={0} size={72}>Scan. Get a number.</Tag>} />
    </Cut>
    <Cut name="Called" from={2} to={3}>
      <PhoneStage vertical bg={C.sun} id="called" rate={1.6} tags={<Tag at={0} size={72} dark>Table ready</Tag>} />
    </Cut>
    <Cut name="Shared cart" from={3} to={4}>
      <PhoneStage vertical bg={C.paper} id="cartB" rate={2.6} tags={<Tag at={0} size={72}>One cart, every phone</Tag>} />
    </Cut>
    <Cut name="Host" from={4} to={5}>
      <DeskStage vertical bg={C.sunSoft} id="host" rate={1.8} tags={<Tag at={0} size={72} dark>AI seats every party</Tag>} />
    </Cut>
    <Cut name="End" from={5} to={TEASER_BARS}><EndCard vertical /></Cut>
  </AbsoluteFill>
);
