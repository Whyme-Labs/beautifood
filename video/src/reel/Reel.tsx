// The Devpost reel: no voiceover, so the story is told in motion. Cuts land on the soundtrack's downbeats.
import type React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { barF, barsF, clamp, ease } from "./beat";
import {
  AgentScene, AskScene, BossScene, CartScene, Clip, CloseScene, CrowdScene, DropScene, FloorScene,
  KitchenScene, LangScene, MontageScene, PaperScene, ScanScene, SetupScene, Tag, TillScene, WallScene,
} from "./scenes";

export const REEL_END_BAR = 42;

/** Every cut opens with a small punch-in so it hits with the beat. */
const Hit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 7], [1.045, 1], { ...clamp, easing: ease });
  return <AbsoluteFill style={{ scale: String(s) }}>{children}</AbsoluteFill>;
};

const Footage: React.FC<{ bg: string; children: React.ReactNode; tags?: React.ReactNode }> = ({ bg, children, tags }) => (
  <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 60 }}>
    {children}
    {tags && <div style={{ position: "absolute", left: 110, bottom: 110, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>{tags}</div>}
  </AbsoluteFill>
);

const Cut: React.FC<{ from: number; to: number; name: string; children: React.ReactNode }> = ({ from, to, name, children }) => (
  <Sequence name={name} from={from === 0 ? 0 : barF(from)} durationInFrames={from === 0 ? barF(to) : barsF(from, to)}>
    <Hit>{children}</Hit>
  </Sequence>
);

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const volume = interpolate(frame, [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 2], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Audio src={staticFile("audio/bgm.m4a")} volume={volume} />

      <Cut name="Crowd" from={0} to={2}><CrowdScene /></Cut>
      <Cut name="Paper" from={2} to={4}><PaperScene /></Cut>
      <Cut name="Scan" from={4} to={8}><ScanScene /></Cut>
      <Cut name="Drop" from={8} to={9}><DropScene /></Cut>

      <Cut name="Guest footage" from={9} to={12}>
        <Footage bg={C.paper} tags={<><Tag at={0}>Live place in line</Tag><Tag at={4}>Preorder while waiting</Tag><Tag at={8} dark>中文 in one tap</Tag></>}>
          <Clip src="clips/01-guest-walk-in.mp4" kind="phone" height={900} start={12} rate={1.3} zoom={[{ t: 0, s: 1, x: 0.5, y: 0.3 }, { t: 1.6, s: 1.5, x: 0.5, y: 0.15 }, { t: 3.4, s: 1.5, x: 0.5, y: 0.15 }, { t: 4.4, s: 1, x: 0.5, y: 0.4 }]} style={{ marginLeft: 600 }} />
        </Footage>
      </Cut>

      <Cut name="Cart" from={12} to={14}><CartScene /></Cut>
      <Cut name="Cart footage" from={14} to={15}>
        <Footage bg={C.sunSoft}>
          <Clip src="clips/02-diner-group-a.mp4" kind="phone" height={880} start={8} rate={1.4} style={{ rotate: "-4deg" }} />
          <Clip src="clips/02-diner-group-b.mp4" kind="phone" height={880} start={8} rate={1.4} style={{ rotate: "4deg" }} />
        </Footage>
      </Cut>

      <Cut name="Ask" from={15} to={17}><AskScene /></Cut>
      <Cut name="Ask footage" from={17} to={18}>
        <Footage bg={C.paper}>
          <Clip src="clips/03-ai-menu-assistant.mp4" kind="phone" height={900} start={6} rate={1.5} zoom={[{ t: 0, s: 1.3, x: 0.5, y: 0.6 }]} />
        </Footage>
      </Cut>

      <Cut name="Floor" from={18} to={21}><FloorScene /></Cut>
      <Cut name="Host footage" from={21} to={23}>
        <Footage bg={C.sunSoft} tags={<Tag at={1} dark>Suggestions with reasons</Tag>}>
          <Clip src="clips/04-host.mp4" kind="desktop" height={820} start={2} rate={1.3} zoom={[{ t: 0, s: 1, x: 0.3, y: 0.4 }, { t: 1.2, s: 1.8, x: 0.25, y: 0.45 }, { t: 3.6, s: 1.8, x: 0.25, y: 0.45 }]} />
        </Footage>
      </Cut>

      <Cut name="Kitchen" from={23} to={25}><KitchenScene /></Cut>
      <Cut name="Till" from={25} to={27}><TillScene /></Cut>

      <Cut name="Setup" from={27} to={29}><SetupScene /></Cut>
      <Cut name="Owner footage" from={29} to={31}>
        <Footage bg={C.paper} tags={<Tag at={1} dark>Paste. Review. Apply.</Tag>}>
          <Clip src="clips/07-owner.mp4" kind="desktop" height={820} start={4} rate={1.4} zoom={[{ t: 0, s: 1, x: 0.5, y: 0.4 }, { t: 2, s: 1.45, x: 0.45, y: 0.35 }]} />
        </Footage>
      </Cut>
      <Cut name="Boss" from={31} to={32}><BossScene /></Cut>

      <Cut name="Languages" from={32} to={34}><LangScene /></Cut>
      <Cut name="Agents" from={34} to={36}><AgentScene /></Cut>
      <Cut name="Wall" from={36} to={38}><WallScene /></Cut>
      <Cut name="Montage" from={38} to={40}>
        <MontageScene
          clips={[
            { src: "clips/small/01-guest-walk-in.mp4", kind: "phone" },
            { src: "clips/small/04-host.mp4", kind: "desktop" },
            { src: "clips/small/02-diner-group-a.mp4", kind: "phone" },
            { src: "clips/small/05-kitchen.mp4", kind: "desktop" },
            { src: "clips/small/03-ai-menu-assistant.mp4", kind: "phone" },
            { src: "clips/small/06-cashier.mp4", kind: "desktop" },
            { src: "clips/small/02-diner-group-b.mp4", kind: "phone" },
            { src: "clips/small/07-owner.mp4", kind: "desktop" },
            { src: "clips/small/09-booking-guest.mp4", kind: "phone" },
            { src: "clips/small/08-marketing.mp4", kind: "desktop" },
            { src: "clips/small/10-display-tv.mp4", kind: "desktop" },
            { src: "clips/small/11-ai-agent.mp4", kind: "desktop" },
          ]}
        />
      </Cut>
      <Cut name="Close" from={40} to={REEL_END_BAR}><CloseScene /></Cut>
    </AbsoluteFill>
  );
};
