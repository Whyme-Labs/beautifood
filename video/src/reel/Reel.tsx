// The Devpost reel: no voiceover, so the story is told by the real product on screen.
// Every product shot is a recording of the running app; a camera follows the cued UI on the beat.
import type React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NUM, SANS } from "../theme";
import { barF, barsF, clamp, ease } from "./beat";
import { Camera, Phone } from "./camera";
import { AgentScene, CloseScene, CrowdScene, DropScene, PaperScene, Tag, WallScene } from "./scenes";

export const REEL_END_BAR = 39;
const R = "reel-clips/";

/** Every cut opens with a small punch-in so it lands with the beat. */
const Hit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 7], [1.04, 1], { ...clamp, easing: ease });
  return <AbsoluteFill style={{ scale: String(s) }}>{children}</AbsoluteFill>;
};

const Cut: React.FC<{ from: number; to: number; name: string; children: React.ReactNode }> = ({ from, to, name, children }) => (
  <Sequence name={name} from={from === 0 ? 0 : barF(from)} durationInFrames={from === 0 ? barF(to) : barsF(from, to)}>
    <Hit>{children}</Hit>
  </Sequence>
);

/** A phone (or two) on a coloured ground, with beat-timed labels on the free side. */
const PhoneStage: React.FC<{ bg: string; children: React.ReactNode; tags?: React.ReactNode; side?: "left" | "right" }> = ({ bg, children, tags, side = "left" }) => (
  <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 70 }}>
    {side === "right" && children}
    {tags && <div style={{ display: "flex", flexDirection: "column", alignItems: side === "left" ? "flex-end" : "flex-start", gap: 20, width: 520 }}>{tags}</div>}
    {side === "left" && children}
  </AbsoluteFill>
);

