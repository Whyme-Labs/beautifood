import { Composition } from "remotion";
import "./theme";
import { Demo } from "./Demo";
import { Close, Feature, Hook, Languages, Problem, Proof, Title } from "./scenes";
import { type FeatureDemoProps, FeatureDemo, featureFrames } from "./feature";
import { Promo30, PROMO_BARS, Teaser15, TEASER_BARS } from "./promo";
import { barF } from "./reel/beat";
import { Reel } from "./reel/Reel";

const FEATURES: (FeatureDemoProps & { id: string })[] = [
  {
    id: "feature-queue",
    n: "1",
    stock: "#ffd12e",
    title: "Walk-in queue",
    sub: "Scan, get a number, walk away.",
    points: ["Live place in line and ETA", "Preorder while waiting", "Push and email when called", "Receipt in the guest's language"],
    segments: [
      { take: "join", rate: 1, note: "Party size, a name, and you have a number." },
      { take: "called", rate: 1, note: "Called the moment a table is free. Here in 中文." },
      { take: "preorder", rate: 1.2, note: "Preorder while you wait. It cooks when you sit." },
    ],
  },
  {
    id: "feature-table",
    n: "2",
    stock: "#ff8fa8",
    title: "Shared table cart",
    sub: "Everyone orders from their own phone.",
    points: ["Scan the table QR", "One cart, live on every phone", "Edit only your own dishes", "Call a waiter or the bill"],
    segments: [{ take: "cartA", take2: "cartB", rate: 1, note: "Ann in English, 美美 in 中文, one shared cart." }],
  },
  {
    id: "feature-assistant",
    n: "3",
    stock: "#7fddbf",
    title: "Menu assistant",
    sub: "Ask what's good, and what's safe.",
    points: ["Signatures, diet and budget picks", "Allergen answers with a safety note", "Stories behind the dishes", "Answers in English or 中文"],
    segments: [
      { take: "assistant", rate: 1, note: "Grounded in the menu data. Never guesses an allergen." },
      { take: "assistantZh", rate: 1, note: "Ask in 中文, get the answer in 中文." },
    ],
  },
  {
    id: "feature-host",
    n: "4",
    stock: "#bba8ff",
    title: "Host stand",
    sub: "The right party at the right table.",
    points: ["Suggestions with reasons", "Merges and splits tables", "No-shows free the table", "Fair: nobody waits forever"],
    segments: [
      { take: "host", rate: 1, note: "Seating suggestions you can read and trust." },
      { take: "board", rate: 1, note: "Called numbers go up on the TV by the door." },
    ],
  },
  {
    id: "feature-kitchen-pos",
    n: "5",
    stock: "#ffd12e",
    title: "Kitchen and till",
    sub: "Tickets to the right station. A till that balances.",
    points: ["Kitchen, bar and dessert stations", "Splits, promos, loyalty points", "Card, cash and change", "Cash drawer shifts"],
    segments: [
      { take: "kitchen", rate: 1, note: "Bump dishes from cooking to served." },
      { take: "till", rate: 1.2, note: "Promo, points, then cash with the change counted." },
    ],
  },
  {
    id: "feature-owner",
    n: "6",
    stock: "#ff8fa8",
    title: "Owner",
    sub: "Paste the menu. Run every branch.",
    points: ["AI drafts menu, allergens and tables", "Every branch on one dashboard", "Reports with menu engineering", "Team roles that limit access"],
    segments: [
      { take: "setup", rate: 1, note: "Paste the menu and the floor. Review. Apply." },
      { take: "boss", rate: 1.3, note: "Every branch live, then the reports." },
    ],
  },
  {
    id: "feature-languages",
    n: "7",
    stock: "#7fddbf",
    title: "English and 中文",
    sub: "Every screen, every email, every menu.",
    points: ["One tap switches language", "Menus translated by AI", "The owner's edits always win", "Staff screens show the original name"],
    segments: [
      { take: "menuZh", rate: 1, note: "Guests read the menu in 中文, original name underneath." },
      { take: "translate", rate: 1, note: "The owner translates the whole menu in one go." },
      { take: "kitchen", rate: 1.2, note: "The kitchen screen speaks 中文 too." },
    ],
  },
  {
    id: "feature-agents",
    n: "8",
    stock: "#bba8ff",
    title: "AI agents",
    sub: "Assistants can queue and book too.",
    points: ["MCP server at /mcp", "Menus in any supported language", "llms.txt and OpenAPI", "Merchant tools behind tokens"],
    segments: [{ clip: "clips/11-ai-agent.mp4", kind: "desktop", start: 0, len: 31, note: "Real requests and responses from the test." }],
  },
];

// 110 s of scenes minus 11 transitions of 0.4 s.
export const RemotionRoot = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={3168} fps={30} width={1920} height={1080} />
    {/* 39 bars at 112.8 BPM from the 0.892 s downbeat: 83.9 s */}
    <Composition id="Reel" component={Reel} durationInFrames={2516} fps={30} width={1920} height={1080} />
    <Composition id="Promo30" component={Promo30} durationInFrames={barF(PROMO_BARS)} fps={30} width={1920} height={1080} />
    <Composition id="Teaser15" component={Teaser15} durationInFrames={barF(TEASER_BARS)} fps={30} width={1080} height={1920} />
    {FEATURES.map(({ id, ...props }) => (
      <Composition key={id} id={id} component={FeatureDemo} durationInFrames={featureFrames(props.segments)} fps={30} width={1920} height={1080} defaultProps={props} />
    ))}
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
