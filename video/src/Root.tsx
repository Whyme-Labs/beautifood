import { Composition } from "remotion";
import "./theme";
import { Demo } from "./Demo";
import { Close, Feature, Hook, Languages, Problem, Proof, Title } from "./scenes";
import { FeatureDemo } from "./feature";
import { Promo30, Teaser15 } from "./promo";

// 110 s of scenes minus 11 transitions of 0.4 s.
export const RemotionRoot = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={3168} fps={30} width={1920} height={1080} />
    <Composition id="Promo30" component={Promo30} durationInFrames={900} fps={30} width={1920} height={1080} />
    <Composition id="Teaser15" component={Teaser15} durationInFrames={450} fps={30} width={1080} height={1920} />
    <Composition
      id="feature-queue"
      component={FeatureDemo}
      durationInFrames={1500}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "1",
        stock: "#ffd12e",
        title: "Walk-in queue",
        sub: "Scan, get a number, walk away.",
        points: ["Live place in line and ETA", "Preorder while waiting", "Push and email when called", "Receipt in the guest's language"],
        segments: [
          { clip: "clips/01-guest-walk-in.mp4", kind: "phone" as const, start: 2, len: 14, note: "Every branch's live queue, then join from the phone." },
          { clip: "clips/01-guest-walk-in.mp4", kind: "phone" as const, start: 16, len: 14, note: "A ticket with your place, your wait and a preorder." },
          { clip: "clips/01-guest-walk-in.mp4", kind: "phone" as const, start: 30, len: 17, note: "Called, seated, order more, pay. All in 中文." },
        ],
      }}
    />
    <Composition
      id="feature-table"
      component={FeatureDemo}
      durationInFrames={750}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "2",
        stock: "#ff8fa8",
        title: "Shared table cart",
        sub: "Everyone orders from their own phone.",
        points: ["Scan the table QR", "One cart, live on every phone", "Edit only your own dishes", "Call a waiter or the bill"],
        segments: [
          { clip: "clips/02-diner-group-a.mp4", kind: "phone" as const, start: 0, len: 20, clip2: "clips/02-diner-group-b.mp4", start2: 0, note: "Ann in English, 美美 in 中文, one shared cart." },
        ],
      }}
    />
    <Composition
      id="feature-assistant"
      component={FeatureDemo}
      durationInFrames={1050}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "3",
        stock: "#7fddbf",
        title: "Menu assistant",
        sub: "Ask what's good, and what's safe.",
        points: ["Signatures, diet and budget picks", "Allergen answers with a safety note", "Stories behind the dishes", "Answers in English or 中文"],
        segments: [{ clip: "clips/03-ai-menu-assistant.mp4", kind: "phone" as const, start: 0, len: 30, note: "Grounded in the menu data. Never guesses an allergen." }],
      }}
    />
    <Composition
      id="feature-host"
      component={FeatureDemo}
      durationInFrames={1230}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "4",
        stock: "#bba8ff",
        title: "Host stand",
        sub: "The right party at the right table.",
        points: ["Suggestions with reasons", "Merges and splits tables", "No-shows free the table", "Fair: nobody waits forever"],
        segments: [
          { clip: "clips/04-host.mp4", kind: "desktop" as const, start: 0, len: 16, note: "Seating suggestions you can read and trust." },
          { clip: "clips/04-host.mp4", kind: "desktop" as const, start: 16, len: 20, note: "Merge, split, move parties, seat walk-ins." },
        ],
      }}
    />
    <Composition
      id="feature-kitchen-pos"
      component={FeatureDemo}
      durationInFrames={1500}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "5",
        stock: "#ffd12e",
        title: "Kitchen and till",
        sub: "Tickets to the right station. A till that balances.",
        points: ["Kitchen, bar and dessert stations", "Splits, promos, loyalty points", "Card, cash and change", "Cash drawer shifts"],
        segments: [
          { clip: "clips/05-kitchen.mp4", kind: "desktop" as const, start: 0, len: 15, note: "Bump dishes from cooking to served." },
          { clip: "clips/06-cashier.mp4", kind: "desktop" as const, start: 0, len: 30, note: "Every way a table wants to pay." },
        ],
      }}
    />
    <Composition
      id="feature-owner"
      component={FeatureDemo}
      durationInFrames={1770}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "6",
        stock: "#ff8fa8",
        title: "Owner",
        sub: "Paste the menu. Run every branch.",
        points: ["AI drafts menu, allergens and tables", "Every branch on one dashboard", "Reports with menu engineering", "Team roles that limit access"],
        segments: [
          { clip: "clips/07-owner.mp4", kind: "desktop" as const, start: 0, len: 12, note: "Paste the menu and the floor. Review. Apply." },
          { clip: "clips/07-owner.mp4", kind: "desktop" as const, start: 12, len: 18, note: "Translate the menu and tune each branch." },
          { clip: "clips/07-owner.mp4", kind: "desktop" as const, start: 30, len: 24, note: "Dashboard, reports and a cashier who sees only the till." },
        ],
      }}
    />
    <Composition
      id="feature-languages"
      component={FeatureDemo}
      durationInFrames={990}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "7",
        stock: "#7fddbf",
        title: "English and 中文",
        sub: "Every screen, every email, every menu.",
        points: ["One tap switches language", "Menus translated by AI", "The owner's edits always win", "Staff screens show the original name"],
        segments: [
          { clip: "clips/01-guest-walk-in.mp4", kind: "phone" as const, start: 10, len: 12, note: "Guests switch to 中文 and it sticks." },
          { clip: "clips/07-owner.mp4", kind: "desktop" as const, start: 12, len: 10, note: "The owner translates the menu and fixes one dish." },
          { clip: "clips/05-kitchen.mp4", kind: "desktop" as const, start: 9, len: 6, note: "The kitchen reads 中文 with the original underneath." },
        ],
      }}
    />
    <Composition
      id="feature-agents"
      component={FeatureDemo}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        n: "8",
        stock: "#bba8ff",
        title: "AI agents",
        sub: "Assistants can queue and book too.",
        points: ["MCP server at /mcp", "Menus in any supported language", "llms.txt and OpenAPI", "Merchant tools behind tokens"],
        segments: [{ clip: "clips/11-ai-agent.mp4", kind: "desktop" as const, start: 0, len: 31, note: "Real requests and responses from the test." }],
      }}
    />
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
