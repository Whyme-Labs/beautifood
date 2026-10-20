import { Fragment } from "react";
import { Composition, Still } from "remotion";
import { Thumbnail } from "./thumbnail";
import "./theme";
import { Demo } from "./Demo";
import { Close, Feature, Hook, Languages, Problem, Proof, Title } from "./scenes";
import { type FeatureDemoProps, FeatureDemo, featureFrames } from "./feature";
import { Promo30, PROMO_BARS, Teaser15, TEASER_BARS } from "./promo";
import { barF } from "./reel/beat";
import { Reel, REEL_END_BAR } from "./reel/Reel";
import { COPY, LANGS, type FeatureKey, type Lang } from "./reel/copy";
import type { TakeId } from "./reel/takes";

/** Each feature demo: its takes in order, with the copy's notes alongside. */
const FEATURES: { id: string; key: FeatureKey; n: string; stock: string; takes: ({ take: TakeId; take2?: TakeId; rate?: number } | { clip: string; kind: "desktop"; start: number; len: number })[] }[] = [
  { id: "queue", key: "queue", n: "1", stock: "#ffd12e", takes: [{ take: "join", rate: 1 }, { take: "ticket", rate: 1 }, { take: "preorder", rate: 1.2 }, { take: "phoneCall", rate: 1 }] },
  { id: "table", key: "table", n: "2", stock: "#ff8fa8", takes: [{ take: "cartA", take2: "cartB", rate: 1 }] },
  { id: "assistant", key: "assistant", n: "3", stock: "#7fddbf", takes: [{ take: "assistant", rate: 1 }, { take: "menu", rate: 1 }] },
  { id: "host", key: "host", n: "4", stock: "#bba8ff", takes: [{ take: "hostCall", rate: 1 }, { take: "board", rate: 1 }] },
  { id: "kitchen-pos", key: "kitchenPos", n: "5", stock: "#ffd12e", takes: [{ take: "kitchen", rate: 1 }, { take: "till", rate: 1.2 }] },
  { id: "owner", key: "owner", n: "6", stock: "#ff8fa8", takes: [{ take: "setup", rate: 1 }, { take: "boss", rate: 1 }, { take: "report", rate: 1 }] },
  { id: "languages", key: "languages", n: "7", stock: "#7fddbf", takes: [{ take: "translate", rate: 1 }, { take: "menu", rate: 1 }] },
  { id: "agents", key: "agents", n: "8", stock: "#bba8ff", takes: [{ clip: "clips/11-ai-agent.mp4", kind: "desktop", start: 0, len: 31 }] },
];

const featureProps = (f: (typeof FEATURES)[number], lang: Lang): FeatureDemoProps => {
  const c = COPY[lang].feature[f.key];
  return { lang, n: f.n, stock: f.stock, title: c.title, sub: c.sub, points: c.points, segments: f.takes.map((t, i) => ({ ...t, note: c.notes[i] ?? "" })) };
};

// 110 s of scenes minus 11 transitions of 0.4 s.
export const RemotionRoot = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={3168} fps={30} width={1920} height={1080} />
    {/* One of each video per language: Reel-en, Reel-zh, Promo30-en, …, feature-queue-zh. */}
    {LANGS.map((lang) => (
      <Fragment key={lang}>
        {/* 59 bars at 112.8 BPM from the 0.892 s downbeat: 126.4 s */}
        <Composition id={`Reel-${lang}`} component={Reel} durationInFrames={barF(REEL_END_BAR)} fps={30} width={1920} height={1080} defaultProps={{ lang }} />
        <Composition id={`Promo30-${lang}`} component={Promo30} durationInFrames={barF(PROMO_BARS)} fps={30} width={1920} height={1080} defaultProps={{ lang }} />
        <Composition id={`Teaser15-${lang}`} component={Teaser15} durationInFrames={barF(TEASER_BARS)} fps={30} width={1080} height={1920} defaultProps={{ lang }} />
        {FEATURES.map((f) => {
          const props = featureProps(f, lang);
          return <Composition key={f.id} id={`feature-${f.id}-${lang}`} component={FeatureDemo} durationInFrames={featureFrames(props.segments, lang)} fps={30} width={1920} height={1080} defaultProps={props} />;
        })}
      </Fragment>
    ))}
    <Still id="Thumbnail-en" component={Thumbnail} width={1280} height={720} defaultProps={{ lang: "en" as const }} />
    <Still id="Thumbnail-zh" component={Thumbnail} width={1280} height={720} defaultProps={{ lang: "zh" as const }} />
    <Composition id="Hook" component={Hook} durationInFrames={150} fps={30} width={1920} height={1080} />
    <Composition id="Problem" component={Problem} durationInFrames={180} fps={30} width={1920} height={1080} />
    <Composition id="Title" component={Title} durationInFrames={120} fps={30} width={1920} height={1080} />
    <Composition
      id="Feature"
      component={Feature}
      durationInFrames={330}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ n: "4", kicker: "Host stand", title: "Seat the right party at the right table.", points: ["Suggestions with reasons", "Merges and splits tables"], src: "shots/host.png", kind: "desktop" as const }}
    />
    <Composition id="Languages" component={Languages} durationInFrames={270} fps={30} width={1920} height={1080} />
    <Composition id="Proof" component={Proof} durationInFrames={240} fps={30} width={1920} height={1080} />
    <Composition id="Close" component={Close} durationInFrames={180} fps={30} width={1920} height={1080} />
  </>
);
