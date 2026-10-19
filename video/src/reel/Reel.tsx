// The Devpost reel: no voiceover, so the story is told by the real product on screen.
// Every product shot is a recording of the running app; a camera follows the cued UI on the beat.
import type React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "../theme";
import { barF, barsF, clamp, ease, useAt, useBeat } from "./beat";
import { COPY, LangProvider, useCopy, useLang, type Lang } from "./copy";
import { Device, type TakeId } from "./takes";
import { AgentScene, CloseScene, CrowdScene, DropScene, PaperScene, Tag, WallScene } from "./scenes";

export const REEL_END_BAR = 39;

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
export const PhoneStage: React.FC<{ bg: string; id: TakeId; tags?: React.ReactNode; side?: "left" | "right"; tilt?: number; rate?: number; vertical?: boolean }> = ({ bg, id, tags, side = "left", tilt, rate, vertical }) => {
  const phone = vertical ? <Device id={id} w={940} h={1380} tilt={tilt} rate={rate} /> : <Device id={id} w={860} h={1000} tilt={tilt} rate={rate} />;
  const labels = tags && <div style={{ display: "flex", flexDirection: "column", alignItems: vertical ? "center" : side === "left" ? "flex-end" : "flex-start", gap: 20, width: vertical ? undefined : 520 }}>{tags}</div>;
  return (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: vertical ? 50 : 70 }}>
      {side === "right" && !vertical && phone}
      {labels}
      {(side === "left" || vertical) && phone}
    </AbsoluteFill>
  );
};