/** A desktop recording full-bleed, with labels floating bottom-left. */
const Desk: React.FC<React.ComponentProps<typeof Camera> & { tags?: React.ReactNode }> = ({ tags, ...cam }) => (
  <AbsoluteFill style={{ background: "#fff" }}>
    <Camera {...cam} />
    {tags && <div style={{ position: "absolute", left: 70, bottom: 70, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>{tags}</div>}
  </AbsoluteFill>
);

const DESK = { vw: 2880, vh: 1800, w: 1920, h: 1080 };

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
        <PhoneStage bg={C.sunSoft} tags={<><Tag at={0}>Scan the QR</Tag><Tag at={3}>Get a number</Tag><Tag at={6} dark>Walk away</Tag></>}>
          <Phone src={`${R}p-join.mp4`} from={0.2} rate={1.25} shots={[{ t: 0.2, box: null }, { t: 0.6, box: { x: 105, y: 880, w: 960, h: 900 } }, { t: 3.71, box: { x: 108, y: 379, w: 954, h: 294 }, pad: 1.1 }, { t: 4.6, box: { x: 108, y: 379, w: 954, h: 800 } }]} maxZoom={1.9} />
        </PhoneStage>
      </Cut>
      <Cut name="Called" from={6} to={8}>
        <PhoneStage bg={C.sun} side="right" tags={<><Tag at={2} dark>Table ready</Tag><Tag at={4} style={{ background: C.paper }}>桌位已准备好</Tag></>}>
          <Phone src={`${R}p-ticket-called.mp4`} from={0.3} rate={1.15} shots={[{ t: 0.3, box: { x: 48, y: 225, w: 1074, h: 1103 } }, { t: 2.62, box: { x: 48, y: 225, w: 1074, h: 879 }, pad: 1.05 }]} maxZoom={1.6} tilt={2} />
        </PhoneStage>
      </Cut>

      <Cut name="Drop" from={8} to={9}><DropScene /></Cut>

      {/* order before you sit, then together at the table */}
      <Cut name="Preorder" from={9} to={11}>
        <PhoneStage bg={C.paper} tags={<><Tag at={0}>Preorder while waiting</Tag><Tag at={5} dark>Cooks when you sit</Tag></>}>
          <Phone src={`${R}p-preorder.mp4`} from={1.8} rate={1.6} shots={[{ t: 1.8, box: null }, { t: 2.4, box: { x: 48, y: 855, w: 1074, h: 1000 } }, { t: 4.7, box: { x: 48, y: 604, w: 1074, h: 753 } }, { t: 8.52, box: { x: 48, y: 512, w: 1074, h: 1001 } }]} maxZoom={1.7} />
        </PhoneStage>
      </Cut>
      <Cut name="Shared cart" from={11} to={13}>
        <AbsoluteFill style={{ background: C.sunSoft, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 60 }}>
          <Phone src={`${R}p-cart-a.mp4`} from={1.2} rate={1.6} height={1000} width={600} tilt={-3} shots={[{ t: 1.2, box: { x: 48, y: 700, w: 1074, h: 1200 } }, { t: 3.56, box: { x: 48, y: 1500, w: 1074, h: 1000 } }, { t: 7.08, box: { x: 48, y: 593, w: 1074, h: 1270 } }]} maxZoom={1.6} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <Tag at={0} size={64}>One table</Tag>
            <Tag at={2} size={64} dark>One cart</Tag>
            <Tag at={4} size={64}>Every phone</Tag>
          </div>
          <Phone src={`${R}p-cart-b.mp4`} from={1.2} rate={1.6} height={1000} width={600} tilt={3} shots={[{ t: 1.2, box: { x: 48, y: 700, w: 1074, h: 1200 } }, { t: 5.96, box: { x: 48, y: 1500, w: 1074, h: 1000 } }, { t: 7.1, box: { x: 48, y: 604, w: 1074, h: 1192 } }]} maxZoom={1.6} />
        </AbsoluteFill>
      </Cut>

      {/* the menu assistant, in both languages */}
      <Cut name="Assistant" from={13} to={15}>
        <PhoneStage bg={C.sun} tags={<><Tag at={1} dark>Allergic to peanuts?</Tag><Tag at={5} style={{ background: C.paper }}>Confirm with staff</Tag></>}>
          <Phone src={`${R}p-assistant.mp4`} from={0.8} rate={1.6} shots={[{ t: 0.8, box: { x: 54, y: 1900, w: 1062, h: 600 } }, { t: 4.14, box: { x: 66, y: 922, w: 913, h: 1490 }, pad: 1.05 }, { t: 5.24, box: { x: 105, y: 1700, w: 835, h: 600 } }]} maxZoom={1.8} />
        </PhoneStage>
      </Cut>
      <Cut name="Assistant 中文" from={15} to={16}>
        <PhoneStage bg={C.paper} side="right" tags={<Tag at={0.5} dark>招牌菜是什么？</Tag>}>
          <Phone src={`${R}p-assistant-zh.mp4`} from={3.0} rate={1.2} shots={[{ t: 3.0, box: { x: 66, y: 1074, w: 913, h: 1193 }, pad: 1.05 }]} maxZoom={1.5} tilt={-2} />
        </PhoneStage>
      </Cut>
      <Cut name="Menu 中文" from={16} to={17}>
        <PhoneStage bg={C.sunSoft} tags={<><Tag at={0} size={72}>炒粿条</Tag><Tag at={2} size={44} dark>Char Kway Teow</Tag></>}>
          <Phone src={`${R}p-menu-zh.mp4`} from={1.0} rate={1.2} shots={[{ t: 1.0, box: { x: 48, y: 1170, w: 1074, h: 469 }, pad: 1.1 }, { t: 3.16, box: { x: 48, y: 930, w: 1074, h: 469 }, pad: 1.1 }]} maxZoom={2.2} />
        </PhoneStage>
      </Cut>

      {/* front of house */}
      <Cut name="Host" from={17} to={20}>
        <Desk {...DESK} src={`${R}d-host.mp4`} from={0.2} rate={1} shots={[{ t: 0.2, box: { x: 230, y: 380, w: 1500, h: 900 } }, { t: 1.35, box: { x: 270, y: 693, w: 1386, h: 139 }, pad: 1.6 }, { t: 2.15, box: { x: 1900, y: 650, w: 900, h: 600 } }, { t: 3.28, box: { x: 270, y: 693, w: 1386, h: 139 }, pad: 1.6 }, { t: 3.86, box: { x: 1900, y: 800, w: 900, h: 600 } }]} maxZoom={2} tags={<><Tag at={0}>Seat with reasons</Tag><Tag at={8} dark>Floor updates live</Tag></>} />
      </Cut>
      <Cut name="Kitchen" from={20} to={22}>
        <Desk {...DESK} src={`${R}d-kitchen-zh.mp4`} from={0.6} rate={1.5} shots={[{ t: 0.6, box: { x: 232, y: 400, w: 1600, h: 1000 } }, { t: 1.25, box: { x: 232, y: 450, w: 1300, h: 800 } }, { t: 3.44, box: { x: 232, y: 500, w: 1300, h: 800 } }, { t: 4.88, box: { x: 232, y: 400, w: 2416, h: 1038 } }]} maxZoom={1.8} tags={<Tag at={0} dark>厨房 · Kitchen</Tag>} />
      </Cut>
      <Cut name="Till" from={22} to={24}>
        <Desk {...DESK} src={`${R}d-pos.mp4`} from={0.9} rate={1.9} shots={[{ t: 0.9, box: { x: 588, y: 300, w: 2000, h: 1300 } }, { t: 3.68, box: { x: 1750, y: 330, w: 980, h: 700 } }, { t: 5.6, box: { x: 1700, y: 1350, w: 1000, h: 450 } }, { t: 7.21, box: { x: 1100, y: 1450, w: 1200, h: 350 } }]} maxZoom={2.2} tags={<><Tag at={0}>Promo, points, card, cash</Tag><Tag at={5} dark>Change, counted</Tag></>} />
      </Cut>

      {/* the owner */}
      <Cut name="AI setup" from={24} to={27}>
        <Desk {...DESK} src={`${R}d-setup.mp4`} from={0.2} rate={1.2} shots={[{ t: 0.2, box: { x: 270, y: 900, w: 2340, h: 700 } }, { t: 3.4, box: { x: 270, y: 1500, w: 2340, h: 300 } }, { t: 3.96, box: { x: 270, y: 900, w: 2340, h: 800 } }, { t: 5.74, box: { x: 232, y: 300, w: 2416, h: 700 } }]} maxZoom={1.6} tags={<><Tag at={0}>Paste the menu</Tag><Tag at={5} dark>AI drafts it</Tag><Tag at={9}>Apply</Tag></>} />
      </Cut>
      <Cut name="Translate" from={27} to={29}>
        <Desk {...DESK} src={`${R}d-translate.mp4`} from={0.6} rate={1.5} shots={[{ t: 0.6, box: { x: 1700, y: 280, w: 1000, h: 500 } }, { t: 1.71, box: { x: 270, y: 450, w: 2340, h: 500 } }, { t: 4.02, box: null }]} maxZoom={2} tags={<><Tag at={0}>Translate the menu</Tag><Tag at={4} dark>EN · 中文</Tag></>} />
      </Cut>
      <Cut name="Dashboard" from={29} to={31}>
        <Desk {...DESK} src={`${R}d-boss.mp4`} from={0.4} rate={2} shots={[{ t: 0.4, box: { x: 232, y: 697, w: 2416, h: 900 } }, { t: 2.39, box: { x: 232, y: 1254, w: 2416, h: 506 } }, { t: 4.81, box: { x: 232, y: 405, w: 2416, h: 1100 } }, { t: 7.02, box: { x: 1460, y: 721, w: 1188, h: 1039 } }]} maxZoom={1.8} tags={<Tag at={0} dark>Every branch, live</Tag>} />
      </Cut>
      <Cut name="TV board" from={31} to={32}>
        <Desk vw={1920} vh={1080} w={1920} h={1080} src={`${R}d-display.mp4`} from={1.4} rate={1.8} shots={[{ t: 1.4, box: null }]} />
      </Cut>

      {/* agents, proof, close */}
      <Cut name="Agents" from={32} to={33}><AgentScene /></Cut>
      <Cut name="Wall" from={33} to={35}><WallScene /></Cut>
      <Cut name="Montage" from={35} to={37}><Montage /></Cut>
      <Cut name="Close" from={37} to={REEL_END_BAR}><CloseScene /></Cut>
    </AbsoluteFill>
  );
};
