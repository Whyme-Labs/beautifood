// The Devpost reel: no voiceover, so the story is told by the real product on screen.
// Every product shot is a recording of the running app; a camera follows the cued UI on the beat.
import type React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "../theme";
import { barF, barsF, clamp, ease, useAt, useBeat } from "./beat";
import { COPY, LangProvider, useCopy, useLang, type Lang } from "./copy";
import { Device, type TakeId } from "./takes";
import { Countdown, Diners, PosDevices, QueueZoom, RushStage, Title } from "./scenes2";
import { AgentScene, CloseScene, CrowdScene, DropScene, PaperScene, Tag } from "./scenes";

export const REEL_END_BAR = 59;

/** Every cut opens with a small punch-in so it lands with the beat. */
export const Hit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 7], [1.04, 1], { ...clamp, easing: ease });
  return <AbsoluteFill style={{ scale: String(s) }}>{children}</AbsoluteFill>;
};

export const Cut: React.FC<{ from: number; to: number; name: string; children: React.ReactNode }> = ({ from, to, name, children }) => (
  <Sequence name={name} from={from === 0 ? 0 : barF(from)} durationInFrames={from === 0 ? barF(to) : barsF(from, to)}>
    <Hit>{children}</Hit>
  </Sequence>
);

/** A phone on a coloured ground, with beat-timed labels on the free side. */
export const PhoneStage: React.FC<{ bg: string; id: TakeId; title?: string; tags?: React.ReactNode; side?: "left" | "right"; tilt?: number; rate?: number; vertical?: boolean }> = ({ bg, id, title, tags, side = "left", tilt, rate, vertical }) => {
  const phone = vertical ? <Device id={id} w={940} h={1380} tilt={tilt} rate={rate} /> : <Device id={id} w={860} h={1000} tilt={tilt} rate={rate} />;
  const align = vertical ? "center" : side === "left" ? "flex-end" : "flex-start";
  const labels = (title || tags) && (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 20, width: vertical ? undefined : 600 }}>
      {title && <Title style={{ textAlign: vertical ? "center" : side === "left" ? "right" : "left", marginBottom: 14 }}>{title}</Title>}
      {tags}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: vertical ? 50 : 70 }}>
      {side === "right" && !vertical && phone}
      {labels}
      {(side === "left" || vertical) && phone}
    </AbsoluteFill>
  );
};

/** A desktop recording full-bleed, with labels floating bottom-left. Vertical: a panel under the labels. */
export const DeskStage: React.FC<{ id: TakeId; title?: string; tags?: React.ReactNode; rate?: number; vertical?: boolean; bg?: string }> = ({ id, title, tags, rate, vertical, bg = C.paper }) =>
  vertical ? (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 50 }}>
      {tags && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>{tags}</div>}
      <Device id={id} w={1000} h={1200} rate={rate} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{ background: "#fff" }}>
      <Device id={id} w={1920} h={1080} rate={rate} bare />
      {(title || tags) && (
        <div style={{ position: "absolute", left: 70, bottom: 70, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
          {title && (
            <div style={{ background: C.ink, borderRadius: 20, padding: "14px 26px 18px", marginBottom: 6, boxShadow: "0 20px 50px rgba(0,0,0,.25)" }}>
              <Title size={60} style={{ color: C.sun }}>{title}</Title>
            </div>
          )}
          {tags}
        </div>
      )}
    </AbsoluteFill>
  );

/** Two phones at one table, sharing a cart. */
export const CartStage: React.FC<{ rate?: number; title?: string }> = ({ rate, title }) => {
  const copy = useCopy();
  return (
    <AbsoluteFill style={{ background: C.sunSoft, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 56 }}>
      <Device id="cartA" w={600} h={1000} tilt={-3} rate={rate} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: 520 }}>
        {title && <Title style={{ textAlign: "center" }}>{title}</Title>}
        <Diners names={[copy.hero, copy.friend]} />
        <Tags items={copy.tags.cart} at={[3, 5]} size={44} />
      </div>
      <Device id="cartB" w={600} h={1000} tilt={3} rate={rate} />
    </AbsoluteFill>
  );
};

/** Beat-timed labels, alternating light and dark; `one` shows each in turn instead of stacking them. */
export const Tags: React.FC<{ items: string[]; at: number[]; size?: number; first?: "light" | "dark"; one?: boolean }> = ({ items, at, size, first = "light", one }) => {
  const { beat, phase } = useBeat();
  const now = beat + phase;
  return (
    <>
      {items.map((x, i) =>
        one && ((at[i] ?? 0) > now || (i + 1 < items.length && (at[i + 1] ?? Infinity) <= now)) ? null : (
          <Tag key={x} at={at[i] ?? i * 2} size={size} dark={(i % 2 === 1) === (first === "light")}>
            {x}
          </Tag>
        ),
      )}
    </>
  );
};

