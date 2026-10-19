// The Devpost reel: no voiceover, so the story is told by the real product on screen.
// Every product shot is a recording of the running app; a camera follows the cued UI on the beat.
import type React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "../theme";
import { BEAT, barF, barsF, clamp, ease, useAt, useBeat } from "./beat";
import { FocusScene, focusBars, landAt, useFocus } from "./focus";
import { COPY, LangProvider, useCopy, useLang, type Lang } from "./copy";
import { Device, type TakeId } from "./takes";
import { Countdown, Diners, PosDevices, QueueZoom, rushCaptions, RushStage, Title } from "./scenes2";
import { AgentScene, CloseScene, CrowdScene, DropScene, PaperScene, Tag } from "./scenes";


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
export const Tags: React.FC<{ items: string[]; at: number[]; size?: number; first?: "light" | "dark"; one?: boolean }> = ({ items, at: asked, size, first = "light", one }) => {
  const { beat, phase } = useBeat();
  const now = beat + phase;
  // in a focused scene each caption lands in its own pause
  const focus = useFocus();
  const at = focus ? asked.map((_, i) => landAt(focus, i) / BEAT) : asked;
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

/**
 * The running order. Each scene is its length in bars as the recording plays, plus, when it has
 * a title over a screen (`focus`), the hold before the screen plays and a pause for each caption:
 * `focus` lists the captions' play-time beats, the same ones its Tags use.
 */
type Scene = { name: string; bars: number; focus?: number[] | ((lang: Lang) => number[]); render: (ctx: ReelCtx) => React.ReactNode; extra?: (ctx: ReelCtx) => React.ReactNode };
type ReelCtx = { lang: Lang; copy: (typeof COPY)[Lang]; guest: string };

const CAP = {
  join: [1, 3],
  ticket: [1, 4],
  menu: [1, 4],
  assistant: [1, 3.5, 6],
  preorder: [1, 6],
  hostQueue: [1.5, 4],
  call: [0, 5, 9, 15],
  cart: [3, 5],
  kitchen: [1.5, 4.5],
  till: [1.5, 4.5],
  translate: [2],
  setup: [1.5, 3.5, 6],
};

const SCENES: Scene[] = [
  // 7:42 PM: the rush, and what it costs
  { name: "Crowd", bars: 2, render: () => <CrowdScene /> },
  { name: "Paper", bars: 2, render: () => <PaperScene /> },
  { name: "Drop", bars: 2, render: () => <DropScene /> },

  // one guest's evening: join, wait, browse, preorder (no app, no account)
  { name: "Join", bars: 2, focus: CAP.join, render: ({ copy: c }) => <PhoneStage bg={C.sunSoft} id="join" rate={1} title={c.titles.join} tags={<Tags items={c.tags.join} at={CAP.join} />} />, extra: ({ copy: c, guest }) => <Corner who={guest} time={c.times.join} /> },
  { name: "Ticket", bars: 2, focus: CAP.ticket, render: ({ copy: c }) => <PhoneStage bg={C.sunSoft} id="ticket" rate={0.5} title={c.titles.ticket} tags={<Tags items={c.tags.ticket} at={CAP.ticket} />} />, extra: ({ copy: c, guest }) => <Corner who={guest} time={c.times.join} /> },
  { name: "Menu", bars: 2, focus: CAP.menu, render: ({ copy: c }) => <PhoneStage bg={C.sunSoft} id="menu" rate={0.9} title={c.titles.menu} tags={<Tags items={c.tags.menu} at={CAP.menu} />} />, extra: ({ copy: c, guest }) => <Corner who={guest} time={c.times.menu} /> },
  { name: "Assistant", bars: 2, focus: CAP.assistant, render: ({ copy: c }) => <PhoneStage bg={C.sunSoft} id="assistant" title={c.titles.assistant} tags={<Tags items={c.tags.assistant} at={CAP.assistant} first="dark" />} />, extra: ({ copy: c, guest }) => <Corner who={guest} time={c.times.menu} /> },
  { name: "Preorder", bars: 3, focus: CAP.preorder, render: ({ copy: c }) => <PhoneStage bg={C.sunSoft} id="preorder" rate={1.3} title={c.titles.preorder} tags={<Tags items={c.tags.preorder} at={CAP.preorder} />} />, extra: ({ copy: c, guest }) => <Corner who={guest} time={c.times.preorder} /> },

  // the host's side of the same queue, then the call: cause and effect on one screen
  { name: "Host queue", bars: 2, focus: CAP.hostQueue, render: ({ copy: c }) => <DeskStage id="hostQueue" title={c.titles.hostQueue} tags={<Tags items={c.tags.hostQueue} at={CAP.hostQueue} />} />, extra: ({ copy: c }) => <Corner who={c.who.host} time={c.times.call} /> },
  { name: "Call", bars: 5, focus: CAP.call, render: ({ copy: c }) => <CallStage rate={1} title={c.titles.call} tags={<Tags items={c.tags.call} at={CAP.call} size={52} one />} /> },
  { name: "Door TV", bars: 2, focus: [], render: ({ copy: c }) => <DeskStage id="board" rate={0.7} title={c.titles.board} />, extra: ({ copy: c }) => <Corner who={c.who.tv} time={c.times.call} /> },

  // at the table, then the kitchen; mid-rush every screen in sync; then the till
  { name: "Table", bars: 3, focus: CAP.cart, render: ({ copy: c }) => <CartStage rate={1.15} title={c.titles.cart} />, extra: ({ copy: c }) => <Corner who={`${c.who.guest} · ${c.hero} + ${c.friend}`} time={c.times.table} /> },
  { name: "Kitchen", bars: 2, focus: CAP.kitchen, render: ({ copy: c }) => <DeskStage id="kitchen" rate={1} title={c.titles.kitchen} tags={<Tags items={c.tags.kitchen} at={CAP.kitchen} />} />, extra: ({ copy: c }) => <Corner who={c.who.kitchen} time={c.times.kitchen} /> },
  { name: "Rush", bars: 4, focus: rushCaptions, render: () => <RushStage /> },
  { name: "Till", bars: 2, focus: CAP.till, render: ({ copy: c }) => <DeskStage id="till" rate={1.3} title={c.titles.till} tags={<Tags items={c.tags.till} at={CAP.till} />} />, extra: ({ copy: c }) => <Corner who={c.who.till} time={c.times.till} /> },
  { name: "POS", bars: 3.5, render: () => <PosDevices /> },

  // closing time: the owner
  { name: "Closing", bars: 1.5, render: ({ copy: c }) => <Chapter lines={c.chapter.closing} /> },
  { name: "Dashboard", bars: 2, focus: [], render: ({ copy: c }) => <DeskStage id="boss" rate={0.7} title={c.titles.boss} />, extra: ({ copy: c }) => <Corner who={c.who.owner} /> },
  { name: "Report", bars: 2, focus: [], render: ({ copy: c }) => <DeskStage id="report" rate={1} title={c.titles.report} />, extra: ({ copy: c }) => <Corner who={c.who.owner} /> },
  { name: "Translate", bars: 2, focus: CAP.translate, render: ({ copy: c }) => <DeskStage id="translate" rate={1} title={c.titles.translate} tags={<Tags items={c.tags.translate.slice(1)} at={CAP.translate} />} />, extra: ({ copy: c }) => <Corner who={c.who.owner} /> },
  { name: "AI setup", bars: 2, focus: CAP.setup, render: ({ copy: c }) => <DeskStage id="setup" rate={1.4} title={c.titles.setup} tags={<Tags items={c.tags.setup.slice(1)} at={CAP.setup} first="dark" />} />, extra: ({ copy: c }) => <Corner who={c.who.owner} /> },

  // the payoff: back at 7:42 PM, the walk-aways count down to none
  { name: "Countdown", bars: 3.5, render: () => <Countdown /> },

  // appendix, labelled: why it holds up at 7:42 PM
  { name: "Under the hood", bars: 1.5, render: ({ copy: c }) => <Chapter lines={c.chapter.proof} /> },
  { name: "Queue zoom", bars: 3, render: () => <QueueZoom /> },
  {
    name: "Agents",
    bars: 3.5,
    render: ({ copy: c }) => (
      <>
        <AgentScene />
        <div style={{ position: "absolute", right: 90, bottom: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16 }}>
          <Title size={56} style={{ color: C.sun }}>{c.titles.agents}</Title>
          <Tags items={c.tags.agents} at={[10.5]} />
        </div>
      </>
    ),
    extra: ({ copy: c }) => <Corner who={c.who.tech} />,
  },
  { name: "Montage", bars: 2, render: () => <Montage />, extra: ({ copy: c }) => <Corner who={c.who.tech} /> },
  { name: "Close", bars: 2, render: () => <CloseScene /> },
];

const marksOf = (s: Scene, lang: Lang) => (typeof s.focus === "function" ? s.focus(lang) : s.focus);
// the number of captions is the same in every language, so lengths are too
const lengthOf = (s: Scene) => s.bars + (s.focus ? focusBars((marksOf(s, "en") ?? []).filter((b) => b > 0).length) : 0);
const STARTS = SCENES.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + lengthOf(SCENES[i - 1])], []);
export const REEL_END_BAR = STARTS[STARTS.length - 1] + lengthOf(SCENES[SCENES.length - 1]);

export const Reel: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const volume = interpolate(frame, [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 2], [0, 1, 1, 0], clamp);
  const copy = COPY[lang];
  const ctx: ReelCtx = { lang, copy, guest: `${copy.who.guest} · ${copy.hero}` };
  return (
    <LangProvider value={lang}>
      <AbsoluteFill style={{ background: C.ink }}>
        <Audio src={staticFile("audio/bgm.m4a")} volume={volume} />
        {SCENES.map((s, i) => (
          <Cut key={s.name} name={s.name} from={STARTS[i]} to={STARTS[i] + lengthOf(s)}>
            {s.focus ? <FocusScene at={marksOf(s, lang)}>{s.render(ctx)}</FocusScene> : s.render(ctx)}
            {s.extra?.(ctx)}
          </Cut>
        ))}
      </AbsoluteFill>
    </LangProvider>
  );
};
