// The Devpost demo: hook, problem, the product by persona, proof, close.
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { useVideoConfig } from "remotion";
import { C } from "./theme";
import { Close, Feature, Hook, Languages, Problem, Proof, Title } from "./scenes";

export const Demo = () => {
  const { fps } = useVideoConfig();
  const t = linearTiming({ durationInFrames: Math.round(0.4 * fps) });
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={5 * fps}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={t} />
      <TransitionSeries.Sequence name="Problem" durationInFrames={6 * fps}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={t} />
      <TransitionSeries.Sequence name="Title" durationInFrames={4 * fps}>
        <Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Guest" durationInFrames={13 * fps}>
        <Feature
          n="1"
          kicker="Guest"
          title="Scan, get a number, walk away."
          points={["Live place in line and ETA", "Preorder while you wait", "Phone buzzes when your table is ready"]}
          src="shots/zh-ticket.png"
          kind="phone"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Languages" durationInFrames={9 * fps}>
        <Languages />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Assistant" durationInFrames={9 * fps}>
        <Feature
          n="2"
          kicker="Menu assistant"
          title="Ask what's good, what's safe."
          points={["Signatures, budget and diet picks", "Allergen answers always carry a safety note", "Answers in English or 中文"]}
          src="shots/en-branch.png"
          kind="phone"
          bg={C.sunSoft}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Table" durationInFrames={9 * fps}>
        <Feature
          n="3"
          kicker="At the table"
          title="One shared cart, everyone's phone."
          points={["Scan the table QR", "Each diner adds their own dishes", "Split the bill any way"]}
          src="shots/zh-menu.png"
          kind="phone"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Host" durationInFrames={11 * fps}>
        <Feature
          n="4"
          kicker="Host stand"
          title="Seat the right party at the right table."
          points={["Suggestions with reasons", "Merges and splits tables", "Fair: nobody waits forever"]}
          src="shots/host.png"
          kind="desktop"
          bg={C.sunSoft}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Kitchen & POS" durationInFrames={11 * fps}>
        <Feature
          n="5"
          kicker="Kitchen & till"
          title="Tickets fire to the right station."
          points={["Bump to ready and served", "Splits, discounts, multi-tender, refunds", "Cash drawer shifts that balance"]}
          src="shots/kitchen-zh.png"
          kind="desktop"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Owner" durationInFrames={11 * fps}>
        <Feature
          n="6"
          kicker="Owner"
          title="Paste the menu. AI sets up the shop."
          points={["Allergens, signatures and tables drafted for review", "Every branch live on one dashboard", "Loyalty, promos and team roles"]}
          src="shots/boss.png"
          kind="desktop"
          bg={C.sunSoft}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence name="Agents" durationInFrames={8 * fps}>
        <Feature
          n="7"
          kicker="AI agents"
          title="Assistants can queue and book too."
          points={["MCP server at /mcp", "llms.txt and OpenAPI for discovery", "Merchant tools behind access tokens"]}
          src="shots/menu-zh.png"
          kind="desktop"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={t} />
      <TransitionSeries.Sequence name="Proof" durationInFrames={8 * fps}>
        <Proof />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={t} />
      <TransitionSeries.Sequence name="Close" durationInFrames={6 * fps}>
        <Close />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
