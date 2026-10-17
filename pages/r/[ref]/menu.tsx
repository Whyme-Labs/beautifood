// Public menu display (server-rendered, with schema.org JSON-LD for search engines and AI agents).
import { useState } from "react";
import type { Props } from "./menu.server";
import { Logo, Modal } from "../../../src/ui/components";
import { MenuList } from "../../../src/ui/menuList";
import { AssistantChat } from "../../../src/ui/chat";

export default function MenuPage(p: Props) {
  const [chat, setChat] = useState(false);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: `${p.restaurant} ${p.branch}`,
    servesCuisine: p.cuisine || undefined,
    address: p.address || undefined,
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: p.menu.categories.map((c) => ({
        "@type": "MenuSection",
        name: c.name,
        hasMenuItem: p.menu.items
          .filter((i) => i.categoryId === c.id)
          .map((i) => ({ "@type": "MenuItem", name: i.name, description: i.description || undefined, offers: { "@type": "Offer", price: (i.price / 100).toFixed(2), priceCurrency: p.currency }, suitableForDiet: i.dietary.includes("vegan") ? "https://schema.org/VeganDiet" : i.dietary.includes("vegetarian") ? "https://schema.org/VegetarianDiet" : undefined })),
      })),
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <a href={`/r/${p.ref}`}>
            ← {p.restaurant} {p.branch}
          </a>
          <span style={{ flex: 1 }} />
          {p.aiAssistant && (
            <button className="btn small" onClick={() => setChat(true)}>
              💬 Ask
            </button>
          )}
        </div>
      </header>
      <main className="narrow">
        <h1>Menu</h1>
        {p.menuDisplay ? <MenuList menu={p.menu as never} currency={p.currency} /> : <p className="muted">The menu isn't published online for this branch.</p>}
      </main>
      <Modal open={chat} onClose={() => setChat(false)} title="Menu assistant">
        <AssistantChat branch={p.ref} currency={p.currency} />
      </Modal>
    </>
  );
}