/** A desktop recording full-bleed, with labels floating bottom-left. Vertical: a panel under the labels. */
export const DeskStage: React.FC<{ id: TakeId; tags?: React.ReactNode; rate?: number; vertical?: boolean; bg?: string }> = ({ id, tags, rate, vertical, bg = C.paper }) =>
  vertical ? (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 50 }}>
      {tags && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>{tags}</div>}
      <Device id={id} w={1000} h={1200} rate={rate} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{ background: "#fff" }}>
      <Device id={id} w={1920} h={1080} rate={rate} bare />
      {tags && <div style={{ position: "absolute", left: 70, bottom: 70, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>{tags}</div>}
    </AbsoluteFill>
  );

/** Two phones at one table, sharing a cart. */
export const CartStage: React.FC<{ rate?: number }> = ({ rate }) => {
  const [table, cart, phones] = useCopy().tags.cart;
  return (
    <AbsoluteFill style={{ background: C.sunSoft, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 60 }}>
      <Device id="cartA" w={600} h={1000} tilt={-3} rate={rate} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Tag at={0} size={64}>{table}</Tag>
        <Tag at={2} size={64} dark>{cart}</Tag>
        <Tag at={4} size={64}>{phones}</Tag>
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
export const CallStage: React.FC<{ tags: React.ReactNode; rate?: number }> = ({ tags, rate }) => {
  const copy = useCopy();
  return (
    <AbsoluteFill style={{ background: C.sunSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 56, paddingBottom: 60 }}>
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

/** The opening rush, again: nobody walked away. */
const Reprise: React.FC = () => {
  const copy = useCopy();
  const p = useAt(0.5, 0.6);
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: SANS, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: 120, right: 120, top: 70, height: 120, display: "flex", borderRadius: "0 0 30px 30px", overflow: "hidden" }}>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? C.paper : C.sun }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 215, left: 0, right: 0, textAlign: "center", color: C.sun, fontFamily: NUM, fontWeight: 800, fontSize: 64, letterSpacing: ".04em" }}>{copy.crowd.sign}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 30, marginTop: 120, opacity: p, scale: String(0.9 + 0.1 * p) }}>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: 300, color: C.sun, lineHeight: 1 }}>0</span>
        <span style={{ fontSize: 80, fontWeight: 900, color: C.paper }}>{copy.reprise}</span>
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const volume = interpolate(frame, [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 2], [0, 1, 1, 0], clamp);
  const { tags: T, who: W, times: at, hero } = COPY[lang];
  const guest = `${W.guest} · ${hero}`;
  return (
    <LangProvider value={lang}>
      <AbsoluteFill style={{ background: C.ink }}>
        <Audio src={staticFile("audio/bgm.m4a")} volume={volume} />

        {/* 7:42 PM: the rush, and what it costs */}
        <Cut name="Crowd" from={0} to={2}><CrowdScene /></Cut>
        <Cut name="Paper" from={2} to={4}><PaperScene /></Cut>
        <Cut name="Drop" from={4} to={5}><DropScene /></Cut>

        {/* one guest's evening: join, browse, preorder */}
        <Cut name="Join" from={5} to={6}><PhoneStage bg={C.sunSoft} id="join" tags={<Tags items={T.join} at={[0, 2]} />} /><Corner who={guest} time={at.join} /></Cut>
        <Cut name="Ticket" from={6} to={7}><PhoneStage bg={C.sunSoft} id="ticket" tags={<Tags items={T.ticket} at={[0, 2]} />} /><Corner who={guest} time={at.join} /></Cut>
        <Cut name="Menu" from={7} to={8}><PhoneStage bg={C.sunSoft} id="menu" tags={<Tags items={T.menu} at={[0, 2]} />} /><Corner who={guest} time={at.menu} /></Cut>
        <Cut name="Assistant" from={8} to={10}><PhoneStage bg={C.sunSoft} id="assistant" tags={<Tags items={T.assistant} at={[0, 3, 5]} first="dark" />} /><Corner who={guest} time={at.menu} /></Cut>
        <Cut name="Preorder" from={10} to={12}><PhoneStage bg={C.sunSoft} id="preorder" tags={<Tags items={T.preorder} at={[0, 4]} />} /><Corner who={guest} time={at.preorder} /></Cut>

        {/* the host calls them: cause and effect on one screen */}
        <Cut name="Call" from={12} to={16}><CallStage tags={<Tags items={T.call} at={[0, 4, 7, 12.5]} size={52} one />} /></Cut>
        <Cut name="Door TV" from={16} to={17}><DeskStage id="board" tags={<Tags items={T.board} at={[0.5]} first="dark" />} /><Corner who={W.tv} time={at.call} /></Cut>

        {/* at the table, then the kitchen and the till work on that same table */}
        <Cut name="Table" from={17} to={19}><CartStage rate={1.75} /><Corner who={`${W.guest} · ${hero} + ${COPY[lang].friend}`} time={at.table} /></Cut>
        <Cut name="Kitchen" from={19} to={21}><DeskStage id="kitchen" tags={<Tags items={T.kitchen} at={[0, 4]} />} /><Corner who={W.kitchen} time={at.kitchen} /></Cut>
        <Cut name="Till" from={21} to={23}><DeskStage id="till" tags={<Tags items={T.till} at={[0, 4]} />} /><Corner who={W.till} time={at.till} /></Cut>

        {/* closing time: the owner */}
        <Cut name="Closing" from={23} to={24}><Chapter lines={COPY[lang].chapter.closing} /></Cut>
        <Cut name="Dashboard" from={24} to={26}><DeskStage id="boss" tags={<Tags items={T.boss} at={[0, 4]} first="dark" />} /><Corner who={W.owner} /></Cut>
        <Cut name="Translate" from={26} to={28}><DeskStage id="translate" tags={<Tags items={T.translate} at={[0, 4]} />} /><Corner who={W.owner} /></Cut>
        <Cut name="AI setup" from={28} to={30}><DeskStage id="setup" rate={1.4} tags={<Tags items={T.setup} at={[0, 2, 4, 6]} first="dark" />} /><Corner who={W.owner} /></Cut>

        {/* the payoff: back at 7:42 PM, nobody walked away */}
        <Cut name="Reprise" from={30} to={31}><Reprise /></Cut>

        {/* appendix, labelled: why it holds up at 7:42 PM */}
        <Cut name="Under the hood" from={31} to={32}><Chapter lines={COPY[lang].chapter.proof} /></Cut>
        <Cut name="Wall" from={32} to={34}><WallScene /><Corner who={W.tech} bottom /><div style={{ position: "absolute", right: 90, bottom: 60, display: "flex", gap: 16 }}><Tags items={T.wall} at={[0, 2]} /></div></Cut>
        <Cut name="Agents" from={34} to={35}><AgentScene /><Corner who={W.tech} /><div style={{ position: "absolute", right: 90, bottom: 60 }}><Tags items={T.agents} at={[0.5]} /></div></Cut>
        <Cut name="Montage" from={35} to={37}><Montage /><Corner who={W.tech} /></Cut>
        <Cut name="Close" from={37} to={REEL_END_BAR}><CloseScene /></Cut>
      </AbsoluteFill>
    </LangProvider>
  );
};
