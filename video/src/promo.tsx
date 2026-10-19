// Promo cuts: fast, mostly real footage cut on the beat. Promo30 is 16:9, Teaser15 is 9:16 for social.
import type React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "./theme";
import { Stub, useIn } from "./parts";
import { CallStage, CartStage, Cut, DeskStage, PhoneStage, Tags } from "./reel/Reel";
import { COPY, LangProvider, useCopy, type Lang } from "./reel/copy";
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

const EndCard: React.FC<{ vertical?: boolean }> = ({ vertical }) => {
  const copy = useCopy();
  return (
    <AbsoluteFill style={{ background: C.sun, alignItems: "center", justifyContent: "center", gap: 34, fontFamily: SANS, color: C.ink }}>
      <div style={useIn(0)}>
        <Stub serial="A013" label={copy.ticket.next} stock={C.paper} width={vertical ? 640 : 520}>
          {copy.ticket.ready}
        </Stub>
      </div>
      <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: vertical ? 150 : 120, ...useIn(0.3) }}>beautifood</div>
      <div style={{ fontSize: vertical ? 44 : 40, fontWeight: 750, textAlign: "center", ...useIn(0.5) }}>{copy.promo.tagline}</div>
      <div style={{ fontSize: vertical ? 34 : 32, fontWeight: 700, ...useIn(0.7) }}>{copy.url}</div>
    </AbsoluteFill>
  );
};

/** Bars each cut lasts; the soundtrack plays from its start, so cuts land on its downbeats. */
export const PROMO_BARS = 14;
export const TEASER_BARS = 7;

export const Promo30: React.FC<{ lang: Lang }> = ({ lang }) => {
  const { tags: T, promo: P } = COPY[lang];
  return (
    <LangProvider value={lang}>
      <AbsoluteFill style={{ background: C.ink }}>
        <Music />
        <Cut name="Hook" from={0} to={1}>
          <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
            <Slam size={150} color={C.sun}>{P.hook[0]}</Slam>
            <Slam size={150} color={C.sun} at={0.4}>{P.hook[1]}</Slam>
          </AbsoluteFill>
        </Cut>
        <Cut name="Join" from={1} to={2}><PhoneStage bg={C.sunSoft} id="join" tags={<Tags items={T.join} at={[0, 2]} />} /></Cut>
        <Cut name="Call" from={2} to={4}><CallStage rate={2.2} tags={<Tags items={P.host} at={[0, 3]} size={52} one />} /></Cut>
        <Cut name="Shared cart" from={4} to={6}><CartStage rate={1.75} /></Cut>
        <Cut name="Assistant" from={6} to={7}><PhoneStage bg={C.sun} id="assistant" rate={2.4} tags={<Tags items={P.assistant} at={[0, 2]} first="dark" />} /></Cut>
        <Cut name="Kitchen" from={7} to={8}><DeskStage id="kitchen" rate={2.4} tags={<Tags items={T.kitchen.slice(0, 1)} at={[0]} first="dark" />} /></Cut>
        <Cut name="Till" from={8} to={9}><DeskStage id="till" rate={2.8} tags={<Tags items={T.till.slice(1)} at={[0]} />} /></Cut>
        <Cut name="Dashboard" from={9} to={10}><DeskStage id="boss" rate={3} tags={<Tags items={T.boss.slice(0, 1)} at={[0]} first="dark" />} /></Cut>
        <Cut name="AI setup" from={10} to={11}><DeskStage id="setup" rate={2.8} tags={<Tags items={P.setup} at={[0, 2]} />} /></Cut>
        <Cut name="Translate" from={11} to={12}><DeskStage id="translate" rate={2.4} tags={<Tags items={T.translate.slice(0, 1)} at={[0]} first="dark" />} /></Cut>
        <Cut name="End" from={12} to={PROMO_BARS}><EndCard /></Cut>
      </AbsoluteFill>
    </LangProvider>
  );
};

export const Teaser15: React.FC<{ lang: Lang }> = ({ lang }) => {
  const Q = COPY[lang].teaser;
  return (
    <LangProvider value={lang}>
      <AbsoluteFill style={{ background: C.ink }}>
        <Music />
        <Cut name="Hook" from={0} to={1}>
          <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 24, padding: 60 }}>
            {Q.hook.map((x, i) => (
              <Slam key={x} size={150} color={C.sun} at={i * 0.3}>{x}</Slam>
            ))}
          </AbsoluteFill>
        </Cut>
        <Cut name="Join" from={1} to={2}><PhoneStage vertical bg={C.sunSoft} id="join" rate={1.8} tags={<Tag at={0} size={72}>{Q.join}</Tag>} /></Cut>
        <Cut name="Called" from={2} to={3}><PhoneStage vertical bg={C.sun} id="phoneCall" rate={2.4} tags={<Tag at={0} size={72} dark>{Q.called}</Tag>} /></Cut>
        <Cut name="Shared cart" from={3} to={4}><PhoneStage vertical bg={C.paper} id="cartB" rate={2.4} tags={<Tag at={0} size={72}>{Q.cart}</Tag>} /></Cut>
        <Cut name="Host" from={4} to={5}><DeskStage vertical bg={C.sunSoft} id="hostCall" rate={2.2} tags={<Tag at={0} size={72} dark>{Q.host}</Tag>} /></Cut>
        <Cut name="End" from={5} to={TEASER_BARS}><EndCard vertical /></Cut>
      </AbsoluteFill>
    </LangProvider>
  );
};
