import { Composition } from "remotion";
import "./theme";
import { Demo } from "./Demo";
import { Close, Feature, Hook, Languages, Problem, Proof, Title } from "./scenes";

// 110 s of scenes minus 11 transitions of 0.4 s.
export const RemotionRoot = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={3168} fps={30} width={1920} height={1080} />
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