const MONTAGE = ["p-join", "d-host", "p-cart-a", "d-kitchen", "p-assistant", "d-pos", "p-cart-b", "d-setup", "p-menu", "d-boss", "p-preorder", "d-translate"];

const Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const lang = useLang();
  return (
    <AbsoluteFill style={{ background: C.ink, padding: 36, fontFamily: SANS }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, height: "100%" }}>
        {MONTAGE.map((n, i) => {
          const p = interpolate(frame, [i * 2, i * 2 + 8], [0, 1], clamp);
          return (
            <div key={n} style={{ borderRadius: 16, overflow: "hidden", background: "#fff", opacity: p, scale: String(0.9 + 0.1 * p) }}>
              <Video src={staticFile(`reel-clips/${lang}/small/${n}.mp4`)} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: C.sun, color: C.ink, padding: "26px 48px", borderRadius: 26, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
          <div style={{ fontSize: 40, fontWeight: 850 }}>{COPY[lang].montage[0]}</div>
          <div style={{ fontSize: 34, fontWeight: 750 }}>{COPY[lang].montage[1]}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Whose screen this is (and when), pinned top-left so every switch of perspective is signposted. */
const Who: React.FC<{ who: string; time?: string; style?: React.CSSProperties }> = ({ who, time, style }) => {
  const p = useAt(0, 0.4);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: SANS, opacity: p, translate: `0 ${(1 - p) * -10}px`, ...style }}>
      <span style={{ background: C.ink, color: C.sun, fontWeight: 900, fontSize: 30, letterSpacing: ".06em", padding: "10px 18px", borderRadius: 12 }}>{who}</span>
      {time && <span style={{ background: "rgba(255,255,255,.85)", color: C.ink, fontFamily: NUM, fontWeight: 800, fontSize: 30, padding: "8px 14px", borderRadius: 12 }}>{time}</span>}
    </div>
  );
};

const Corner: React.FC<{ who: string; time?: string; bottom?: boolean }> = ({ bottom, ...p }) => (
  <div style={{ position: "absolute", left: 48, ...(bottom ? { bottom: 56 } : { top: 40 }) }}>
    <Who {...p} />
  </div>
);

/** The host's Call and the guest's phone, side by side: one tap, two screens. */
export const CallStage: React.FC<{ tags: React.ReactNode; rate?: number; title?: string }> = ({ tags, rate, title }) => {
  const copy = useCopy();
  return (
    <AbsoluteFill style={{ background: C.sunSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 56, paddingBottom: 60, paddingTop: title ? 70 : 0 }}>
      {title && <div style={{ position: "absolute", top: 26, left: 0, right: 0, display: "flex", justifyContent: "center" }}><Title size={58}>{title}</Title></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Who who={copy.who.host} time={copy.times.call} />
        <Device id="hostCall" w={1180} h={780} rate={rate} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Who who={`${copy.who.guest} · ${copy.hero}`} />
        <Device id="phoneCall" w={560} h={900} rate={rate} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", gap: 18 }}>{tags}</div>
    </AbsoluteFill>
  );
};

/** A chapter card: a time, then what happens. */
const Chapter: React.FC<{ lines: string[] }> = ({ lines: [a, b] }) => {
  const p = useAt(0, 0.6);
  const q = useAt(1, 0.6);
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 10, fontFamily: SANS }}>
      <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 120, color: C.sun, opacity: p, scale: String(0.94 + 0.06 * p) }}>{a}</div>
      <div style={{ fontWeight: 900, fontSize: 96, color: C.paper, letterSpacing: "-.02em", opacity: q, translate: `0 ${(1 - q) * 20}px` }}>{b}</div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const volume = interpolate(frame, [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 2], [0, 1, 1, 0], clamp);
  const { tags: T, who: W, times: at, hero, titles: H } = COPY[lang];
  const guest = `${W.guest} · ${hero}`;
  return (
    <LangProvider value={lang}>
      <AbsoluteFill style={{ background: C.ink }}>
        <Audio src={staticFile("audio/bgm.m4a")} volume={volume} />

        {/* 7:42 PM: the rush, and what it costs */}
        <Cut name="Crowd" from={0} to={2}><CrowdScene /></Cut>
        <Cut name="Paper" from={2} to={4}><PaperScene /></Cut>
        <Cut name="Drop" from={4} to={5}><DropScene /></Cut>

        {/* one guest's evening: join, wait, browse, preorder (no app, no account) */}
        <Cut name="Join" from={5} to={7}><PhoneStage bg={C.sunSoft} id="join" rate={1} title={H.join} tags={<Tags items={T.join} at={[1, 3]} />} /><Corner who={guest} time={at.join} /></Cut>
        <Cut name="Ticket" from={7} to={9}><PhoneStage bg={C.sunSoft} id="ticket" rate={0.5} title={H.ticket} tags={<Tags items={T.ticket} at={[1, 4]} />} /><Corner who={guest} time={at.join} /></Cut>
        <Cut name="Menu" from={9} to={11}><PhoneStage bg={C.sunSoft} id="menu" rate={0.9} title={H.menu} tags={<Tags items={T.menu} at={[1, 4]} />} /><Corner who={guest} time={at.menu} /></Cut>
        <Cut name="Assistant" from={11} to={13}><PhoneStage bg={C.sunSoft} id="assistant" title={H.assistant} tags={<Tags items={T.assistant} at={[1, 3.5, 6]} first="dark" />} /><Corner who={guest} time={at.menu} /></Cut>
        <Cut name="Preorder" from={13} to={16}><PhoneStage bg={C.sunSoft} id="preorder" rate={1.3} title={H.preorder} tags={<Tags items={T.preorder} at={[1, 6]} />} /><Corner who={guest} time={at.preorder} /></Cut>

        {/* the host's side of the same queue, then the call: cause and effect on one screen */}
        <Cut name="Host queue" from={16} to={18}><DeskStage id="hostQueue" title={H.hostQueue} tags={<Tags items={T.hostQueue} at={[1.5, 4]} />} /><Corner who={W.host} time={at.call} /></Cut>
        <Cut name="Call" from={18} to={23}><CallStage rate={1} title={H.call} tags={<Tags items={T.call} at={[0, 5, 9, 15]} size={52} one />} /></Cut>
        <Cut name="Door TV" from={23} to={25}><DeskStage id="board" rate={0.7} title={H.board} /><Corner who={W.tv} time={at.call} /></Cut>

        {/* at the table, then the kitchen; mid-rush every screen in sync; then the till */}
        <Cut name="Table" from={25} to={28}><CartStage rate={1.15} title={H.cart} /><Corner who={`${W.guest} · ${hero} + ${COPY[lang].friend}`} time={at.table} /></Cut>
        <Cut name="Kitchen" from={28} to={30}><DeskStage id="kitchen" rate={1} title={H.kitchen} tags={<Tags items={T.kitchen} at={[1.5, 4.5]} />} /><Corner who={W.kitchen} time={at.kitchen} /></Cut>
        <Cut name="Rush" from={30} to={34}><RushStage /></Cut>
        <Cut name="Till" from={34} to={36}><DeskStage id="till" rate={1.3} title={H.till} tags={<Tags items={T.till} at={[1.5, 4.5]} />} /><Corner who={W.till} time={at.till} /></Cut>
        <Cut name="POS" from={36} to={38}><PosDevices /></Cut>

        {/* closing time: the owner */}
        <Cut name="Closing" from={38} to={39}><Chapter lines={COPY[lang].chapter.closing} /></Cut>
        <Cut name="Dashboard" from={39} to={41}><DeskStage id="boss" rate={0.7} title={H.boss} /><Corner who={W.owner} /></Cut>
        <Cut name="Report" from={41} to={43}><DeskStage id="report" rate={1} title={H.report} /><Corner who={W.owner} /></Cut>
        <Cut name="Translate" from={43} to={45}><DeskStage id="translate" rate={1} title={H.translate} tags={<Tags items={T.translate.slice(1)} at={[2]} />} /><Corner who={W.owner} /></Cut>
        <Cut name="AI setup" from={45} to={47}><DeskStage id="setup" rate={1.4} title={H.setup} tags={<Tags items={T.setup.slice(1)} at={[1.5, 3.5, 6]} first="dark" />} /><Corner who={W.owner} /></Cut>

        {/* the payoff: back at 7:42 PM, the walk-aways count down to none */}
        <Cut name="Countdown" from={47} to={49}><Countdown /></Cut>

        {/* appendix, labelled: why it holds up at 7:42 PM */}
        <Cut name="Under the hood" from={49} to={50}><Chapter lines={COPY[lang].chapter.proof} /></Cut>
        <Cut name="Queue zoom" from={50} to={53}><QueueZoom /></Cut>
        <Cut name="Agents" from={53} to={55}><AgentScene /><Corner who={W.tech} /><div style={{ position: "absolute", right: 90, bottom: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16 }}><Title size={56} style={{ color: C.sun }}>{H.agents}</Title><Tags items={T.agents} at={[2]} /></div></Cut>
        <Cut name="Montage" from={55} to={57}><Montage /><Corner who={W.tech} /></Cut>
        <Cut name="Close" from={57} to={REEL_END_BAR}><CloseScene /></Cut>
      </AbsoluteFill>
    </LangProvider>
  );
};
