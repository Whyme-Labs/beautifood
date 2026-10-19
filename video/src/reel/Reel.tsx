// The Devpost reel: no voiceover, so the story is told by the real product on screen.
// Every product shot is a recording of the running app; a camera follows the cued UI on the beat.
import type React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "../theme";
import { barF, barsF, clamp, ease } from "./beat";
import { Device, type TakeId } from "./takes";
import { AgentScene, CloseScene, CrowdScene, DropScene, PaperScene, Tag, WallScene } from "./scenes";

export const REEL_END_BAR = 39;
const R = "reel-clips/";

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
export const CartStage: React.FC<{ rate?: number }> = ({ rate }) => (
  <AbsoluteFill style={{ background: C.sunSoft, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 60 }}>
    <Device id="cartA" w={600} h={1000} tilt={-3} rate={rate} />
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <Tag at={0} size={64}>One table</Tag>
      <Tag at={2} size={64} dark>One cart</Tag>
      <Tag at={4} size={64}>Every phone</Tag>
    </div>
    <Device id="cartB" w={600} h={1000} tilt={3} rate={rate} />
  </AbsoluteFill>
);

const MONTAGE = ["p-join", "d-host", "p-cart-a", "d-kitchen-zh", "p-assistant", "d-pos", "p-cart-b", "d-setup", "p-menu-zh", "d-boss", "p-preorder", "d-translate"];

const Montage: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink, padding: 36, fontFamily: SANS }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "1fr 1fr", gap: 14, height: "100%" }}>
        {MONTAGE.map((n, i) => {
          const p = interpolate(frame, [i * 2, i * 2 + 8], [0, 1], clamp);
          return (
            <div key={n} style={{ borderRadius: 16, overflow: "hidden", background: "#fff", opacity: p, scale: String(0.9 + 0.1 * p) }}>
              <Video src={staticFile(`${R}small/${n}.mp4`)} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: C.sun, color: C.ink, padding: "26px 48px", borderRadius: 26, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
          <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 130, lineHeight: 1 }}>56 + 11</div>
          <div style={{ fontSize: 40, fontWeight: 850 }}>end-to-end tests · walkthroughs filmed by them</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const volume = interpolate(frame, [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 2], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Audio src={staticFile("audio/bgm.m4a")} volume={volume} />

      {/* the problem */}
      <Cut name="Crowd" from={0} to={2}><CrowdScene /></Cut>
      <Cut name="Paper" from={2} to={4}><PaperScene /></Cut>

      {/* a guest joins from their phone */}
      <Cut name="Join" from={4} to={6}>
        <PhoneStage bg={C.sunSoft} id="join" tags={<><Tag at={0}>Scan the QR</Tag><Tag at={3}>Get a number</Tag><Tag at={6} dark>Walk away</Tag></>} />
      </Cut>
      <Cut name="Called" from={6} to={8}>
        <PhoneStage bg={C.sun} id="called" side="right" tilt={2} tags={<><Tag at={2} dark>Table ready</Tag><Tag at={4} style={{ background: C.paper }}>桌位已准备好</Tag></>} />
      </Cut>

      <Cut name="Drop" from={8} to={9}><DropScene /></Cut>

      {/* order before you sit, then together at the table */}
      <Cut name="Preorder" from={9} to={11}>
        <PhoneStage bg={C.paper} id="preorder" tags={<><Tag at={0}>Preorder while waiting</Tag><Tag at={5} dark>Cooks when you sit</Tag></>} />
      </Cut>
      <Cut name="Shared cart" from={11} to={13}><CartStage /></Cut>

      {/* the menu assistant, in both languages */}
      <Cut name="Assistant" from={13} to={15}>
        <PhoneStage bg={C.sun} id="assistant" tags={<><Tag at={1} dark>Allergic to peanuts?</Tag><Tag at={5} style={{ background: C.paper }}>Confirm with staff</Tag></>} />
      </Cut>
      <Cut name="Assistant 中文" from={15} to={16}>
        <PhoneStage bg={C.paper} id="assistantZh" side="right" tilt={-2} tags={<Tag at={0.5} dark>招牌菜是什么？</Tag>} />
      </Cut>
      <Cut name="Menu 中文" from={16} to={17}>
        <PhoneStage bg={C.sunSoft} id="menuZh" tags={<><Tag at={0} size={72}>炒粿条</Tag><Tag at={2} size={44} dark>Char Kway Teow</Tag></>} />
      </Cut>

      {/* front of house */}
      <Cut name="Host" from={17} to={20}>
        <DeskStage id="host" tags={<><Tag at={0}>Seat with reasons</Tag><Tag at={8} dark>Floor updates live</Tag></>} />
      </Cut>
      <Cut name="Kitchen" from={20} to={22}><DeskStage id="kitchen" tags={<Tag at={0} dark>厨房 · Kitchen</Tag>} /></Cut>
      <Cut name="Till" from={22} to={24}>
        <DeskStage id="till" tags={<><Tag at={0}>Promo, points, card, cash</Tag><Tag at={5} dark>Change, counted</Tag></>} />
      </Cut>

      {/* the owner */}
      <Cut name="AI setup" from={24} to={27}>
        <DeskStage id="setup" tags={<><Tag at={0}>Paste the menu</Tag><Tag at={5} dark>AI drafts it</Tag><Tag at={9}>Apply</Tag></>} />
      </Cut>
      <Cut name="Translate" from={27} to={29}>
        <DeskStage id="translate" tags={<><Tag at={0}>Translate the menu</Tag><Tag at={4} dark>EN · 中文</Tag></>} />
      </Cut>
      <Cut name="Dashboard" from={29} to={31}><DeskStage id="boss" tags={<Tag at={0} dark>Every branch, live</Tag>} /></Cut>
      <Cut name="TV board" from={31} to={32}><DeskStage id="board" /></Cut>

      {/* agents, proof, close */}
      <Cut name="Agents" from={32} to={33}><AgentScene /></Cut>
      <Cut name="Wall" from={33} to={35}><WallScene /></Cut>
      <Cut name="Montage" from={35} to={37}><Montage /></Cut>
      <Cut name="Close" from={37} to={REEL_END_BAR}><CloseScene /></Cut>
    </AbsoluteFill>
  );
};
